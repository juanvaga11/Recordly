import { describe, expect, it } from "vitest";
import type { AudioRegion } from "../types";
import {
	buildBackgroundMusicRegions,
	getBackgroundMusic,
	nextFreeAudioTrack,
	setBackgroundMusicVolume,
	withBackgroundMusic,
} from "./backgroundMusic";

const voiceOver: AudioRegion = {
	id: "audio-1",
	startMs: 0,
	endMs: 5000,
	audioPath: "C:/voz.wav",
	volume: 1,
	trackIndex: 0,
};

describe("background music", () => {
	it("repeats a short song to cover the whole video", () => {
		const regions = buildBackgroundMusicRegions({
			audioPath: "C:/Musica SKY/beat.mp3",
			trackDurationMs: 20_000,
			timelineDurationMs: 45_000,
		});
		expect(regions.map((r) => [r.startMs, r.endMs])).toEqual([
			[0, 20_000],
			[20_000, 40_000],
			[40_000, 45_000],
		]);
		expect(regions.every((r) => r.volume === 0.15)).toBe(true);
	});

	it("uses one region when the song is longer than the video", () => {
		const regions = buildBackgroundMusicRegions({
			audioPath: "a.mp3",
			trackDurationMs: 180_000,
			timelineDurationMs: 30_000,
		});
		expect(regions).toHaveLength(1);
		expect(regions[0]?.endMs).toBe(30_000);
	});

	it("ignores broken input", () => {
		expect(
			buildBackgroundMusicRegions({
				audioPath: "",
				trackDurationMs: 1000,
				timelineDurationMs: 1000,
			}),
		).toEqual([]);
		expect(
			buildBackgroundMusicRegions({
				audioPath: "a",
				trackDurationMs: NaN,
				timelineDurationMs: 1000,
			}),
		).toEqual([]);
	});

	it("replaces old music, keeps the user's audio and changes volume", () => {
		const first = buildBackgroundMusicRegions({
			audioPath: "one.mp3",
			trackDurationMs: 10_000,
			timelineDurationMs: 20_000,
			trackIndex: nextFreeAudioTrack([voiceOver]),
		});
		expect(first[0]?.trackIndex).toBe(1);
		let regions = withBackgroundMusic([voiceOver], first);
		const second = buildBackgroundMusicRegions({
			audioPath: "two.mp3",
			trackDurationMs: 30_000,
			timelineDurationMs: 20_000,
		});
		regions = withBackgroundMusic(regions, second);
		expect(regions).toHaveLength(2);
		expect(getBackgroundMusic(regions)?.audioPath).toBe("two.mp3");
		regions = setBackgroundMusicVolume(regions, 0.3);
		expect(regions.find((r) => r.id === "audio-1")?.volume).toBe(1);
		expect(getBackgroundMusic(regions)?.volume).toBe(0.3);
		expect(getBackgroundMusic([voiceOver])).toBeNull();
	});
});
