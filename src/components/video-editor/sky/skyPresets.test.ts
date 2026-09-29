import { describe, expect, it } from "vitest";
import {
	type AnnotationRegion,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_WEBCAM_OVERLAY,
} from "../types";
import {
	adaptSkyPatchToAspect,
	buildSkyLogoWatermarkPatch,
	buildSkyReelLayout,
	buildSkyWatermarkPatch,
	buildTradeCardPatch,
	buildTradeCardText,
	computeRiskReward,
	formatRiskReward,
	resolveSkyAnnotationPatch,
	SKY_CLEAR_BOX_STYLE,
	SKY_LOGO_ASPECT,
	SKY_SMC_PRESETS,
} from "./skyPresets";

function makeRegion(overrides: Partial<AnnotationRegion> = {}): AnnotationRegion {
	return {
		id: "annotation-1",
		startMs: 1000,
		endMs: 3000,
		type: "image",
		content: "data:image/png;base64,xx",
		imageContent: "data:image/png;base64,xx",
		position: { ...DEFAULT_ANNOTATION_POSITION },
		size: { ...DEFAULT_ANNOTATION_SIZE },
		style: { ...DEFAULT_ANNOTATION_STYLE },
		zIndex: 1,
		...overrides,
	};
}

describe("SKY SMC presets", () => {
	it("has unique ids and turns any annotation into styled text", () => {
		const ids = SKY_SMC_PRESETS.map((preset) => preset.id);
		expect(new Set(ids).size).toBe(ids.length);

		for (const preset of SKY_SMC_PRESETS) {
			const next = resolveSkyAnnotationPatch(makeRegion(), preset.patch, 10_000);
			expect(next.type).toBe("text");
			expect(next.content).toBe(next.textContent);
			expect(next.content.length).toBeGreaterThan(0);
			// keeps the timing and the image the user had
			expect(next.startMs).toBe(1000);
			expect(next.endMs).toBe(3000);
			expect(next.imageContent).toBe("data:image/png;base64,xx");
		}
	});

	it("zones draw a filled box, labels do not", () => {
		const ob = SKY_SMC_PRESETS.find((preset) => preset.id === "ob-bull");
		const bos = SKY_SMC_PRESETS.find((preset) => preset.id === "bos");
		expect(ob?.patch.style?.boxFill).toMatch(/rgba/);
		expect(ob?.patch.style?.verticalAlign).toBe("top");
		expect(bos?.patch.style?.boxFill).toBeUndefined();
	});

	it("switching from a zone to a label clears the box", () => {
		const ob = SKY_SMC_PRESETS.find((preset) => preset.id === "ob-bull");
		const bos = SKY_SMC_PRESETS.find((preset) => preset.id === "bos");
		if (!ob || !bos) throw new Error("missing presets");
		const asZone = resolveSkyAnnotationPatch(makeRegion(), ob.patch, 0);
		const asLabel = resolveSkyAnnotationPatch(asZone, bos.patch, 0);
		expect(asLabel.style.boxFill).toBeUndefined();
		expect(asLabel.style.boxBorderColor).toBeUndefined();
		const cleared = resolveSkyAnnotationPatch(asZone, { style: SKY_CLEAR_BOX_STYLE }, 0);
		expect(cleared.style.boxFill).toBeUndefined();
	});
});

describe("SKY watermark", () => {
	it("covers the whole video", () => {
		const next = resolveSkyAnnotationPatch(makeRegion(), buildSkyWatermarkPatch(), 42_500);
		expect(next.startMs).toBe(0);
		expect(next.endMs).toBe(42_500);
		expect(next.content).toBe("JulianVal.fx");
	});

	it("falls back to the brand name when the text is empty", () => {
		expect(buildSkyWatermarkPatch("   ").content).toBe("JulianVal.fx");
	});

	it("keeps timing when the duration is unknown", () => {
		const next = resolveSkyAnnotationPatch(makeRegion(), buildSkyWatermarkPatch(), 0);
		expect(next.startMs).toBe(1000);
		expect(next.endMs).toBe(3000);
	});
});

