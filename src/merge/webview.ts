import { lineKinds } from "./conflicts";

export interface MergeViewConflict {
	id: number;
	oursLabel: string;
	theirsLabel: string;
	baseLabel?: string;
	oursLines: string[];
	theirsLines: string[];
	baseLines?: string[];
	before: string[];
	after: string[];
	hiddenBefore: number;
	hiddenAfter: number;
}

export interface MergeViewModel {
	nonce: string;
	relativePath: string;
	currentHeading: string;
	incomingHeading: string;
	note?: string;
	conflicts: MergeViewConflict[];
}

export function renderMergePage(model: MergeViewModel): string {
	const data = model.conflicts.map((conflict) => ({
		id: conflict.id,
		oursLines: conflict.oursLines,
		theirsLines: conflict.theirsLines,
	}));
	const total = model.conflicts.length;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${model.nonce}'; script-src 'nonce-${model.nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Merge ${escapeHtml(model.relativePath)}</title>
	<style nonce="${model.nonce}">
		:root {
			color-scheme: light dark;
			--ink: var(--vscode-editor-foreground);
			--muted: var(--vscode-descriptionForeground);
			--bg: var(--vscode-editor-background);
			--bar: var(--vscode-sideBar-background);
			--line: var(--vscode-panel-border, var(--vscode-widget-border, transparent));
			--fill: var(--vscode-input-background);
			--accent: var(--vscode-button-background);
			--accent-ink: var(--vscode-button-foreground);
			--focus: var(--vscode-focusBorder);
			--removed: var(--vscode-diffEditor-removedLineBackground, var(--vscode-diffEditor-removedTextBackground));
			--added: var(--vscode-diffEditor-insertedLineBackground, var(--vscode-diffEditor-insertedTextBackground));
			--mono: var(--vscode-editor-font-family, monospace);
			--ui: var(--vscode-font-family);
			--size: var(--vscode-editor-font-size, 13px);
		}

		* { box-sizing: border-box; }
		html, body { height: 100%; }
		body {
			margin: 0;
			background: var(--bg);
			color: var(--ink);
			font-family: var(--ui);
			font-size: 13px;
			display: flex;
			flex-direction: column;
		}

		.top, .bottom {
			flex: 0 0 auto;
			background: var(--bar);
			border-color: var(--line);
		}
		.top { border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 2; }
		.bottom { border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 10px 16px; }
		.identity, .toolbar, .actions, .jump { display: flex; align-items: center; gap: 8px; }
		.identity { justify-content: space-between; padding: 12px 16px 8px; gap: 16px; }
		.toolbar { padding: 0 16px 12px; justify-content: space-between; flex-wrap: wrap; }
		h1 { margin: 0; font-size: 13px; font-weight: 650; }
		.path, .hint, .gap, .note, .footer-copy, .marker { color: var(--muted); }
		.path, .marker { font-family: var(--mono); font-size: 12px; }
		.note { margin: 0 16px 10px; font-size: 12px; }
		.footer-copy { font-size: 12px; }
		.progress { font-variant-numeric: tabular-nums; }
		.progress strong { color: var(--ink); font-weight: 650; }

		button, textarea { font: inherit; color: inherit; }
		button {
			border: 1px solid transparent;
			background: var(--vscode-button-secondaryBackground, var(--fill));
			color: var(--vscode-button-secondaryForeground, var(--ink));
			border-radius: 4px;
			padding: 4px 8px;
			cursor: pointer;
		}
		button.primary {
			background: var(--accent);
			color: var(--accent-ink);
		}
		button:focus-visible, textarea:focus-visible { outline: 1px solid var(--focus); outline-offset: 1px; }
		button:disabled { opacity: 0.45; cursor: default; }
		button.quiet { background: transparent; border-color: var(--line); }

		.rail { display: flex; flex-wrap: wrap; gap: 4px; }
		.rail button {
			width: 16px;
			height: 8px;
			padding: 0;
			border-radius: 99px;
			background: var(--fill);
		}
		.rail button.done { background: var(--vscode-gitDecoration-addedResourceForeground, var(--accent)); }
		.rail button.current { outline: 1px solid var(--focus); outline-offset: 1px; }

		main { flex: 1 1 auto; overflow: auto; padding: 16px; }
		.conflict { border: 1px solid var(--line); border-radius: 8px; margin: 0 0 16px; scroll-margin-top: 108px; }
		.conflict-head, .column-head {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			background: var(--bar);
		}
		.conflict-head { border-bottom: 1px solid var(--line); }
		.column-head { border-bottom: 1px solid var(--line); min-height: 36px; }
		.pill {
			font-size: 11px;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			color: var(--vscode-editorWarning-foreground, var(--muted));
		}
		.conflict[data-resolved="true"] .pill { color: var(--vscode-gitDecoration-addedResourceForeground, var(--accent)); }
		.group { display: flex; flex-wrap: wrap; gap: 6px; }

		.columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1fr); }
		.column { min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); }
		.column:last-child { border-right: 0; }
		.column.current .column-head strong { color: var(--vscode-gitDecoration-modifiedResourceForeground, var(--ink)); }
		.column.incoming .column-head strong { color: var(--vscode-gitDecoration-addedResourceForeground, var(--ink)); }
		.code, textarea { font-family: var(--mono); font-size: var(--size); line-height: 1.45; }
		.code { overflow: auto; padding: 4px 0; }
		.code-line { display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); white-space: pre-wrap; word-break: break-word; }
		.code-line.del { background: var(--removed); }
		.code-line.add { background: var(--added); }
		.ln { color: var(--vscode-editorLineNumber-foreground, var(--muted)); text-align: right; padding: 0 8px 0 4px; user-select: none; }
		.lt { padding-right: 8px; }
		.context { opacity: 0.72; }
		.gap { margin: 0; padding: 6px 12px; font-size: 11px; }
		.empty-side, .hint { margin: 0; padding: 8px 12px; font-size: 12px; }
		.base { border-top: 1px solid var(--line); }
		.base summary { cursor: pointer; padding: 8px 12px; color: var(--muted); }
		textarea {
			width: 100%;
			min-height: 9rem;
			flex: 1 1 auto;
			border: 0;
			resize: vertical;
			padding: 8px 10px;
			background: var(--bg);
		}
		textarea.resolved { box-shadow: inset 3px 0 0 var(--vscode-gitDecoration-addedResourceForeground, var(--focus)); }
		@media (max-width: 760px) {
			.columns { grid-template-columns: 1fr; }
			.column { border-right: 0; border-bottom: 1px solid var(--line); }
			.bottom, .identity { align-items: flex-start; flex-direction: column; }
		}
	</style>
