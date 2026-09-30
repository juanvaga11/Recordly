/**
 * SKY Academy: "Cortar silencios" — find pauses in the voice and remove them
 * from the timeline in one click.
 *
 * Detection works on the waveform peaks Recordly already computes for the
 * timeline (normalized to the 99.5th percentile, ~500 peaks per second), so it
 * does not depend on how loud the recording is. Cutting works on source time:
 * every clip is split at the silence boundaries and the silent pieces are
 * dropped, so zooms, annotations and audio regions can be rippled with the
 * existing clip-sequence helpers.
 */
import { type ClipRegion, getClipSourceEndMs, getClipSourceStartMs } from "../types";

export interface TimeSpan {
	startMs: number;
	endMs: number;
}

export interface SilenceDetectionOptions {
	/** Pauses shorter than this are kept (natural breathing). */
	minSilenceMs?: number;
	/** Audio kept on each side of a pause so words are never clipped. */
	paddingMs?: number;
	/** Force a threshold (0..1 of the normalized peak). Auto when omitted. */
	threshold?: number;
}

export const SKY_SILENCE_DEFAULTS = {
	minSilenceMs: 700,
	paddingMs: 150,
} as const;

function percentile(values: Float32Array, fraction: number): number {
	if (values.length === 0) return 0;
	const sorted = Array.from(values).sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * fraction)));
	return sorted[index] ?? 0;
}

/**
 * Threshold between "voice" and "room": 3× the noise floor (20th percentile),
 * clamped so a noisy room still cuts and a very clean one does not eat soft words.
 */
export function autoSilenceThreshold(peaks: Float32Array): number {
	const noiseFloor = percentile(peaks, 0.2);
	return Math.min(0.2, Math.max(0.05, noiseFloor * 3));
}

export function detectSilences(
	peaks: Float32Array,
	durationMs: number,
	options: SilenceDetectionOptions = {},
): TimeSpan[] {
	if (!peaks.length || !Number.isFinite(durationMs) || durationMs <= 0) return [];
	const minSilenceMs = options.minSilenceMs ?? SKY_SILENCE_DEFAULTS.minSilenceMs;
	const paddingMs = options.paddingMs ?? SKY_SILENCE_DEFAULTS.paddingMs;
	const threshold = options.threshold ?? autoSilenceThreshold(peaks);
	const binMs = durationMs / peaks.length;

	const spans: TimeSpan[] = [];
	let runStart = -1;
	const flush = (endIndex: number) => {
		if (runStart < 0) return;
		const startMs = runStart * binMs;
		const endMs = endIndex * binMs;
		runStart = -1;
		if (endMs - startMs < minSilenceMs) return;
		// keep a little air around the words; the very start/end of the video
		// can be cut all the way
		const cutStart = startMs <= 0 ? 0 : startMs + paddingMs;
		const cutEnd = endMs >= durationMs - binMs ? durationMs : endMs - paddingMs;
		if (cutEnd - cutStart >= 200) {
			spans.push({ startMs: Math.round(cutStart), endMs: Math.round(cutEnd) });
		}
	};

	for (let index = 0; index < peaks.length; index++) {
		const silent = (peaks[index] ?? 0) < threshold;
		if (silent && runStart < 0) runStart = index;
		if (!silent) flush(index);
	}
	flush(peaks.length);
	return spans;
}

export interface SilenceCutPlan {
	/** Original clips split at the silence boundaries (same timeline positions). */
	split: ClipRegion[];
	/** `split` without the silent pieces, not yet packed. */
	kept: ClipRegion[];
	/** Timeline milliseconds removed. */
	removedMs: number;
	/** Number of pauses removed. */
	removedCount: number;
}

/** Pieces shorter than this between two pauses are dropped with them. */
const MIN_KEPT_PIECE_MS = 350;

/**
 * Splits every clip at the given source-time spans and drops the pieces inside
 * them. Returns null when nothing would change or everything would be removed.
 */
export function planSilenceCut(
	clips: ClipRegion[],
	silences: TimeSpan[],
	createId: () => string,
): SilenceCutPlan | null {
	const spans = [...silences]
		.filter((span) => span.endMs > span.startMs)
		.sort((a, b) => a.startMs - b.startMs);
	if (!clips.length || !spans.length) return null;

	const split: ClipRegion[] = [];
	const kept: ClipRegion[] = [];
	let removedMs = 0;
	let removedCount = 0;

	for (const clip of clips) {
		const speed = Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;
		const sourceStart = getClipSourceStartMs(clip);
		const sourceEnd = getClipSourceEndMs(clip);
		const toTimeline = (sourceMs: number) =>
			sourceMs >= sourceEnd
				? clip.endMs
				: Math.round(clip.startMs + (sourceMs - sourceStart) / speed);

		// boundaries inside this clip, alternating keep / cut
		const pieces: Array<{ from: number; to: number; silent: boolean }> = [];
		let cursor = sourceStart;
		for (const span of spans) {
			const from = Math.max(span.startMs, sourceStart);
			const to = Math.min(span.endMs, sourceEnd);
			if (to <= from || to <= cursor) continue;
			const cutFrom = Math.max(from, cursor);
			if (cutFrom > cursor) pieces.push({ from: cursor, to: cutFrom, silent: false });
			pieces.push({ from: cutFrom, to, silent: true });
			cursor = to;
		}
		if (cursor < sourceEnd) pieces.push({ from: cursor, to: sourceEnd, silent: false });

		// tiny words-in-between are removed together with the pauses around them
		for (const piece of pieces) {
			if (!piece.silent && pieces.length > 1) {
				const pieceMs = (piece.to - piece.from) / speed;
				if (pieceMs < MIN_KEPT_PIECE_MS) piece.silent = true;
			}
		}

		if (!pieces.some((piece) => piece.silent)) {
			split.push(clip);
			kept.push(clip);
			continue;
		}

		pieces.forEach((piece, index) => {
			const startMs = toTimeline(piece.from);
			const endMs = toTimeline(piece.to);
			if (endMs <= startMs) return;
			const next: ClipRegion = {
				...clip,
				id: index === 0 ? clip.id : createId(),
				startMs,
				endMs,
				sourceStartMs: piece.from,
			};
			split.push(next);
			if (piece.silent) {
				removedMs += endMs - startMs;
				removedCount += 1;
			} else {
				kept.push(next);
			}
		});
	}

	if (removedCount === 0 || kept.length === 0) return null;
	return { split, kept, removedMs, removedCount };
}
