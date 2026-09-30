import { describe, expect, it } from "vitest";
import { concealDropouts, findDropouts, relativeSpeechThreshold } from "./skyDropouts";

const SR = 48000;

/** Stereo tone with holes of digital silence. `holes` in ms: [start, length]. */
function voiceWithHoles(seconds: number, holes: Array<[number, number]>, amplitude = 0.05) {
	const frames = seconds * SR;
	const samples = new Float32Array(frames * 2);
	for (let i = 0; i < frames; i++) {
		const value = Math.sin((2 * Math.PI * 180 * i) / SR) * amplitude;
		samples[i * 2] = value;
		samples[i * 2 + 1] = value;
	}
	for (const [startMs, lengthMs] of holes) {
		const start = Math.round((startMs / 1000) * SR);
		const end = start + Math.round((lengthMs / 1000) * SR);
		samples.fill(0, start * 2, end * 2);
	}
	return samples;
}

describe("dropout concealment", () => {
	it("finds short holes inside speech and ignores real pauses", () => {
		const samples = voiceWithHoles(2, [
			[300, 25],
			[800, 4],
			[1200, 400], // a real pause: too long to be a dropout
		]);
		const holes = findDropouts(samples, { sampleRate: SR, channels: 2 });
		expect(holes.map((h) => Math.round((h.start / SR) * 1000))).toEqual([300, 800]);
	});

	it("fills the holes so there is no digital silence left", () => {
		const samples = voiceWithHoles(1, [
			[200, 30],
			[600, 10],
		]);
		const report = concealDropouts(samples, { sampleRate: SR, channels: 2 });
		expect(report.concealed).toBe(2);
		expect(report.concealedMs).toBe(40);
		const mid = Math.round(0.215 * SR) * 2;
		expect(Math.abs(samples[mid] ?? 0) + Math.abs(samples[mid + 2] ?? 0)).toBeGreaterThan(0);
		// never louder than the audio around it
		expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.05 * Math.SQRT2 + 1e-6);
	});

	it("works for very quiet microphones", () => {
		const quiet = voiceWithHoles(1, [[500, 20]], 0.002);
		expect(relativeSpeechThreshold(quiet)).toBeLessThan(0.002);
		expect(concealDropouts(quiet, { sampleRate: SR, channels: 2 }).concealed).toBe(1);
	});

	it("leaves silence at the start and end alone", () => {
		const samples = voiceWithHoles(1, [
			[0, 20],
			[980, 20],
		]);
		expect(concealDropouts(samples, { sampleRate: SR, channels: 2 }).concealed).toBe(0);
	});
});