</head>
<body>
	<header class="top">
		<div class="identity">
			<div>
				<h1>Resolve merge conflicts</h1>
				<div class="path">${escapeHtml(model.relativePath)}</div>
			</div>
			<div class="progress" aria-live="polite"><strong id="resolvedCount">0</strong> / ${total} resolved · <span id="statusText">Unresolved conflicts</span></div>
		</div>
		${model.note ? `<p class="note">${escapeHtml(model.note)}</p>` : ""}
		<div class="toolbar">
			<div class="jump">
				<div class="rail" id="rail">${railHtml(model.conflicts)}</div>
				<button type="button" class="quiet" data-action="prev">Previous</button>
				<button type="button" class="quiet" data-action="next">Next</button>
			</div>
			<div class="actions">
				<button type="button" data-action="all-current">Use current for all</button>
				<button type="button" data-action="all-incoming">Use incoming for all</button>
			</div>
		</div>
	</header>
	<main>
		${model.conflicts.map((conflict, index) => renderConflict(conflict, index, total, model)).join("")}
	</main>
	<footer class="bottom">
		<p class="footer-copy">Alt+Up and Alt+Down move between conflicts. Ctrl/Cmd+S stages the file.</p>
		<div class="actions">
			<button type="button" class="quiet" data-action="cancel">Cancel</button>
			<button type="button" class="primary" id="saveBtn" data-action="save" disabled>Stage merged file</button>
		</div>
	</footer>
	<script nonce="${model.nonce}">
		const vscode = acquireVsCodeApi();
		const conflicts = ${safeJson(data)};
		const state = new Map();
		let currentId = conflicts.length ? conflicts[0].id : 0;
		let saving = false;

		function entry(id) {
			return state.get(id);
		}

		function isResolved(id) {
			return entry(id)?.resolved === true;
		}

		function notify() {
			const dirty = conflicts.some((conflict) => isResolved(conflict.id));
			vscode.postMessage({ command: "dirty", dirty });
		}

		function updateHint(id) {
			const hint = document.getElementById("hint-" + id);
			const current = entry(id);
			const box = document.getElementById("result-" + id);
			if (!current || !current.resolved) {
				hint.hidden = true;
				return;
			}
			if (current.lines.length === 0) {
				hint.hidden = false;
				hint.textContent = "Conflict removed";
				return;
			}
			if (current.lines.length === 1 && current.lines[0] === "" && box.value === "") {
				hint.hidden = false;
				hint.textContent = "Blank line kept";
				return;
			}
			hint.hidden = true;
		}

		function updateProgress() {
			const done = conflicts.filter((conflict) => isResolved(conflict.id)).length;
			document.getElementById("resolvedCount").textContent = String(done);
			document.getElementById("statusText").textContent = done === conflicts.length ? "Ready to stage" : "Unresolved conflicts";
			document.getElementById("saveBtn").disabled = saving || done !== conflicts.length;
			document.querySelectorAll(".rail-seg").forEach((segment) => {
				const id = Number(segment.dataset.id);
				const resolved = isResolved(id);
				segment.classList.toggle("done", resolved);
				segment.classList.toggle("current", id === currentId);
				segment.setAttribute("aria-label", "Conflict " + (id + 1) + (resolved ? ", resolved" : ", unresolved"));
			});
			conflicts.forEach((conflict) => {
				const section = document.getElementById("conflict-" + conflict.id);
				const resolved = isResolved(conflict.id);
				section.dataset.resolved = resolved ? "true" : "false";
				section.querySelector(".pill").textContent = resolved ? "Resolved" : "Unresolved";
				document.getElementById("result-" + conflict.id).classList.toggle("resolved", resolved);
				updateHint(conflict.id);
			});
		}

		function choose(id, lines) {
			state.set(id, { lines: lines.slice(), resolved: true });
			document.getElementById("result-" + id).value = lines.join("\\n");
			updateProgress();
			notify();
		}

		function readBox(id) {
			const value = document.getElementById("result-" + id).value.replace(/\\r/g, "");
			state.set(id, { lines: value === "" ? [] : value.split("\\n"), resolved: true });
			updateProgress();
			notify();
		}

		function resetConflict(id) {
			state.delete(id);
			const box = document.getElementById("result-" + id);
			box.value = "";
			updateProgress();
			notify();
		}

		function conflictById(id) {
			return conflicts.find((conflict) => conflict.id === id);
		}

		function combine(first, second) {
			if (first.length === 0) return second.slice();
			if (second.length === 0) return first.slice();
			return first.concat(second);
		}

		function focusConflict(id) {
			currentId = id;
			const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			document.getElementById("conflict-" + id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
			document.getElementById("result-" + id)?.focus();
			updateProgress();
		}

		function move(delta) {
			const index = conflicts.findIndex((conflict) => conflict.id === currentId);
			const next = conflicts[index + delta];
			if (next) focusConflict(next.id);
		}

		function save() {
			if (saving || conflicts.some((conflict) => !isResolved(conflict.id))) return;
			saving = true;
			document.getElementById("saveBtn").disabled = true;
			vscode.postMessage({
				command: "save",
				resolutions: conflicts.map((conflict) => ({
					id: conflict.id,
					lines: entry(conflict.id).lines,
					resolved: true,
				})),
			});
		}

		document.body.addEventListener("click", (event) => {
			const button = event.target.closest("button[data-action]");
			if (!button) return;
			const action = button.dataset.action;
			const id = button.dataset.id === undefined ? undefined : Number(button.dataset.id);
			const conflict = id === undefined ? undefined : conflictById(id);
			if (action === "current" && conflict) choose(id, conflict.oursLines);
			else if (action === "incoming" && conflict) choose(id, conflict.theirsLines);
			else if (action === "both-current" && conflict) choose(id, combine(conflict.oursLines, conflict.theirsLines));
			else if (action === "both-incoming" && conflict) choose(id, combine(conflict.theirsLines, conflict.oursLines));
			else if (action === "neither" && id !== undefined) choose(id, []);
			else if (action === "reset" && id !== undefined) resetConflict(id);
			else if (action === "all-current") conflicts.forEach((item) => choose(item.id, item.oursLines));
			else if (action === "all-incoming") conflicts.forEach((item) => choose(item.id, item.theirsLines));
			else if (action === "jump" && id !== undefined) focusConflict(id);
			else if (action === "prev") move(-1);
			else if (action === "next") move(1);
			else if (action === "save") save();
			else if (action === "cancel") vscode.postMessage({ command: "cancel" });
		});

		document.querySelectorAll(".result").forEach((box) => {
			box.addEventListener("input", () => readBox(Number(box.dataset.id)));
		});

		document.addEventListener("keydown", (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "s") {
				event.preventDefault();
				save();
			} else if (event.altKey && event.key === "ArrowDown") {
				event.preventDefault();
				move(1);
			} else if (event.altKey && event.key === "ArrowUp") {
				event.preventDefault();
				move(-1);
			}
		});

		window.addEventListener("message", (event) => {
			if (event.data && event.data.command === "saveFailed") {
				saving = false;
				updateProgress();
			}
		});

		updateProgress();
	</script>
