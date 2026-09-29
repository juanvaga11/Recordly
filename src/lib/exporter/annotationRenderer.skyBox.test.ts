import { describe, expect, it, vi } from "vitest";
import { type AnnotationRegion, DEFAULT_ANNOTATION_STYLE } from "@/components/video-editor/types";
import { renderAnnotations, renderTextBox } from "./annotationRenderer";

function mockCtx() {
	return {
		save: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		roundRect: vi.fn(),
		fill: vi.fn(),
		stroke: vi.fn(),
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 0,
	} as unknown as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
}

describe("renderTextBox", () => {
	it("does nothing for regular text annotations", () => {
		const ctx = mockCtx();
		renderTextBox(ctx, { ...DEFAULT_ANNOTATION_STYLE }, 0, 0, 100, 50, 1);
		expect(ctx.roundRect).not.toHaveBeenCalled();
	});

	it("fills and strokes SKY zones inside the annotation rect", () => {
		const ctx = mockCtx();
		renderTextBox(
			ctx,
			{
				...DEFAULT_ANNOTATION_STYLE,
				borderRadius: 100,
				boxFill: "rgba(16, 185, 129, 0.22)",
				boxBorderColor: "#10B981",
				boxBorderWidth: 4,
			},
			10,
			20,
			200,
			60,
			0.5,
		);
		// border 4 * 0.5 = 2px, inset by half the border, radius clamped to half the height
		expect(ctx.roundRect).toHaveBeenCalledWith(11, 21, 198, 58, 29);
		expect(ctx.fill).toHaveBeenCalledTimes(1);
		expect(ctx.stroke).toHaveBeenCalledTimes(1);
		expect(ctx.fillStyle).toBe("rgba(16, 185, 129, 0.22)");
		expect(ctx.strokeStyle).toBe("#10B981");
	});
});

describe("renderAnnotations pinToFrame", () => {
	function region(pinToFrame: boolean): AnnotationRegion {
		return {
			id: pinToFrame ? "pinned" : "scene",
			startMs: 0,
			endMs: 1000,
			type: "text",
			content: "X",
			position: { x: 50, y: 50 },
			size: { width: 10, height: 10 },
			style: { ...DEFAULT_ANNOTATION_STYLE, boxFill: "#000" },
			zIndex: 1,
			pinToFrame,
		};
	}

	function textCtx() {
		const ctx = mockCtx() as unknown as Record<string, unknown>;
		Object.assign(ctx, {
			rect: vi.fn(),
			clip: vi.fn(),
			fillText: vi.fn(),
			measureText: vi.fn(() => ({ width: 10 })),
			font: "",
			textAlign: "left",
			textBaseline: "alphabetic",
		});
		return ctx as unknown as CanvasRenderingContext2D &
			Record<string, ReturnType<typeof vi.fn>>;
	}

	const zoom = { scale: 2, x: -500, y: -300 };
	const videoRect = { x: 100, y: 100, width: 800, height: 400 };

	it("scene annotations follow the video rect and the zoom", async () => {
		const ctx = textCtx();
		await renderAnnotations(
			ctx,
			[region(false)],
			1000,
			1000,
			500,
			1,
			undefined,
			zoom,
			videoRect,
		);
		// x = (100 + 0.5*800) * 2 - 500 = 500 ; y = (100 + 0.5*400) * 2 - 300 = 300
		expect(ctx.rect).toHaveBeenCalledWith(500, 300, 160, 80);
	});

	it("pinned annotations use the whole frame and ignore the zoom", async () => {
		const ctx = textCtx();
		await renderAnnotations(
			ctx,
			[region(true)],
			1000,
			1000,
			500,
			1,
			undefined,
			zoom,
			videoRect,
		);
		expect(ctx.rect).toHaveBeenCalledWith(500, 500, 100, 100);
	});
});