describe("trade card", () => {
	it("computes risk reward for buys and sells", () => {
		expect(
			computeRiskReward({
				symbol: "XAUUSD",
				direction: "compra",
				entry: "2345",
				stopLoss: "2340",
				takeProfit: "2360",
			}),
		).toBe(3);
		expect(
			computeRiskReward({
				symbol: "EURUSD",
				direction: "venta",
				entry: "1,0850",
				stopLoss: "1,0870",
				takeProfit: "1,0800",
			}),
		).toBeCloseTo(2.5);
	});

	it("rejects stops on the wrong side", () => {
		expect(
			computeRiskReward({
				symbol: "XAUUSD",
				direction: "compra",
				entry: "2345",
				stopLoss: "2350",
				takeProfit: "2360",
			}),
		).toBeNull();
		expect(formatRiskReward(null)).toBe("—");
		expect(formatRiskReward(2.5)).toBe("1:2.5");
		expect(formatRiskReward(3)).toBe("1:3");
	});

	it("builds the card text", () => {
		const text = buildTradeCardText({
			symbol: "xauusd",
			direction: "compra",
			entry: "2345",
			stopLoss: "2340",
			takeProfit: "2360",
			result: "+3R",
		});
		expect(text.split("\n")).toEqual([
			"XAUUSD · COMPRA ▲",
			"Entrada: 2345",
			"SL: 2340",
			"TP: 2360",
			"R:R 1:3",
			"Resultado: +3R ✓",
		]);
	});

	it("marks losses and styles the card as a gold box", () => {
		const patch = buildTradeCardPatch({
			symbol: "BOOM 1000",
			direction: "venta",
			entry: "",
			stopLoss: "",
			takeProfit: "",
			result: "-1R",
		});
		expect(patch.content).toContain("Resultado: -1R ✕");
		expect(patch.content).toContain("R:R —");
		expect(patch.style?.boxBorderColor).toBe("#D4AF37");
		expect(patch.size?.height).toBeLessThanOrEqual(90);
	});
});

describe("vertical reels layout", () => {
	it("goes 9:16 with no padding and moves the webcam to the bottom", () => {
		const webcam = { ...DEFAULT_WEBCAM_OVERLAY, sourcePath: "/tmp/cam.webm", enabled: true };
		const layout = buildSkyReelLayout({
			padding: { top: 20, bottom: 20, left: 20, right: 20, linked: true },
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			webcam,
			wallpaper: "/wallpapers/tahoe-light.jpg",
			borderRadius: 12,
		});
		expect(layout.aspectRatio).toBe("9:16");
		expect(layout.padding).toMatchObject({ top: 0, bottom: 0, left: 0, right: 0 });
		expect(layout.cropRegion.x + layout.cropRegion.width).toBeCloseTo(1);
		expect(layout.cropRegion.y + layout.cropRegion.height).toBeCloseTo(1);
		expect(layout.webcam.positionPreset).toBe("bottom-center");
		expect(layout.webcam.sourcePath).toBe("/tmp/cam.webm");
		expect(layout.webcam.enabled).toBe(true);
		expect(layout.wallpaper).toBe("/wallpapers/sky-negro-dorado.jpg");
	});
});

