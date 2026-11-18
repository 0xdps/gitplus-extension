import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const {
	ConflictParseError,
	applyResolutionLines,
	contentHasConflictMarkers,
	lineKinds,
	parseConflictedText,
} = require("../out/merge/conflicts.js");

describe("parseConflictedText", () => {
	it("keeps the surrounding file and both sides", () => {
		const parsed = parseConflictedText(
			["before", "<<<<<<< HEAD", "left", "=======", "right", ">>>>>>> topic", "after", ""].join("\n"),
		);

		assert.equal(parsed.conflicts.length, 1);
		assert.equal(parsed.trailingNewline, true);
		assert.deepEqual(parsed.conflicts[0].oursLines, ["left"]);
		assert.deepEqual(parsed.conflicts[0].theirsLines, ["right"]);
		assert.equal(parsed.conflicts[0].oursLabel, "HEAD");
		assert.equal(parsed.conflicts[0].theirsLabel, "topic");
		assert.equal(parsed.conflicts[0].baseLines, undefined);

		const merged = applyResolutionLines(parsed, new Map([[0, ["left"]]]));
		assert.equal(merged, "before\nleft\nafter\n");
	});

	it("keeps a diff3 base out of the current side", () => {
		const parsed = parseConflictedText(
			[
				"<<<<<<< Updated upstream",
				"left",
				"||||||| parent of abc",
				"original",
				"=======",
				"right",
				">>>>>>> feature/one",
				"",
			].join("\n"),
		);
		const conflict = parsed.conflicts[0];
		assert.deepEqual(conflict.oursLines, ["left"]);
		assert.deepEqual(conflict.baseLines, ["original"]);
		assert.deepEqual(conflict.theirsLines, ["right"]);
		assert.equal(conflict.oursLabel, "Updated upstream");
		assert.equal(conflict.baseLabel, "parent of abc");
		assert.equal(conflict.theirsLabel, "feature/one");
	});

	it("distinguishes an empty side from a blank line", () => {
		const parsed = parseConflictedText(
			["start", "<<<<<<< HEAD", "", "=======", "incoming", ">>>>>>> branch", "end", ""].join("\n"),
		);
		assert.deepEqual(parsed.conflicts[0].oursLines, [""]);
		assert.deepEqual(parsed.conflicts[0].theirsLines, ["incoming"]);

		assert.equal(
			applyResolutionLines(parsed, new Map([[0, [""]]])),
			"start\n\nend\n",
		);
		assert.equal(
			applyResolutionLines(parsed, new Map([[0, []]])),
			"start\nend\n",
		);
	});

	it("removes a conflict that is the whole file", () => {
		const parsed = parseConflictedText(
			["<<<<<<< HEAD", "left", "=======", "right", ">>>>>>> topic", ""].join("\n"),
		);
		assert.equal(applyResolutionLines(parsed, new Map([[0, []]])), "");
		assert.equal(applyResolutionLines(parsed, new Map([[0, ["left", "right"]]])), "left\nright\n");
	});

	it("preserves CRLF and a missing final newline", () => {
		const crlf = "a\r\n<<<<<<< HEAD\r\nleft\r\n=======\r\nright\r\n>>>>>>> topic\r\nb\r\n";
		const parsed = parseConflictedText(crlf);
		assert.equal(parsed.eol, "\r\n");
		assert.equal(applyResolutionLines(parsed, new Map([[0, ["left"]]])), "a\r\nleft\r\nb\r\n");

		const noTrailing = "a\n<<<<<<< HEAD\nleft\n=======\nright\n>>>>>>> topic\nb";
		const plain = parseConflictedText(noTrailing);
		assert.equal(plain.trailingNewline, false);
		assert.equal(applyResolutionLines(plain, new Map([[0, ["left"]]])), "a\nleft\nb");
	});

	it("accepts longer conflict markers and ignores marker-like text outside a conflict", () => {
		const parsed = parseConflictedText(
			["note ======= stays", "<<<<<<<< HEAD", "left", "========", "right", ">>>>>>>> topic", ""].join("\n"),
		);
		assert.equal(parsed.conflicts.length, 1);
		assert.deepEqual(parsed.conflicts[0].oursLines, ["left"]);
		assert.equal(parsed.lines[0], "note ======= stays");
	});

	it("rejects unclosed, nested, and separator-less conflicts", () => {
		assert.throws(
			() => parseConflictedText("<<<<<<< HEAD\nleft\n"),
			(error) => error instanceof ConflictParseError && /closing/.test(error.message),
		);
		assert.throws(
			() => parseConflictedText("<<<<<<< HEAD\n<<<<<<< HEAD\n=======\nb\n>>>>>>> x\n"),
			(error) => error instanceof ConflictParseError && /another opening/.test(error.message),
		);
		assert.throws(
			() => parseConflictedText("<<<<<<< HEAD\nleft\n>>>>>>> topic\n"),
			(error) => error instanceof ConflictParseError && /separator/.test(error.message),
		);
	});

	it("counts the gap between conflicts once", () => {
		const prefix = Array.from({ length: 10 }, (_, index) => `p${index}`);
		const middle = Array.from({ length: 10 }, (_, index) => `m${index}`);
		const block = (left, right) => ["<<<<<<< HEAD", left, "=======", right, ">>>>>>> branch"];
		const text = [...prefix, ...block("L1", "R1"), ...middle, ...block("L2", "R2"), "s0", "s1"].join("\n") + "\n";
		const parsed = parseConflictedText(text);

		assert.deepEqual(parsed.conflicts[0].beforeContext, ["p7", "p8", "p9"]);
		assert.equal(parsed.conflicts[0].hiddenBefore, 7);
		assert.deepEqual(parsed.conflicts[0].afterContext, ["m0", "m1", "m2"]);
		assert.equal(parsed.conflicts[0].hiddenAfter, 4);
		assert.equal(parsed.conflicts[1].hiddenBefore, 0);
		assert.deepEqual(parsed.conflicts[1].beforeContext, ["m7", "m8", "m9"]);
		assert.deepEqual(parsed.conflicts[1].afterContext, ["s0", "s1"]);
		assert.equal(parsed.conflicts[1].hiddenAfter, 0);
	});

	it("requires a resolution for every conflict", () => {
		const parsed = parseConflictedText("<<<<<<< HEAD\na\n=======\nb\n>>>>>>> c\n");
		assert.throws(() => applyResolutionLines(parsed, new Map()), /not resolved/);
	});
});

describe("conflict markers and line diff", () => {
	it("detects a complete marker pair", () => {
		assert.equal(contentHasConflictMarkers("<<<<<<< HEAD\n=======\n>>>>>>> x\n"), true);
		assert.equal(contentHasConflictMarkers("<<<<<<< almost\n"), false);
		assert.equal(contentHasConflictMarkers("const value = 1;\n"), false);
	});

	it("marks inserted and deleted lines", () => {
		const kinds = lineKinds(["a", "b", "c"], ["a", "x", "c"]);
		assert.deepEqual(kinds.left, ["same", "del", "same"]);
		assert.deepEqual(kinds.right, ["same", "add", "same"]);
		assert.deepEqual(lineKinds([], ["only"]).right, ["add"]);
	});
});
