import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getOutputChannel } from '../extension';

const execAsync = promisify(exec);

export async function renameLastCommit() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a workspace.');
            return;
        }

        const workspacePath = workspaceFolder.uri.fsPath;

        try {
            // Check if it's a git repository
            await execAsync('git rev-parse --git-dir', { cwd: workspacePath });
        } catch (error) {
            vscode.window.showErrorMessage('Not a Git repository. Please initialize Git first.');
            return;
        }

        try {
            // Get the current commit message
            const { stdout: currentMessage } = await execAsync(
                'git log -1 --pretty=%B',
                { cwd: workspacePath }
            );

            // Show input box with current message
            const newMessage = await vscode.window.showInputBox({
                prompt: 'Enter new commit message',
                value: currentMessage.trim(),
                placeHolder: 'Enter your updated commit message',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Commit message cannot be empty';
                    }
                    return null;
                }
            });

            if (!newMessage) {
                return; // User cancelled
            }

            // Show confirmation dialog
            const confirm = await vscode.window.showWarningMessage(
                'This will amend the last commit. Continue?',
                { modal: true },
                'Yes'
            );

            if (confirm !== 'Yes') {
                return;
            }

            // Amend the commit
            await execAsync(`git commit --amend -m "${newMessage.replace(/"/g, '\\"')}"`, {
                cwd: workspacePath
            });

            vscode.window.showInformationMessage('✓ Last commit message updated successfully!');
            getOutputChannel().appendLine(`✓ Commit message updated: "${newMessage}"`);
        } catch (error: any) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to rename commit: ${errorMessage}`);
            getOutputChannel().appendLine(`Error renaming commit: ${errorMessage}`);
            console.error('GitPlus: Error renaming commit:', error);
        }
    } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
        vscode.window.showErrorMessage(`GitPlus: Unexpected error: ${errorMessage}`);
        getOutputChannel().appendLine(`Unexpected error: ${errorMessage}`);
        console.error('GitPlus: Unexpected error in renameLastCommit:', error);
    }
}

