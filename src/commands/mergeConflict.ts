import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { getOutputChannel } from "../extension";

const execAsync = promisify(exec);

interface ConflictBlock {
	id: number;
	startLine: number;
	endLine: number;
	ours: string;
	theirs: string;
	oursLabel: string;
	theirsLabel: string;
}

interface MergeConflict {
	filePath: string;
	relativePath: string;
	conflicts: ConflictBlock[];
	fullContent: string;
	language: string;
}

interface ConflictedFile {
	path: string;
	relativePath: string;
}

/**
 * Get list of files with merge conflicts
 */
async function getConflictedFiles(workspacePath: string): Promise<ConflictedFile[]> {
	try {
		const { stdout } = await execAsync("git diff --name-only --diff-filter=U", {
			cwd: workspacePath,
		});

		if (!stdout.trim()) {
			return [];
		}

		return stdout
			.trim()
			.split("\n")
			.filter((f) => f.length > 0)
			.map((relativePath) => ({
				path: path.join(workspacePath, relativePath),
				relativePath,
			}));
	} catch {
		return [];
	}
}

/**
 * Parse conflict markers from file content
 */
function parseConflictedFile(
	filePath: string,
	relativePath: string,
	language: string
): MergeConflict | null {
	if (!fs.existsSync(filePath)) {
		return null;
	}

	const content = fs.readFileSync(filePath, "utf8");
	const lines = content.split("\n");
	const conflicts: ConflictBlock[] = [];

	let currentConflict: Partial<ConflictBlock> | null = null;
	let oursLines: string[] = [];
	let theirsLines: string[] = [];
	let inOurs = false;
	let inTheirs = false;
	let conflictId = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith("<<<<<<< ")) {
			currentConflict = {
				id: conflictId++,
				startLine: i,
				oursLabel: line.substring(8).trim() || "HEAD",
			};
			oursLines = [];
			inOurs = true;
			inTheirs = false;
		} else if (line.startsWith("=======")) {
			inOurs = false;
			inTheirs = true;
		} else if (line.startsWith(">>>>>>> ")) {
			if (currentConflict) {
				currentConflict.endLine = i;
				currentConflict.ours = oursLines.join("\n");
				currentConflict.theirs = theirsLines.join("\n");
				currentConflict.theirsLabel = line.substring(8).trim() || "incoming";
				conflicts.push(currentConflict as ConflictBlock);
			}
			currentConflict = null;
			theirsLines = [];
			inOurs = false;
			inTheirs = false;
		} else if (inOurs) {
			oursLines.push(line);
		} else if (inTheirs) {
			theirsLines.push(line);
		}
	}

	return {
		filePath,
		relativePath,
		conflicts,
		fullContent: content,
		language,
	};
}

/**
 * Get the non-conflicting content with placeholders for conflicts
 */
function getResultContent(content: string, conflicts: ConflictBlock[]): string {
	const lines = content.split("\n");
	const result: string[] = [];
	let skipUntil = -1;

	for (let i = 0; i < lines.length; i++) {
		if (i <= skipUntil) {
			continue;
		}

		const conflict = conflicts.find((c) => c.startLine === i);
		if (conflict) {
			// Add a placeholder comment for the conflict
			result.push(`// <<<< CONFLICT ${conflict.id + 1}: Choose from left or right panel >>>>`);
			skipUntil = conflict.endLine;
		} else {
			result.push(lines[i]);
		}
	}

	return result.join("\n");
}

/**
 * Resolve content by replacing conflict markers with resolved content
 */
function resolveContent(
	originalContent: string,
	conflicts: ConflictBlock[],
	resolutions: Map<number, string>
): string {
	const lines = originalContent.split("\n");
	const result: string[] = [];
	let skipUntil = -1;

	for (let i = 0; i < lines.length; i++) {
		if (i <= skipUntil) {
			continue;
		}

		const conflict = conflicts.find((c) => c.startLine === i);
		if (conflict) {
			const resolved = resolutions.get(conflict.id);
			if (resolved !== undefined) {
				// Add resolved content
				result.push(...resolved.split("\n"));
			}
			skipUntil = conflict.endLine;
		} else {
			result.push(lines[i]);
		}
	}

	return result.join("\n");
}

/**
 * Get language ID from file path
 */
