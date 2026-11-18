import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getOutputChannel } from "../extension";
import {
	ConflictParseError,
	ParsedConflicts,
	applyResolutionLines,
	contentHasConflictMarkers,
	parseConflictedText,
} from "../merge/conflicts";
import {
	GitError,
	OperationKind,
	UnmergedFile,
	collectWorkspaceUnmerged,
	detectOperation,
	getUnmergedFile,
	listUnmerged,
	operationCopy,
	stagePath,
	takeSide,
} from "../merge/git";
import { MergeConflictPanel, ResolutionPayload } from "../merge/panel";

const MAX_CONFLICTS = 80;

export async function showMergeConflictResolver(
	extensionUri: vscode.Uri,
	arg?: unknown,
): Promise<void> {
	try {
		const explicit = coerceUri(arg);
		if (explicit) {
			if (explicit.scheme !== "file") {
				vscode.window.showErrorMessage("Merge conflicts can only be resolved for files on disk.");
				return;
			}
			if (fs.existsSync(explicit.fsPath) && fs.statSync(explicit.fsPath).isDirectory()) {
				vscode.window.showInformationMessage("Choose a conflicted file, not a folder.");
				return;
			}
			await openPath(extensionUri, explicit.fsPath);
			return;
		}

		const active = vscode.window.activeTextEditor?.document;
		if (active?.uri.scheme === "file") {
			const unmerged = await findUnmerged(active.uri.fsPath);
			if (unmerged) {
				await openUnmerged(extensionUri, unmerged);
				return;
			}
		}

		await pickAndOpen(extensionUri);
	} catch (error) {
		report(error, "Could not open the merge resolver");
	}
}

async function openPath(extensionUri: vscode.Uri, fsPath: string): Promise<void> {
	let file: UnmergedFile | undefined;
	try {
		file = await getUnmergedFile(fsPath);
	} catch (error) {
		if (isOutsideRepo(error)) {
			vscode.window.showErrorMessage("This file is not in a Git repository.");
			return;
		}
		throw error;
	}
	if (!file) {
		vscode.window.showInformationMessage("This file has no unmerged changes.");
		return;
	}
	await openUnmerged(extensionUri, file);
}

async function findUnmerged(fsPath: string): Promise<UnmergedFile | undefined> {
	try {
		return await getUnmergedFile(fsPath);
	} catch (error) {
		if (isOutsideRepo(error)) {
			return undefined;
		}
		throw error;
	}
}

async function pickAndOpen(extensionUri: vscode.Uri): Promise<void> {
	const folders = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
	if (folders.length === 0) {
		vscode.window.showErrorMessage("Open a folder that is a Git repository first.");
		return;
	}

	const files = await collectWorkspaceUnmerged(folders);
	if (files.length === 0) {
		vscode.window.showInformationMessage("No merge conflicts in this workspace.");
		return;
	}
	if (files.length === 1) {
		await openUnmerged(extensionUri, files[0]);
		return;
	}

	const roots = new Set(files.map((file) => file.repoRoot));
	const picked = await vscode.window.showQuickPick(
		files.map((file) => ({
			label: roots.size > 1 ? `${path.basename(file.repoRoot)}/${file.relativePath}` : file.relativePath,
			description: describeUnmerged(file),
			file,
		})),
		{ placeHolder: "Select a conflicted file" },
	);
	if (!picked) {
		return;
	}
	await openUnmerged(extensionUri, picked.file);
}

