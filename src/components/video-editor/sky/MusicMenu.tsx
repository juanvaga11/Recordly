import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MusicNotes, Pause, Play } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/toast";
import { getRenderableVideoUrl } from "@/lib/assetPath";
import { cn } from "@/lib/utils";
import type { AudioRegion } from "../types";
import {
	buildBackgroundMusicRegions,
	getBackgroundMusic,
	nextFreeAudioTrack,
	SKY_MUSIC_DEFAULT_VOLUME,
	setBackgroundMusicVolume,
	withBackgroundMusic,
} from "./backgroundMusic";
import { SKY_GOLD } from "./skyPresets";

interface Track {
	name: string;
	path: string;
	folder: string;
}

interface MusicMenuProps {
	audioRegions: AudioRegion[];
	setAudioRegions: Dispatch<SetStateAction<AudioRegion[]>>;
	/** Timeline length in seconds. */
	timelineDuration: number;
}

function readDurationMs(url: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const audio = new Audio();
		audio.preload = "metadata";
		audio.onloadedmetadata = () => resolve(audio.duration * 1000);
		audio.onerror = () => reject(new Error("No se pudo leer la canción"));
		audio.src = url;
	});
}

/**
 * SKY Academy background music: songs from "Documentos/Musica SKY", preview,
 * one click to cover the whole video, volume and remove.
 */
export function MusicMenu({ audioRegions, setAudioRegions, timelineDuration }: MusicMenuProps) {
	const [open, setOpen] = useState(false);
	const [tracks, setTracks] = useState<Track[]>([]);
	const [folder, setFolder] = useState("");
	const [loading, setLoading] = useState(false);
	const [playingPath, setPlayingPath] = useState<string | null>(null);
	const previewRef = useRef<HTMLAudioElement | null>(null);
	const current = getBackgroundMusic(audioRegions);
	const volume = current?.volume ?? SKY_MUSIC_DEFAULT_VOLUME;

	const stopPreview = useCallback(() => {
		previewRef.current?.pause();
		previewRef.current = null;
		setPlayingPath(null);
	}, []);

	const refresh = useCallback(async () => {
		if (!window.electronAPI?.skyMusicList) return;
		setLoading(true);
		try {
			const result = await window.electronAPI.skyMusicList();
			setFolder(result.folder);
			setTracks(result.tracks);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (open) void refresh();
		else stopPreview();
	}, [open, refresh, stopPreview]);

	useEffect(() => stopPreview, [stopPreview]);

	const togglePreview = async (track: Track) => {
		if (playingPath === track.path) {
			stopPreview();
			return;
		}
		stopPreview();
		const audio = new Audio(await getRenderableVideoUrl(track.path));
		audio.volume = 0.6;
		audio.onended = () => setPlayingPath(null);
		previewRef.current = audio;
		setPlayingPath(track.path);
		audio.play().catch(() => {
			setPlayingPath(null);
			toast.error("No se pudo reproducir esta canción");
		});
	};

	const applyTrack = async (track: Track) => {
		stopPreview();
		try {
			const durationMs = await readDurationMs(await getRenderableVideoUrl(track.path));
			const music = buildBackgroundMusicRegions({
				audioPath: track.path,
				trackDurationMs: durationMs,
				timelineDurationMs: timelineDuration * 1000,
				volume,
				trackIndex: nextFreeAudioTrack(audioRegions),
			});
			if (music.length === 0) {
				toast.error("La canción es muy corta o el video no tiene duración");
				return;
			}
			setAudioRegions((regions) => withBackgroundMusic(regions, music));
			toast.success(`Música de fondo: ${track.name}`, {
				description: "Suena en todo el video. Ajuste el volumen aquí mismo.",
			});
		} catch {
			toast.error("No se pudo leer la canción");
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-9 shrink-0 gap-1.5 px-2 text-xs font-semibold"
					title="Música de fondo"
				>
					<MusicNotes className="h-4 w-4" style={{ color: SKY_GOLD }} />
					Música
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" side="top" sideOffset={10} className="w-[340px] p-4">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<p className="text-sm font-semibold text-foreground">Música de fondo</p>
						<button
							type="button"
							onClick={() => void window.electronAPI?.skyMusicOpenFolder?.()}
							className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
						>
							Abrir carpeta
						</button>
					</div>

					<div className="max-h-56 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
						{loading ? (
							<p className="py-4 text-center text-[11px] text-muted-foreground">
								Cargando…
							</p>
						) : tracks.length === 0 ? (
							<div className="rounded-lg bg-foreground/[0.04] p-3 text-[11px] leading-snug text-muted-foreground">
								<p className="mb-1 font-semibold text-foreground">
									Aún no hay canciones
								</p>
								Guarde sus canciones (MP3 o WAV) en la carpeta
								<span className="block break-all font-mono text-[10px] text-foreground">
									{folder || "Documentos/Musica SKY"}
								</span>
								Puede hacer subcarpetas por estilo (Motivación, Chill, Épica…).
								Música gratis para redes: Biblioteca de audio de YouTube o Pixabay
								Music.
							</div>
						) : (
							tracks.map((track) => {
								const isCurrent = current?.audioPath === track.path;
								return (
									<div
										key={track.path}
										className={cn(
											"flex items-center gap-1.5 rounded-lg p-1.5",
											isCurrent
												? "bg-[#D4AF37]/15"
												: "hover:bg-foreground/[0.06]",
										)}
									>
										<button
											type="button"
											onClick={() => void togglePreview(track)}
											className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10"
											aria-label={
												playingPath === track.path ? "Pausar" : "Escuchar"
											}
										>
											{playingPath === track.path ? (
												<Pause className="h-3.5 w-3.5" weight="fill" />
											) : (
												<Play className="h-3.5 w-3.5" weight="fill" />
											)}
										</button>
										<div className="min-w-0 flex-1">
											<p className="truncate text-[12px] text-foreground">
												{track.name}
											</p>
											{track.folder ? (
												<p className="truncate text-[10px] text-muted-foreground">
													{track.folder}
												</p>
											) : null}
										</div>
										<button
											type="button"
											onClick={() => void applyTrack(track)}
											className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold"
											style={
												isCurrent
													? { color: SKY_GOLD }
													: { background: SKY_GOLD, color: "#0A0A0A" }
											}
										>
											{isCurrent ? "En uso" : "Usar"}
										</button>
									</div>
								);
							})
						)}
					</div>

					{current ? (
						<div className="space-y-2 border-t border-foreground/10 pt-3">
							<div className="flex items-center justify-between text-[11px] text-muted-foreground">
								<span className="font-semibold text-foreground">
									Volumen de la música
								</span>
								<span>{Math.round(volume * 100)}%</span>
							</div>
							<Slider
								aria-label="Volumen de la música"
								min={0}
								max={60}
								step={1}
								value={[Math.round(volume * 100)]}
								onValueChange={([value]) =>
									setAudioRegions((regions) =>
										setBackgroundMusicVolume(regions, (value ?? 15) / 100),
									)
								}
							/>
							<div className="flex items-center justify-between">
								<span className="text-[10px] text-muted-foreground">
									Recomendado 10–20% para que su voz se entienda.
								</span>
								<button
									type="button"
									onClick={() =>
										setAudioRegions((regions) =>
											withBackgroundMusic(regions, []),
										)
									}
									className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
								>
									Quitar música
								</button>
							</div>
						</div>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}