describe("frame pinning and vertical sizing", () => {
	const VERTICAL = 9 / 16;
	const HORIZONTAL = 16 / 9;

	it("pins watermark, logo and trade card to the frame; SMC stays on the chart", () => {
		expect(buildSkyWatermarkPatch("JulianVal.fx", VERTICAL).pinToFrame).toBe(true);
		expect(buildSkyLogoWatermarkPatch("data:image/webp;base64,xx", "jv").pinToFrame).toBe(true);
		expect(
			buildTradeCardPatch(
				{ symbol: "X", direction: "compra", entry: "", stopLoss: "", takeProfit: "" },
				VERTICAL,
			).pinToFrame,
		).toBe(true);
		for (const preset of SKY_SMC_PRESETS) {
			expect(preset.patch.pinToFrame).toBe(false);
		}
	});

	it("builds the logo watermark as a full-duration image in a safe corner", () => {
		const patch = buildSkyLogoWatermarkPatch("data:image/webp;base64,xx", "jv", VERTICAL);
		const region = resolveSkyAnnotationPatch(makeRegion({ type: "text" }), patch, 30_000);
		expect(region.type).toBe("image");
		expect(region.imageContent).toBe("data:image/webp;base64,xx");
		expect(region.startMs).toBe(0);
		expect(region.endMs).toBe(30_000);
		// vertical Reels: top-right, away from the Instagram buttons at the bottom
		expect(region.position.y).toBeLessThan(20);
		expect(region.position.x + region.size.width).toBeLessThanOrEqual(100);
		// horizontal: bottom-right
		const wide = buildSkyLogoWatermarkPatch("data:image/webp;base64,xx", "jv", HORIZONTAL);
		expect((wide.position?.y ?? 0) + (wide.size?.height ?? 0)).toBeLessThanOrEqual(100);
		expect(wide.position?.y).toBeGreaterThan(50);
	});

	it("keeps the logo proportions on the frame", () => {
		for (const aspect of [VERTICAL, HORIZONTAL]) {
			const patch = buildSkyLogoWatermarkPatch("data:image/png;base64,xx", "full", aspect);
			const pixelRatio = ((patch.size?.width ?? 0) * aspect) / (patch.size?.height ?? 1);
			expect(pixelRatio).toBeCloseTo(SKY_LOGO_ASPECT.full, 1);
		}
	});

	it("makes text bigger in vertical frames so it is readable on a phone", () => {
		const bos = SKY_SMC_PRESETS.find((preset) => preset.id === "bos");
		if (!bos) throw new Error("missing preset");
		expect(adaptSkyPatchToAspect(bos.patch, HORIZONTAL)).toBe(bos.patch);
		const vertical = adaptSkyPatchToAspect(bos.patch, VERTICAL);
		expect(vertical.style?.fontSize).toBeGreaterThan(bos.patch.style?.fontSize ?? 0);
		expect(vertical.size?.width).toBeGreaterThan(bos.patch.size?.width ?? 0);
		expect(vertical.pinToFrame).toBe(false);

		const cardV = buildTradeCardPatch(
			{
				symbol: "XAUUSD",
				direction: "compra",
				entry: "1",
				stopLoss: "0",
				takeProfit: "3",
				result: "+3R",
			},
			VERTICAL,
		);
		const cardH = buildTradeCardPatch(
			{
				symbol: "XAUUSD",
				direction: "compra",
				entry: "1",
				stopLoss: "0",
				takeProfit: "3",
				result: "+3R",
			},
			HORIZONTAL,
		);
		expect(cardV.style?.fontSize).toBeGreaterThan(cardH.style?.fontSize ?? 0);
		for (const card of [cardV, cardH]) {
			expect((card.position?.x ?? 0) + (card.size?.width ?? 0)).toBeLessThan(100);
			expect((card.position?.y ?? 0) + (card.size?.height ?? 0)).toBeLessThan(100);
		}
	});
});

describe("embedded logos", () => {
	it("are valid WebP data URLs the annotation renderer accepts", async () => {
		const { SKY_LOGO_FULL_DATA_URL, SKY_LOGO_JV_DATA_URL } = await import("./skyLogos");
		for (const url of [SKY_LOGO_JV_DATA_URL, SKY_LOGO_FULL_DATA_URL]) {
			expect(url.startsWith("data:image/webp;base64,")).toBe(true);
			const bytes = Buffer.from(url.split(",")[1] ?? "", "base64");
			expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
			expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
		}
	});
});
