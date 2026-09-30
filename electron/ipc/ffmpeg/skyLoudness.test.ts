import { describe, expect, it } from "vitest";
import {
	buildLoudnessApplyArgs,
	buildLoudnessMeasureArgs,
	parseLoudnormJson,
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

	it("only normalizes real audio that is off target", () => {
		const quiet = parseLoudnormJson(STDERR);
		expect(shouldApplyLoudness(quiet)).toBe(true);
		expect(shouldApplyLoudness(null)).toBe(false);
		const onTarget = { ...(quiet as NonNullable<typeof quiet>), input_i: "-14.4" };
		expect(shouldApplyLoudness(onTarget)).toBe(false);
		const silent = { ...(quiet as NonNullable<typeof quiet>), input_i: "-80" };
		expect(shouldApplyLoudness(silent)).toBe(false);
	});

	it("measures audio only and copies the video stream when applying", () => {
		expect(buildLoudnessMeasureArgs("in.mp4")).toContain("-vn");
		const measured = parseLoudnormJson(STDERR);
		if (!measured) throw new Error("parse failed");
		const args = buildLoudnessApplyArgs("in.mp4", "out.mp4", measured);
		expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
		const filter = args[args.indexOf("-af") + 1];
		expect(filter).toContain(`I=${SKY_TARGET_LUFS}`);
		expect(filter).toContain("measured_I=-38.08");
		expect(filter).toContain("linear=true");
		expect(args[args.indexOf("-ar") + 1]).toBe("48000");
		expect(args.at(-1)).toBe("out.mp4");
	});
});
