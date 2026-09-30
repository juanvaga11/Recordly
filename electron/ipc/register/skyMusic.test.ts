import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: { getPath: () => os.tmpdir() },
	ipcMain: { handle: vi.fn() },
	shell: { openPath: vi.fn(async () => "") },
}));
vi.mock("../utils", () => ({ approveUserPath: vi.fn() }));

const { listSkyMusic, trackDisplayName } = await import("./skyMusic");

let dir = "";
afterEach(async () => {
	if (dir) await fs.rm(dir, { recursive: true, force: true });
});

describe("sky music library", () => {
	it("makes readable names", () => {
		expect(trackDisplayName("chill_trading-beat.mp3")).toBe("chill trading beat");
	});

	it("lists audio files, one level of subfolders, sorted", async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "sky-music-"));
		await fs.mkdir(path.join(dir, "Motivacion"));
		await fs.mkdir(path.join(dir, "Motivacion", "deep"));
		await fs.writeFile(path.join(dir, "zeta.mp3"), "x");
		await fs.writeFile(path.join(dir, "Alpha.WAV"), "x");
		await fs.writeFile(path.join(dir, "notes.txt"), "x");
		await fs.writeFile(path.join(dir, "Motivacion", "epic_win.m4a"), "x");
		await fs.writeFile(path.join(dir, "Motivacion", "deep", "too-deep.mp3"), "x");
		const tracks = await listSkyMusic(dir);
		expect(tracks.map((t) => [t.folder, t.name])).toEqual([
			["", "Alpha"],
			["", "zeta"],
			["Motivacion", "epic win"],
		]);
	});

	it("returns nothing for a missing folder", async () => {
		expect(await listSkyMusic(path.join(os.tmpdir(), "does-not-exist-sky"))).toEqual([]);
	});
});
