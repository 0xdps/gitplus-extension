import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface CommitInfo {
	hash: string;
	author: string;
	date: string;
	message: string;
}

export async function showFileHistory(uri?: vscode.Uri) {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

		if (!workspaceFolder) {
			vscode.window.showErrorMessage(
				"No workspace folder found. Please open a workspace.",
			);
			return;
		}

		const workspacePath = workspaceFolder.uri.fsPath;

		// Get file path
		let filePath: string;
		if (uri) {
			filePath = uri.fsPath;
		} else {
			// If no URI provided, ask user to select a file
			const fileUri = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: "Select File",
			});

			if (!fileUri || fileUri.length === 0) {
				return;
			}

			filePath = fileUri[0].fsPath;
		}

		try {
			// Check if it's a git repository
			await execAsync("git rev-parse --git-dir", { cwd: workspacePath });
		} catch (error) {
			vscode.window.showErrorMessage(
				"Not a Git repository. Please initialize Git first.",
			);
			return;
		}

		try {
			// Get relative path from workspace root
			const relativePath = vscode.workspace.asRelativePath(filePath);

			// Get commit history for the file
			const { stdout: logOutput } = await execAsync(
				`git log --follow --pretty=format:"%H|%an|%ad|%s" --date=iso -- "${relativePath}"`,
				{ cwd: workspacePath },
			);

			if (!logOutput.trim()) {
				vscode.window.showInformationMessage(
					`No Git history found for ${relativePath}`,
				);
				return;
			}

			// Parse commit information
			const commits: CommitInfo[] = logOutput
				.trim()
				.split("\n")
				.map((line) => {
					const [hash, author, date, ...messageParts] = line.split("|");
					return {
						hash: hash || "",
						author: author || "Unknown",
						date: date || "",
						message: messageParts.join("|") || "No message",
					};
				})
				.filter((commit) => commit.hash);

			if (commits.length === 0) {
				vscode.window.showInformationMessage(
					`No commits found for ${relativePath}`,
				);
				return;
			}

			// Show commit list in quick pick
			const items = commits.map((commit) => ({
				label: commit.message,
				description: `${commit.author} • ${formatDate(commit.date)}`,
				detail: `Hash: ${commit.hash.substring(0, 8)}`,
				commit: commit,
				filePath: relativePath,
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: `Select a commit to view details for ${relativePath}`,
				canPickMany: false,
			});

			if (!selected) {
				return;
			}

			// Check if this is the HEAD commit (last commit)
			const { stdout: headHash } = await execAsync("git rev-parse HEAD", {
				cwd: workspacePath,
			});
			const isHeadCommit = selected.commit.hash.trim() === headHash.trim();

			// Build action options
			const actions = [
				{ label: "View File Content", value: "content" },
				{ label: "View Diff", value: "diff" },
				{ label: "View Commit Details", value: "details" },
			];

			// Add Edit Message option if this is the HEAD commit
			if (isHeadCommit) {
				actions.unshift({ label: "$(edit) Edit Message", value: "edit" });
			}

			// Show options for the selected commit
			const action = await vscode.window.showQuickPick(actions, {
				placeHolder: `What would you like to do with commit ${selected.commit.hash.substring(0, 8)}?`,
			});

			if (!action) {
				return;
			}

			await handleCommitAction(
				action.value,
				selected.commit,
				relativePath,
				workspacePath,
			);
		} catch (error: any) {
			const errorMessage =
				error?.message || error?.toString() || "Unknown error occurred";
			vscode.window.showErrorMessage(
				`Failed to get file history: ${errorMessage}`,
			);
			console.error("GitPlus: Error showing file history:", error);
		}
	} catch (error: any) {
		const errorMessage =
			error?.message || error?.toString() || "Unknown error occurred";
		vscode.window.showErrorMessage(
			`GitPlus: Unexpected error: ${errorMessage}`,
		);
		console.error("GitPlus: Unexpected error in showFileHistory:", error);
	}
}

