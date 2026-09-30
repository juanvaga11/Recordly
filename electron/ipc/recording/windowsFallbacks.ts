const WINDOWS_MIC_CAPTURE_UNAVAILABLE_MARKERS = [
	"MICROPHONE_CAPTURE_UNAVAILABLE",
	"WARNING: Failed to initialize WASAPI mic capture",
];
export const WINDOWS_MIC_CAPTURE_MODE_ENV = "RECORDLY_WINDOWS_MIC_CAPTURE";

/**
 * SKY Academy: app setting that picks the Windows mic path from the HUD.
 * "browser" (Chromium capture) is our default because native WASAPI mic
 * capture dropped packets on some USB mics, making the voice sound chopped.
 */
export const SKY_WINDOWS_MIC_CAPTURE_SETTING = "skyWindowsMicCapture";
export type SkyWindowsMicCaptureMode = "browser" | "native";
export const SKY_DEFAULT_WINDOWS_MIC_CAPTURE: SkyWindowsMicCaptureMode = "browser";

export function normalizeSkyWindowsMicCaptureMode(value: unknown): SkyWindowsMicCaptureMode {
	return value === "native"
		? "native"
		: value === "browser"
			? "browser"
			: SKY_DEFAULT_WINDOWS_MIC_CAPTURE;
}

export function shouldStartWindowsBrowserMicrophoneFallback(
	options?: { capturesMicrophone?: boolean },
	env: NodeJS.ProcessEnv = process.env,
	/** Mode saved in the app settings; the environment variable wins when set. */
	settingMode?: string | null,
) {
	if (!options?.capturesMicrophone) {
		return false;
	}

	const mode = (
		env[WINDOWS_MIC_CAPTURE_MODE_ENV]?.trim() ||
		settingMode?.trim() ||
		""
	).toLowerCase();
	// Native WASAPI is the normal Windows path. Keep the renderer path as an
	// explicit escape hatch and as an automatic fallback when WASAPI cannot start.
	return mode === "browser" || mode === "fallback" || mode === "renderer";
}

export function shouldUseWindowsBrowserMicrophoneFallback(
	captureOutput: string,
	options?: { capturesMicrophone?: boolean },
	env: NodeJS.ProcessEnv = process.env,
	settingMode?: string | null,
) {
	return (
		Boolean(options?.capturesMicrophone) &&
		(shouldStartWindowsBrowserMicrophoneFallback(options, env, settingMode) ||
			WINDOWS_MIC_CAPTURE_UNAVAILABLE_MARKERS.some((marker) =>
				captureOutput.includes(marker),
			))
	);
}
