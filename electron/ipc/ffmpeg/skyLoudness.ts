/**
 * SKY Academy: bring the voice of exported MP4s to social-media loudness.
 *
 * Instagram / TikTok / YouTube Shorts play around -14 LUFS. Screen recordings
 * with a desk mic often land at -35..-40 LUFS, so viewers think the video has
 * no sound. After an MP4 is saved we run ffmpeg's two-pass EBU R128 `loudnorm`
 * on the audio track only (video is stream-copied, so it is fast and lossless).
 *
 * The step is best effort: any failure leaves the exported file untouched.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export const SKY_TARGET_LUFS = -14;
export const SKY_TARGET_TRUE_PEAK = -1.5;
export const SKY_TARGET_LRA = 11;
/** Files already within this many LU of the target are left alone. */
export const SKY_LOUDNESS_TOLERANCE_LU = 1.5;

export interface LoudnormMeasurement {
	input_i: string;
	input_tp: string;
	input_lra: string;
	input_thresh: string;
	target_offset: string;
}

const TARGET = `I=${SKY_TARGET_LUFS}:TP=${SKY_TARGET_TRUE_PEAK}:LRA=${SKY_TARGET_LRA}`;

export function buildLoudnessMeasureArgs(inputPath: string): string[] {
	return [
		"-hide_banner",
		"-nostats",
		"-i",
		inputPath,
		"-vn",
		"-af",
		`loudnorm=${TARGET}:print_format=json`,
		"-f",
		"null",
		"-",
	];
}

export function buildLoudnessApplyArgs(
	inputPath: string,
	outputPath: string,
	measured: LoudnormMeasurement,
): string[] {
	const filter = [
		`loudnorm=${TARGET}`,
		`measured_I=${measured.input_i}`,
		`measured_TP=${measured.input_tp}`,
		`measured_LRA=${measured.input_lra}`,
		`measured_thresh=${measured.input_thresh}`,
		`offset=${measured.target_offset}`,
		"linear=true",
		"print_format=summary",
	].join(":");
	return [
		"-hide_banner",
		"-nostats",
		"-y",
		"-i",
		inputPath,
		"-map",
		"0:v?",
		"-map",
		"0:a:0",
		"-c:v",
		"copy",
		"-af",
		filter,
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		// loudnorm resamples to 192 kHz internally; bring it back to 48 kHz
		"-ar",
		"48000",
		"-movflags",
		"+faststart",
		outputPath,
	];
}

/** Extracts the JSON block that `loudnorm=print_format=json` writes to stderr. */
export function parseLoudnormJson(stderr: string): LoudnormMeasurement | null {
	const end = stderr.lastIndexOf("}");
	const start = end >= 0 ? stderr.lastIndexOf("{", end) : -1;
	if (start < 0 || end < 0) return null;
	try {
		const parsed = JSON.parse(stderr.slice(start, end + 1)) as Record<string, unknown>;
		const keys = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"] as const;
		const result = {} as LoudnormMeasurement;
		for (const key of keys) {
			const value = parsed[key];
			if (typeof value !== "string" || !Number.isFinite(Number(value))) return null;
			result[key] = value;
		}
		return result;
	} catch {
		return null;
	}
}

/** Silent / missing audio (-inf) and already-loud files are skipped. */
export function shouldApplyLoudness(measured: LoudnormMeasurement | null): boolean {
	if (!measured) return false;
	const integrated = Number(measured.input_i);
	if (!Number.isFinite(integrated) || integrated < -70) return false;
	return Math.abs(integrated - SKY_TARGET_LUFS) > SKY_LOUDNESS_TOLERANCE_LU;
}

function runFfmpeg(
	ffmpegPath: string,
	args: string[],
	timeoutMs: number,
): Promise<{ code: number | null; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn(ffmpegPath, args, { windowsHide: true });
		let stderr = "";
		const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
			if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			resolve({ code: -1, stderr: `${stderr}\n${String(error)}` });
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ code, stderr });
		});
	});
}

export interface LoudnessResult {
	applied: boolean;
	measuredLufs?: number;
	reason?: string;
}

/**
 * Normalizes the audio of an exported MP4 in place. Never throws.
 */
export async function normalizeExportLoudness(
	filePath: string,
	ffmpegPath: string,
): Promise<LoudnessResult> {
	if (!filePath.toLowerCase().endsWith(".mp4")) {
		return { applied: false, reason: "not-mp4" };
	}
	const tempPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath, ".mp4")}.sky-audio-${Date.now()}.mp4`,
	);
	try {
		const stat = await fs.stat(filePath);
		// ~2 minutes per GB of video for the copy pass, at least 3 minutes.
		const timeoutMs = Math.max(180_000, Math.round((stat.size / 1e9) * 120_000));

		const measure = await runFfmpeg(ffmpegPath, buildLoudnessMeasureArgs(filePath), timeoutMs);
		const measured = measure.code === 0 ? parseLoudnormJson(measure.stderr) : null;
		const measuredLufs = measured ? Number(measured.input_i) : undefined;
		if (!shouldApplyLoudness(measured)) {
			return {
				applied: false,
				measuredLufs,
				reason: measured ? "within-target" : "no-audio",
			};
		}

		const apply = await runFfmpeg(
			ffmpegPath,
			buildLoudnessApplyArgs(filePath, tempPath, measured as LoudnormMeasurement),
			timeoutMs,
		);
		if (apply.code !== 0) {
			await fs.rm(tempPath, { force: true });
			console.warn("[sky-loudness] apply pass failed:", apply.stderr.slice(-2000));
			return { applied: false, measuredLufs, reason: "ffmpeg-failed" };
		}
		const output = await fs.stat(tempPath);
		if (output.size < 1024) {
			await fs.rm(tempPath, { force: true });
			return { applied: false, measuredLufs, reason: "empty-output" };
		}
		await fs.rename(tempPath, filePath);
		return { applied: true, measuredLufs };
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		console.warn("[sky-loudness] skipped:", error);
		return { applied: false, reason: "error" };
	}
}
