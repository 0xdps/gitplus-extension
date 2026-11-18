import * as path from "path";
import * as vscode from "vscode";
import { randomBytes } from "crypto";
import { ConflictBlock, ParsedConflicts } from "./conflicts";
import { UnmergedFile } from "./git";
import { renderMergePage } from "./webview";

export interface ResolutionPayload {
	id: number;
	lines: string[];
	resolved: boolean;
}

export interface MergePanelOptions {
	extensionUri: vscode.Uri;
	file: UnmergedFile;
	parsed: ParsedConflicts;
	originalText: string;
	currentHeading: string;
	incomingHeading: string;
	note?: string;
	onSave: (resolutions: ResolutionPayload[]) => Promise<boolean>;
	onAfterSave: () => Promise<void>;
}

export class MergeConflictPanel {
	public static current: MergeConflictPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _disposables: vscode.Disposable[] = [];
	private _dirty = false;
	private _saving = false;
	private _disposed = false;

	public static async open(options: MergePanelOptions): Promise<void> {
		const existing = MergeConflictPanel.current;
		if (existing && !existing._disposed) {
			const sameSnapshot =
				existing._options.file.absolutePath === options.file.absolutePath &&
				existing._options.originalText === options.originalText;
			if (sameSnapshot) {
				existing._panel.reveal(vscode.ViewColumn.Active);
				return;
			}
			if (existing._dirty) {
				const choice = await vscode.window.showWarningMessage(
					"The open merge editor has unsaved resolutions.",
					{ modal: true },
					"Discard",
				);
				if (choice !== "Discard") {
					existing._panel.reveal(vscode.ViewColumn.Active);
					return;
				}
			}
			existing.dispose();
		}

		MergeConflictPanel.current = new MergeConflictPanel(options);
	}

	private constructor(private readonly _options: MergePanelOptions) {
		const nonce = randomBytes(16).toString("hex");
		this._panel = vscode.window.createWebviewPanel(
			"gitplusMergeConflict",
			`Merge ${path.basename(_options.file.absolutePath)}`,
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [_options.extensionUri],
			},
		);
		this._panel.webview.html = renderMergePage({
			nonce,
			relativePath: _options.file.relativePath,
			currentHeading: _options.currentHeading,
			incomingHeading: _options.incomingHeading,
			note: _options.note,
			conflicts: _options.parsed.conflicts.map(toViewConflict),
		});

		this._panel.webview.onDidReceiveMessage(
			(message: unknown) => {
				void this._onMessage(message);
			},
			null,
			this._disposables,
		);
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public dispose(): void {
		if (this._disposed) {
			return;
		}
		this._disposed = true;
		if (MergeConflictPanel.current === this) {
			MergeConflictPanel.current = undefined;
		}
		this._panel.dispose();
		while (this._disposables.length > 0) {
			this._disposables.pop()?.dispose();
		}
	}

	private async _onMessage(message: unknown): Promise<void> {
		if (!message || typeof message !== "object" || !("command" in message)) {
			return;
		}
		const command = (message as { command?: unknown }).command;
		if (command === "dirty") {
			const dirty = (message as { dirty?: unknown }).dirty;
			if (typeof dirty === "boolean") {
				this._dirty = dirty;
			}
			return;
		}
		if (command === "cancel") {
			await this._cancel();
			return;
		}
		if (command === "save") {
			await this._save(message);
		}
	}

	private async _cancel(): Promise<void> {
		if (this._dirty) {
			const choice = await vscode.window.showWarningMessage(
				"Discard these merge resolutions?",
				{ modal: true },
				"Discard",
			);
			if (choice !== "Discard") {
				return;
			}
		}
		this.dispose();
	}

	private async _save(message: unknown): Promise<void> {
		if (this._saving) {
			return;
		}
		const resolutions = readResolutions(message, this._options.parsed.conflicts);
		if (!resolutions) {
			void vscode.window.showErrorMessage("Resolve every conflict before staging.");
			this._failSave();
			return;
		}

		this._saving = true;
		try {
			const saved = await this._options.onSave(resolutions);
			if (!saved) {
				this._failSave();
				return;
			}
			const afterSave = this._options.onAfterSave;
			this._dirty = false;
			this.dispose();
			await afterSave();
		} catch (error) {
			const text = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(text);
			this._failSave();
		} finally {
			this._saving = false;
		}
	}

	private _failSave(): void {
		if (!this._disposed) {
			void this._panel.webview.postMessage({ command: "saveFailed" });
		}
	}
}

function toViewConflict(conflict: ConflictBlock) {
	return {
		id: conflict.id,
		oursLabel: conflict.oursLabel,
		theirsLabel: conflict.theirsLabel,
		baseLabel: conflict.baseLabel,
		oursLines: conflict.oursLines,
		theirsLines: conflict.theirsLines,
		baseLines: conflict.baseLines,
		before: conflict.beforeContext,
		after: conflict.afterContext,
		hiddenBefore: conflict.hiddenBefore,
		hiddenAfter: conflict.hiddenAfter,
	};
}

function readResolutions(message: unknown, conflicts: readonly ConflictBlock[]): ResolutionPayload[] | undefined {
	if (!message || typeof message !== "object" || !("resolutions" in message)) {
		return undefined;
	}
	const value = (message as { resolutions?: unknown }).resolutions;
	if (!Array.isArray(value)) {
		return undefined;
	}

	const byId = new Map<number, ResolutionPayload>();
	for (const entry of value) {
		if (!entry || typeof entry !== "object") {
			return undefined;
		}
		const record = entry as { id?: unknown; lines?: unknown; resolved?: unknown };
		if (typeof record.id !== "number" || typeof record.resolved !== "boolean" || !Array.isArray(record.lines)) {
			return undefined;
		}
		if (!record.lines.every((line) => typeof line === "string")) {
			return undefined;
		}
		byId.set(record.id, { id: record.id, lines: record.lines, resolved: record.resolved });
	}

	const payloads: ResolutionPayload[] = [];
	for (const conflict of conflicts) {
		const payload = byId.get(conflict.id);
		if (!payload?.resolved) {
			return undefined;
		}
		payloads.push(payload);
	}
	return payloads;
}
