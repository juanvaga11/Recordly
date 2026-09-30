/**
 * SKY Academy "Expectativa": a pause that makes the viewer decide before the
 * answer — "¿Comprarías o venderías?" with COMPRA / VENTA and a 3-2-1
 * countdown in a gold circle. It keeps people watching to see if they were right.
 *
 * Built only from regular text annotations pinned to the frame, so it renders
 * the same in preview and export and every piece can be edited afterwards.
 */
import {
	type AnnotationRegion,
	type AnnotationTextStyle,
	DEFAULT_ANNOTATION_STYLE,
} from "../types";
import {
	isVerticalFrame,
	SKY_FONT,
	SKY_GOLD,
	SKY_GREEN,
	SKY_RED,
	skyTextScale,
} from "./skyPresets";

export interface DecisionCountdownInput {
	question: string;
	optionA: string;
	optionB: string;
	/** Countdown length in seconds (3 or 5). */
	seconds: number;
	/** Where it starts, in timeline milliseconds. */
	startMs: number;
	/** Where it sits vertically. */
	place: "top" | "middle" | "bottom";
	/** false = only the 3-2-1 circle (no question or options). */
	includeQuestion?: boolean;
}

export const DEFAULT_DECISION_COUNTDOWN: Omit<DecisionCountdownInput, "startMs"> = {
	question: "¿Comprarías o venderías?",
	optionA: "▲ COMPRA",
	optionB: "▼ VENTA",
	seconds: 3,
	place: "middle",
	includeQuestion: true,
};

/** The question appears half a second before the countdown starts. */
export const COUNTDOWN_LEAD_MS = 500;
export const SKY_COUNTDOWN_ID_PREFIX = "annotation-sky-exp";

const BASE_WIDTH = 1920;
const CHAR_WIDTH = 0.62;
/** Bold capitals and ▲▼ are wider than average text. */
const CAPS_CHAR_WIDTH = 0.78;

const BASE_STYLE: Partial<AnnotationTextStyle> = {
	fontFamily: SKY_FONT,
	fontWeight: "bold",
	fontStyle: "normal",
	textDecoration: "none",
	textAlign: "center",
	verticalAlign: "middle",
	backgroundColor: "transparent",
};

function round(value: number) {
	return Math.round(value * 10) / 10;
}

/** Width in % of the frame for a box of `px` base pixels. */
function widthPercent(px: number) {
	return round(Math.min(94, (px / BASE_WIDTH) * 100));
}

/** Height in % of the frame for a box of `px` base pixels. */
function heightPercent(px: number, frameAspect: number) {
	return round(Math.min(60, (px / BASE_WIDTH) * frameAspect * 100));
}

/** Vertical anchor (top of the block, % of frame height). */
function blockTop(place: DecisionCountdownInput["place"], vertical: boolean) {
	if (vertical) return place === "top" ? 12 : place === "bottom" ? 60 : 34;
	return place === "top" ? 6 : place === "bottom" ? 52 : 26;
}

