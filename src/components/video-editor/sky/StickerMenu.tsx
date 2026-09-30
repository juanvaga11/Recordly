import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CaretDown, Megaphone } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { AnnotationRegion, AudioRegion } from "../types";
import { nextAnnotationZIndex, nextFreeAnnotationTrack } from "./decisionCountdown";
import { SKY_GOLD } from "./skyPresets";
import { findSkySound, placeSoundEffects, type SfxPlacement } from "./soundEffects";
import {
	buildCallToAction,
	buildStickerRegion,
	CALLS_TO_ACTION,
	type CallToActionId,
	SKY_STICKER_ID_PREFIX,
	SKY_STICKERS,
	type StickerDefinition,
	stickerImage,
	type TimedSound,
} from "./stickers";

interface StickerMenuProps {
	annotationRegions: AnnotationRegion[];
	setAnnotationRegions: Dispatch<SetStateAction<AnnotationRegion[]>>;
	setAudioRegions: Dispatch<SetStateAction<AudioRegion[]>>;
	/** Playhead in seconds (timeline time). */
	playheadSeconds: number;
	/** Output frame width / height. */
	frameAspect: number;
	/** Visible recording (after crop) width / height. */
	chartAspect: number;
}

type Place = "top" | "middle" | "bottom";
const PLACE_Y: Record<Place, { vertical: number; horizontal: number }> = {
	top: { vertical: 14, horizontal: 14 },
	middle: { vertical: 50, horizontal: 50 },
	bottom: { vertical: 78, horizontal: 82 },
};

/**
 * SKY stickers: chart tools (zig-zag, arrows, TP/SL lines, ✓ ✗ ?) and animated
 * social calls to action (Sígueme + campanita, like/comenta/comparte/guarda).
 */
