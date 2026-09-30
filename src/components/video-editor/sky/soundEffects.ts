/**
 * SKY Academy sound effects as ordinary audio regions. Each effect is placed
 * on the first audio row where it does not overlap anything.
 */
import { getRenderableVideoUrl } from "@/lib/assetPath";
import type { AudioRegion } from "../types";

export const SKY_SFX_ID_PREFIX = "sky-sfx-";
export const SKY_SFX_DEFAULT_VOLUME = 0.7;

export interface SkySound {
	id: string;
	name: string;
	description: string;
	category: string;
	path: string;
	durationMs: number;
	builtIn: boolean;
}

export interface SfxPlacement {
	path: string;
	startMs: number;
	durationMs: number;
	volume?: number;
}

export const SFX_CATEGORY_LABELS: Record<string, string> = {
	cuenta: "Cuenta regresiva",
	revelar: "Suspenso y revelar",
	interfaz: "Botones y redes",
	trading: "Trading",
	transicion: "Transiciones",
	mios: "Mis sonidos",
};

function overlaps(a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }) {
	return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Adds sound effects, each on the lowest audio row where it fits. */
export function placeSoundEffects(
	current: AudioRegion[],
	placements: SfxPlacement[],
	idSeed: string | number = Date.now(),
): AudioRegion[] {
	const result = [...current];
	placements.forEach((placement, index) => {
		const startMs = Math.max(0, Math.round(placement.startMs));
		const endMs = startMs + Math.max(50, Math.round(placement.durationMs));
		const span = { startMs, endMs };
		let track = 0;
		while (
			result.some((region) => (region.trackIndex ?? 0) === track && overlaps(region, span))
		) {
			track++;
		}
		result.push({
			id: `${SKY_SFX_ID_PREFIX}${idSeed}-${index}`,
			startMs,
			endMs,
			audioPath: placement.path,
			volume: Math.min(1, Math.max(0, placement.volume ?? SKY_SFX_DEFAULT_VOLUME)),
			normalize: false,
			trackIndex: track,
		});
	});
	return result;
}

let cache: Promise<SkySound[]> | null = null;

/** Built-in + user sounds (cached; call with `refresh` after adding files). */
export function loadSkySounds(refresh = false): Promise<SkySound[]> {
	if (!cache || refresh) {
		const api = typeof window !== "undefined" ? window.electronAPI : undefined;
		cache = api?.skySfxList
			? api
					.skySfxList()
					.then((result) => result.sounds)
					.catch(() => [])
			: Promise.resolve([]);
	}
	return cache;
}

export async function findSkySound(id: string): Promise<SkySound | null> {
	return (await loadSkySounds()).find((sound) => sound.id === id) ?? null;
}

/** Duration of a sound file (user files do not report it up front). */
export async function soundDurationMs(sound: SkySound): Promise<number> {
	if (sound.durationMs > 0) return sound.durationMs;
	const url = await getRenderableVideoUrl(sound.path);
	return new Promise((resolve) => {
		const audio = new Audio();
		audio.preload = "metadata";
		audio.onloadedmetadata = () =>
			resolve(Number.isFinite(audio.duration) ? audio.duration * 1000 : 1000);
		audio.onerror = () => resolve(1000);
		audio.src = url;
	});
}

let previewAudio: HTMLAudioElement | null = null;

export async function previewSkySound(sound: SkySound) {
	previewAudio?.pause();
	const audio = new Audio(await getRenderableVideoUrl(sound.path));
	audio.volume = 0.7;
	previewAudio = audio;
	await audio.play().catch(() => undefined);
}
