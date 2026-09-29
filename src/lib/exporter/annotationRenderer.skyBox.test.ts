import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ANNOTATION_STYLE } from "@/components/video-editor/types";
import { renderTextBox } from "./annotationRenderer";

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
