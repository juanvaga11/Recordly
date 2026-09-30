import { describe, expect, it } from "vitest";
import {
	buildDecodeArgs,
	buildLoudnessApplyArgs,
	buildLoudnessMeasureArgs,
	parseLoudnormJson,
	SKY_CLEAN_FILTERS,
	SKY_TARGET_LUFS,
	shouldApplyLoudness,
} from "./skyLoudness";

const STDERR = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'x.mp4':
[Parsed_loudnorm_0 @ 0x1]
{
	"input_i" : "-38.08",
	"input_tp" : "-19.50",
	"input_lra" : "9.20",
	"input_thresh" : "-48.51",
	"output_i" : "-14.60",
	"output_tp" : "-1.50",
	"output_lra" : "7.10",
	"output_thresh" : "-24.90",
	"normalization_type" : "dynamic",
	"target_offset" : "0.60"
}
`;

describe("sky loudness", () => {
	it("parses the loudnorm json block", () => {
		expect(parseLoudnormJson(STDERR)).toEqual({
			input_i: "-38.08",
			input_tp: "-19.50",
			input_lra: "9.20",
			input_thresh: "-48.51",
			target_offset: "0.60",
		});
		expect(parseLoudnormJson("no json here")).toBeNull();
		expect(parseLoudnormJson('{"input_i":"-inf"}')).toBeNull();
	});

	it("only normalizes real audio that is off target or has dropouts", () => {
		const quiet = parseLoudnormJson(STDERR);
		expect(shouldApplyLoudness(quiet)).toBe(true);
		expect(shouldApplyLoudness(null)).toBe(false);
		const onTarget = { ...(quiet as NonNullable<typeof quiet>), input_i: "-14.4" };
		expect(shouldApplyLoudness(onTarget)).toBe(false);
		expect(shouldApplyLoudness(onTarget, 3)).toBe(true);
		const silent = { ...(quiet as NonNullable<typeof quiet>), input_i: "-80" };
		expect(shouldApplyLoudness(silent)).toBe(false);
	});

	it("decodes, measures the cleaned raw audio and copies the video when applying", () => {
		expect(buildDecodeArgs("in.mp4", "raw.f32")).toEqual(
			expect.arrayContaining(["-vn", "f32le", "raw.f32"]),
		);
		const measureFilter = buildLoudnessMeasureArgs("raw.f32");
		expect(measureFilter.join(" ")).toContain(SKY_CLEAN_FILTERS);
		const measured = parseLoudnormJson(STDERR);
		if (!measured) throw new Error("parse failed");
		const args = buildLoudnessApplyArgs("in.mp4", "raw.f32", "out.mp4", measured);
		expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
		const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
		expect(graph).toContain(`I=${SKY_TARGET_LUFS}`);
		expect(graph).toContain("measured_I=-38.08");
		expect(graph).toContain("anoisesrc");
		// the limiter must be the last step, after the room tone is mixed in
		expect(graph.trim().endsWith("[out]")).toBe(true);
		expect(graph.lastIndexOf("alimiter")).toBeGreaterThan(graph.lastIndexOf("amix"));
		expect(args).toContain("[out]");
		expect(args.at(-1)).toBe("out.mp4");
	});
});
