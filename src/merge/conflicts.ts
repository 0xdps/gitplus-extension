export class ConflictParseError extends Error {
	readonly line: number;

	constructor(line: number, message: string) {
		super(message);
		this.name = "ConflictParseError";
		this.line = line;
	}
}

export interface ConflictBlock {
	id: number;
	startLine: number;
	endLine: number;
	oursLines: string[];
	theirsLines: string[];
	/** Present when Git wrote a diff3 base marker, even if that side is empty. */
	baseLines?: string[];
	oursLabel: string;
	theirsLabel: string;
	baseLabel?: string;
	beforeContext: string[];
	afterContext: string[];
	hiddenBefore: number;
	hiddenAfter: number;
}

export interface ParsedConflicts {
	eol: "\n" | "\r\n";
	trailingNewline: boolean;
	lines: string[];
	conflicts: ConflictBlock[];
}

const OURS_MARKER = /^<{7,}(.*)$/;
const BASE_MARKER = /^\|{7,}(.*)$/;
const SEPARATOR = /^={7,}\s*$/;
const THEIRS_MARKER = /^>{7,}(.*)$/;
const DEFAULT_CONTEXT_LINES = 3;

export function parseConflictedText(
	content: string,
	contextLines = DEFAULT_CONTEXT_LINES,
): ParsedConflicts {
	const split = splitLines(content);
	const conflicts: ConflictBlock[] = [];
	let nextId = 0;
	let region: "ours" | "base" | "theirs" | null = null;
	let start = -1;
	let sawBase = false;
	let oursLabel = "";
	let baseLabel = "";
	let ours: string[] = [];
	let base: string[] = [];
	let theirs: string[] = [];

	const fail = (lineIndex: number, message: string): never => {
		throw new ConflictParseError(lineIndex + 1, message);
	};

	for (let index = 0; index < split.lines.length; index++) {
		const line = split.lines[index];
		const oursMatch = OURS_MARKER.exec(line);

		if (oursMatch) {
			if (region !== null) {
				fail(
					start,
					`Conflict on line ${start + 1} contains another opening marker before it closes.`,
				);
			}
			region = "ours";
			start = index;
			sawBase = false;
			oursLabel = oursMatch[1].trim();
			baseLabel = "";
			ours = [];
			base = [];
			theirs = [];
			continue;
		}

		if (region === null) {
			continue;
		}

		const baseMatch = BASE_MARKER.exec(line);
		if (baseMatch) {
			if (region !== "ours" || sawBase) {
				fail(start, `Conflict on line ${start + 1} has a base marker in an unexpected place.`);
			}
			region = "base";
			sawBase = true;
			baseLabel = baseMatch[1].trim();
			continue;
		}

		if (SEPARATOR.test(line)) {
			if (region !== "ours" && region !== "base") {
				fail(start, `Conflict on line ${start + 1} has an extra separator.`);
			}
			region = "theirs";
			continue;
		}

		const theirsMatch = THEIRS_MARKER.exec(line);
		if (theirsMatch) {
			if (region !== "theirs") {
				fail(start, `Conflict on line ${start + 1} is missing the ======= separator.`);
			}
			const block: ConflictBlock = {
				id: nextId++,
				startLine: start,
				endLine: index,
				oursLines: ours,
				theirsLines: theirs,
				oursLabel,
				theirsLabel: theirsMatch[1].trim(),
				beforeContext: [],
				afterContext: [],
				hiddenBefore: 0,
				hiddenAfter: 0,
			};
			if (sawBase) {
				block.baseLines = base;
				block.baseLabel = baseLabel;
			}
			conflicts.push(block);
			region = null;
			continue;
		}

		if (region === "ours") {
			ours.push(line);
		} else if (region === "base") {
			base.push(line);
		} else {
			theirs.push(line);
		}
	}

	if (region !== null) {
		fail(start, `Conflict on line ${start + 1} is missing the closing >>>>>>> marker.`);
	}

	attachContext(split.lines, conflicts, contextLines);
	return { ...split, conflicts };
}

/**
 * Replace each conflict with the chosen lines.
 * An empty array removes the conflict. A single empty string keeps one blank line.
 */
