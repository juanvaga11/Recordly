import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Plus, SpeakerHigh } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import type { AudioRegion } from "../types";
import { SKY_GOLD } from "./skyPresets";
import {
	loadSkySounds,
	placeSoundEffects,
	previewSkySound,
	SFX_CATEGORY_LABELS,
	SKY_SFX_ID_PREFIX,
	type SkySound,
	soundDurationMs,
} from "./soundEffects";

interface SoundMenuProps {
	audioRegions: AudioRegion[];
	setAudioRegions: Dispatch<SetStateAction<AudioRegion[]>>;
	/** Playhead in seconds (timeline time). */
	playheadSeconds: number;
}

/** SKY sound effects: listen and drop a sound at the playhead. */
export function SoundMenu({ audioRegions, setAudioRegions, playheadSeconds }: SoundMenuProps) {
	const [open, setOpen] = useState(false);
	const [sounds, setSounds] = useState<SkySound[]>([]);
	const [loading, setLoading] = useState(false);
	const effectCount = audioRegions.filter((region) =>
		region.id.startsWith(SKY_SFX_ID_PREFIX),
	).length;

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		void loadSkySounds(true)
			.then(setSounds)
			.finally(() => setLoading(false));
	}, [open]);

	const insert = async (sound: SkySound) => {
		const durationMs = await soundDurationMs(sound);
		setAudioRegions((current) =>
			placeSoundEffects(current, [
				{ path: sound.path, startMs: playheadSeconds * 1000, durationMs },
			]),
		);
		toast.success(`Sonido "${sound.name}" agregado`, {
			description: "Muévalo o cambie su volumen en la línea de tiempo. Ctrl+Z para deshacer.",
		});
	};

	const groups = Object.entries(
		sounds.reduce<Record<string, SkySound[]>>((acc, sound) => {
			(acc[sound.category] ??= []).push(sound);
			return acc;
		}, {}),
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-9 shrink-0 gap-1.5 px-2 text-xs font-semibold"
					title="Efectos de sonido SKY (propios, sin copyright)"
				>
					<SpeakerHigh className="h-4 w-4" style={{ color: SKY_GOLD }} />
					Sonidos
				</Button>
			</PopoverTrigger>
			<PopoverContent align="center" side="top" sideOffset={10} className="w-[340px] p-4">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<p className="text-sm font-semibold text-foreground">Efectos de sonido</p>
						<button
							type="button"
							onClick={() => void window.electronAPI?.skySfxOpenFolder?.()}
							className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
						>
							Mis sonidos
						</button>
					</div>
					<p className="text-[10px] leading-snug text-muted-foreground">
						Creados por SKY: 100% propios, sin copyright. ▶ escuchar · + poner en la
						línea roja.
					</p>
					<div className="max-h-72 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
						{loading && sounds.length === 0 ? (
							<p className="py-4 text-center text-[11px] text-muted-foreground">
								Cargando…
							</p>
						) : null}
						{groups.map(([category, items]) => (
							<div key={category}>
								<p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#D4AF37]">
									{SFX_CATEGORY_LABELS[category] ?? category}
								</p>
								{items.map((sound) => (
									<div
										key={sound.path}
										className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-foreground/[0.06]"
									>
										<button
											type="button"
											aria-label={`Escuchar ${sound.name}`}
											onClick={() => void previewSkySound(sound)}
											className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10"
										>
											<Play className="h-3.5 w-3.5" weight="fill" />
										</button>
										<div className="min-w-0 flex-1">
											<p className="truncate text-[12px] text-foreground">
												{sound.name}
											</p>
											<p className="truncate text-[10px] text-muted-foreground">
												{sound.description}
											</p>
										</div>
										<button
											type="button"
											aria-label={`Agregar ${sound.name}`}
											onClick={() => void insert(sound)}
											className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/15"
										>
											<Plus className="h-3.5 w-3.5" />
										</button>
									</div>
								))}
							</div>
						))}
					</div>
					<p className="text-[10px] leading-snug text-muted-foreground">
						¿Quiere más? Guarde MP3/WAV en "Documentos/Sonidos SKY" (Pixabay y Mixkit
						tienen efectos gratis para redes).
						{effectCount > 0 ? ` En este video: ${effectCount} efecto(s).` : ""}
					</p>
				</div>
			</PopoverContent>
		</Popover>
	);
}