</body>
</html>`;
}

function renderConflict(
	conflict: MergeViewConflict,
	index: number,
	total: number,
	model: MergeViewModel,
): string {
	const kinds = lineKinds(conflict.oursLines, conflict.theirsLines);
	const base =
		conflict.baseLines === undefined
			? ""
			: `<details class="base"><summary>Base${conflict.baseLabel ? ` · ${escapeHtml(conflict.baseLabel)}` : ""}</summary>${renderCode(conflict.baseLines)}</details>`;

	return `<section class="conflict" id="conflict-${conflict.id}" data-conflict-id="${conflict.id}" data-resolved="false">
		<div class="conflict-head">
			<strong>Conflict ${index + 1} of ${total}</strong>
			<div class="group">
				<button type="button" data-action="both-current" data-id="${conflict.id}">Current, then incoming</button>
				<button type="button" data-action="both-incoming" data-id="${conflict.id}">Incoming, then current</button>
				<button type="button" data-action="neither" data-id="${conflict.id}">Keep neither</button>
				<button type="button" class="quiet" data-action="reset" data-id="${conflict.id}">Mark unresolved</button>
			</div>
			<span class="pill">Unresolved</span>
		</div>
		${gapLabel(conflict.hiddenBefore, "above")}
		${renderContext(conflict.before)}
		<div class="columns">
			<div class="column current">
				<div class="column-head">
					<strong>${columnTitle(model.currentHeading, conflict.oursLabel)}</strong>
					<button type="button" data-action="current" data-id="${conflict.id}">Use current</button>
				</div>
				<div class="code">${renderCode(conflict.oursLines, kinds.left, "del")}</div>
			</div>
			<div class="column result-column">
				<div class="column-head"><strong>Result</strong></div>
				<textarea class="result" id="result-${conflict.id}" data-id="${conflict.id}" spellcheck="false" autocapitalize="off" aria-label="Resolution for conflict ${index + 1}" placeholder="Choose a side, or type the resolution."></textarea>
				<p class="hint" id="hint-${conflict.id}" hidden></p>
			</div>
			<div class="column incoming">
				<div class="column-head">
					<button type="button" data-action="incoming" data-id="${conflict.id}">Use incoming</button>
					<strong>${columnTitle(model.incomingHeading, conflict.theirsLabel)}</strong>
				</div>
				<div class="code">${renderCode(conflict.theirsLines, kinds.right, "add")}</div>
			</div>
		</div>
		${base}
		${renderContext(conflict.after)}
		${gapLabel(conflict.hiddenAfter, "below")}
	</section>`;
}

function renderContext(lines: string[]): string {
	if (lines.length === 0) {
		return "";
	}
	return `<div class="context">${renderCode(lines)}</div>`;
}

function renderCode(
	lines: string[],
	kinds?: ReadonlyArray<"same" | "del" | "add">,
	changed: "del" | "add" = "del",
): string {
	if (lines.length === 0) {
		return `<p class="empty-side">This side is empty</p>`;
	}
	return lines
		.map((line, index) => {
			const kind = kinds?.[index] === changed ? changed : "same";
			const text = line.length === 0 ? "\u00a0" : escapeHtml(line);
			return `<div class="code-line ${kind}"><span class="ln">${index + 1}</span><span class="lt">${text}</span></div>`;
		})
		.join("");
}

function gapLabel(count: number, where: "above" | "below"): string {
	if (count <= 0) {
		return "";
	}
	const noun = count === 1 ? "line" : "lines";
	return `<p class="gap">${count} unchanged ${noun} ${where}</p>`;
}

function railHtml(conflicts: readonly MergeViewConflict[]): string {
	return conflicts
		.map((conflict, index) => {
			return `<button type="button" class="rail-seg" data-action="jump" data-id="${conflict.id}" aria-label="Conflict ${index + 1}, unresolved"></button>`;
		})
		.join("");
}

function columnTitle(heading: string, label: string): string {
	if (!label || label.toLowerCase() === heading.toLowerCase()) {
		return escapeHtml(heading);
	}
	return `${escapeHtml(heading)} <span class="marker">${escapeHtml(label)}</span>`;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function safeJson(value: unknown): string {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}
