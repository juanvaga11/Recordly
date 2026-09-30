import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CaretDown, TimerIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { AnnotationRegion, AudioRegion } from "../types";
import {
	buildDecisionCountdown,
	countdownSoundTimes,
	DEFAULT_DECISION_COUNTDOWN,
	type DecisionCountdownInput,
	nextAnnotationZIndex,
	nextFreeAnnotationTrack,
	SKY_COUNTDOWN_ID_PREFIX,
} from "./decisionCountdown";
import { SKY_GOLD } from "./skyPresets";
import { findSkySound, placeSoundEffects, type SfxPlacement } from "./soundEffects";

interface ExpectationMenuProps {
	annotationRegions: AnnotationRegion[];
	setAnnotationRegions: Dispatch<SetStateAction<AnnotationRegion[]>>;
	setAudioRegions: Dispatch<SetStateAction<AudioRegion[]>>;
	/** Playhead in seconds (timeline time). */
	playheadSeconds: number;
	/** Output frame width / height. */
	frameAspect: number;
}

const PLACES: Array<[DecisionCountdownInput["place"], string]> = [
	["top", "Arriba"],
	["middle", "Centro"],
	["bottom", "Abajo"],
];

const QUICK_QUESTIONS = [
	"¿Comprarías o venderías?",
	"¿Toca el TP o el SL?",
	"¿Entrarías aquí?",
	"¿Rompe o rebota?",
];

const inputClass =
	"h-8 w-full rounded-md border border-foreground/15 bg-foreground/[0.04] px-2 text-xs text-foreground outline-none focus:border-[#D4AF37]";

/**
 * SKY "Expectativa": inserts a decision pause at the playhead — question,
 * COMPRA / VENTA and a 3-2-1 countdown — so viewers commit to an answer and
 * stay to see the result.
 */
