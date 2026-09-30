import { describe, expect, it } from "vitest";
import {
	buildDecisionCountdown,
	COUNTDOWN_LEAD_MS,
	countdownSoundTimes,
	DEFAULT_DECISION_COUNTDOWN,
	nextFreeAnnotationTrack,
} from "./decisionCountdown";

const build = (frameAspect: number, seconds = 3) =>
	buildDecisionCountdown(
		{ ...DEFAULT_DECISION_COUNTDOWN, seconds, startMs: 10_000 },
		frameAspect,
		{ firstTrack: 2, firstZIndex: 5, idSeed: "t" },
	);

describe("buildDecisionCountdown", () => {
	it("creates question, two options and one number per second", () => {
		const regions = build(9 / 16);
		expect(regions.map((r) => r.content)).toEqual([
			"¿Comprarías o venderías?",
			"▲ COMPRA",
			"▼ VENTA",
			"3",
			"2",
			"1",
		]);
		expect(regions.every((r) => r.pinToFrame)).toBe(true);
	});

	it("times the countdown after a short lead and keeps the question until the end", () => {
		const regions = build(9 / 16);
		const numbers = regions.filter((r) => /^\d$/.test(r.content));
		expect(numbers[0]).toMatchObject({ startMs: 10_000 + COUNTDOWN_LEAD_MS, endMs: 11_500 });
		expect(numbers[2]).toMatchObject({ startMs: 12_500, endMs: 13_500 });
		expect(regions[0]).toMatchObject({ startMs: 10_000, endMs: 13_500 });
	});

	it("keeps overlapping pieces on separate tracks and stays inside the frame", () => {
		for (const aspect of [9 / 16, 16 / 9]) {
			const regions = build(aspect, 5);
			const tracks = new Set(regions.slice(0, 3).map((r) => r.trackIndex));
			expect(tracks.size).toBe(3);
			for (const r of regions) {
				expect(r.position.x).toBeGreaterThanOrEqual(0);
				expect(r.position.x + r.size.width).toBeLessThanOrEqual(100);
				expect(r.position.y + r.size.height).toBeLessThanOrEqual(100);
			}
		}
	});

	it("draws the numbers as circles", () => {
		const circle = build(9 / 16).at(-1);
		const aspect = 9 / 16;
		// same size in pixels on both axes
		expect(circle?.size.width).toBeCloseTo((circle?.size.height ?? 0) / aspect, 0);
	});

	it("finds the next free track", () => {
		expect(nextFreeAnnotationTrack([])).toBe(0);
		expect(nextFreeAnnotationTrack(build(9 / 16))).toBe(6);
	});

	it("can show only the countdown, starting right away", () => {
		const regions = buildDecisionCountdown(
			{ ...DEFAULT_DECISION_COUNTDOWN, includeQuestion: false, startMs: 2000 },
			9 / 16,
			{ firstTrack: 0, firstZIndex: 1, idSeed: "c" },
		);
		expect(regions.map((r) => r.content)).toEqual(["3", "2", "1"]);
		expect(regions[0]?.startMs).toBe(2000);
	});

	it("ticks every second and dings at the end", () => {
		const times = countdownSoundTimes({ startMs: 10_000, seconds: 3 });
		expect(times).toEqual([
			{ soundId: "tic", startMs: 10_500 },
			{ soundId: "tac", startMs: 11_500 },
			{ soundId: "tic", startMs: 12_500 },
			{ soundId: "ding", startMs: 13_500 },
		]);
	});
});
