import * as vscode from "vscode";
import { getUnmergedFile } from "./git";

const MAX_LINES = 100_000;

export function watchConflictMarkers(context: vscode.ExtensionContext): void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let generation = 0;

	const publish = (hasConflicts: boolean) => {
		void vscode.commands.executeCommand("setContext", "gitplus.fileHasConflicts", hasConflicts);
	};

	const schedule = (editor: vscode.TextEditor | undefined) => {
		if (timer) {
			clearTimeout(timer);
		}
		const token = ++generation;
		timer = setTimeout(() => {
			void publishFor(editor, token);
		}, 150);
	};

	const publishFor = async (editor: vscode.TextEditor | undefined, token: number) => {
		const document = editor?.document;
		if (!documentHasConflictMarkers(document) || !document) {
			if (token === generation) {
				publish(false);
			}
			return;
		}

		try {
			const unmerged = await getUnmergedFile(document.uri.fsPath);
			if (token === generation) {
				publish(Boolean(unmerged));
			}
		} catch {
			if (token === generation) {
				publish(false);
			}
		}
	};

	schedule(vscode.window.activeTextEditor);
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => schedule(editor)),
		vscode.workspace.onDidChangeTextDocument((event) => {
			const active = vscode.window.activeTextEditor;
			if (active && event.document === active.document) {
				schedule(active);
			}
		}),
		new vscode.Disposable(() => {
			if (timer) {
				clearTimeout(timer);
			}
		}),
	);
}

export function documentHasConflictMarkers(document: vscode.TextDocument | undefined): boolean {
	if (!document || document.uri.scheme !== "file" || document.lineCount > MAX_LINES) {
		return false;
	}

	let open = false;
	for (let index = 0; index < document.lineCount; index++) {
		const line = document.lineAt(index).text;
		if (!open) {
			if (/^<{7}/.test(line)) {
				open = true;
			}
		} else if (/^>{7}/.test(line)) {
			return true;
		}
	}
	return false;
}
