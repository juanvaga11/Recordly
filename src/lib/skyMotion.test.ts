import { describe, expect, it } from "vitest";
import { computeSkyMotion, IDLE_MOTION } from "./skyMotion";

describe("computeSkyMotion", () => {
	it("is idle without a motion", () => {
		expect(computeSkyMotion(undefined, 100)).toEqual(IDLE_MOTION);
	});

	it("pops in from small and transparent, overshoots, then rests", () => {
		const start = computeSkyMotion("pop", 0);
		expect(start.scale).toBeLessThan(0.5);
		expect(start.alpha).toBe(0);
		const peak = Math.max(...[150, 200, 250, 300].map((t) => computeSkyMotion("pop", t).scale));
		expect(peak).toBeGreaterThan(1.02);
		expect(computeSkyMotion("pop", 2000)).toEqual(IDLE_MOTION);
	});

	it("keeps the bell swinging and the button pulsing after the entrance", () => {
		const angles = [400, 430, 460, 490].map((t) => computeSkyMotion("shake", t).rotation);
		expect(Math.max(...angles.map(Math.abs))).toBeGreaterThan(0.1);
		const scales = [600, 800, 1000, 1200].map((t) => computeSkyMotion("pulse", t).scale);
		expect(Math.max(...scales) - Math.min(...scales)).toBeGreaterThan(0.05);
	});

	it("slides up into place", () => {
		expect(computeSkyMotion("slide", 0).offsetY).toBeGreaterThan(0.5);
		expect(computeSkyMotion("slide", 500)).toEqual(IDLE_MOTION);
	});

	it("presses the cursor once per second", () => {
		const pressed = computeSkyMotion("click", 380 + 80);
		expect(pressed.scale).toBeLessThan(0.9);
		expect(computeSkyMotion("click", 380 + 500).scale).toBe(1);
	});
});
