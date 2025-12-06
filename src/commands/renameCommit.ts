import * as vscode from "vscode";
import { getOutputChannel } from "../extension";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import simpleGit, { SimpleGit } from "simple-git";

const execAsync = promisify(exec);

interface CommitItem {
	label: string;
	description: string;
	detail: string;
	hash: string;
}

function getGitInstance(workspacePath: string): SimpleGit {
	return simpleGit(workspacePath);
}

export async function renameLastCommit() {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

		if (!workspaceFolder) {
			vscode.window.showErrorMessage(
				"No workspace folder found. Please open a workspace.",
			);
			return;
		}

		const workspacePath = workspaceFolder.uri.fsPath;
		const git = getGitInstance(workspacePath);

		try {
			// Check if it's a git repository
			await git.checkIsRepo();
		} catch (error) {
			vscode.window.showErrorMessage(
				"Not a Git repository. Please initialize Git first.",
			);
			return;
		}

		try {
			// Get the current commit message
			const log = await git.log({ maxCount: 1 });
			const currentMessage = log.latest?.message || "";
			const oldMessage = currentMessage.trim();

			// Show input box with current message
			const newMessage = await vscode.window.showInputBox({
				prompt: "Enter new commit message",
				value: oldMessage,
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

			// Amend the commit using simple-git
			await git.commit(newMessage, ["--amend", "--allow-empty"]);

			// Show success message with undo option
			const action = await vscode.window.showInformationMessage(
				"✓ Last commit message updated successfully!",
				"Undo"
			);

			if (action === "Undo") {
				// Restore the original message
				await git.commit(oldMessage, ["--amend", "--allow-empty"]);
				vscode.window.showInformationMessage(
					"✓ Commit message restored to original"
				);
				getOutputChannel().appendLine(
					`✓ Commit message restored: "${oldMessage}"`
				);
			} else {
				getOutputChannel().appendLine(
					`✓ Commit message updated: "${newMessage}"`
				);
			}
		} catch (error: any) {
			const errorMessage =
				error?.message || error?.toString() || "Unknown error occurred";
			vscode.window.showErrorMessage(
				`Failed to rename commit: ${errorMessage}`,
			);
			getOutputChannel().appendLine(`Error renaming commit: ${errorMessage}`);
			console.error("GitPlus: Error renaming commit:", error);
		}
	} catch (error: any) {
		const errorMessage =
			error?.message || error?.toString() || "Unknown error occurred";
		vscode.window.showErrorMessage(
			`GitPlus: Unexpected error: ${errorMessage}`,
		);
		getOutputChannel().appendLine(`Unexpected error: ${errorMessage}`);
		console.error("GitPlus: Unexpected error in renameLastCommit:", error);
	}
}

/**
 * Edit commit message for any local commit (HEAD or non-HEAD)
 * @param commitHash Optional commit hash. If not provided, shows a picker to select a commit
 */
export async function editCommitMessage(commitHash?: string) {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

		if (!workspaceFolder) {
			vscode.window.showErrorMessage(
				"No workspace folder found. Please open a workspace.",
			);
			return;
		}

		const workspacePath = workspaceFolder.uri.fsPath;
		const git = getGitInstance(workspacePath);

		try {
			// Check if it's a git repository
			await git.checkIsRepo();
		} catch (error) {
			vscode.window.showErrorMessage(
				"Not a Git repository. Please initialize Git first.",
			);
			return;
		}

		try {
			// Get the target commit hash and message
			let targetHash: string;
			let currentMessage: string = "";

			if (commitHash) {
				// Validate the provided commit hash
				try {
					const hash = await git.revparse([commitHash]);
					targetHash = hash.trim();
					// Get the commit message for the provided hash
					const log = await git.log({ from: targetHash, maxCount: 1 });
					currentMessage = log.latest?.message || "";
				} catch (error) {
					vscode.window.showErrorMessage(
						`Invalid commit hash: ${commitHash}`,
					);
					return;
				}
			} else {
				// No commit hash provided - show a picker to select from recent commits
				// Get only local commits (not pushed to remote)
				let localCommitHashes: string[] = [];
				
				try {
					// Try to get commits that are ahead of the remote branch
					const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
					const branchName = currentBranch.trim();
					
					try {
						// Get the remote tracking branch
						const remoteBranch = await git.revparse(["--abbrev-ref", `${branchName}@{upstream}`]);
						const remoteTrackingBranch = remoteBranch.trim();
						
						// Get commits that are in local but not in remote using rev-list
						const { stdout } = await execAsync(
							`git rev-list ${remoteTrackingBranch}..${branchName}`,
							{ cwd: workspacePath }
						);
						
						if (stdout.trim()) {
							localCommitHashes = stdout.trim().split('\n').filter(hash => hash.length > 0);
						}
					} catch {
						// No remote tracking branch, get all commits (up to 50)
						const { stdout } = await execAsync(
							`git rev-list --max-count=50 HEAD`,
							{ cwd: workspacePath }
						);
						
						if (stdout.trim()) {
							localCommitHashes = stdout.trim().split('\n').filter(hash => hash.length > 0);
						}
					}
				} catch (error) {
					// Fallback: get all recent commits
					getOutputChannel().appendLine("Could not determine local commits, showing all recent commits");
					const { stdout } = await execAsync(
						`git rev-list --max-count=50 HEAD`,
						{ cwd: workspacePath }
					);
					
					if (stdout.trim()) {
						localCommitHashes = stdout.trim().split('\n').filter(hash => hash.length > 0);
					}
				}

				if (localCommitHashes.length === 0) {
					vscode.window.showErrorMessage("No local commits found.");
					return;
				}

				// Get full commit details for each local commit using git show
				const commits: (CommitItem & { fullMessage: string })[] = [];
				const seenHashes = new Set<string>();
				
				for (const hash of localCommitHashes) {
					// Skip if we've already processed this hash
					if (seenHashes.has(hash)) {
						continue;
					}
					seenHashes.add(hash);
					
					try {
						// Use git show to get commit details
						const { stdout } = await execAsync(
							`git show --no-patch --format="%H%n%an%n%ai%n%B" ${hash}`,
							{ cwd: workspacePath }
						);
						
						const lines = stdout.trim().split('\n');
						if (lines.length >= 4) {
							const fullHash = lines[0];
							const authorName = lines[1];
							const authorDate = lines[2];
							const message = lines.slice(3).join('\n').trim();
							
							commits.push({
								label:
									message.length > 60
										? message.substring(0, 60) + "..."
										: message,
								description: `${authorName} • ${authorDate}`,
								detail: `Hash: ${fullHash.substring(0, 8)}`,
								hash: fullHash,
								fullMessage: message,
							});
						}
					} catch (error) {
						getOutputChannel().appendLine(`Error getting details for commit ${hash}: ${error}`);
					}
				}

				if (commits.length === 0) {
					vscode.window.showErrorMessage("No valid local commits found.");
					return;
				}

				// Show commit picker
				const selected = await vscode.window.showQuickPick(commits, {
					placeHolder: `Select a local commit to edit its message (${commits.length} local commits)`,
					canPickMany: false,
				});

				if (!selected) {
					return; // User cancelled
				}

				targetHash = selected.hash;
				currentMessage = selected.fullMessage;
			}

			// Get HEAD commit hash to check if target is HEAD
			const headHash = await git.revparse(["HEAD"]);
			const isHeadCommit = targetHash.trim() === headHash.trim();

			// Show input box with current message
			const newMessage = await vscode.window.showInputBox({
				prompt: isHeadCommit
					? "Enter new commit message"
					: `Enter new commit message for commit ${targetHash.substring(0, 8)}`,
				value: currentMessage.trim(),
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

			if (isHeadCommit) {
				// Simple amend for HEAD commit using simple-git
				await git.commit(newMessage, ["--amend", "--allow-empty"]);

				vscode.window.showInformationMessage(
					"✓ Commit message updated successfully!",
				);
				getOutputChannel().appendLine(
					`✓ Commit message updated: "${newMessage}"`,
				);
			} else {
				// Use interactive rebase for non-HEAD commits
				// Get the parent of the target commit
				const parentHash = await git.revparse([`${targetHash}^`]);

				// Get short hash for matching in rebase todo list (Git uses short hashes in rebase)
				const shortHash = targetHash.substring(0, 7);

				// Create temporary files for rebase automation
				const tempDir = path.join(workspacePath, ".git");
				const sequenceEditorScript = path.join(
					tempDir,
					"gitplus-sequence-editor.sh",
				);
				const commitMessageFile = path.join(
					tempDir,
					"gitplus-commit-message.txt",
				);

				// Write the new commit message to a temporary file
				fs.writeFileSync(commitMessageFile, newMessage);

				// Create script that changes "pick" to "reword" for our target commit
				const sequenceEditorContent = `#!/bin/sh
# Find the line with our target commit (match by short hash) and change "pick" to "reword"
echo "GitPlus: Editing rebase todo list, looking for commit ${shortHash}" >&2
sed -i.bak "s/^pick \\(${shortHash}[a-f0-9]*\\)/reword \\1/" "$1"
if grep -q "^reword.*${shortHash}" "$1"; then
	echo "GitPlus: Successfully changed pick to reword for commit ${shortHash}" >&2
else
	echo "GitPlus: Warning: Could not find commit ${shortHash} in rebase todo list" >&2
fi
`;

				fs.writeFileSync(sequenceEditorScript, sequenceEditorContent);
				fs.chmodSync(sequenceEditorScript, 0o755);

				// Create script that uses our commit message file
				const editorScript = path.join(tempDir, "gitplus-editor.sh");
				const escapedCommitMessageFile = commitMessageFile.replace(
					/'/g,
					"'\\''",
				);
				const editorContent = `#!/bin/sh
echo "GitPlus: Setting commit message from ${escapedCommitMessageFile}" >&2
if [ -f '${escapedCommitMessageFile}' ]; then
	cat '${escapedCommitMessageFile}' > "$1"
	echo "GitPlus: Commit message written successfully" >&2
	exit 0
else
	echo "Error: Commit message file not found: ${escapedCommitMessageFile}" >&2
	exit 1
fi
`;

				fs.writeFileSync(editorScript, editorContent);
				fs.chmodSync(editorScript, 0o755);

				try {
					// Set environment variables for rebase automation
					const env = {
						...process.env,
						GIT_SEQUENCE_EDITOR: sequenceEditorScript,
						GIT_EDITOR: editorScript,
					};

					getOutputChannel().appendLine(
						`Starting rebase to edit commit ${targetHash.substring(0, 8)}...`,
					);

					// Start interactive rebase using exec (simple-git doesn't support interactive rebase)
					try {
						await execAsync(`git rebase -i ${parentHash.trim()}`, {
							cwd: workspacePath,
							env: env,
						});
					} catch (rebaseStartError: any) {
						// Rebase might exit with code 0 even if it stops for editing
						const errorMsg = rebaseStartError?.message || "";
						if (!errorMsg.includes("rebase") && rebaseStartError.code !== 0) {
							throw rebaseStartError;
						}
					}

					// Wait for rebase to process
					await new Promise((resolve) => setTimeout(resolve, 1000));

					// Check if rebase is in progress
					let rebaseInProgress = false;
					try {
						await execAsync("git rev-parse --git-path rebase-merge", {
							cwd: workspacePath,
						});
						rebaseInProgress = true;
						getOutputChannel().appendLine("Rebase is in progress, continuing...");
					} catch {
						// Rebase completed or never started
						getOutputChannel().appendLine("Rebase completed successfully");
					}

					// Only continue if rebase is actually in progress
					if (rebaseInProgress) {
						const commitEditMsgPath = path.join(
							workspacePath,
							".git",
							"COMMIT_EDITMSG",
						);

						// Ensure commit message is set
						if (fs.existsSync(commitEditMsgPath)) {
							const currentEditMsg = fs.readFileSync(
								commitEditMsgPath,
								"utf8",
							);
							if (currentEditMsg.trim() !== newMessage.trim()) {
								getOutputChannel().appendLine(
									"Updating commit message in COMMIT_EDITMSG...",
								);
								fs.writeFileSync(commitEditMsgPath, newMessage);
							}
						}

						try {
							getOutputChannel().appendLine("Continuing rebase...");
							await execAsync("git rebase --continue", {
								cwd: workspacePath,
								env: env,
							});

							await new Promise((resolve) => setTimeout(resolve, 1000));

							// Check if rebase completed
							let stillInProgress = false;
							try {
								await execAsync("git rev-parse --git-path rebase-merge", {
									cwd: workspacePath,
								});
								stillInProgress = true;
							} catch {
								stillInProgress = false;
							}

							if (stillInProgress) {
								getOutputChannel().appendLine(
									"Rebase still in progress, continuing again...",
								);
								await execAsync("git rebase --continue", {
									cwd: workspacePath,
									env: env,
								});
								await new Promise((resolve) => setTimeout(resolve, 1000));

								// Final check
								try {
									await execAsync("git rev-parse --git-path rebase-merge", {
										cwd: workspacePath,
									});
									getOutputChannel().appendLine(
										"Rebase still in progress after second continue, aborting...",
									);
									await execAsync("git rebase --abort", {
										cwd: workspacePath,
									});
									throw new Error(
										"Rebase did not complete after multiple continue attempts",
									);
								} catch (checkError: any) {
									if (
										checkError.message &&
										checkError.message.includes("did not complete")
									) {
										throw checkError;
									}
									getOutputChannel().appendLine("Rebase completed successfully");
								}
							} else {
								getOutputChannel().appendLine("Rebase completed successfully");
							}
						} catch (continueError: any) {
							const errorMsg =
								continueError?.message ||
								continueError?.toString() ||
								"Unknown error";
							const stderr = continueError?.stderr || "";
							const stdout = continueError?.stdout || "";

							// Check if the error is "no rebase in progress" - this means it already completed
							if (
								errorMsg.includes("no rebase in progress") ||
								errorMsg.includes("fatal: no rebase in progress")
							) {
								getOutputChannel().appendLine(
									"Rebase already completed (no rebase in progress)",
								);
								// This is actually success, not an error
							} else {
								getOutputChannel().appendLine(
									`Rebase continue error: ${errorMsg}`,
								);
								if (stderr) {
									getOutputChannel().appendLine(`Rebase stderr: ${stderr}`);
								}
								if (stdout) {
									getOutputChannel().appendLine(`Rebase stdout: ${stdout}`);
								}

								// Try to abort only if it's a real error
								try {
									await execAsync("git rev-parse --git-path rebase-merge", {
										cwd: workspacePath,
									});
									// Rebase is still in progress, abort it
									await execAsync("git rebase --abort", {
										cwd: workspacePath,
									});
									getOutputChannel().appendLine("Rebase aborted due to error");
								} catch {
									// No rebase in progress, ignore
								}
								throw new Error(`Rebase continue failed: ${errorMsg}`);
							}
						}
					}

					// Clean up temporary files
					if (fs.existsSync(sequenceEditorScript)) {
						fs.unlinkSync(sequenceEditorScript);
					}
					if (fs.existsSync(`${sequenceEditorScript}.bak`)) {
						fs.unlinkSync(`${sequenceEditorScript}.bak`);
					}
					if (fs.existsSync(editorScript)) {
						fs.unlinkSync(editorScript);
					}
					if (fs.existsSync(commitMessageFile)) {
						fs.unlinkSync(commitMessageFile);
					}

					vscode.window.showInformationMessage(
						`✓ Commit message updated successfully!`,
					);
					getOutputChannel().appendLine(
						`✓ Commit message updated for ${targetHash.substring(0, 8)}: "${newMessage}"`,
					);
				} catch (rebaseError: any) {
					// Clean up on error
					if (fs.existsSync(sequenceEditorScript)) {
						fs.unlinkSync(sequenceEditorScript);
					}
					if (fs.existsSync(`${sequenceEditorScript}.bak`)) {
						fs.unlinkSync(`${sequenceEditorScript}.bak`);
					}
					if (fs.existsSync(editorScript)) {
						fs.unlinkSync(editorScript);
					}
					if (fs.existsSync(commitMessageFile)) {
						fs.unlinkSync(commitMessageFile);
					}

					// Check if rebase is in progress and abort it
					try {
						await execAsync("git rev-parse --git-path rebase-merge", {
							cwd: workspacePath,
						});
						await execAsync("git rebase --abort", {
							cwd: workspacePath,
						});
						getOutputChannel().appendLine("Rebase was aborted due to error");
					} catch {
						// No rebase in progress or already aborted, ignore
					}

					const errorMessage =
						rebaseError?.message ||
						rebaseError?.toString() ||
						"Unknown error occurred";

					getOutputChannel().appendLine(`Rebase error details: ${errorMessage}`);
					if (rebaseError.stdout) {
						getOutputChannel().appendLine(
							`Rebase stdout: ${rebaseError.stdout}`,
						);
					}
					if (rebaseError.stderr) {
						getOutputChannel().appendLine(
							`Rebase stderr: ${rebaseError.stderr}`,
						);
					}

					throw new Error(`Rebase failed: ${errorMessage}`);
				}
			}
		} catch (error: any) {
			const errorMessage =
				error?.message || error?.toString() || "Unknown error occurred";
			vscode.window.showErrorMessage(
				`Failed to edit commit message: ${errorMessage}`,
			);
			getOutputChannel().appendLine(`Error editing commit: ${errorMessage}`);
			console.error("GitPlus: Error editing commit:", error);
		}
	} catch (error: any) {
		const errorMessage =
			error?.message || error?.toString() || "Unknown error occurred";
		vscode.window.showErrorMessage(
			`GitPlus: Unexpected error: ${errorMessage}`,
		);
		getOutputChannel().appendLine(`Unexpected error: ${errorMessage}`);
		console.error("GitPlus: Unexpected error in editCommitMessage:", error);
	}
}
