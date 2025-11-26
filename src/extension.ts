import * as vscode from 'vscode';
import { renameLastCommit } from './commands/renameCommit';
import { showFileHistory } from './commands/fileHistory';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('GitPlus');
    outputChannel.appendLine('GitPlus extension is now active!');
    console.log('GitPlus extension is now active!');

    // Register Rename Last Commit command
    const renameCommitCommand = vscode.commands.registerCommand(
        'gitplus.renameLastCommit',
        renameLastCommit
    );

    // Register Show File History command
    const fileHistoryCommand = vscode.commands.registerCommand(
        'gitplus.showFileHistory',
        showFileHistory
    );

    context.subscriptions.push(renameCommitCommand, fileHistoryCommand, outputChannel);
}

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
}

export function deactivate() {}

