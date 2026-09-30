import { describe, expect, it } from "vitest";
import type { AudioRegion } from "../types";
import { placeSoundEffects } from "./soundEffects";

const music: AudioRegion = {
	id: "sky-music-1",
	startMs: 0,
	endMs: 60_000,
	audioPath: "/m.mp3",
	volume: 0.15,
	trackIndex: 0,
};

describe("placeSoundEffects", () => {
	it("puts effects on the first free row and never over the music", () => {
		const result = placeSoundEffects(
			[music],
			[
				{ path: "/tic.wav", startMs: 1000, durationMs: 120 },
				{ path: "/tic.wav", startMs: 2000, durationMs: 120 },
				{ path: "/ding.wav", startMs: 2050, durationMs: 1600 },
			],
			"t",
		);
		const added = result.slice(1);
		expect(added.map((r) => r.trackIndex)).toEqual([1, 1, 2]);
		expect(added[0]).toMatchObject({ startMs: 1000, endMs: 1120, volume: 0.7 });
		expect(new Set(added.map((r) => r.id)).size).toBe(3);
	});
});
