import * as vscode from "vscode";
import { renameLastCommit, editCommitMessage } from "./commands/renameCommit";
import { showFileHistory } from "./commands/fileHistory";

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
	// Create output channel for debugging
	outputChannel = vscode.window.createOutputChannel("GitPlus");
	outputChannel.appendLine("GitPlus extension is now active!");
	console.log("GitPlus extension is now active!");

	// Register Rename Last Commit command
	const renameCommitCommand = vscode.commands.registerCommand(
		"gitplus.renameLastCommit",
		renameLastCommit,
	);

	// Register Show File History command
	const fileHistoryCommand = vscode.commands.registerCommand(
		"gitplus.showFileHistory",
		showFileHistory,
	);

	// Register Edit Commit Message command (works for any commit)
	const editCommitCommand = vscode.commands.registerCommand(
		"gitplus.editCommitMessage",
		async (arg?: string | vscode.Uri | any) => {
			// Handle different argument types that VS Code might pass
			let commitHash: string | undefined;
			
			if (arg) {
				if (typeof arg === "string") {
					// Direct commit hash string
					commitHash = arg;
				} else if (arg instanceof vscode.Uri) {
					// URI - might contain commit info in query or path
					const uriString = arg.toString();
					// Try to extract commit hash from URI (format may vary)
					const hashMatch = uriString.match(/([a-f0-9]{40}|[a-f0-9]{7,})/i);
					if (hashMatch) {
						commitHash = hashMatch[1];
					}
				} else if (arg.hash || arg.commitHash) {
					// Object with hash property
					commitHash = arg.hash || arg.commitHash;
				} else if (typeof arg === "object" && arg.toString) {
					// Try to get string representation
					const str = arg.toString();
					const hashMatch = str.match(/([a-f0-9]{40}|[a-f0-9]{7,})/i);
					if (hashMatch) {
						commitHash = hashMatch[1];
					}
				}
			}
			
			await editCommitMessage(commitHash);
		},
	);

	// Register Post Install command
	const postInstallCommand = vscode.commands.registerCommand(
		"gitplus.postInstall",
		() => {
			// Get the extension's installation path
			const postInstallPath = vscode.Uri.joinPath(
				context.extensionUri,
				"POST_INSTALL.md"
			);
			vscode.workspace.openTextDocument(postInstallPath)
				.then(
					doc => vscode.window.showTextDocument(doc),
					() => vscode.window.showInformationMessage("POST_INSTALL.md not found in extension directory.")
				);
		}
	);

	// Register Post Install command
	const getVersionCommand = vscode.commands.registerCommand(
		"gitplus.getVersion",
		() => {
			const packageJson = vscode.Uri.joinPath(
				context.extensionUri,
				"package.json"
			);
			vscode.window.showInformationMessage(
			`Gitplus Version: ${require(packageJson.path).version}`,
			);
		}
	);

	// Show post-install page on first install
	if (!context.globalState.get("gitplusInstalled")) {
		vscode.commands.executeCommand("gitplus.postInstall");
		context.globalState.update("gitplusInstalled", true);
	}

	context.subscriptions.push(
		renameCommitCommand,
		fileHistoryCommand,
		editCommitCommand,
		getVersionCommand,
		outputChannel,
	);
	context.subscriptions.push(postInstallCommand);
}

export function getOutputChannel(): vscode.OutputChannel {
	return outputChannel;
}

export function deactivate() {}
