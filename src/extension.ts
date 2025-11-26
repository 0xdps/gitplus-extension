import * as vscode from "vscode";
import { renameLastCommit } from "./commands/renameCommit";
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

	// Register Post Install command
	const postInstallCommand = vscode.commands.registerCommand(
		"gitplus.postInstall",
		() => {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				const postInstallPath = vscode.Uri.joinPath(
					workspaceFolders[0].uri,
					"POST_INSTALL.md",
				);
				vscode.commands.executeCommand("vscode.open", postInstallPath);
			} else {
				vscode.window.showInformationMessage("POST_INSTALL.md not found.");
			}
		},
	);

	// Show post-install page on first install
	if (!context.globalState.get("gitplusInstalled")) {
		vscode.commands.executeCommand("gitplus.postInstall");
		context.globalState.update("gitplusInstalled", true);
	}

	context.subscriptions.push(
		renameCommitCommand,
		fileHistoryCommand,
		outputChannel,
	);
	context.subscriptions.push(postInstallCommand);
}

export function getOutputChannel(): vscode.OutputChannel {
	return outputChannel;
}

export function deactivate() {}
