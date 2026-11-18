import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const conflicts = require("../out/merge/conflicts.js");
const gitApi = require("../out/merge/git.js");

let hasGit = true;
try {
	execFileSync("git", ["--version"], { stdio: "ignore" });
} catch {
	hasGit = false;
}

function runGit(cwd, args) {
	return new Promise((resolve, reject) => {
		execFile(
			"git",
			args,
			{
				cwd,
				encoding: "utf8",
				env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
			},
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error((stderr || error.message).trim()));
					return;
				}
				resolve(stdout);
			},
		);
	});
}

async function initRepo() {
	const dir = await mkdtemp(path.join(tmpdir(), "gitplus-merge-"));
	const hooks = path.join(dir, "empty-hooks");
	await mkdir(hooks);
	await runGit(dir, ["init", "-b", "main"]);
	await runGit(dir, ["config", "user.email", "gitplus@example.com"]);
	await runGit(dir, ["config", "user.name", "GitPlus"]);
	await runGit(dir, ["config", "commit.gpgsign", "false"]);
	await runGit(dir, ["config", "core.hooksPath", hooks]);
	return dir;
}

async function commitFile(dir, name, content, message) {
	await writeFile(path.join(dir, name), content);
	await runGit(dir, ["add", "--", name]);
	await runGit(dir, ["commit", "-m", message]);
}

describe("unmerged git files", { skip: !hasGit && "git is not installed" }, () => {
	it("skips a folder that is not a repository", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "gitplus-empty-"));
		try {
			assert.deepEqual(await gitApi.collectWorkspaceUnmerged([dir]), []);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("parses a diff3 merge and stages the current side", async () => {
		const dir = await initRepo();
		try {
			await commitFile(dir, "file.txt", "base\n", "base");
			await runGit(dir, ["checkout", "-b", "feature"]);
			await commitFile(dir, "file.txt", "feature\n", "feature");
			await runGit(dir, ["checkout", "main"]);
			await commitFile(dir, "file.txt", "main\n", "main");
			await runGit(dir, ["config", "merge.conflictStyle", "diff3"]);
			await assert.rejects(runGit(dir, ["merge", "feature"]));

			assert.equal(await gitApi.detectOperation(dir), "merge");
			const [file] = await gitApi.listUnmerged(dir);
			assert.equal(file.relativePath, "file.txt");
			assert.deepEqual(file.stages, [1, 2, 3]);
			assert.equal(file.binary, false);

			const parsed = conflicts.parseConflictedText(await readFile(file.absolutePath, "utf8"));
			assert.deepEqual(parsed.conflicts[0].oursLines, ["main"]);
			assert.deepEqual(parsed.conflicts[0].theirsLines, ["feature"]);
			assert.deepEqual(parsed.conflicts[0].baseLines, ["base"]);

			await gitApi.takeSide(file, "ours");
			const status = await runGit(dir, ["status", "--porcelain"]);
			assert.doesNotMatch(status, /^(UU|UD|DU|AA|DD|AU|UA)/m);
			assert.equal(await readFile(file.absolutePath, "utf8"), "main\n");
			assert.equal(await gitApi.getUnmergedFile(file.absolutePath), undefined);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("accepts a deletion from the incoming side", async () => {
		const dir = await initRepo();
		try {
			await commitFile(dir, "gone.txt", "keep\n", "add");
			await runGit(dir, ["checkout", "-b", "feature"]);
			await runGit(dir, ["rm", "gone.txt"]);
			await runGit(dir, ["commit", "-m", "delete"]);
			await runGit(dir, ["checkout", "main"]);
			await commitFile(dir, "gone.txt", "changed\n", "edit");
			await assert.rejects(runGit(dir, ["merge", "feature"]));

			const [file] = await gitApi.listUnmerged(dir);
			assert.equal(file.stages.includes(2), true);
			assert.equal(file.stages.includes(3), false);
			await gitApi.takeSide(file, "theirs");

			const status = await runGit(dir, ["status", "--porcelain"]);
			assert.doesNotMatch(status, /^(UU|UD|DU|AA|DD|AU|UA)/m);
			await assert.rejects(readFile(path.join(dir, "gone.txt"), "utf8"));
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("recognizes a rebase and which side is the replayed commit", async () => {
		const dir = await initRepo();
		try {
			await commitFile(dir, "file.txt", "base\n", "base");
			await runGit(dir, ["checkout", "-b", "feature"]);
			await commitFile(dir, "file.txt", "feature\n", "feature");
			await runGit(dir, ["checkout", "main"]);
			await commitFile(dir, "file.txt", "main\n", "main");
			await runGit(dir, ["checkout", "feature"]);
			await assert.rejects(runGit(dir, ["rebase", "main"]));

			assert.equal(await gitApi.detectOperation(dir), "rebase");
			const [file] = await gitApi.listUnmerged(dir);
			const parsed = conflicts.parseConflictedText(await readFile(file.absolutePath, "utf8"));
			assert.deepEqual(parsed.conflicts[0].oursLines, ["main"]);
			assert.deepEqual(parsed.conflicts[0].theirsLines, ["feature"]);
			assert.match(gitApi.operationCopy("rebase").note, /rebasing onto/);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
