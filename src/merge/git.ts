import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";

const TEXT_MODES = new Set(["100644", "100755"]);
const MAX_TEXT_BYTES = 1_000_000;

export class GitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitError";
	}
}

export type OperationKind = "merge" | "rebase" | "cherry-pick" | "revert" | "unknown";

export interface OperationCopy {
	current: string;
	incoming: string;
	note?: string;
}

export interface UnmergedFile {
	repoRoot: string;
	relativePath: string;
	absolutePath: string;
	stages: number[];
	exists: boolean;
	binary: boolean;
	large: boolean;
}

export function operationCopy(operation: OperationKind): OperationCopy {
	switch (operation) {
		case "rebase":
			return {
				current: "Rebase target",
				incoming: "Replayed commit",
				note: "During a rebase, the left side is the branch you are rebasing onto. The right side is your commit.",
			};
		case "cherry-pick":
			return {
				current: "Current branch",
				incoming: "Cherry-pick",
				note: "The right side is the commit being cherry-picked.",
			};
		case "revert":
			return {
				current: "Current branch",
				incoming: "Revert",
				note: "The right side is the revert of the selected commit.",
			};
		case "merge":
			return {
				current: "Current branch",
				incoming: "Incoming branch",
			};
		default:
			return { current: "Current", incoming: "Incoming" };
	}
}

export async function getRepoRoot(start: string): Promise<string> {
	const stdout = await execGit(cwdFor(start), ["rev-parse", "--show-toplevel"]);
	return canonical(stdout.trim());
}

export async function getUnmergedFile(absolutePath: string): Promise<UnmergedFile | undefined> {
	const repoRoot = await getRepoRoot(absolutePath);
	const relativePath = toGitPath(repoRoot, absolutePath);
	const stdout = await execGit(repoRoot, ["ls-files", "-u", "-z", "--", relativePath]);
	return parseUnmerged(repoRoot, stdout)[0];
}

export async function listUnmerged(repoRoot: string): Promise<UnmergedFile[]> {
	const stdout = await execGit(repoRoot, ["ls-files", "-u", "-z"]);
	return parseUnmerged(repoRoot, stdout);
}

export async function collectWorkspaceUnmerged(folders: readonly string[]): Promise<UnmergedFile[]> {
	const seen = new Set<string>();
	const files: UnmergedFile[] = [];

	for (const folder of folders) {
		let root: string;
		try {
			root = await getRepoRoot(folder);
		} catch (error) {
			if (isOutsideRepo(error)) {
				continue;
			}
			throw error;
		}
		if (seen.has(root)) {
			continue;
		}
		seen.add(root);
		files.push(...(await listUnmerged(root)));
	}

	return files;
}

export async function detectOperation(repoRoot: string): Promise<OperationKind> {
	const directory = await resolveGitDir(repoRoot);
	if (fs.existsSync(path.join(directory, "rebase-merge")) || fs.existsSync(path.join(directory, "rebase-apply"))) {
		return "rebase";
	}
	if (fs.existsSync(path.join(directory, "CHERRY_PICK_HEAD"))) {
		return "cherry-pick";
	}
	if (fs.existsSync(path.join(directory, "REVERT_HEAD"))) {
		return "revert";
	}
	if (fs.existsSync(path.join(directory, "MERGE_HEAD"))) {
		return "merge";
	}
	return "unknown";
}

export async function stagePath(repoRoot: string, relativePath: string): Promise<void> {
	await execGit(repoRoot, ["add", "--", relativePath]);
}

export async function takeSide(file: UnmergedFile, side: "ours" | "theirs"): Promise<void> {
	const stage = side === "ours" ? 2 : 3;
	if (file.stages.includes(stage)) {
		await execGit(file.repoRoot, ["checkout", `--${side}`, "--", file.relativePath]);
		await execGit(file.repoRoot, ["add", "--", file.relativePath]);
		return;
	}

	try {
		await execGit(file.repoRoot, ["rm", "-f", "--", file.relativePath]);
	} catch {
		await execGit(file.repoRoot, ["update-index", "--force-remove", "--", file.relativePath]);
		return;
	}

	const still = await listUnmerged(file.repoRoot);
	if (still.some((entry) => entry.relativePath === file.relativePath)) {
		await execGit(file.repoRoot, ["update-index", "--force-remove", "--", file.relativePath]);
	}
}

