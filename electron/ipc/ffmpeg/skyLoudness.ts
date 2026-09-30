/**
 * SKY Academy: clean up and level the voice of exported MP4s for social media.
 *
 * Instagram / TikTok / YouTube Shorts play around -14 LUFS. Screen recordings
 * with a desk or headset mic often land at -35..-40 LUFS, and on Windows the
 * mic capture can contain short dropouts (digital silence) from wireless
 * headsets. Raising such audio by 20+ dB makes the dropouts, the room noise
 * and some peaks very audible, so after an MP4 is saved we:
 *
 *   1. decode the audio and conceal short dropouts (skyDropouts.ts),
 *   2. remove rumble (high-pass) and gently reduce steady background noise,
 *   3. level it with two-pass EBU R128 `loudnorm`,
 *   4. and catch any remaining peak with a limiter so nothing clips.
 *
 * The video stream is copied untouched. The step is best effort: any failure
 * leaves the exported file exactly as it was.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { concealDropouts } from "./skyDropouts";

export const SKY_TARGET_LUFS = -14;
export const SKY_TARGET_TRUE_PEAK = -1.5;
export const SKY_TARGET_LRA = 11;
/** Files already within this many LU of the target (and without dropouts) are left alone. */
export const SKY_LOUDNESS_TOLERANCE_LU = 1.5;
/** Dropout concealment keeps the whole track in memory; longer videos skip it. */
export const SKY_MAX_CONCEAL_SECONDS = 12 * 60;

const SAMPLE_RATE = 48000;
const CHANNELS = 2;

export interface LoudnormMeasurement {
	input_i: string;
	input_tp: string;
	input_lra: string;
	input_thresh: string;
	target_offset: string;
}

const TARGET = `I=${SKY_TARGET_LUFS}:TP=${SKY_TARGET_TRUE_PEAK}:LRA=${SKY_TARGET_LRA}`;
/** Rumble and steady hiss removal, kept mild so the voice stays natural. */
export const SKY_CLEAN_FILTERS = "highpass=f=80,afftdn=nr=10:nf=-50:tn=1";
/** Pink "room tone" at about -64 dBFS, far below the voice. */
export const SKY_ROOM_TONE_AMPLITUDE = 0.0006;
/** Hard ceiling at -1.5 dBFS after leveling. */
// loudnorm works at 192 kHz; the limiter only catches peaks reliably at 48 kHz
export const SKY_LIMITER = "aresample=48000,alimiter=limit=0.84:level=false:attack=1:release=50";

const RAW_INPUT = ["-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", String(CHANNELS)];

export function buildDecodeArgs(inputPath: string, rawPath: string): string[] {
	return [
		"-hide_banner",
		"-nostats",
		"-y",
		"-i",
		inputPath,
		"-vn",
		"-map",
		"0:a:0",
		...RAW_INPUT,
		rawPath,
	];
}

export function buildLoudnessMeasureArgs(rawPath: string): string[] {
	return [
		"-hide_banner",
		"-nostats",
		...RAW_INPUT,
		"-i",
		rawPath,
		"-af",
		`${SKY_CLEAN_FILTERS},loudnorm=${TARGET}:print_format=json`,
		"-f",
		"null",
		"-",
	];
}