export function applyResolutionLines(
	parsed: ParsedConflicts,
	resolutions: ReadonlyMap<number, readonly string[]>,
): string {
	const out: string[] = [];
	let cursor = 0;

	for (const conflict of parsed.conflicts) {
		if (cursor > conflict.startLine) {
			throw new Error(`Conflict ${conflict.id + 1} overlaps an earlier conflict.`);
		}
		if (!resolutions.has(conflict.id)) {
			throw new Error(`Conflict ${conflict.id + 1} is not resolved.`);
		}
		out.push(...parsed.lines.slice(cursor, conflict.startLine));
		const chosen = resolutions.get(conflict.id) ?? [];
		out.push(...chosen.map((line) => line.replace(/\r/g, "")));
		cursor = conflict.endLine + 1;
	}

	out.push(...parsed.lines.slice(cursor));
	if (out.length === 0) {
		return "";
	}

	let text = out.join(parsed.eol);
	if (parsed.trailingNewline) {
		text += parsed.eol;
	}
	return text;
}

export function contentHasConflictMarkers(content: string): boolean {
	let open = false;
	for (const line of content.split(/\r?\n/)) {
		if (!open) {
			if (OURS_MARKER.test(line)) {
				open = true;
			}
		} else if (THEIRS_MARKER.test(line)) {
			return true;
		}
	}
	return false;
}

export interface LineKindResult {
	left: Array<"same" | "del">;
	right: Array<"same" | "add">;
}

export function lineKinds(left: readonly string[], right: readonly string[]): LineKindResult {
	if (left.length === 0 || right.length === 0 || left.length * right.length > 40_000) {
		return {
			left: left.map(() => "del"),
			right: right.map(() => "add"),
		};
	}

	const leftCount = left.length;
	const rightCount = right.length;
	const scores: number[][] = Array.from({ length: leftCount + 1 }, () =>
		new Array<number>(rightCount + 1).fill(0),
	);

	for (let i = leftCount - 1; i >= 0; i--) {
		for (let j = rightCount - 1; j >= 0; j--) {
			scores[i][j] =
				left[i] === right[j]
					? scores[i + 1][j + 1] + 1
					: Math.max(scores[i + 1][j], scores[i][j + 1]);
		}
	}

	const leftKinds: Array<"same" | "del"> = [];
	const rightKinds: Array<"same" | "add"> = [];
	let i = 0;
	let j = 0;
	while (i < leftCount && j < rightCount) {
		if (left[i] === right[j]) {
			leftKinds.push("same");
			rightKinds.push("same");
			i++;
			j++;
		} else if (scores[i + 1][j] >= scores[i][j + 1]) {
			leftKinds.push("del");
			i++;
		} else {
			rightKinds.push("add");
			j++;
		}
	}
	while (i < leftCount) {
		leftKinds.push("del");
		i++;
	}
	while (j < rightCount) {
		rightKinds.push("add");
		j++;
	}

	return { left: leftKinds, right: rightKinds };
}

function splitLines(content: string): Pick<ParsedConflicts, "eol" | "trailingNewline" | "lines"> {
	const eol: "\n" | "\r\n" = content.includes("\r\n") ? "\r\n" : "\n";
	const normalized = eol === "\r\n" ? content.replace(/\r\n/g, "\n") : content;
	const trailingNewline = normalized.endsWith("\n");
	const lines = normalized.split("\n");
	if (trailingNewline) {
		lines.pop();
	}
	return { eol, trailingNewline, lines };
}

/**
 * Show a few unchanged lines around each conflict, and count the rest once
 * so neighboring conflicts do not repeat the same gap.
 */
function attachContext(lines: string[], conflicts: ConflictBlock[], contextLines: number): void {
	let cursor = 0;
	conflicts.forEach((conflict, index) => {
		const availableBefore = Math.max(0, conflict.startLine - cursor);
		const beforeCount = Math.min(contextLines, availableBefore);
		const beforeStart = conflict.startLine - beforeCount;
		conflict.hiddenBefore = beforeStart - cursor;
		conflict.beforeContext = lines.slice(beforeStart, conflict.startLine);

		const nextStart = index + 1 < conflicts.length ? conflicts[index + 1].startLine : lines.length;
		const gapStart = conflict.endLine + 1;
		const gap = Math.max(0, nextStart - gapStart);
		const keepForNext =
			index + 1 < conflicts.length ? Math.min(contextLines, Math.floor(gap / 2)) : 0;
		const afterCount = Math.min(contextLines, gap - keepForNext);
		conflict.afterContext = lines.slice(gapStart, gapStart + afterCount);
		const nextCursor = index + 1 < conflicts.length ? nextStart - keepForNext : lines.length;
		conflict.hiddenAfter = nextCursor - (gapStart + afterCount);
		cursor = nextCursor;
	});
}
