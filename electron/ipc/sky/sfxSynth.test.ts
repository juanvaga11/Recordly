import { describe, expect, it } from "vitest";
import { encodeWav, SFX_SAMPLE_RATE, SKY_SFX } from "./sfxSynth";

describe("SKY sound effects", () => {
	it("renders every sound with audible, non-clipping audio", () => {
		for (const sfx of SKY_SFX) {
			const samples = sfx.render();
			let peak = 0;
			for (const value of samples) peak = Math.max(peak, Math.abs(value));
			expect(peak, sfx.id).toBeGreaterThan(0.3);
			expect(peak, sfx.id).toBeLessThanOrEqual(0.8);
			expect(samples.length / SFX_SAMPLE_RATE, sfx.id).toBeLessThan(4);
			expect(Math.abs(samples[0] ?? 0), sfx.id).toBeLessThan(0.01);
			expect(Math.abs(samples.at(-1) ?? 0), sfx.id).toBeLessThan(0.01);
		}
	});

	it("is deterministic", () => {
		const first = SKY_SFX.find((sfx) => sfx.id === "whoosh")?.render();
		const second = SKY_SFX.find((sfx) => sfx.id === "whoosh")?.render();
		expect(first).toEqual(second);
	});

	it("writes a valid WAV header", () => {
		const wav = encodeWav(new Float32Array([0, 0.5, -0.5]));
		expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
		expect(wav.readUInt32LE(24)).toBe(SFX_SAMPLE_RATE);
		expect(wav.length).toBe(44 + 6);
	});

	it("has unique ids", () => {
		expect(new Set(SKY_SFX.map((sfx) => sfx.id)).size).toBe(SKY_SFX.length);
	});
});