export function buildLoudnessApplyArgs(
	videoPath: string,
	rawPath: string,
	outputPath: string,
	measured: LoudnormMeasurement,
): string[] {
	const loudnorm = [
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
		videoPath,
		...RAW_INPUT,
		"-i",
		rawPath,
		"-filter_complex",
		[
			`[1:a]${SKY_CLEAN_FILTERS},${loudnorm},aresample=${SAMPLE_RATE}[voice]`,
			// very quiet room tone so pauses are not dead digital silence: headset
			// noise gates otherwise make the leveled voice sound chopped
			`anoisesrc=r=${SAMPLE_RATE}:c=pink:a=${SKY_ROOM_TONE_AMPLITUDE},aformat=channel_layouts=stereo[tone]`,
			// the limiter goes last: amix otherwise passes the unlimited peaks through
			`[voice][tone]amix=inputs=2:duration=first:normalize=0,${SKY_LIMITER}[out]`,
		].join(";"),
		"-map",
		"0:v?",
		"-map",
		"[out]",
		"-c:v",
		"copy",
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		// loudnorm resamples to 192 kHz internally; bring it back to 48 kHz
		"-ar",
		String(SAMPLE_RATE),
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

/** Silent / missing audio (-inf) is skipped; dropouts force processing. */
export function shouldApplyLoudness(
	measured: LoudnormMeasurement | null,
	concealedDropouts = 0,
): boolean {
	if (!measured) return false;
	const integrated = Number(measured.input_i);
	if (!Number.isFinite(integrated) || integrated < -70) return false;
	if (concealedDropouts > 0) return true;
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
	concealedDropouts?: number;
	reason?: string;
}

/**
 * Cleans and levels the audio of an exported MP4 in place. Never throws.
 */
export async function normalizeExportLoudness(
	filePath: string,
	ffmpegPath: string,
): Promise<LoudnessResult> {
	if (!filePath.toLowerCase().endsWith(".mp4")) {
		return { applied: false, reason: "not-mp4" };
	}
	const stamp = `${path.basename(filePath, ".mp4")}.sky-audio-${Date.now()}`;
	const rawPath = path.join(path.dirname(filePath), `.${stamp}.f32`);
	const tempPath = path.join(path.dirname(filePath), `.${stamp}.mp4`);
	const cleanup = async () => {
		await fs.rm(rawPath, { force: true }).catch(() => undefined);
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
	};
	try {
		const stat = await fs.stat(filePath);
		// ~2 minutes per GB of video for the copy pass, at least 3 minutes.
		const timeoutMs = Math.max(180_000, Math.round((stat.size / 1e9) * 120_000));

		const decode = await runFfmpeg(ffmpegPath, buildDecodeArgs(filePath, rawPath), timeoutMs);
		if (decode.code !== 0) {
			await cleanup();
			return { applied: false, reason: "no-audio" };
		}

		let concealedDropouts = 0;
		const rawStat = await fs.stat(rawPath);
		const seconds = rawStat.size / (SAMPLE_RATE * CHANNELS * 4);
		if (seconds <= SKY_MAX_CONCEAL_SECONDS) {
			const buffer = await fs.readFile(rawPath);
			const samples = new Float32Array(
				buffer.buffer,
				buffer.byteOffset,
				buffer.byteLength / 4,
			);
			const report = concealDropouts(samples, {
				sampleRate: SAMPLE_RATE,
				channels: CHANNELS,
			});
			concealedDropouts = report.concealed;
			if (report.concealed > 0) await fs.writeFile(rawPath, buffer);
		}

		const measure = await runFfmpeg(ffmpegPath, buildLoudnessMeasureArgs(rawPath), timeoutMs);
		const measured = measure.code === 0 ? parseLoudnormJson(measure.stderr) : null;
		const measuredLufs = measured ? Number(measured.input_i) : undefined;
		if (!shouldApplyLoudness(measured, concealedDropouts)) {
			await cleanup();
			return {
				applied: false,
				measuredLufs,
				concealedDropouts,
				reason: measured ? "within-target" : "no-audio",
			};
		}

		const apply = await runFfmpeg(
			ffmpegPath,
			buildLoudnessApplyArgs(filePath, rawPath, tempPath, measured as LoudnormMeasurement),
			timeoutMs,
		);
		if (apply.code !== 0) {
			console.warn("[sky-loudness] apply pass failed:", apply.stderr.slice(-2000));
			await cleanup();
			return { applied: false, measuredLufs, concealedDropouts, reason: "ffmpeg-failed" };
		}
		const output = await fs.stat(tempPath);
		if (output.size < 1024) {
			await cleanup();
			return { applied: false, measuredLufs, concealedDropouts, reason: "empty-output" };
		}
		await fs.rename(tempPath, filePath);
		await cleanup();
		return { applied: true, measuredLufs, concealedDropouts };
	} catch (error) {
		await cleanup();
		console.warn("[sky-loudness] skipped:", error);
		return { applied: false, reason: "error" };
	}
}
