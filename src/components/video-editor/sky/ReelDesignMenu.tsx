import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CaretDown } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { useAppearanceState } from "../state/useAppearanceState";
import {
	applyCameraShape,
	buildReelTemplate,
	type CameraCorner,
	moveCameraToCorner,
	type CameraShape,
	chartPositionToPadding,
	getCameraShape,
	paddingToChartPosition,
	REEL_TEMPLATES,
	type ReelTemplate,
	type ReelTemplateId,
	scaleCamera,
} from "./reelTemplates";
import { SKY_GOLD } from "./skyPresets";

type Appearance = ReturnType<typeof useAppearanceState>;

interface ReelDesignMenuProps {
	appearance: Appearance;
	setAspectRatio: Dispatch<SetStateAction<AspectRatio>>;
}

const BAND_COLORS: Record<ReelTemplate["bands"][number]["kind"], string> = {
	chart: "#1f6f5c",
	camera: SKY_GOLD,
	free: "rgba(255,255,255,0.08)",
	logo: "radial-gradient(circle, #D4AF37 0 22%, #0A0A0A 60%)",
};

const DOT_POSITION: Record<NonNullable<ReelTemplate["cameraDot"]>, React.CSSProperties> = {
	"top-left": { left: 3, top: 3 },
	"bottom-left": { left: 3, bottom: 3 },
	"mid-left": { left: 3, top: "34%" },
};

function TemplatePreview({ template }: { template: ReelTemplate }) {
	const total = template.bands.reduce((sum, band) => sum + band.size, 0);

	return (
		<div className="relative flex h-16 w-9 shrink-0 flex-col overflow-hidden rounded-[5px] border border-foreground/15 bg-[#0A0A0A]">
			{template.bands.map((band, index) => (
				<div
					key={index}
					style={{
						flexGrow: band.size / total,
						background: BAND_COLORS[band.kind],
						opacity: band.kind === "camera" ? 0.85 : 1,
					}}
				/>
			))}
			{template.cameraDot ? (
				<span
					className="absolute h-3 w-3 rounded-full border border-black/40"
					style={{ ...DOT_POSITION[template.cameraDot], background: "#8a7a5a" }}
				/>
			) : null}
		</div>
	);
}

/**
 * SKY Academy "Diseño Reel": templates for vertical videos plus simple controls
 * for the chart position and the camera. The camera can also be dragged and
 * resized directly on the preview.
 */
