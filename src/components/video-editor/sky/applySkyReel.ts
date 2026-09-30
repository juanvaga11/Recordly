import type { Dispatch, SetStateAction } from "react";
import { toast } from "@/components/ui/toast";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { useAppearanceState } from "../state/useAppearanceState";
import { buildSkyReelLayout, buildSkyReelWebcam } from "./skyPresets";

type Appearance = ReturnType<typeof useAppearanceState>;

/**
 * SKY Academy: one click vertical 9:16 layout for Reels / TikTok / Shorts.
 * Shared by the toolbar button and the (hidden upstream) presets menu.
 */
export function applySkyReelLayout(
	appearance: Appearance,
	setAspectRatio: Dispatch<SetStateAction<AspectRatio>>,
) {
	const layout = buildSkyReelLayout({
		padding: appearance.padding,
		cropRegion: appearance.cropRegion,
		webcam: appearance.webcam,
		wallpaper: appearance.wallpaper,
		borderRadius: appearance.borderRadius,
	});
	// Functional update so the recorded webcam source is never lost.
	appearance.setWebcam((current) => buildSkyReelWebcam(current));
	appearance.setPadding(layout.padding);
	appearance.setCropRegion(layout.cropRegion);
	appearance.setBorderRadius(layout.borderRadius);
	appearance.setWallpaper(layout.wallpaper);
	setAspectRatio(layout.aspectRatio);
	toast.success("Formato Reel SKY aplicado (9:16)", {
		description: "Si quiere mostrar otra parte del gráfico, ajuste el recorte.",
	});
}