async function handleCommitAction(
	action: string,
	commit: CommitInfo,
	filePath: string,
	workspacePath: string,
) {
	try {
		switch (action) {
			case "edit":
				await editCommitMessage(commit, workspacePath);
				break;
			case "content":
				await showFileContent(commit.hash, filePath, workspacePath);
				break;
			case "diff":
				await showDiff(commit.hash, filePath, workspacePath);
				break;
			case "details":
				await showCommitDetails(commit, workspacePath);
				break;
		}
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to ${action}: ${error.message}`);
	}
}

async function showFileContent(
	hash: string,
	filePath: string,
	workspacePath: string,
) {
	try {
		// Try to get file content at that commit
		// Note: filePath might have been renamed, so we need to find the actual path at that commit
		const { stdout: content } = await execAsync(
			`git show ${hash}:${filePath}`,
			{ cwd: workspacePath },
		);

		const doc = await vscode.workspace.openTextDocument({
			content: content,
			language: getLanguageFromPath(filePath),
		});

		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(
			`Showing file content at commit ${hash.substring(0, 8)}`,
		);
	} catch (error: any) {
		// File might have been deleted or renamed at that commit
		if (
			error.message.includes("does not exist") ||
			error.message.includes("No such file")
		) {
			vscode.window.showWarningMessage(
				`File does not exist at commit ${hash.substring(0, 8)}. It may have been deleted or renamed.`,
			);
		} else {
			vscode.window.showErrorMessage(
				`Failed to show file content: ${error.message}`,
			);
		}
	}
}

async function showDiff(hash: string, filePath: string, workspacePath: string) {
	try {
		// Check if this is the first commit (no parent)
		let parentHash: string;
		try {
			const { stdout } = await execAsync(`git rev-parse ${hash}^`, {
				cwd: workspacePath,
			});
			parentHash = stdout.trim();
		} catch {
			// First commit - show all file content as addition
			const { stdout: content } = await execAsync(
				`git show ${hash}:${filePath}`,
				{ cwd: workspacePath },
			);
			const doc = await vscode.workspace.openTextDocument({
				content: `--- /dev/null\n+++ ${filePath}\n${content
					.split("\n")
					.map((line) => `+${line}`)
					.join("\n")}`,
				language: "diff",
			});
			await vscode.window.showTextDocument(doc);
			vscode.window.showInformationMessage(
				`Showing file addition for commit ${hash.substring(0, 8)} (first commit)`,
			);
			return;
		}

		// Get diff between parent and current commit
		const { stdout: diff } = await execAsync(
			`git diff ${parentHash} ${hash} -- "${filePath}"`,
			{ cwd: workspacePath },
		);

		const doc = await vscode.workspace.openTextDocument({
			content: diff || "No changes found",
			language: "diff",
		});

		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(
			`Showing diff for commit ${hash.substring(0, 8)}`,
		);
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to show diff: ${error.message}`);
	}
}

async function showCommitDetails(commit: CommitInfo, workspacePath: string) {
	try {
		const { stdout: fullDetails } = await execAsync(
			`git show --stat ${commit.hash}`,
			{ cwd: workspacePath },
		);

		const doc = await vscode.workspace.openTextDocument({
			content: `Commit: ${commit.hash}\nAuthor: ${commit.author}\nDate: ${commit.date}\n\nMessage:\n${commit.message}\n\n---\n\n${fullDetails}`,
			language: "plaintext",
		});

		await vscode.window.showTextDocument(doc);
	} catch (error: any) {
		vscode.window.showErrorMessage(
			`Failed to show commit details: ${error.message}`,
		);
	}
}

function formatDate(dateString: string): string {
	try {
		const date = new Date(dateString);
		return date.toLocaleString();
	} catch {
		return dateString;
	}
}

async function editCommitMessage(commit: CommitInfo, workspacePath: string) {
	try {
		// Show input box with current message
		const newMessage = await vscode.window.showInputBox({
			prompt: "Enter new commit message",
			value: commit.message,
			placeHolder: "Enter your updated commit message",
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return "Commit message cannot be empty";
				}
				return null;
			},
		});

		if (!newMessage) {
			return; // User cancelled
		}

		// Show confirmation dialog
		const confirm = await vscode.window.showWarningMessage(
			"This will amend the last commit. Continue?",
			{ modal: true },
			"Yes",
		);

		if (confirm !== "Yes") {
			return;
		}

		// Amend the commit
		await execAsync(
			`git commit --amend -m "${newMessage.replace(/"/g, '\\"')}"`,
			{
				cwd: workspacePath,
			},
		);

		vscode.window.showInformationMessage(
			"✓ Commit message updated successfully!",
		);
	} catch (error: any) {
		const errorMessage =
			error?.message || error?.toString() || "Unknown error occurred";
		vscode.window.showErrorMessage(
			`Failed to edit commit message: ${errorMessage}`,
		);
		console.error("GitPlus: Error editing commit message:", error);
	}
}

function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase();
	const languageMap: { [key: string]: string } = {
		js: "javascript",
		ts: "typescript",
		py: "python",
		java: "java",
		cpp: "cpp",
		c: "c",
		html: "html",
		css: "css",
		json: "json",
		md: "markdown",
		xml: "xml",
		yaml: "yaml",
		yml: "yaml",
	};
	return languageMap[ext || ""] || "plaintext";
}