export function ReelDesignMenu({ appearance, setAspectRatio }: ReelDesignMenuProps) {
	const [open, setOpen] = useState(false);
	const webcam = appearance.webcam;
	const hasCamera = Boolean(webcam.sourcePath);
	const chartPosition = paddingToChartPosition(appearance.padding);
	const cameraShape = getCameraShape(webcam);

	const applyTemplate = (id: ReelTemplateId) => {
		const layout = buildReelTemplate(id, webcam);
		appearance.setWebcam((current) => ({
			...layout.webcam,
			sourcePath: current.sourcePath,
			visibleRanges: current.visibleRanges,
			enabled: current.enabled,
		}));
		appearance.setPadding(layout.padding);
		appearance.setCropRegion(layout.cropRegion);
		appearance.setBorderRadius(layout.borderRadius);
		appearance.setWallpaper(layout.wallpaper);
		appearance.setBackgroundBlur(layout.backgroundBlur);
		setAspectRatio(layout.aspectRatio);
		const template = REEL_TEMPLATES.find((item) => item.id === id);
		toast.success(`Diseño "${template?.label ?? "Reel"}" aplicado`, {
			description: hasCamera
				? "Arrastre la cámara en el video para moverla; rueda del mouse para cambiar el tamaño."
				: "Este video no tiene cámara grabada: el espacio queda libre para logo o textos.",
		});
	};

	const updateWebcam = (patch: Partial<typeof webcam>) =>
		appearance.setWebcam((current) => ({ ...current, ...patch }));

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					size="sm"
					className="h-9 shrink-0 gap-1.5 px-3 text-xs font-semibold"
					style={{ background: SKY_GOLD, color: "#0A0A0A" }}
					title="Diseño Reel SKY: plantillas verticales, posición del gráfico y cámara"
				>
					Diseño Reel
					<CaretDown className="h-3 w-3" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" side="top" sideOffset={10} className="w-[340px] p-4">
				<div className="space-y-4">
					<div>
						<p className="mb-2 text-sm font-semibold text-foreground">
							Diseño Reel SKY
						</p>
						<div className="grid grid-cols-2 gap-2">
							{REEL_TEMPLATES.map((template) => (
								<button
									key={template.id}
									type="button"
									title={template.description}
									onClick={() => applyTemplate(template.id)}
									className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] p-2 text-left transition-colors hover:border-[#D4AF37]"
								>
									<TemplatePreview template={template} />
									<span className="text-[11px] font-semibold leading-tight text-foreground">
										{template.label}
									</span>
								</button>
							))}
						</div>
					</div>

					<div>
						<div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
							<span className="font-semibold text-foreground">Gráfico</span>
							<span>arriba ↕ abajo</span>
						</div>
						<Slider
							aria-label="Posición del gráfico"
							min={0}
							max={100}
							step={1}
							value={[Math.round(chartPosition * 100)]}
							onValueChange={([value]) =>
								appearance.setPadding(chartPositionToPadding((value ?? 50) / 100))
							}
						/>
					</div>

					<div className={cn(!hasCamera && "pointer-events-none opacity-50")}>
						<div className="mb-2 flex items-center justify-between">
							<span className="text-[11px] font-semibold text-foreground">
								Cámara
							</span>
							{!hasCamera ? (
								<span className="text-[10px] text-muted-foreground">
									sin cámara grabada
								</span>
							) : null}
						</div>
						<div className="mb-3 grid grid-cols-3 gap-1.5">
							{(
								[
									["circle", "Círculo"],
									["rounded", "Redondeada"],
									["rectangle", "Rectángulo"],
								] as Array<[CameraShape, string]>
							).map(([shape, label]) => (
								<button
									key={shape}
									type="button"
									aria-pressed={cameraShape === shape}
									onClick={() => updateWebcam(applyCameraShape(webcam, shape))}
									className={cn(
										"h-8 rounded-lg border text-[11px] font-semibold transition-colors",
										cameraShape === shape
											? "border-[#D4AF37] bg-[#D4AF37]/15 text-foreground"
											: "border-foreground/10 bg-foreground/[0.04] text-muted-foreground",
									)}
								>
									{label}
								</button>
							))}
						</div>
						<div className="mb-3 grid grid-cols-4 gap-1.5">
							{(
								[
									["top-left", "↖"],
									["top-right", "↗"],
									["bottom-left", "↙"],
									["bottom-right", "↘"],
								] as Array<[CameraCorner, string]>
							).map(([corner, arrow]) => (
								<button
									key={corner}
									type="button"
									title="Mover la cámara a esta esquina"
									aria-pressed={webcam.positionPreset === corner}
									onClick={() => updateWebcam(moveCameraToCorner(corner))}
									className={cn(
										"h-8 rounded-lg border text-sm font-semibold transition-colors",
										webcam.positionPreset === corner
											? "border-[#D4AF37] bg-[#D4AF37]/15 text-foreground"
											: "border-foreground/10 bg-foreground/[0.04] text-muted-foreground",
									)}
								>
									{arrow}
								</button>
							))}
						</div>
						<div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
							<span>Tamaño</span>
							<span>{Math.round(webcam.width)}%</span>
						</div>
						<Slider
							aria-label="Tamaño de la cámara"
							min={10}
							max={100}
							step={1}
							value={[Math.round(webcam.width)]}
							onValueChange={([value]) =>
								updateWebcam(
									scaleCamera(webcam, (value ?? webcam.width) / webcam.width),
								)
							}
						/>
						<p className="mt-2 text-[10px] leading-snug text-muted-foreground">
							Tip: agarre la cámara en el video para moverla. Con la rueda del mouse
							encima, cambia el tamaño.
						</p>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
