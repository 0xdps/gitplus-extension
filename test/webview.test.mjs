import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const { renderMergePage } = require("../out/merge/webview.js");

describe("merge webview", () => {
	it("escapes conflict text and keeps the editor script valid", () => {
		const html = renderMergePage({
			nonce: "abc123",
			relativePath: "src/app.ts",
			currentHeading: "Current branch",
			incomingHeading: "Incoming branch",
			note: "During a rebase, left is the target.",
			conflicts: [
				{
					id: 0,
					oursLabel: "HEAD",
					theirsLabel: "topic",
					oursLines: ["<script>alert(1)</script>"],
					theirsLines: ["ok"],
					baseLines: ["base <b>"],
					baseLabel: "parent",
					before: [],
					after: [],
					hiddenBefore: 0,
					hiddenAfter: 2,
				},
			],
		});

		assert.match(html, /script-src 'nonce-abc123'/);
		assert.match(html, /default-src 'none'/);
		assert.doesNotMatch(html, /<script>alert/);
		assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
		assert.match(html, /&lt;b&gt;/);
		assert.match(html, /Use current/);
		assert.match(html, /Keep neither/);
		assert.match(html, /Stage merged file/);
		assert.match(html, /Base · parent/);
		assert.match(html, /2 unchanged lines below/);
		assert.match(html, /During a rebase, left is the target\./);
		assert.match(html, /split\("\\n"\)/);
		assert.match(html, /join\("\\n"\)/);
	});
});