export function StickerMenu({
	annotationRegions,
	setAnnotationRegions,
	setAudioRegions,
	playheadSeconds,
	frameAspect,
	chartAspect,
}: StickerMenuProps) {
	const [open, setOpen] = useState(false);
	const [withSound, setWithSound] = useState(true);
	const [place, setPlace] = useState<Place>("bottom");
	const vertical = frameAspect < 1;
	const count = annotationRegions.filter((region) =>
		region.id.startsWith(SKY_STICKER_ID_PREFIX),
	).length;

	const addSounds = async (sounds: TimedSound[]) => {
		if (!withSound || sounds.length === 0) return;
		const placements: SfxPlacement[] = [];
		for (const { soundId, startMs } of sounds) {
			const sound = await findSkySound(soundId);
			if (sound) placements.push({ path: sound.path, startMs, durationMs: sound.durationMs });
		}
		if (placements.length > 0) {
			setAudioRegions((current) => placeSoundEffects(current, placements));
		}
	};

	const addSticker = (sticker: StickerDefinition) => {
		const startMs = playheadSeconds * 1000;
		const region = buildStickerRegion(sticker, {
			startMs,
			frameAspect,
			chartAspect,
			center:
				sticker.group === "redes"
					? { x: 50, y: PLACE_Y[place][vertical ? "vertical" : "horizontal"] }
					: undefined,
			track: nextFreeAnnotationTrack(annotationRegions),
			zIndex: nextAnnotationZIndex(annotationRegions),
		});
		setAnnotationRegions((current) => [...current, region]);
		void addSounds(sticker.sound ? [{ soundId: sticker.sound, startMs }] : []);
		toast.success(`"${sticker.label}" agregado`, {
			description:
				sticker.group === "grafico"
					? "Arrástrelo sobre el gráfico y agrándelo desde las esquinas. Dura 3 s (ajústelo en la línea de tiempo)."
					: "Arrástrelo donde quiera. Dura 3 s (ajústelo en la línea de tiempo).",
		});
	};

	const addCallToAction = (id: CallToActionId) => {
		const { regions, sounds } = buildCallToAction(id, {
			startMs: playheadSeconds * 1000,
			frameAspect,
			baseY: PLACE_Y[place][vertical ? "vertical" : "horizontal"],
			firstTrack: nextFreeAnnotationTrack(annotationRegions),
			firstZIndex: nextAnnotationZIndex(annotationRegions),
		});
		setAnnotationRegions((current) => [...current, ...regions]);
		void addSounds(sounds);
		setOpen(false);
		toast.success("Llamado a la acción agregado", {
			description: "Animado y con sonido. Ctrl+Z para deshacer.",
		});
	};

	const removeAll = () =>
		setAnnotationRegions((current) =>
			current.filter((region) => !region.id.startsWith(SKY_STICKER_ID_PREFIX)),
		);

	const renderGrid = (group: StickerDefinition["group"]) => (
		<div className="grid grid-cols-5 gap-1.5">
			{SKY_STICKERS.filter((sticker) => sticker.group === group).map((sticker) => (
				<button
					key={sticker.id}
					type="button"
					title={sticker.label}
					onClick={() => addSticker(sticker)}
					className="flex aspect-square items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.06] p-1 transition-colors hover:border-[#D4AF37]"
				>
					<img
						src={stickerImage(sticker.id)?.src}
						alt={sticker.label}
						className="max-h-full max-w-full object-contain"
						draggable={false}
					/>
				</button>
			))}
		</div>
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-9 shrink-0 gap-1.5 px-2 text-xs font-semibold"
					title="Stickers: herramientas para el gráfico y botones de redes animados"
				>
					<Megaphone className="h-4 w-4" style={{ color: SKY_GOLD }} />
					Stickers
					<CaretDown className="h-3 w-3" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="center" side="top" sideOffset={10} className="w-[360px] p-4">
				<div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
					<div className="flex items-center justify-between">
						<p className="text-sm font-semibold text-foreground">Stickers SKY</p>
						<button
							type="button"
							aria-pressed={withSound}
							onClick={() => setWithSound(!withSound)}
							className={cn(
								"rounded-full border px-2 py-0.5 text-[10px] font-semibold",
								withSound
									? "border-[#D4AF37] bg-[#D4AF37]/15 text-foreground"
									: "border-foreground/10 text-muted-foreground line-through",
							)}
						>
							Con sonido
						</button>
					</div>

					<div>
						<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#D4AF37]">
							Para el gráfico
						</p>
						{renderGrid("grafico")}
						<p className="mt-1 text-[10px] leading-snug text-muted-foreground">
							Se pegan al gráfico (siguen el zoom). Aparecen en la línea roja.
						</p>
					</div>

					<div>
						<div className="mb-1.5 flex items-center justify-between">
							<p className="text-[10px] font-semibold uppercase tracking-wide text-[#D4AF37]">
								Redes (animados)
							</p>
							<div className="flex gap-1">
								{(
									[
										["top", "Arriba"],
										["middle", "Centro"],
										["bottom", "Abajo"],
									] as Array<[Place, string]>
								).map(([value, label]) => (
									<button
										key={value}
										type="button"
										aria-pressed={place === value}
										onClick={() => setPlace(value)}
										className={cn(
											"rounded-md border px-1.5 py-0.5 text-[10px]",
											place === value
												? "border-[#D4AF37] text-foreground"
												: "border-foreground/10 text-muted-foreground",
										)}
									>
										{label}
									</button>
								))}
							</div>
						</div>
						<div className="mb-2 space-y-1">
							{CALLS_TO_ACTION.map((cta) => (
								<button
									key={cta.id}
									type="button"
									onClick={() => addCallToAction(cta.id)}
									className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1.5 text-left hover:border-[#D4AF37]"
								>
									<span className="block text-[12px] font-semibold text-foreground">
										{cta.label}
									</span>
									<span className="block text-[10px] text-muted-foreground">
										{cta.description}
									</span>
								</button>
							))}
						</div>
						{renderGrid("redes")}
					</div>

					{count > 0 ? (
						<Button
							type="button"
							variant="outline"
							onClick={removeAll}
							className="h-8 w-full text-xs"
						>
							Quitar todos los stickers ({count})
						</Button>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}
