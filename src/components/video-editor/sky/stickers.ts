/**
 * SKY Academy stickers: chart tools (zig-zag scenarios, arrows, TP/SL lines,
 * ✓ ✗ ?) and social calls to action (Sígueme, campanita, me gusta…).
 *
 * They are ordinary image annotations, so they render the same in preview and
 * export and can be moved, resized or deleted like any other layer.
 */
import type { AnnotationRegion, SkyMotion } from "../types";
import { DEFAULT_ANNOTATION_STYLE } from "../types";
import { isVerticalFrame } from "./skyPresets";
import { SKY_STICKER_IMAGES } from "./skyStickers.data";

export type StickerGroup = "grafico" | "redes";

export interface StickerDefinition {
	id: string;
	label: string;
	group: StickerGroup;
	/** Width as % of the chart (chart tools) or of the frame (social). */
	width: { vertical: number; horizontal: number };
	motion: SkyMotion;
	durationMs: number;
	/** Suggested sound id from the SKY sound library. */
	sound?: string;
}

const chart = (
	id: string,
	label: string,
	width: number,
	motion: SkyMotion = "pop",
	sound = "pop",
): StickerDefinition => ({
	id,
	label,
	group: "grafico",
	width: { vertical: width, horizontal: width },
	motion,
	durationMs: 3000,
	sound,
});

const social = (
	id: string,
	label: string,
	vertical: number,
	horizontal: number,
	motion: SkyMotion,
	sound: string,
): StickerDefinition => ({
	id,
	label,
	group: "redes",
	width: { vertical, horizontal },
	motion,
	durationMs: 3000,
	sound,
});

export const SKY_STICKERS: StickerDefinition[] = [
	chart("escenarios", "Escenarios", 34, "pop", "whoosh"),
	chart("zigzag-alcista", "Zig-zag alcista", 30, "pop", "whoosh"),
	chart("zigzag-bajista", "Zig-zag bajista", 30, "pop", "whoosh"),
	chart("flecha-arriba", "Flecha arriba", 9),
	chart("flecha-abajo", "Flecha abajo", 9),
	chart("flecha-curva", "Flecha curva", 26),
	chart("circulo", "Círculo", 30),
	chart("linea-entrada", "Línea entrada", 90, "slide", "whoosh"),
	chart("linea-tp", "Línea TP", 90, "slide", "whoosh"),
	chart("linea-sl", "Línea SL", 90, "slide", "whoosh"),
	chart("check", "Correcto", 11, "pop", "exito"),
	chart("equis", "Incorrecto", 11, "pop", "error"),
	chart("pregunta", "Pregunta", 11, "pulse", "pop"),
	chart("cursor-clic", "Cursor clic", 9, "click", "click"),
	social("boton-sigueme", "Sígueme", 55, 26, "pulse", "pop"),
	social("boton-siguiendo", "Siguiendo", 55, 26, "pop", "click"),
	social("campana", "Campanita", 16, 8, "shake", "campanita"),
	social("like", "Me gusta", 16, 8, "pop", "pop"),
	social("corazon", "Corazón", 16, 8, "pulse", "pop"),
	social("comentar", "Comenta", 16, 8, "pop", "pop"),
	social("compartir", "Comparte", 16, 8, "pop", "pop"),
	social("guardar", "Guarda", 16, 8, "pop", "pop"),
].filter((sticker) => sticker.id in SKY_STICKER_IMAGES);

export const SKY_STICKER_ID_PREFIX = "annotation-sky-stk";

export function stickerImage(id: string) {
	return SKY_STICKER_IMAGES[id];
}

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Box for a sticker whose width is `widthPercent` of a rect with aspect
 * `rectAspect` (width / height), keeping the image proportions.
 */
export function stickerBox(
	id: string,
	widthPercent: number,
	rectAspect: number,
	center: { x: number; y: number },
): Box {
	const image = SKY_STICKER_IMAGES[id];
	const ratio = image ? image.height / image.width : 1;
	const safeAspect = Number.isFinite(rectAspect) && rectAspect > 0 ? rectAspect : 16 / 9;
	const width = Math.min(98, widthPercent);
	const height = Math.min(98, width * ratio * safeAspect);
	const round = (value: number) => Math.round(value * 10) / 10;
	return {
		x: round(Math.min(100 - width, Math.max(0, center.x - width / 2))),
		y: round(Math.min(100 - height, Math.max(0, center.y - height / 2))),
		width: round(width),
		height: round(height),
	};
}

export function buildStickerRegion(
	sticker: StickerDefinition,
	options: {
		startMs: number;
		durationMs?: number;
		/** Frame aspect (width / height) for social stickers. */
		frameAspect: number;
		/** Recording rect aspect for chart tools (they follow the chart). */
		chartAspect: number;
		center?: { x: number; y: number };
		widthPercent?: number;
		track: number;
		zIndex: number;
		idSeed?: string | number;
		motion?: SkyMotion;
	},
): AnnotationRegion {
	const pinned = sticker.group === "redes";
	const vertical = isVerticalFrame(options.frameAspect);
	const widthPercent =
		options.widthPercent ?? (vertical ? sticker.width.vertical : sticker.width.horizontal);
	const center = options.center ?? { x: 50, y: pinned ? (vertical ? 76 : 80) : 50 };
	const box = stickerBox(
		sticker.id,
		widthPercent,
		pinned ? options.frameAspect : options.chartAspect,
		center,
	);
	const image = SKY_STICKER_IMAGES[sticker.id];
	const startMs = Math.max(0, Math.round(options.startMs));
	return {
		id: `${SKY_STICKER_ID_PREFIX}-${options.idSeed ?? Date.now()}-${sticker.id}`,
		startMs,
		endMs: startMs + Math.round(options.durationMs ?? sticker.durationMs),
		type: "image",
		content: image?.src ?? "",
		imageContent: image?.src ?? "",
		position: { x: box.x, y: box.y },
		size: { width: box.width, height: box.height },
		style: { ...DEFAULT_ANNOTATION_STYLE },
		zIndex: options.zIndex,
		trackIndex: options.track,
		pinToFrame: pinned ? true : undefined,
		skyMotion: options.motion ?? sticker.motion,
	};
}