async function openUnmerged(extensionUri: vscode.Uri, file: UnmergedFile): Promise<void> {
	const operation = await detectOperation(file.repoRoot);
	getOutputChannel().appendLine(
		`Opening ${file.relativePath} (${operation}, stages ${file.stages.join(",") || "none"})`,
	);

	if (file.binary || !file.exists || !file.stages.includes(2) || !file.stages.includes(3)) {
		await chooseSide(extensionUri, file, operation, { allowStage: false });
		return;
	}
	if (file.large) {
		await chooseSide(extensionUri, file, operation, {
			allowStage: false,
			intro: "This file is too large for the 3-column editor.",
		});
		return;
	}

	let text: string;
	try {
		text = fs.readFileSync(file.absolutePath, "utf8");
	} catch (error) {
		report(error, "Could not read the conflicted file");
		return;
	}

	let parsed: ParsedConflicts;
	try {
		parsed = parseConflictedText(text);
	} catch (error) {
		if (error instanceof ConflictParseError) {
			await chooseSide(extensionUri, file, operation, { allowStage: false, intro: error.message });
			return;
		}
		throw error;
	}

	if (parsed.conflicts.length === 0) {
		await chooseSide(extensionUri, file, operation, {
			allowStage: true,
			intro: "Git still lists this file as unmerged, and it has no conflict markers.",
		});
		return;
	}
	if (parsed.conflicts.length > MAX_CONFLICTS) {
		await chooseSide(extensionUri, file, operation, {
			allowStage: false,
			intro: `This file has ${parsed.conflicts.length} conflicts, which is too many for the 3-column editor.`,
		});
		return;
	}

	const copy = operationCopy(operation);
	await MergeConflictPanel.open({
		extensionUri,
		file,
		parsed,
		originalText: text,
		currentHeading: copy.current,
		incomingHeading: copy.incoming,
		note: copy.note,
		onSave: (resolutions) => saveMerge(file, parsed, text, resolutions),
		onAfterSave: () => offerNext(extensionUri, file),
	});
}

async function chooseSide(
	extensionUri: vscode.Uri,
	file: UnmergedFile,
	operation: OperationKind,
	options: { allowStage: boolean; intro?: string },
): Promise<void> {
	const copy = operationCopy(operation);
	const items: Array<vscode.QuickPickItem & { action: "ours" | "theirs" | "stage" | "open" }> = [
		sideChoice(file, "ours", copy.current),
		sideChoice(file, "theirs", copy.incoming),
	];
	if (options.allowStage) {
		items.push({
			label: "Stage the file as it is",
			description: file.relativePath,
			action: "stage",
		});
	}
	if (file.exists) {
		items.push({ label: "Open the file", description: file.relativePath, action: "open" });
	}

	const picked = await vscode.window.showQuickPick(items, {
		title: file.relativePath,
		placeHolder: options.intro ?? `Choose a version of ${file.relativePath}`,
	});
	if (!picked) {
		return;
	}

	try {
		if (picked.action === "open") {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file.absolutePath));
			await vscode.window.showTextDocument(document);
			return;
		}
		if (picked.action === "stage") {
			await stagePath(file.repoRoot, file.relativePath);
		} else {
			await takeSide(file, picked.action);
		}
		getOutputChannel().appendLine(`Resolved ${file.relativePath} with ${picked.action}`);
		await offerNext(extensionUri, file);
	} catch (error) {
		report(error, `Could not resolve ${file.relativePath}`);
	}
}

function sideChoice(
	file: UnmergedFile,
	side: "ours" | "theirs",
	name: string,
): vscode.QuickPickItem & { action: "ours" | "theirs" } {
	const present = file.stages.includes(side === "ours" ? 2 : 3);
	return {
		label: present ? `Keep ${name}` : `Accept deletion from ${name}`,
		description: file.relativePath,
		action: side,
	};
}