function parseUnmerged(repoRoot: string, stdout: string): UnmergedFile[] {
	const grouped = new Map<string, { stages: Set<number>; textual: boolean }>();
	const order: string[] = [];

	for (const entry of stdout.split("\0")) {
		if (!entry) {
			continue;
		}
		const tab = entry.indexOf("\t");
		if (tab < 0) {
			continue;
		}
		const meta = entry.slice(0, tab).split(" ");
		const relativePath = entry.slice(tab + 1);
		const mode = meta[0] ?? "";
		const stage = Number(meta[meta.length - 1]);
		if (!Number.isInteger(stage) || stage < 1) {
			continue;
		}

		let group = grouped.get(relativePath);
		if (!group) {
			group = { stages: new Set<number>(), textual: true };
			grouped.set(relativePath, group);
			order.push(relativePath);
		}
		group.stages.add(stage);
		if (!TEXT_MODES.has(mode)) {
			group.textual = false;
		}
	}

	return order.map((relativePath) => describeFile(repoRoot, relativePath, grouped.get(relativePath)!));
}

function describeFile(
	repoRoot: string,
	relativePath: string,
	group: { stages: Set<number>; textual: boolean },
): UnmergedFile {
	const absolutePath = canonical(path.resolve(repoRoot, ...relativePath.split("/")));
	const exists = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
	let large = false;
	let binary = !group.textual;
	if (exists) {
		large = fs.statSync(absolutePath).size > MAX_TEXT_BYTES;
		if (!binary && hasNul(absolutePath)) {
			binary = true;
		}
	}

	return {
		repoRoot,
		relativePath,
		absolutePath,
		stages: [...group.stages].sort((left, right) => left - right),
		exists,
		binary,
		large,
	};
}

function hasNul(filePath: string): boolean {
	const fd = fs.openSync(filePath, "r");
	try {
		const buffer = Buffer.alloc(8192);
		const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
		return buffer.subarray(0, read).includes(0);
	} finally {
		fs.closeSync(fd);
	}
}

async function resolveGitDir(repoRoot: string): Promise<string> {
	try {
		return (await execGit(repoRoot, ["rev-parse", "--absolute-git-dir"])).trim();
	} catch {
		const raw = (await execGit(repoRoot, ["rev-parse", "--git-dir"])).trim();
		return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
	}
}

function cwdFor(start: string): string {
	if (fs.existsSync(start)) {
		return fs.statSync(start).isDirectory() ? start : path.dirname(start);
	}
	return path.dirname(start);
}

function toGitPath(repoRoot: string, absolutePath: string): string {
	return path.relative(canonical(repoRoot), canonical(absolutePath)).split(path.sep).join("/");
}

/** Resolve symlinks so a /var path and Git's /private/var path stay in the same repository. */
function canonical(target: string): string {
	const resolved = path.resolve(target);
	try {
		return fs.realpathSync(resolved);
	} catch {
		try {
			return path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
		} catch {
			return resolved;
		}
	}
}

function isOutsideRepo(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /not a git repository/i.test(message) || /no such file or directory/i.test(message);
}

function execGit(cwd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"git",
			args,
			{
				cwd,
				encoding: "utf8",
				maxBuffer: 20 * 1024 * 1024,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				if (error) {
					const err = error as NodeJS.ErrnoException;
					if (err.code === "ENOENT") {
						reject(new GitError("Git is not available on PATH."));
						return;
					}
					reject(new GitError((stderr || err.message || "Git command failed.").trim()));
					return;
				}
				resolve(stdout);
			},
		);
	});
}
