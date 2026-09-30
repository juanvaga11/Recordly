/**
 * SKY Academy annotation motion, shared by the editor preview and the export
 * renderers so both show the same animation.
 *
 * Every motion starts with a quick "pop" entrance; some keep moving while the
 * annotation is on screen (pulse, bell shake, mouse click).
 */
import type { SkyMotion } from "@/components/video-editor/types";

export interface SkyMotionFrame {
	scale: number;
	/** Radians, around the annotation center. */
	rotation: number;
	alpha: number;
	/** Vertical offset as a fraction of the annotation height (positive = down). */
	offsetY: number;
}

export const IDLE_MOTION: SkyMotionFrame = { scale: 1, rotation: 0, alpha: 1, offsetY: 0 };

const ENTRANCE_MS = 380;

function easeOutBack(t: number) {
	const c1 = 1.9;
	const c3 = c1 + 1;
	return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function entrance(elapsedMs: number): { scale: number; alpha: number; done: boolean } {
	if (elapsedMs >= ENTRANCE_MS) return { scale: 1, alpha: 1, done: true };
	const t = Math.max(0, elapsedMs) / ENTRANCE_MS;
	return { scale: 0.25 + 0.75 * easeOutBack(t), alpha: Math.min(1, t * 3), done: false };
}

export function computeSkyMotion(motion: SkyMotion | undefined, elapsedMs: number): SkyMotionFrame {
	if (!motion || !Number.isFinite(elapsedMs)) return IDLE_MOTION;
	const t = Math.max(0, elapsedMs);

	if (motion === "slide") {
		if (t >= 450) return IDLE_MOTION;
		const p = t / 450;
		const eased = 1 - (1 - p) ** 3;
		return { scale: 1, rotation: 0, alpha: Math.min(1, p * 2), offsetY: 0.8 * (1 - eased) };
	}

	const enter = entrance(t);
	if (!enter.done || motion === "pop") {
		return { scale: enter.scale, rotation: 0, alpha: enter.alpha, offsetY: 0 };
	}
	const loop = t - ENTRANCE_MS;

	if (motion === "pulse") {
		return { ...IDLE_MOTION, scale: 1 + 0.06 * Math.sin((2 * Math.PI * loop) / 900) };
	}
	if (motion === "shake") {
		// bell: rings for 0.7 s every 1.6 s
		const cycle = loop % 1600;
		const ring = cycle < 700 ? Math.exp(-cycle / 260) : 0;
		return { ...IDLE_MOTION, rotation: 0.32 * ring * Math.sin((2 * Math.PI * cycle) / 180) };
	}
	// click: presses down once per second
	const cycle = loop % 1000;
	const press = cycle < 160 ? Math.sin((Math.PI * cycle) / 160) : 0;
	return { ...IDLE_MOTION, scale: 1 - 0.14 * press, offsetY: 0.04 * press };
}
