/**
 * SKY Academy: lets the HUD choose how Windows records the microphone.
 * "browser" = Chromium capture (steady on USB mics), "native" = WASAPI.
 */
import { ipcMain } from "electron";
import { readAppSetting, writeAppSetting } from "../../appSettingsStore";
import {
	normalizeSkyWindowsMicCaptureMode,
	SKY_WINDOWS_MIC_CAPTURE_SETTING,
} from "../recording/windowsFallbacks";

export function registerSkyMicModeHandlers() {
	ipcMain.handle("sky-get-mic-capture-mode", () => ({
		mode: normalizeSkyWindowsMicCaptureMode(readAppSetting(SKY_WINDOWS_MIC_CAPTURE_SETTING)),
		platform: process.platform,
	}));
	ipcMain.handle("sky-set-mic-capture-mode", (_event, mode: unknown) => {
		const normalized = normalizeSkyWindowsMicCaptureMode(mode);
		try {
			writeAppSetting(SKY_WINDOWS_MIC_CAPTURE_SETTING, normalized);
			return { success: true, mode: normalized };
		} catch (error) {
			return { success: false, mode: normalized, error: String(error) };
		}
	});
}
