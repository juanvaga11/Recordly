/**
 * SKY Academy sound effects library: the built-in synthesized sounds plus any
 * file the user drops into "Documentos/Sonidos SKY".
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app, ipcMain, shell } from "electron";
import { encodeWav, SFX_SAMPLE_RATE, SKY_SFX } from "../sky/sfxSynth";
import { approveUserPath } from "../utils";
import { listSkyMusic } from "./skyMusic";

/** Bump when the synthesis changes so old files are regenerated. */
const SFX_VERSION = "v1";
export const SKY_SFX_USER_FOLDER_NAME = "Sonidos SKY";

export interface SkySfxItem {
	id: string;
	name: string;
	description: string;
	category: string;
	path: string;
	durationMs: number;
	builtIn: boolean;
}

export function getSkySfxUserFolder(): string {
	return path.join(app.getPath("documents"), SKY_SFX_USER_FOLDER_NAME);
}

/** Writes the built-in sounds once into `dir` and returns them. */
export async function ensureBuiltInSfx(dir: string): Promise<SkySfxItem[]> {
	await fs.mkdir(dir, { recursive: true });
	const items: SkySfxItem[] = [];
	for (const sfx of SKY_SFX) {
		const filePath = path.join(dir, `${sfx.id}.${SFX_VERSION}.wav`);
		let samples: number | null = null;
		const stat = await fs.stat(filePath).catch(() => null);
		if (stat && stat.size > 44) {
			samples = (stat.size - 44) / 2;
		} else {
			const rendered = sfx.render();
			await fs.writeFile(filePath, encodeWav(rendered));
			samples = rendered.length;
		}
		items.push({
			id: sfx.id,
			name: sfx.name,
			description: sfx.description,
			category: sfx.category,
			path: filePath,
			durationMs: Math.round((samples / SFX_SAMPLE_RATE) * 1000),
			builtIn: true,
		});
	}
	return items;
}

export function registerSkySfxHandlers() {
	ipcMain.handle("sky-sfx-list", async () => {
		const userFolder = getSkySfxUserFolder();
		try {
			const builtIn = await ensureBuiltInSfx(
				path.join(app.getPath("userData"), "sky-sonidos"),
			);
			await fs.mkdir(userFolder, { recursive: true }).catch(() => undefined);
			const userTracks = await listSkyMusic(userFolder);
			const user: SkySfxItem[] = userTracks.map((track, index) => ({
				id: `user-${index}`,
				name: track.name,
				description: track.folder ? `Mis sonidos · ${track.folder}` : "Mis sonidos",
				category: "mios",
				path: track.path,
				durationMs: 0,
				builtIn: false,
			}));
			const all = [...builtIn, ...user];
			for (const item of all) approveUserPath(item.path);
			return { success: true, folder: userFolder, sounds: all };
		} catch (error) {
			return { success: false, folder: userFolder, sounds: [], error: String(error) };
		}
	});

	ipcMain.handle("sky-sfx-open-folder", async () => {
		const folder = getSkySfxUserFolder();
		await fs.mkdir(folder, { recursive: true }).catch(() => undefined);
		const error = await shell.openPath(folder);
		return { success: !error, folder, error: error || undefined };
	});
}
