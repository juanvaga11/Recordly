/**
 * SKY Academy: conceal short audio dropouts.
 *
 * On Windows, wireless / Bluetooth headsets and busy machines make WASAPI drop
 * microphone packets. Recordly fills those holes with digital silence, which
 * sounds like the voice "cutting out" several times per second once the voice
 * is brought up to social-media loudness.
 *
 * Each short run of exact zeros that sits inside speech is replaced by a
 * crossfade between the audio just before the hole and the audio just after
 * it. That is a simple packet-loss concealment: not perfect, but a 25 ms
 * smear is far less noticeable than a 25 ms hole.
 */

export interface DropoutOptions {
	sampleRate: number;
	channels: number;
	/** Holes shorter than this are ignored (sample-level zero crossings). */
	minGapMs?: number;
	/** Longer silences are real pauses, not dropouts. */
	maxGapMs?: number;
	/** Audio around the hole must be at least this loud (linear peak). */
	contextThreshold?: number;
}

export interface DropoutReport {
	concealed: number;
	concealedMs: number;
}

/** Dropouts decode as near-exact zeros (below -100 dBFS), far under any room noise. */
const ZERO = 1e-5;

function isZeroFrame(samples: Float32Array, frame: number, channels: number): boolean {
	const base = frame * channels;
	for (let c = 0; c < channels; c++) {
		if (Math.abs(samples[base + c] ?? 0) > ZERO) return false;
	}
	return true;
}

function peakInFrames(samples: Float32Array, start: number, end: number, channels: number): number {
	let peak = 0;
	const from = Math.max(0, start) * channels;
	const to = Math.min(samples.length, end * channels);
	for (let i = from; i < to; i++) {
		const value = Math.abs(samples[i] ?? 0);
		if (value > peak) peak = value;
	}
	return peak;
}

/**
 * "Speech is present" level relative to the recording: 4% of its loud peaks
 * (99th percentile), so very quiet mics are handled like loud ones.
 */
export function relativeSpeechThreshold(samples: Float32Array): number {
	const step = Math.max(1, Math.floor(samples.length / 200_000));
	const picks: number[] = [];
	for (let i = 0; i < samples.length; i += step) picks.push(Math.abs(samples[i] ?? 0));
	if (picks.length === 0) return 0.003;
	picks.sort((a, b) => a - b);
	const p99 = picks[Math.min(picks.length - 1, Math.floor(picks.length * 0.99))] ?? 0;
	return Math.max(0.0004, p99 * 0.04);
}

/** Finds holes of exact digital silence, in frames: [start, end). */
export function findDropouts(
	samples: Float32Array,
	options: DropoutOptions,
): Array<{ start: number; end: number }> {
	const { sampleRate, channels } = options;
	const minFrames = Math.max(1, Math.round(((options.minGapMs ?? 2) / 1000) * sampleRate));
	const maxFrames = Math.round(((options.maxGapMs ?? 150) / 1000) * sampleRate);
	const contextFrames = Math.round(0.012 * sampleRate);
	const threshold = options.contextThreshold ?? relativeSpeechThreshold(samples);
	const totalFrames = Math.floor(samples.length / channels);
	const holes: Array<{ start: number; end: number }> = [];

	let frame = 0;
	while (frame < totalFrames) {
		if (!isZeroFrame(samples, frame, channels)) {
			frame++;
			continue;
		}
		const start = frame;
		while (frame < totalFrames && isZeroFrame(samples, frame, channels)) frame++;
		const end = frame;
		const length = end - start;
		if (length < minFrames || length > maxFrames) continue;
		if (start < contextFrames || end + contextFrames > totalFrames) continue;
		const before = peakInFrames(samples, start - contextFrames, start, channels);
		const after = peakInFrames(samples, end, end + contextFrames, channels);
		if (before >= threshold && after >= threshold) holes.push({ start, end });
	}
	return holes;
}

/**
 * Fills each hole with previous audio fading out + following audio fading in.
 * Works in place on interleaved float samples.
 */
export function concealDropouts(samples: Float32Array, options: DropoutOptions): DropoutReport {
	const { channels, sampleRate } = options;
	const holes = findDropouts(samples, options);
	let concealedFrames = 0;
	for (const { start, end } of holes) {
		const length = end - start;
		for (let i = 0; i < length; i++) {
			// equal-power crossfade from "before" to "after"
			const t = (i + 0.5) / length;
			const fadeOut = Math.cos((t * Math.PI) / 2);
			const fadeIn = Math.sin((t * Math.PI) / 2);
			const prevFrame = start - length + i;
			const nextFrame = end + i;
			for (let c = 0; c < channels; c++) {
				const prev = prevFrame >= 0 ? (samples[prevFrame * channels + c] ?? 0) : 0;
				const next = samples[nextFrame * channels + c] ?? 0;
				samples[(start + i) * channels + c] = prev * fadeOut + next * fadeIn;
			}
		}
		concealedFrames += length;
	}
	return {
		concealed: holes.length,
		concealedMs: Math.round((concealedFrames / sampleRate) * 1000),
	};
}