function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase();
	const languageMap: { [key: string]: string } = {
		js: "javascript",
		jsx: "javascript",
		ts: "typescript",
		tsx: "typescript",
		py: "python",
		java: "java",
		cpp: "cpp",
		c: "c",
		cs: "csharp",
		go: "go",
		rs: "rust",
		rb: "ruby",
		php: "php",
		html: "html",
		css: "css",
		scss: "scss",
		less: "less",
		json: "json",
		xml: "xml",
		yaml: "yaml",
		yml: "yaml",
		md: "markdown",
		sql: "sql",
		sh: "shell",
		bash: "shell",
		zsh: "shell",
		ps1: "powershell",
		vue: "vue",
		svelte: "svelte",
	};
	return languageMap[ext || ""] || "plaintext";
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * MergeConflictPanel - IntelliJ-style 3-column merge editor
 */
export class MergeConflictPanel {
	public static currentPanel: MergeConflictPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _conflict: MergeConflict;
	private _resolutions: Map<number, string>;
	private _disposables: vscode.Disposable[] = [];

	public static async create(
		extensionUri: vscode.Uri,
		filePath?: string
	): Promise<MergeConflictPanel | undefined> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found.");
			return undefined;
		}

		const workspacePath = workspaceFolder.uri.fsPath;

		// If no file specified, show picker for conflicted files
		if (!filePath) {
			const conflictedFiles = await getConflictedFiles(workspacePath);

			if (conflictedFiles.length === 0) {
				vscode.window.showInformationMessage(
					"No merge conflicts found in the workspace."
				);
				return undefined;
			}

			const items = conflictedFiles.map((f) => ({
				label: f.relativePath,
				description: "Has merge conflicts",
				filePath: f.path,
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: "Select a file with merge conflicts to resolve",
			});

			if (!selected) {
				return undefined;
			}

			filePath = selected.filePath;
		}

		const relativePath = vscode.workspace.asRelativePath(filePath);
		const language = getLanguageFromPath(filePath);

		// Parse the conflicted file
		const conflict = parseConflictedFile(filePath, relativePath, language);
		if (!conflict || conflict.conflicts.length === 0) {
			vscode.window.showInformationMessage(
				"No merge conflicts found in this file."
			);
			return undefined;
		}

		// Dispose existing panel if any
		if (MergeConflictPanel.currentPanel) {
			MergeConflictPanel.currentPanel.dispose();
		}

		const panel = vscode.window.createWebviewPanel(
			"gitplusMergeConflict",
			`Merge: ${path.basename(filePath)}`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [extensionUri],
			}
		);

		MergeConflictPanel.currentPanel = new MergeConflictPanel(
			panel,
			extensionUri,
			conflict
		);
		return MergeConflictPanel.currentPanel;
	}

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		conflict: MergeConflict
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._conflict = conflict;
		this._resolutions = new Map();

		// Initialize with empty resolutions (user must choose)
		this._conflict.conflicts.forEach((c) => {
			this._resolutions.set(c.id, "");
		});

		this._panel.webview.html = this._getWebviewContent();

		// Handle messages from webview
		this._panel.webview.onDidReceiveMessage(
			async (message) => {
				await this._handleMessage(message);
			},
			null,
			this._disposables
		);

		// Handle panel disposal
		this._panel.onDidDispose(
			() => {
				this.dispose();
			},
			null,
			this._disposables
		);

		getOutputChannel().appendLine(
			`Opened merge editor for ${conflict.relativePath} with ${conflict.conflicts.length} conflicts`
		);
	}

	private async _handleMessage(message: any) {
		switch (message.command) {
			case "acceptLeft":
				this._acceptSide("ours", message.conflictId);
				break;
			case "acceptRight":
				this._acceptSide("theirs", message.conflictId);
				break;
			case "acceptBoth":
				this._acceptBoth(message.conflictId);
				break;
			case "acceptAllLeft":
				this._acceptAllSide("ours");
				break;
			case "acceptAllRight":
				this._acceptAllSide("theirs");
				break;
			case "updateResolution":
				this._resolutions.set(message.conflictId, message.content);
				break;
			case "save":
				await this._saveResult(message.resultContent);
				break;
			case "cancel":
				this.dispose();
				break;
			case "log":
				getOutputChannel().appendLine(`[MergeEditor] ${message.text}`);
				break;
		}
	}

	private _acceptSide(side: "ours" | "theirs", conflictId: number) {
		const conflict = this._conflict.conflicts.find((c) => c.id === conflictId);
		if (conflict) {
			const content = side === "ours" ? conflict.ours : conflict.theirs;
			this._resolutions.set(conflictId, content);
			this._panel.webview.postMessage({
				command: "updateConflict",
				conflictId,
				content,
			});
		}
	}

	private _acceptBoth(conflictId: number) {
		const conflict = this._conflict.conflicts.find((c) => c.id === conflictId);
		if (conflict) {
			const content = conflict.ours + "\n" + conflict.theirs;
			this._resolutions.set(conflictId, content);
			this._panel.webview.postMessage({
				command: "updateConflict",
				conflictId,
				content,
			});
		}
	}

	private _acceptAllSide(side: "ours" | "theirs") {
		this._conflict.conflicts.forEach((conflict) => {
			const content = side === "ours" ? conflict.ours : conflict.theirs;
			this._resolutions.set(conflict.id, content);
		});
		this._panel.webview.postMessage({
			command: "updateAllConflicts",
			resolutions: Array.from(this._resolutions.entries()).map(
				([id, content]) => ({ id, content })
			),
		});
	}

	private async _saveResult(resultContent: string) {
		try {
			// Write the resolved content
			fs.writeFileSync(this._conflict.filePath, resultContent);

			// Stage the file
			const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (workspacePath) {
				try {
					await execAsync(`git add "${this._conflict.relativePath}"`, {
						cwd: workspacePath,
					});
					getOutputChannel().appendLine(
						`Staged resolved file: ${this._conflict.relativePath}`
					);
				} catch (stageError) {
					getOutputChannel().appendLine(
						`Warning: Could not stage file: ${stageError}`
					);
				}
			}

			vscode.window.showInformationMessage(
				`✓ Merge conflicts resolved and saved: ${this._conflict.relativePath}`
			);

			getOutputChannel().appendLine(
				`Saved merged result for ${this._conflict.relativePath}`
			);

			this.dispose();
		} catch (error: any) {
			vscode.window.showErrorMessage(
				`Failed to save merge result: ${error.message}`
			);
			getOutputChannel().appendLine(`Error saving merge result: ${error}`);
		}
	}

	public dispose() {
		MergeConflictPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}

	private _getWebviewContent(): string {
		const conflicts = this._conflict.conflicts;
		const language = this._conflict.language;

		// Generate conflict blocks HTML
		const conflictBlocksHtml = conflicts
			.map(
				(c) => `
			<div class="conflict-section" data-conflict-id="${c.id}">
				<div class="conflict-header">
					<span class="conflict-title">Conflict ${c.id + 1} of ${conflicts.length}</span>
					<div class="conflict-actions">
						<button class="btn btn-accept-both" onclick="acceptBoth(${c.id})" title="Accept Both">
							<span class="icon">⇄</span> Both
						</button>
					</div>
				</div>
				<div class="conflict-panels">
					<div class="conflict-panel left-panel">
						<div class="panel-header">
							<span class="panel-label">Yours (${escapeHtml(c.oursLabel)})</span>
							<button class="btn btn-accept" onclick="acceptLeft(${c.id})" title="Use this version">
								Accept →
							</button>
						</div>
						<div class="code-block ours-code">
							<pre><code class="language-${language}">${escapeHtml(c.ours)}</code></pre>
						</div>
					</div>
					<div class="conflict-panel center-panel">
						<div class="panel-header">
							<span class="panel-label">Result</span>
						</div>
						<div class="code-block result-code">
							<textarea 
								class="result-editor" 
								id="result-${c.id}" 
								data-conflict-id="${c.id}"
								placeholder="Choose from left or right, or edit manually..."
								spellcheck="false"
							></textarea>
						</div>
					</div>
					<div class="conflict-panel right-panel">
						<div class="panel-header">
							<button class="btn btn-accept" onclick="acceptRight(${c.id})" title="Use this version">
								← Accept
							</button>
							<span class="panel-label">Theirs (${escapeHtml(c.theirsLabel)})</span>
						</div>
						<div class="code-block theirs-code">
							<pre><code class="language-${language}">${escapeHtml(c.theirs)}</code></pre>
						</div>
					</div>
				</div>
			</div>
		`
			)
			.join("");

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
	<title>Merge Conflicts - ${escapeHtml(this._conflict.relativePath)}</title>
	<style>
		:root {
			--bg-primary: var(--vscode-editor-background, #1e1e1e);
			--bg-secondary: var(--vscode-sideBar-background, #252526);
			--bg-tertiary: var(--vscode-input-background, #3c3c3c);
			--text-primary: var(--vscode-editor-foreground, #d4d4d4);
			--text-secondary: var(--vscode-descriptionForeground, #858585);
			--border-color: var(--vscode-panel-border, #454545);
			--accent-color: var(--vscode-button-background, #0e639c);
			--accent-hover: var(--vscode-button-hoverBackground, #1177bb);
			--success-color: #4ec9b0;
			--warning-color: #dcdcaa;
			--ours-bg: rgba(0, 180, 0, 0.15);
			--ours-border: rgba(0, 180, 0, 0.4);
			--theirs-bg: rgba(0, 120, 255, 0.15);
			--theirs-border: rgba(0, 120, 255, 0.4);
			--result-bg: var(--vscode-editor-background, #1e1e1e);
			--font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
			--font-mono: var(--vscode-editor-font-family, 'Menlo', 'Monaco', 'Consolas', monospace);
			--font-size: var(--vscode-editor-font-size, 13px);
		}

		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: var(--font-family);
			font-size: var(--font-size);
			background: var(--bg-primary);
			color: var(--text-primary);
			height: 100vh;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}

		/* Header */
		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px 20px;
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border-color);
			flex-shrink: 0;
		}

		.header-title {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.header-title h1 {
			font-size: 14px;
			font-weight: 600;
		}

		.header-title .file-path {
			font-size: 12px;
			color: var(--text-secondary);
			font-family: var(--font-mono);
		}

		.header-actions {
			display: flex;
			gap: 8px;
		}

		/* Global Actions Bar */
		.global-actions {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 8px 20px;
			background: var(--bg-tertiary);
			border-bottom: 1px solid var(--border-color);
			flex-shrink: 0;
		}

		.global-actions-group {
			display: flex;
			gap: 12px;
			align-items: center;
		}

		.conflict-counter {
			font-size: 12px;
			color: var(--text-secondary);
		}

		.conflict-counter strong {
			color: var(--warning-color);
		}

		/* Buttons */
		.btn {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			padding: 6px 12px;
			font-size: 12px;
			font-family: var(--font-family);
			border: none;
			border-radius: 3px;
			cursor: pointer;
			transition: all 0.15s ease;
		}

		.btn-primary {
			background: var(--accent-color);
			color: white;
		}

		.btn-primary:hover {
			background: var(--accent-hover);
		}

		.btn-secondary {
			background: var(--bg-tertiary);
			color: var(--text-primary);
			border: 1px solid var(--border-color);
		}

		.btn-secondary:hover {
			background: var(--border-color);
		}

		.btn-success {
			background: #2ea043;
			color: white;
		}

		.btn-success:hover {
			background: #3fb950;
		}

		.btn-danger {
			background: transparent;
			color: #f85149;
			border: 1px solid #f85149;
		}

		.btn-danger:hover {
			background: rgba(248, 81, 73, 0.1);
		}

		.btn-accept {
			background: transparent;
			color: var(--success-color);
			border: 1px solid var(--success-color);
			padding: 4px 10px;
			font-size: 11px;
		}

		.btn-accept:hover {
			background: rgba(78, 201, 176, 0.15);
		}

		.btn-accept-both {
			background: transparent;
			color: var(--warning-color);
			border: 1px solid var(--warning-color);
			padding: 4px 10px;
			font-size: 11px;
		}

		.btn-accept-both:hover {
			background: rgba(220, 220, 170, 0.15);
		}

		/* Main Content */
		.main-content {
			flex: 1;
			overflow-y: auto;
			padding: 20px;
		}

		/* Conflict Section */
		.conflict-section {
			margin-bottom: 24px;
			border: 1px solid var(--border-color);
			border-radius: 6px;
			overflow: hidden;
			background: var(--bg-secondary);
		}

		.conflict-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 10px 16px;
			background: var(--bg-tertiary);
			border-bottom: 1px solid var(--border-color);
		}

		.conflict-title {
			font-weight: 600;
			font-size: 12px;
			color: var(--warning-color);
		}

		.conflict-actions {
			display: flex;
			gap: 8px;
		}

		/* Three Panel Layout */
		.conflict-panels {
			display: grid;
			grid-template-columns: 1fr 1fr 1fr;
			min-height: 200px;
		}

		.conflict-panel {
			display: flex;
			flex-direction: column;
			border-right: 1px solid var(--border-color);
		}

		.conflict-panel:last-child {
			border-right: none;
		}

		.panel-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 8px 12px;
			background: var(--bg-tertiary);
			border-bottom: 1px solid var(--border-color);
			min-height: 36px;
		}

		.panel-label {
			font-size: 11px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		.left-panel .panel-label {
			color: #4ec9b0;
		}

		.center-panel .panel-label {
			color: var(--warning-color);
		}

		.right-panel .panel-label {
			color: #569cd6;
		}

		.left-panel .panel-header {
			flex-direction: row;
		}

		.right-panel .panel-header {
			flex-direction: row;
		}

		.center-panel .panel-header {
			justify-content: center;
		}

		/* Code Blocks */
		.code-block {
			flex: 1;
			overflow: auto;
			padding: 12px;
			font-family: var(--font-mono);
			font-size: 12px;
			line-height: 1.5;
		}

		.ours-code {
			background: var(--ours-bg);
			border-left: 3px solid var(--ours-border);
		}

		.theirs-code {
			background: var(--theirs-bg);
			border-left: 3px solid var(--theirs-border);
		}

		.result-code {
			background: var(--result-bg);
			padding: 0;
		}

		.code-block pre {
			margin: 0;
			white-space: pre-wrap;
			word-wrap: break-word;
		}

		.code-block code {
			font-family: var(--font-mono);
		}

		/* Result Editor */
		.result-editor {
			width: 100%;
			height: 100%;
			min-height: 150px;
			padding: 12px;
			font-family: var(--font-mono);
			font-size: 12px;
			line-height: 1.5;
			background: var(--bg-primary);
			color: var(--text-primary);
			border: none;
			resize: none;
			outline: none;
		}

		.result-editor:focus {
			box-shadow: inset 0 0 0 1px var(--accent-color);
		}

		.result-editor::placeholder {
			color: var(--text-secondary);
			font-style: italic;
		}

		.result-editor.has-content {
			background: rgba(78, 201, 176, 0.05);
		}

		/* Status indicator */
		.status-badge {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 8px;
			font-size: 10px;
			border-radius: 10px;
			font-weight: 600;
		}

		.status-badge.resolved {
			background: rgba(46, 160, 67, 0.2);
			color: #3fb950;
		}

		.status-badge.pending {
			background: rgba(248, 81, 73, 0.2);
			color: #f85149;
		}

		/* Footer */
		.footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px 20px;
			background: var(--bg-secondary);
			border-top: 1px solid var(--border-color);
			flex-shrink: 0;
		}

		.footer-info {
			font-size: 12px;
			color: var(--text-secondary);
		}

		.footer-actions {
			display: flex;
			gap: 12px;
		}

		/* Keyboard shortcuts hint */
		.shortcuts-hint {
			font-size: 11px;
			color: var(--text-secondary);
		}

		kbd {
			display: inline-block;
			padding: 2px 6px;
			font-size: 10px;
			font-family: var(--font-mono);
			background: var(--bg-tertiary);
			border: 1px solid var(--border-color);
			border-radius: 3px;
			margin: 0 2px;
		}

		/* Scrollbar styling */
		::-webkit-scrollbar {
			width: 10px;
			height: 10px;
		}

		::-webkit-scrollbar-track {
			background: var(--bg-primary);
		}

		::-webkit-scrollbar-thumb {
			background: var(--border-color);
			border-radius: 5px;
		}

		::-webkit-scrollbar-thumb:hover {
			background: #666;
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="header-title">
			<h1>🔀 Merge Conflict Resolution</h1>
			<span class="file-path">${escapeHtml(this._conflict.relativePath)}</span>
		</div>
		<div class="header-actions">
			<span class="shortcuts-hint">
				<kbd>Ctrl</kbd>+<kbd>S</kbd> Save
			</span>
		</div>
	</div>

	<div class="global-actions">
		<div class="global-actions-group">
			<span class="conflict-counter">
				<strong id="resolvedCount">0</strong> / ${conflicts.length} conflicts resolved
			</span>
			<span id="statusBadge" class="status-badge pending">● Pending</span>
		</div>
		<div class="global-actions-group">
			<button class="btn btn-secondary" onclick="acceptAllLeft()">
				Accept All Yours
			</button>
			<button class="btn btn-secondary" onclick="acceptAllRight()">
				Accept All Theirs
			</button>
		</div>
	</div>

	<div class="main-content">
		${conflictBlocksHtml}
	</div>

	<div class="footer">
		<div class="footer-info">
			Review each conflict and choose the version to keep. You can also edit the result manually.
		</div>
		<div class="footer-actions">
			<button class="btn btn-danger" onclick="cancel()">Cancel</button>
			<button class="btn btn-success" id="saveBtn" onclick="saveResult()" disabled>
				Save Merged File
			</button>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const totalConflicts = ${conflicts.length};
		const resolutions = new Map();
		
		// Initialize resolutions map
		${conflicts.map((c) => `resolutions.set(${c.id}, '');`).join("\n\t\t")}

		// Track which conflicts are resolved
		function updateStatus() {
			let resolved = 0;
			resolutions.forEach((value, key) => {
				if (value.length > 0 || document.getElementById('result-' + key).value.trim().length > 0) {
					resolved++;
				}
			});

			document.getElementById('resolvedCount').textContent = resolved;
			
			const badge = document.getElementById('statusBadge');
			const saveBtn = document.getElementById('saveBtn');
			
			if (resolved === totalConflicts) {
				badge.className = 'status-badge resolved';
				badge.innerHTML = '✓ Ready to save';
				saveBtn.disabled = false;
			} else {
				badge.className = 'status-badge pending';
				badge.innerHTML = '● Pending';
				saveBtn.disabled = true;
			}
		}

		function acceptLeft(conflictId) {
			vscode.postMessage({ command: 'acceptLeft', conflictId });
		}

		function acceptRight(conflictId) {
			vscode.postMessage({ command: 'acceptRight', conflictId });
		}

		function acceptBoth(conflictId) {
			vscode.postMessage({ command: 'acceptBoth', conflictId });
		}

		function acceptAllLeft() {
			vscode.postMessage({ command: 'acceptAllLeft' });
		}

		function acceptAllRight() {
			vscode.postMessage({ command: 'acceptAllRight' });
		}

		function cancel() {
			vscode.postMessage({ command: 'cancel' });
		}

		function saveResult() {
			// Collect all result content and build final file
			const resultContent = buildFinalContent();
			vscode.postMessage({ command: 'save', resultContent });
		}

		function buildFinalContent() {
			const originalContent = ${JSON.stringify(this._conflict.fullContent)};
			const lines = originalContent.split('\\n');
			const result = [];
			let skipUntil = -1;

			const conflicts = ${JSON.stringify(conflicts)};

			for (let i = 0; i < lines.length; i++) {
				if (i <= skipUntil) {
					continue;
				}

				const conflict = conflicts.find(c => c.startLine === i);
				if (conflict) {
					const editor = document.getElementById('result-' + conflict.id);
					const resolvedContent = editor.value;
					if (resolvedContent) {
						result.push(...resolvedContent.split('\\n'));
					}
					skipUntil = conflict.endLine;
				} else {
					result.push(lines[i]);
				}
			}

			return result.join('\\n');
		}

		// Handle messages from extension
		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.command) {
				case 'updateConflict':
					const editor = document.getElementById('result-' + message.conflictId);
					if (editor) {
						editor.value = message.content;
						editor.classList.add('has-content');
						resolutions.set(message.conflictId, message.content);
						updateStatus();
					}
					break;
				case 'updateAllConflicts':
					message.resolutions.forEach(r => {
						const ed = document.getElementById('result-' + r.id);
						if (ed) {
							ed.value = r.content;
							ed.classList.add('has-content');
							resolutions.set(r.id, r.content);
						}
					});
					updateStatus();
					break;
			}
		});

		// Setup textarea change listeners
		document.querySelectorAll('.result-editor').forEach(textarea => {
			textarea.addEventListener('input', (e) => {
				const conflictId = parseInt(e.target.dataset.conflictId);
				const content = e.target.value;
				resolutions.set(conflictId, content);
				
				if (content.trim().length > 0) {
					e.target.classList.add('has-content');
				} else {
					e.target.classList.remove('has-content');
				}
				
				vscode.postMessage({ 
					command: 'updateResolution', 
					conflictId, 
					content 
				});
				updateStatus();
			});
		});

		// Keyboard shortcuts
		document.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				const saveBtn = document.getElementById('saveBtn');
				if (!saveBtn.disabled) {
					saveResult();
				}
			}
		});

		// Initial status update
		updateStatus();
	</script>
</body>
</html>`;
	}
}

/**
 * Show merge conflict resolver
 */
export async function showMergeConflictResolver(uri?: vscode.Uri) {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showErrorMessage("No workspace folder found.");
		return;
	}

	const filePath = uri?.fsPath;
	await MergeConflictPanel.create(
		workspaceFolder.uri,
		filePath
	);
}
