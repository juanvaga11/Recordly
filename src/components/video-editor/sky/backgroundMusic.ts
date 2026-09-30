/**
 * SKY Academy: background music as ordinary Recordly audio regions, so preview,
 * export, the timeline and project files all handle it with no extra plumbing.
 */
import type { AudioRegion } from "../types";

export const SKY_MUSIC_ID_PREFIX = "sky-music-";
/** Music under a voice sits around 10–20% on social media. */
export const SKY_MUSIC_DEFAULT_VOLUME = 0.15;

export function isSkyMusicRegion(region: Pick<AudioRegion, "id">): boolean {
	return region.id.startsWith(SKY_MUSIC_ID_PREFIX);
}

/** First audio track row that has no user audio on it. */
export function nextFreeAudioTrack(regions: AudioRegion[]): number {
	const used = regions.filter((region) => !isSkyMusicRegion(region));
	if (used.length === 0) return 0;
	return Math.max(...used.map((region) => region.trackIndex ?? 0)) + 1;
}

/**
 * Covers the whole video with the song, repeating it when it is shorter than
 * the video and cutting the last repetition at the end.
 */
export function buildBackgroundMusicRegions({
	audioPath,
	trackDurationMs,
	timelineDurationMs,
	volume = SKY_MUSIC_DEFAULT_VOLUME,
	trackIndex = 0,
}: {
	audioPath: string;
	trackDurationMs: number;
	timelineDurationMs: number;
	volume?: number;
	trackIndex?: number;
}): AudioRegion[] {
	const total = Math.round(timelineDurationMs);
	const loop = Math.round(trackDurationMs);
	if (!audioPath || total <= 0 || !Number.isFinite(loop) || loop < 500) return [];
	const regions: AudioRegion[] = [];
	for (let start = 0, index = 0; start < total && index < 500; start += loop, index++) {
		regions.push({
			id: `${SKY_MUSIC_ID_PREFIX}${index + 1}`,
			startMs: start,
			endMs: Math.min(total, start + loop),
			audioPath,
			volume: Math.min(1, Math.max(0, volume)),
			normalize: false,
			trackIndex,
		});
	}
	return regions;
}

/** Replaces any previous background music with the new regions. */
export function withBackgroundMusic(current: AudioRegion[], music: AudioRegion[]): AudioRegion[] {
	return [...current.filter((region) => !isSkyMusicRegion(region)), ...music];
}

export function setBackgroundMusicVolume(current: AudioRegion[], volume: number): AudioRegion[] {
	const safe = Math.min(1, Math.max(0, volume));
	return current.map((region) =>
		isSkyMusicRegion(region) ? { ...region, volume: safe } : region,
	);
}

export function getBackgroundMusic(current: AudioRegion[]) {
	const music = current.filter(isSkyMusicRegion);
	if (music.length === 0) return null;
	return { audioPath: music[0]?.audioPath ?? "", volume: music[0]?.volume ?? 0 };
}