export function ExpectationMenu({
	annotationRegions,
	setAnnotationRegions,
	setAudioRegions,
	playheadSeconds,
	frameAspect,
}: ExpectationMenuProps) {
	const [includeQuestion, setIncludeQuestion] = useState(true);
	const [withSound, setWithSound] = useState(true);
	const [open, setOpen] = useState(false);
	const [question, setQuestion] = useState(DEFAULT_DECISION_COUNTDOWN.question);
	const [optionA, setOptionA] = useState(DEFAULT_DECISION_COUNTDOWN.optionA);
	const [optionB, setOptionB] = useState(DEFAULT_DECISION_COUNTDOWN.optionB);
	const [seconds, setSeconds] = useState(DEFAULT_DECISION_COUNTDOWN.seconds);
	const [place, setPlace] = useState<DecisionCountdownInput["place"]>("middle");
	const count = new Set(
		annotationRegions
			.filter((region) => region.id.startsWith(SKY_COUNTDOWN_ID_PREFIX))
			.map((region) => region.id.split("-").slice(0, 4).join("-")),
	).size;

	const insert = async () => {
		const input: DecisionCountdownInput = {
			question,
			optionA,
			optionB,
			seconds,
			place,
			includeQuestion,
			startMs: playheadSeconds * 1000,
		};
		const regions = buildDecisionCountdown(input, frameAspect, {
			firstTrack: nextFreeAnnotationTrack(annotationRegions),
			firstZIndex: nextAnnotationZIndex(annotationRegions),
		});
		setAnnotationRegions((current) => [...current, ...regions]);
		let soundAdded = false;
		if (withSound) {
			const placements: SfxPlacement[] = [];
			for (const { soundId, startMs } of countdownSoundTimes(input)) {
				const sound = await findSkySound(soundId);
				if (sound)
					placements.push({ path: sound.path, startMs, durationMs: sound.durationMs });
			}
			if (placements.length > 0) {
				setAudioRegions((current) => placeSoundEffects(current, placements));
				soundAdded = true;
			}
		}
		setOpen(false);
		toast.success(includeQuestion ? "Expectativa agregada" : "Cuenta regresiva agregada", {
			description: `${seconds} s desde aquí${soundAdded ? " con tic-tac y ding al final" : ""}. Cada parte se puede editar o mover. Ctrl+Z para deshacer.`,
		});
	};

	const removeAll = () =>
		setAnnotationRegions((current) =>
			current.filter((region) => !region.id.startsWith(SKY_COUNTDOWN_ID_PREFIX)),
		);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-9 shrink-0 gap-1.5 px-2 text-xs font-semibold"
					title="Expectativa: pregunta + cuenta regresiva para que la gente piense antes de la respuesta"
				>
					<TimerIcon className="h-4 w-4" style={{ color: SKY_GOLD }} />
					Expectativa
					<CaretDown className="h-3 w-3" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="center" side="top" sideOffset={10} className="w-[330px] p-4">
				<div className="space-y-3">
					<div>
						<p className="text-sm font-semibold text-foreground">
							Momento de expectativa
						</p>
						<p className="text-[10px] leading-snug text-muted-foreground">
							Ponga la línea roja justo antes de mostrar qué hizo el precio y
							agréguelo. La gente decide, espera la cuenta y se queda a ver si acertó.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-1.5">
						{(
							[
								[includeQuestion, setIncludeQuestion, "Con pregunta"],
								[withSound, setWithSound, "Con tic-tac"],
							] as const
						).map(([value, setValue, label]) => (
							<button
								key={label}
								type="button"
								aria-pressed={value}
								onClick={() => setValue(!value)}
								className={cn(
									"h-8 rounded-lg border text-[11px] font-semibold",
									value
										? "border-[#D4AF37] bg-[#D4AF37]/15 text-foreground"
										: "border-foreground/10 text-muted-foreground line-through",
								)}
							>
								{label}
							</button>
						))}
					</div>

					{includeQuestion ? (
						<>
							<div className="space-y-1.5">
								<label className="text-[11px] font-semibold text-foreground">
									Pregunta
									<input
										className={cn(inputClass, "mt-1")}
										value={question}
										maxLength={40}
										onChange={(event) => setQuestion(event.target.value)}
									/>
								</label>
								<div className="flex flex-wrap gap-1">
									{QUICK_QUESTIONS.map((item) => (
										<button
											key={item}
											type="button"
											onClick={() => setQuestion(item)}
											className="rounded-full border border-foreground/10 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-[#D4AF37] hover:text-foreground"
										>
											{item}
										</button>
									))}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<label className="text-[11px] font-semibold text-emerald-400">
									Opción verde
									<input
										className={cn(inputClass, "mt-1")}
										value={optionA}
										maxLength={14}
										onChange={(event) => setOptionA(event.target.value)}
									/>
								</label>
								<label className="text-[11px] font-semibold text-red-400">
									Opción roja
									<input
										className={cn(inputClass, "mt-1")}
										value={optionB}
										maxLength={14}
										onChange={(event) => setOptionB(event.target.value)}
									/>
								</label>
							</div>
						</>
					) : (
						<p className="text-[10px] leading-snug text-muted-foreground">
							Solo el círculo 3-2-1: arrástrelo encima del gráfico donde quiera.
						</p>
					)}

					<div className="grid grid-cols-2 gap-3">
						<div>
							<p className="mb-1 text-[11px] font-semibold text-foreground">
								Segundos
							</p>
							<div className="grid grid-cols-2 gap-1">
								{[3, 5].map((value) => (
									<button
										key={value}
										type="button"
										aria-pressed={seconds === value}
										onClick={() => setSeconds(value)}
										className={cn(
											"h-8 rounded-lg border text-xs font-semibold",
											seconds === value
												? "border-[#D4AF37] bg-[#D4AF37]/15 text-foreground"
												: "border-foreground/10 text-muted-foreground",
										)}
									>
										{value}
									</button>
								))}
							</div>
						</div>
						<div>
							<p className="mb-1 text-[11px] font-semibold text-foreground">Lugar</p>
							<div className="grid grid-cols-3 gap-1">
								{PLACES.map(([value, label]) => (
									<button
										key={value}
										type="button"
										aria-pressed={place === value}
										onClick={() => setPlace(value)}
										className={cn(
											"h-8 rounded-lg border text-[10px] font-semibold",
											place === value
												? "border-[#D4AF37] bg-[#D4AF37]/15 text-foreground"
												: "border-foreground/10 text-muted-foreground",
										)}
									>
										{label}
									</button>
								))}
							</div>
						</div>
					</div>

					<Button
						type="button"
						onClick={() => void insert()}
						className="h-9 w-full text-xs font-semibold"
						style={{ background: SKY_GOLD, color: "#0A0A0A" }}
					>
						Agregar aquí ({Math.floor(playheadSeconds / 60)}:
						{String(Math.floor(playheadSeconds % 60)).padStart(2, "0")})
					</Button>
					{count > 0 ? (
						<Button
							type="button"
							variant="outline"
							onClick={removeAll}
							className="h-8 w-full text-xs"
						>
							Quitar expectativas ({count})
						</Button>
					) : null}
					<p className="text-[10px] leading-snug text-muted-foreground">
						Tip: dígalo en voz alta ("tienes 3 segundos… 3, 2, 1") y aplique "Silencios"
						antes de agregar la expectativa, para que no se recorte la pausa.
					</p>
				</div>
			</PopoverContent>
		</Popover>
	);
}
