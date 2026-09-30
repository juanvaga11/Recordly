/**
 * SKY Academy: background music library.
 *
 * Tracks live in "Documentos/Musica SKY" so the user can drop in royalty-free
 * songs (YouTube Audio Library, Pixabay Music…) and pick them in the editor.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app, ipcMain, shell } from "electron";
import { approveUserPath } from "../utils";

export const SKY_MUSIC_FOLDER_NAME = "Musica SKY";
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);

export interface SkyMusicTrack {
	name: string;
	path: string;
	folder: string;
	sizeBytes: number;
}

export function getSkyMusicFolder(): string {
	return path.join(app.getPath("documents"), SKY_MUSIC_FOLDER_NAME);
}

/** Pretty name from a file name: "chill_trading-beat.mp3" → "chill trading beat". */
export function trackDisplayName(fileName: string): string {
	return path.parse(fileName).name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function listSkyMusic(folder: string): Promise<SkyMusicTrack[]> {
	const tracks: SkyMusicTrack[] = [];
	const visit = async (dir: string, depth: number, group: string) => {
		let entries: import("node:fs").Dirent[] = [];
		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory() && depth < 1 && !entry.name.startsWith(".")) {
				await visit(fullPath, depth + 1, entry.name);
			} else if (
				entry.isFile() &&
				AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
			) {
				const stat = await fs.stat(fullPath).catch(() => null);
				tracks.push({
					name: trackDisplayName(entry.name),
					path: fullPath,
					folder: group,
					sizeBytes: stat?.size ?? 0,
				});
			}
		}
	};
	await visit(folder, 0, "");
	return tracks.sort(
		(a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name, "es"),
	);
}

export function registerSkyMusicHandlers() {
	ipcMain.handle("sky-music-list", async () => {
		const folder = getSkyMusicFolder();
		try {
			await fs.mkdir(folder, { recursive: true });
			const tracks = await listSkyMusic(folder);
			for (const track of tracks) approveUserPath(track.path);
			return { success: true, folder, tracks };
		} catch (error) {
			return { success: false, folder, tracks: [], error: String(error) };
		}
	});

	ipcMain.handle("sky-music-open-folder", async () => {
		const folder = getSkyMusicFolder();
		await fs.mkdir(folder, { recursive: true }).catch(() => undefined);
		const error = await shell.openPath(folder);
		return { success: !error, folder, error: error || undefined };
	});
}