export type CallToActionId = "seguir" | "interaccion" | "corazon";

export const CALLS_TO_ACTION: Array<{ id: CallToActionId; label: string; description: string }> = [
	{
		id: "seguir",
		label: "Sígueme + campanita",
		description: "Botón Sígueme, clic, cambia a Siguiendo y suena la campanita",
	},
	{
		id: "interaccion",
		label: "Like · Comenta · Comparte · Guarda",
		description: "Los 4 íconos aparecen uno tras otro",
	},
	{ id: "corazon", label: "Corazón", description: "Corazón que late" },
];

export interface TimedSound {
	soundId: string;
	startMs: number;
}

/**
 * Builds an animated call to action from stickers plus the sounds that go with
 * it. `baseY` is the vertical center (% of the frame).
 */
export function buildCallToAction(
	id: CallToActionId,
	options: {
		startMs: number;
		frameAspect: number;
		baseY: number;
		firstTrack: number;
		firstZIndex: number;
		idSeed?: string | number;
	},
): { regions: AnnotationRegion[]; sounds: TimedSound[] } {
	const find = (stickerId: string) => {
		const sticker = SKY_STICKERS.find((item) => item.id === stickerId);
		if (!sticker) throw new Error(`Missing sticker ${stickerId}`);
		return sticker;
	};
	const vertical = isVerticalFrame(options.frameAspect);
	const t0 = Math.max(0, Math.round(options.startMs));
	const seed = options.idSeed ?? Date.now();
	let z = options.firstZIndex;
	const common = {
		frameAspect: options.frameAspect,
		chartAspect: options.frameAspect,
	};

	if (id === "seguir") {
		const buttonWidth = vertical ? 55 : 26;
		const bellWidth = vertical ? 15 : 7.5;
		const buttonX = 50 - bellWidth / 2 - 1;
		const bellX = buttonX + buttonWidth / 2 + bellWidth / 2 + 2;
		const cursorWidth = vertical ? 11 : 5;
		const regions = [
			buildStickerRegion(find("boton-sigueme"), {
				...common,
				startMs: t0,
				durationMs: 1600,
				center: { x: buttonX, y: options.baseY },
				track: options.firstTrack,
				zIndex: z++,
				idSeed: `${seed}-1`,
			}),
			buildStickerRegion(find("boton-siguiendo"), {
				...common,
				startMs: t0 + 1600,
				durationMs: 2400,
				center: { x: buttonX, y: options.baseY },
				track: options.firstTrack,
				zIndex: z++,
				idSeed: `${seed}-2`,
			}),
			buildStickerRegion(
				{ ...find("cursor-clic"), group: "redes" },
				{
					...common,
					startMs: t0 + 700,
					durationMs: 1000,
					center: {
						x: buttonX + buttonWidth * 0.3,
						y: options.baseY + (vertical ? 3 : 6),
					},
					widthPercent: cursorWidth,
					track: options.firstTrack + 1,
					zIndex: z++,
					idSeed: `${seed}-3`,
				},
			),
			buildStickerRegion(find("campana"), {
				...common,
				startMs: t0 + 1800,
				durationMs: 2200,
				center: { x: bellX, y: options.baseY },
				track: options.firstTrack + 2,
				zIndex: z++,
				idSeed: `${seed}-4`,
			}),
		];
		return {
			regions,
			sounds: [
				{ soundId: "pop", startMs: t0 },
				// the cursor presses when its entrance ends (0.7 s + 0.38 s)
				{ soundId: "click", startMs: t0 + 1080 },
				{ soundId: "campanita", startMs: t0 + 1800 },
			],
		};
	}

	if (id === "interaccion") {
		const ids = ["like", "comentar", "compartir", "guardar"];
		const width = vertical ? 16 : 8;
		const gap = vertical ? 5 : 2.5;
		const total = ids.length * width + (ids.length - 1) * gap;
		const left = 50 - total / 2 + width / 2;
		const regions = ids.map((stickerId, index) =>
			buildStickerRegion(find(stickerId), {
				...common,
				startMs: t0 + index * 300,
				durationMs: 4000 - index * 300,
				center: { x: left + index * (width + gap), y: options.baseY },
				widthPercent: width,
				track: options.firstTrack + index,
				zIndex: z++,
				idSeed: `${seed}-${index}`,
			}),
		);
		return {
			regions,
			sounds: ids.map((_, index) => ({ soundId: "pop", startMs: t0 + index * 300 })),
		};
	}

	return {
		regions: [
			buildStickerRegion(find("corazon"), {
				...common,
				startMs: t0,
				durationMs: 2500,
				center: { x: 50, y: options.baseY },
				widthPercent: vertical ? 22 : 11,
				track: options.firstTrack,
				zIndex: z++,
				idSeed: seed,
			}),
		],
		sounds: [{ soundId: "pop", startMs: t0 }],
	};
}
