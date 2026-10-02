import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CaretDown, MagnifyingGlassPlus } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ZoomDepth, ZoomRegion } from "../types";
import { SKY_GOLD } from "./skyPresets";
import {
	buildFollowMouseZoom,
	getPreferredZoomDepth,
	hasFollowMouseZoom,
	isFollowMouseZoom,
	SKY_ZOOM_LEVELS,
	setAllZoomDepth,
	setPreferredZoomDepth,
	zoomScaleLabel,
} from "./skyZoom";

interface ZoomMenuProps {
	zoomRegions: ZoomRegion[];
	setZoomRegions: Dispatch<SetStateAction<ZoomRegion[]>>;
	/** Timeline length in seconds. */
	timelineDuration: number;
	/** Recordly's automatic zooms on clicks and mouse stops. */
	onSuggestZooms: () => void;
	/** Starts drawing a rectangle on the preview to choose where to zoom. */
	onPickArea: () => void;
}

/**
 * SKY Academy zoom: pick how close the camera gets and, with one click, keep
 * the chart zoomed the whole video following the mouse.
 */
export function ZoomMenu({
	zoomRegions,
	setZoomRegions,
	timelineDuration,
	onSuggestZooms,
	onPickArea,
}: ZoomMenuProps) {
	const [open, setOpen] = useState(false);
	const [depth, setDepth] = useState<ZoomDepth>(() => getPreferredZoomDepth());
	const following = hasFollowMouseZoom(zoomRegions);

	const chooseLevel = (next: ZoomDepth) => {
		setDepth(next);
		setPreferredZoomDepth(next);
		if (zoomRegions.length > 0) {
			setZoomRegions((current) => setAllZoomDepth(current, next));
			toast.success(`Zoom ${zoomScaleLabel(next)} en todo el video`, {
				description: `Se cambiaron ${zoomRegions.length} zoom(s). Los nuevos zooms también usarán este nivel.`,
			});
		}
	};

	const followMouse = () => {
		const regions = buildFollowMouseZoom(timelineDuration * 1000, depth);
		if (regions.length === 0) return;
		setZoomRegions(regions);
		toast.success("Zoom siguiendo el mouse", {
			description:
				"El gráfico queda acercado todo el video y se mueve hacia donde lleve el mouse. Ctrl+Z para deshacer.",
		});
	};

	const stopFollowing = () =>
		setZoomRegions((current) => current.filter((region) => !isFollowMouseZoom(region)));

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-9 shrink-0 gap-1.5 px-2 text-xs font-semibold"
					title="Zoom SKY: qué tan cerca se ve el gráfico y zoom que sigue el mouse"
				>
					<MagnifyingGlassPlus className="h-4 w-4" style={{ color: SKY_GOLD }} />
					Zoom {zoomScaleLabel(depth)}
					<CaretDown className="h-3 w-3" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" side="top" sideOffset={10} className="w-[320px] p-4">
				<div className="space-y-4">
					<div>
						<Button
							type="button"
							onClick={() => {
								setOpen(false);
								onPickArea();
							}}
							className="h-10 w-full text-xs font-semibold"
							style={{ background: SKY_GOLD, color: "#0A0A0A" }}
						>
							🎯 Marcar zona de zoom
						</Button>
						<p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
							Ponga la línea roja donde quiere el zoom y dibuje un recuadro sobre la
							parte del gráfico. El zoom va justo ahí (3 s, o el zoom que tenga
							seleccionado).
						</p>
					</div>
					<div>
						<p className="mb-2 text-sm font-semibold text-foreground">
							¿Qué tan cerca?
						</p>
						<div className="grid grid-cols-2 gap-1.5">
							{SKY_ZOOM_LEVELS.map((level) => (
								<button
									key={level.depth}
									type="button"
									title={level.hint}
									aria-pressed={depth === level.depth}
									onClick={() => chooseLevel(level.depth)}
									className={cn(
										"flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors",
										depth === level.depth
											? "border-[#D4AF37] bg-[#D4AF37]/15"
											: "border-foreground/10 bg-foreground/[0.04] hover:border-[#D4AF37]/60",
									)}
								>
									<span className="text-[12px] font-semibold text-foreground">
										{level.label} · {zoomScaleLabel(level.depth)}
									</span>
									<span className="text-[10px] leading-tight text-muted-foreground">
										{level.hint}
									</span>
								</button>
							))}
						</div>
						<p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
							Se aplica a todos los zooms del video y a los que agregue después.
						</p>
					</div>

					<div className="space-y-2">
						<Button
							type="button"
							variant="outline"
							onClick={followMouse}
							className="h-9 w-full border-[#D4AF37]/60 text-xs font-semibold"
						>
							{following
								? "Volver a aplicar: seguir el mouse"
								: "Seguir el mouse todo el video"}
						</Button>
						{following ? (
							<Button
								type="button"
								variant="outline"
								onClick={stopFollowing}
								className="h-8 w-full text-xs"
							>
								Quitar el zoom continuo
							</Button>
						) : null}
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								onSuggestZooms();
								setOpen(false);
							}}
							className="h-8 w-full text-xs"
						>
							Solo en clics y pausas del mouse (automático)
						</Button>
					</div>

					<p className="text-[10px] leading-snug text-muted-foreground">
						Tip: al grabar, mueva el mouse despacio y déjelo quieto 1-2 s sobre la zona
						que explica; el zoom lo sigue suave. Para ver un zoom en un punto fijo,
						selecciónelo en la línea de tiempo y elija "Manual".
					</p>
				</div>
			</PopoverContent>
		</Popover>
	);
}
