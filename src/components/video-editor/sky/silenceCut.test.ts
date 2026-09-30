import { describe, expect, it } from "vitest";
import { packClipSequence, rippleRegions } from "../clipSequence";
import { type ClipRegion, getClipSourceStartMs } from "../types";
import { autoSilenceThreshold, detectSilences, planSilenceCut } from "./silenceCut";

/** 500 peaks per second like Recordly's waveform. `voice` = [startSec, endSec] ranges. */
function peaksFor(durationSec: number, voice: Array<[number, number]>, noise = 0.01) {
	const peaks = new Float32Array(durationSec * 500);
	for (let i = 0; i < peaks.length; i++) {
		const sec = i / 500;
		const speaking = voice.some(([start, end]) => sec >= start && sec < end);
		// speech has micro dips between syllables; keep them short
		peaks[i] = speaking ? (i % 40 < 3 ? 0.02 : 0.6) : noise;
	}
	return peaks;
}

describe("detectSilences", () => {
	it("finds long pauses, keeps short breaths and pads around words", () => {
		// 0-2 voice, 2-2.4 breath, 2.4-5 voice, 5-9 pause, 9-10 voice
		const peaks = peaksFor(10, [
			[0, 2],
			[2.4, 5],
			[9, 10],
		]);
		const spans = detectSilences(peaks, 10_000);
		expect(spans).toEqual([{ startMs: 5150, endMs: 8850 }]);
	});

	it("cuts silence at the very start and end completely", () => {
		const peaks = peaksFor(6, [[2, 4]]);
		const spans = detectSilences(peaks, 6000);
		expect(spans).toHaveLength(2);
		expect(spans[0]?.startMs).toBe(0);
		// syllable dips can extend a pause by a few ms
		expect(spans[0]?.endMs).toBeGreaterThanOrEqual(1850);
		expect(spans[0]?.endMs).toBeLessThanOrEqual(1860);
		expect(spans[1]?.startMs).toBeGreaterThanOrEqual(4150);
		expect(spans[1]?.startMs).toBeLessThanOrEqual(4160);
		expect(spans[1]?.endMs).toBe(6000);
	});

	it("adapts the threshold to a noisy room", () => {
		const quietRoom = peaksFor(10, [[0, 5]], 0.01);
		const noisyRoom = peaksFor(10, [[0, 5]], 0.12);
		expect(autoSilenceThreshold(quietRoom)).toBeCloseTo(0.05);
		expect(autoSilenceThreshold(noisyRoom)).toBeGreaterThan(0.12);
		expect(detectSilences(noisyRoom, 10_000)).toHaveLength(1);
	});

	it("returns nothing for empty audio", () => {
		expect(detectSilences(new Float32Array(0), 1000)).toEqual([]);
	});
});

describe("planSilenceCut", () => {
	let n = 1;
	const createId = () => `clip-new-${n++}`;

	it("removes the pauses from a single clip and ripples effects", () => {
		const clips: ClipRegion[] = [{ id: "clip-1", startMs: 0, endMs: 10_000, speed: 1 }];
		const plan = planSilenceCut(clips, [{ startMs: 2000, endMs: 5000 }], createId);
		if (!plan) throw new Error("expected a plan");
		expect(plan.removedCount).toBe(1);
		expect(plan.removedMs).toBe(3000);
		const next = packClipSequence(plan.kept);
		expect(next.map((clip) => [clip.startMs, clip.endMs, getClipSourceStartMs(clip)])).toEqual([
			[0, 2000, 0],
			[2000, 7000, 5000],
		]);
		// a zoom at 6-7 s (source) moves 3 s earlier; one inside the pause disappears;
		// a full-length watermark shrinks with the video
		const zooms = [
			{ id: "z1", startMs: 6000, endMs: 7000 },
			{ id: "z2", startMs: 3000, endMs: 4000 },
			{ id: "wm", startMs: 0, endMs: 10_000 },
		];
		expect(rippleRegions(zooms, plan.split, next)).toEqual([
			{ id: "z1", startMs: 3000, endMs: 4000 },
			{ id: "wm", startMs: 0, endMs: 7000 },
		]);
	});

	it("respects clip speed and existing source offsets", () => {
		const clips: ClipRegion[] = [
			{ id: "a", startMs: 0, endMs: 2000, speed: 1 },
			// plays source 4000-8000 at 2x in 2000 ms of timeline
			{ id: "b", startMs: 2000, endMs: 4000, sourceStartMs: 4000, speed: 2 },
		];
		const plan = planSilenceCut(clips, [{ startMs: 5000, endMs: 7000 }], createId);
		if (!plan) throw new Error("expected a plan");
		expect(plan.removedMs).toBe(1000);
		const next = packClipSequence(plan.kept);
		expect(next.map((clip) => [clip.startMs, clip.endMs, getClipSourceStartMs(clip)])).toEqual([
			[0, 2000, 0],
			[2000, 2500, 4000],
			[2500, 3000, 7000],
		]);
	});

	it("drops tiny sounds stuck between two pauses", () => {
		const clips: ClipRegion[] = [{ id: "c", startMs: 0, endMs: 10_000, speed: 1 }];
		const plan = planSilenceCut(
			clips,
			[
				{ startMs: 2000, endMs: 4000 },
				{ startMs: 4050, endMs: 6000 },
			],
			createId,
		);
		expect(plan?.kept.map((clip) => getClipSourceStartMs(clip))).toEqual([0, 6000]);
	});

	it("does nothing when there is nothing to cut or it would remove everything", () => {
		const clips: ClipRegion[] = [{ id: "d", startMs: 0, endMs: 1000, speed: 1 }];
		expect(planSilenceCut(clips, [], createId)).toBeNull();
		expect(planSilenceCut(clips, [{ startMs: 0, endMs: 1000 }], createId)).toBeNull();
	});
});