async function saveMerge(
	file: UnmergedFile,
	parsed: ParsedConflicts,
	originalText: string,
	resolutions: ResolutionPayload[],
): Promise<boolean> {
	const merged = applyResolutionLines(
		parsed,
		new Map(resolutions.map((resolution) => [resolution.id, resolution.lines])),
	);
	if (contentHasConflictMarkers(merged)) {
		const choice = await vscode.window.showWarningMessage(
			"The result still contains conflict markers.",
			{ modal: true },
			"Stage anyway",
		);
		if (choice !== "Stage anyway") {
			return false;
		}
	}

	let disk: string;
	try {
		disk = fs.readFileSync(file.absolutePath, "utf8");
	} catch (error) {
		report(error, "The conflicted file is no longer readable");
		return false;
	}
	if (disk !== originalText && disk !== merged) {
		vscode.window.showErrorMessage("The file changed on disk. Close the merge editor and open it again.");
		return false;
	}

	const uri = vscode.Uri.file(file.absolutePath);
	const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
	const editorDiffers = open !== undefined && open.getText() !== merged;
	if (open?.isDirty && editorDiffers) {
		const choice = await vscode.window.showWarningMessage(
			`${file.relativePath} has unsaved edits. Staging the merge replaces them.`,
			{ modal: true },
			"Replace",
		);
		if (choice !== "Replace") {
			return false;
		}
	}

	if (disk !== merged || editorDiffers) {
		const document = open ?? (await vscode.workspace.openTextDocument(uri));
		const edit = new vscode.WorkspaceEdit();
		edit.replace(
			uri,
			new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
			merged,
		);
		const applied = await vscode.workspace.applyEdit(edit);
		if (!applied) {
			vscode.window.showErrorMessage("Could not update the editor with the merged file.");
			return false;
		}
		const saved = await document.save();
		if (!saved) {
			vscode.window.showErrorMessage("Could not save the merged file.");
			return false;
		}
	}

	try {
		await stagePath(file.repoRoot, file.relativePath);
	} catch (error) {
		report(error, "The file was saved, but Git could not stage it");
		return false;
	}

	getOutputChannel().appendLine(`Staged ${file.relativePath}`);
	return true;
}

async function offerNext(extensionUri: vscode.Uri, file: UnmergedFile): Promise<void> {
	let remaining: UnmergedFile[] = [];
	try {
		remaining = (await listUnmerged(file.repoRoot)).filter(
			(entry) => entry.relativePath !== file.relativePath,
		);
	} catch (error) {
		report(error, "The file was staged, but the remaining conflicts could not be listed");
		return;
	}

	if (remaining.length === 0) {
		void vscode.window.showInformationMessage(
			`Staged ${file.relativePath}. All conflicted files are staged. Commit when you're ready.`,
		);
		return;
	}

	const noun = remaining.length === 1 ? "file" : "files";
	const choice = await vscode.window.showInformationMessage(
		`Staged ${file.relativePath}. ${remaining.length} conflicted ${noun} left.`,
		"Next file",
	);
	if (choice === "Next file") {
		await openUnmerged(extensionUri, remaining[0]);
	}
}

function describeUnmerged(file: UnmergedFile): string {
	if (file.binary) {
		return "Binary";
	}
	if (!file.stages.includes(2) && !file.stages.includes(3)) {
		return "Deleted on both sides";
	}
	if (!file.stages.includes(2)) {
		return "Deleted by current";
	}
	if (!file.stages.includes(3)) {
		return "Deleted by incoming";
	}
	if (!file.exists) {
		return "Missing from the working tree";
	}
	if (file.large) {
		return "Too large for the 3-column editor";
	}
	return "Content conflict";
}

function coerceUri(arg: unknown): vscode.Uri | undefined {
	if (arg instanceof vscode.Uri) {
		return arg;
	}
	if (Array.isArray(arg)) {
		for (const item of arg) {
			const uri = coerceUri(item);
			if (uri) {
				return uri;
			}
		}
		return undefined;
	}
	if (arg && typeof arg === "object") {
		const record = arg as { resourceUri?: unknown; uri?: unknown };
		if (record.resourceUri instanceof vscode.Uri) {
			return record.resourceUri;
		}
		if (record.uri instanceof vscode.Uri) {
			return record.uri;
		}
	}
	return undefined;
}

function isOutsideRepo(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /not a git repository/i.test(message);
}

function report(error: unknown, prefix: string): void {
	const message = error instanceof Error ? error.message : String(error);
	const detail = message.split("\n").find((line) => line.trim().length > 0) ?? message;
	void vscode.window.showErrorMessage(`${prefix}: ${detail}`);
	getOutputChannel().appendLine(`${prefix}: ${message}`);
	if (error instanceof GitError) {
		return;
	}
	console.error("GitPlus:", error);
}