export function buildDecisionCountdown(
	input: DecisionCountdownInput,
	frameAspect: number,
	options: { firstTrack: number; firstZIndex: number; idSeed?: string | number },
): AnnotationRegion[] {
	const vertical = isVerticalFrame(frameAspect);
	const scale = skyTextScale(frameAspect);
	const seconds = Math.max(1, Math.min(10, Math.round(input.seconds || 3)));
	const start = Math.max(0, Math.round(input.startMs));
	const withQuestion = input.includeQuestion !== false;
	const countdownStart = countdownStartMs(input);
	const end = countdownStart + seconds * 1000;
	const seed = options.idSeed ?? Date.now();
	let z = options.firstZIndex;
	const regions: AnnotationRegion[] = [];

	const make = (
		key: string,
		text: string,
		span: [number, number],
		track: number,
		box: { x: number; y: number; width: number; height: number },
		style: Partial<AnnotationTextStyle>,
	): AnnotationRegion => ({
		id: `${SKY_COUNTDOWN_ID_PREFIX}-${seed}-${key}`,
		startMs: span[0],
		endMs: span[1],
		type: "text",
		content: text,
		textContent: text,
		position: { x: box.x, y: box.y },
		size: { width: box.width, height: box.height },
		style: { ...DEFAULT_ANNOTATION_STYLE, ...BASE_STYLE, ...style },
		zIndex: z++,
		trackIndex: track,
		pinToFrame: true,
		// every piece pops in; each number of the countdown pops on its second
		skyMotion: "pop",
	});

	let top = blockTop(input.place, vertical);
	const gap = vertical ? 1.2 : 2;

	if (withQuestion) {
		// 1. question
		const questionFont = Math.round(40 * scale);
		const question = input.question.trim() || DEFAULT_DECISION_COUNTDOWN.question;
		const questionW = widthPercent(question.length * CHAR_WIDTH * questionFont + 80);
		const questionH = heightPercent(questionFont * 1.5 + 40, frameAspect);
		regions.push(
			make(
				"q",
				question,
				[start, end],
				options.firstTrack,
				{ x: round(50 - questionW / 2), y: top, width: questionW, height: questionH },
				{
					fontSize: questionFont,
					color: "#FFFFFF",
					borderRadius: 16,
					boxFill: "rgba(10, 10, 10, 0.85)",
					boxBorderColor: SKY_GOLD,
					boxBorderWidth: 3,
				},
			),
		);
		top += questionH + gap;

		// 2. options side by side (green / red)
		const optionFont = Math.round(34 * scale);
		const labels = [
			input.optionA.trim() || DEFAULT_DECISION_COUNTDOWN.optionA,
			input.optionB.trim() || DEFAULT_DECISION_COUNTDOWN.optionB,
		];
		const longest = Math.max(...labels.map((label) => label.length));
		const optionW = widthPercent(longest * CAPS_CHAR_WIDTH * optionFont + 110);
		const optionH = heightPercent(optionFont * 1.5 + 30, frameAspect);
		const pairGap = vertical ? 3 : 2;
		const pairLeft = 50 - optionW - pairGap / 2;
		labels.forEach((label, index) => {
			const color = index === 0 ? SKY_GREEN : SKY_RED;
			regions.push(
				make(
					index === 0 ? "a" : "b",
					label,
					[start, end],
					options.firstTrack + 1 + index,
					{
						x: round(pairLeft + index * (optionW + pairGap)),
						y: round(top),
						width: optionW,
						height: optionH,
					},
					{
						fontSize: optionFont,
						color: "#FFFFFF",
						borderRadius: 14,
						boxFill: color,
						boxBorderColor: "rgba(255, 255, 255, 0.85)",
						boxBorderWidth: 2,
					},
				),
			);
		});
		top += optionH + gap;
	}

	// 3. countdown numbers in a gold circle, one per second
	const circlePx = 150 * scale;
	const circleW = widthPercent(circlePx);
	const circleH = heightPercent(circlePx, frameAspect);
	for (let i = 0; i < seconds; i++) {
		const number = String(seconds - i);
		regions.push(
			make(
				`n${number}`,
				number,
				[countdownStart + i * 1000, countdownStart + (i + 1) * 1000],
				options.firstTrack + 3,
				{ x: round(50 - circleW / 2), y: round(top), width: circleW, height: circleH },
				{
					fontSize: Math.round(84 * scale),
					color: SKY_GOLD,
					borderRadius: 999,
					boxFill: "rgba(10, 10, 10, 0.9)",
					boxBorderColor: SKY_GOLD,
					boxBorderWidth: 5,
				},
			),
		);
	}

	return regions;
}

/** When the first number shows, in timeline ms. */
export function countdownStartMs(
	input: Pick<DecisionCountdownInput, "startMs" | "includeQuestion">,
) {
	const start = Math.max(0, Math.round(input.startMs));
	return input.includeQuestion === false ? start : start + COUNTDOWN_LEAD_MS;
}

/**
 * Sounds for the countdown: tic / tac on every number and a "ding" when it
 * reaches the end (the moment to reveal the answer).
 */
export function countdownSoundTimes(
	input: Pick<DecisionCountdownInput, "startMs" | "includeQuestion" | "seconds">,
): Array<{ soundId: "tic" | "tac" | "ding"; startMs: number }> {
	const seconds = Math.max(1, Math.min(10, Math.round(input.seconds || 3)));
	const first = countdownStartMs(input);
	const times: Array<{ soundId: "tic" | "tac" | "ding"; startMs: number }> = [];
	for (let i = 0; i < seconds; i++) {
		times.push({ soundId: i % 2 === 0 ? "tic" : "tac", startMs: first + i * 1000 });
	}
	times.push({ soundId: "ding", startMs: first + seconds * 1000 });
	return times;
}

/** Next free annotation track so the countdown never overlaps other layers. */
export function nextFreeAnnotationTrack(regions: AnnotationRegion[]): number {
	return regions.length > 0
		? Math.max(...regions.map((region) => region.trackIndex ?? 0)) + 1
		: 0;
}

export function nextAnnotationZIndex(regions: AnnotationRegion[]): number {
	return regions.length > 0 ? Math.max(...regions.map((region) => region.zIndex ?? 0)) + 1 : 1;
}
