import { describe, expect, it } from "vitest";
import {
	buildCallToAction,
	buildStickerRegion,
	SKY_STICKERS,
	stickerBox,
	stickerImage,
} from "./stickers";

const REEL = 9 / 16;

describe("SKY stickers", () => {
	it("has an image for every sticker", () => {
		expect(SKY_STICKERS.length).toBeGreaterThanOrEqual(20);
		for (const sticker of SKY_STICKERS) {
			expect(stickerImage(sticker.id)?.src.startsWith("data:image/webp")).toBe(true);
		}
	});

	it("keeps the image proportions inside the frame", () => {
		const box = stickerBox("boton-sigueme", 55, REEL, { x: 50, y: 76 });
		// 600x170 image, 55% of a 9:16 frame width → height in % of frame height
		expect(box.height).toBeCloseTo(55 * (170 / 600) * REEL, 0);
		expect(box.x + box.width).toBeLessThanOrEqual(100);
		const edge = stickerBox("check", 20, 1, { x: 99, y: 99 });
		expect(edge.x + edge.width).toBeLessThanOrEqual(100);
		expect(edge.y + edge.height).toBeLessThanOrEqual(100);
	});

	it("pins social stickers to the frame and lets chart tools follow the chart", () => {
		const social = buildStickerRegion(SKY_STICKERS.find((s) => s.id === "campana")!, {
			startMs: 1000,
			frameAspect: REEL,
			chartAspect: 1.2,
			track: 0,
			zIndex: 1,
			idSeed: "a",
		});
		expect(social).toMatchObject({ type: "image", pinToFrame: true, skyMotion: "shake" });
		const tool = buildStickerRegion(SKY_STICKERS.find((s) => s.id === "escenarios")!, {
			startMs: 1000,
			frameAspect: REEL,
			chartAspect: 1.2,
			track: 0,
			zIndex: 1,
			idSeed: "b",
		});
		expect(tool.pinToFrame).toBeUndefined();
		expect(tool.endMs - tool.startMs).toBe(3000);
	});

	it("builds the Sígueme sequence with click and bell sounds", () => {
		const { regions, sounds } = buildCallToAction("seguir", {
			startMs: 5000,
			frameAspect: REEL,
			baseY: 76,
			firstTrack: 3,
			firstZIndex: 10,
			idSeed: "s",
		});
		const button = regions.find((r) => r.id.endsWith("boton-sigueme"));
		const following = regions.find((r) => r.id.endsWith("boton-siguiendo"));
		expect(button?.endMs).toBe(following?.startMs);
		expect(button?.trackIndex).toBe(following?.trackIndex);
		expect(new Set(regions.map((r) => r.id)).size).toBe(regions.length);
		expect(sounds.map((s) => s.soundId)).toEqual(["pop", "click", "campanita"]);
		for (const r of regions) expect(r.position.x + r.size.width).toBeLessThanOrEqual(100);
	});

	it("staggers the four interaction icons", () => {
		const { regions } = buildCallToAction("interaccion", {
			startMs: 0,
			frameAspect: REEL,
			baseY: 76,
			firstTrack: 0,
			firstZIndex: 1,
			idSeed: "i",
		});
		expect(regions.map((r) => r.startMs)).toEqual([0, 300, 600, 900]);
		expect(new Set(regions.map((r) => r.endMs)).size).toBe(1);
	});
});
