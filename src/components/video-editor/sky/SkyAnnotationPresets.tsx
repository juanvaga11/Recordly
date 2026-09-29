import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SKY_LOGO_FULL_DATA_URL, SKY_LOGO_JV_DATA_URL } from "./skyLogos";
import {
	adaptSkyPatchToAspect,
	buildSkyLogoWatermarkPatch,
	buildSkyWatermarkPatch,
	buildTradeCardPatch,
	computeRiskReward,
	formatRiskReward,
	SKY_CLEAR_BOX_STYLE,
	SKY_GOLD,
	SKY_SMC_PRESETS,
	SKY_WATERMARK_TEXT,
	type SkyAnnotationPatch,
	type SkyLogoVariant,
	type SkyTradeCardInput,
	type SkyTradeDirection,
} from "./skyPresets";

interface SkyAnnotationPresetsProps {
	onApply: (patch: SkyAnnotationPatch) => void;
	/** Output frame width / height (9:16 → 0.5625). Used to size presets. */
	frameAspect?: number;
	/** Whether the selected annotation is pinned to the frame. */
	pinned?: boolean;
}

function SectionTitle({ children }: { children: string }) {
	return (
		<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
			{children}
		</p>
	);
}

/**
 * SKY Academy panel shown on top of the annotation settings: one-click SMC
 * zones and labels, brand watermark and the trade card.
 */
export function SkyAnnotationPresets({
	onApply,
	frameAspect = 16 / 9,
	pinned = false,
}: SkyAnnotationPresetsProps) {
	const [open, setOpen] = useState(true);
	const [watermark, setWatermark] = useState(SKY_WATERMARK_TEXT);
	const [trade, setTrade] = useState<SkyTradeCardInput>({
		symbol: "XAUUSD",
		direction: "compra",
		entry: "",
		stopLoss: "",
		takeProfit: "",
		result: "",
	});

	const zones = SKY_SMC_PRESETS.filter((preset) => preset.kind === "zone");
	const labels = SKY_SMC_PRESETS.filter((preset) => preset.kind === "label");
	const riskReward = useMemo(() => formatRiskReward(computeRiskReward(trade)), [trade]);

	const updateTrade = (patch: Partial<SkyTradeCardInput>) =>
		setTrade((current) => ({ ...current, ...patch }));

	const applyLogo = (dataUrl: string, variant: SkyLogoVariant) =>
		onApply(buildSkyLogoWatermarkPatch(dataUrl, variant, frameAspect));

	return (
		<div
			className="mb-5 rounded-xl border p-3"
			style={{ borderColor: `${SKY_GOLD}66`, background: "rgba(212, 175, 55, 0.06)" }}
		>
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				className="flex w-full items-center justify-between text-left"
				aria-expanded={open}
			>
				<span className="flex items-center gap-2 text-sm font-semibold text-foreground">
					<span
						className="inline-block h-2.5 w-2.5 rounded-full"
						style={{ background: SKY_GOLD }}
					/>
					SKY Academy
				</span>
				<span className="text-xs text-muted-foreground">
					{open ? "Ocultar" : "Mostrar"}
				</span>
			</button>

			{open ? (
				<div className="mt-3 space-y-4">
					<div>
						<SectionTitle>Zonas SMC</SectionTitle>
						<div className="grid grid-cols-3 gap-1.5">
							{zones.map((preset) => (
								<PresetChip
									key={preset.id}
									preset={preset}
									onApply={(patch) =>
										onApply(adaptSkyPatchToAspect(patch, frameAspect))
									}
								/>
							))}
						</div>
					</div>

					<div>
						<SectionTitle>Etiquetas</SectionTitle>
						<div className="grid grid-cols-4 gap-1.5">
							{labels.map((preset) => (
								<PresetChip
									key={preset.id}
									preset={preset}
									onApply={(patch) =>
										onApply(adaptSkyPatchToAspect(patch, frameAspect))
									}
								/>
							))}
						</div>
					</div>

					<div>
						<SectionTitle>Marca de agua (fija, todo el video)</SectionTitle>
						<div className="mb-2 grid grid-cols-2 gap-1.5">
							<LogoButton
								src={SKY_LOGO_JV_DATA_URL}
								label="Logo JV"
								onClick={() => applyLogo(SKY_LOGO_JV_DATA_URL, "jv")}
							/>
							<LogoButton
								src={SKY_LOGO_FULL_DATA_URL}
								label="Logo completo"
								onClick={() => applyLogo(SKY_LOGO_FULL_DATA_URL, "full")}
							/>
						</div>
						<div className="flex items-center gap-2">
							<Input
								value={watermark}
								onChange={(event) => setWatermark(event.target.value)}
								className="h-8 min-w-0 flex-1 text-xs"
								aria-label="Texto de la marca de agua"
							/>
							<Button
								type="button"
								size="sm"
								className="h-8 shrink-0 px-2 text-xs"
								onClick={() =>
									onApply(buildSkyWatermarkPatch(watermark, frameAspect))
								}
							>
								Texto
							</Button>
						</div>
					</div>

					<div>
						<SectionTitle>Tarjeta de operación</SectionTitle>
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<Input
									value={trade.symbol}
									onChange={(event) =>
										updateTrade({ symbol: event.target.value })
									}
									className="h-8 min-w-0 flex-1 text-xs"
									aria-label="Símbolo"
									placeholder="XAUUSD"
								/>
								<DirectionToggle
									value={trade.direction}
									onChange={(direction) => updateTrade({ direction })}
								/>
							</div>
							<div className="grid grid-cols-3 gap-1.5">
								<Input
									value={trade.entry}
									onChange={(event) => updateTrade({ entry: event.target.value })}
									className="h-8 min-w-0 text-xs"
									aria-label="Entrada"
									placeholder="Entrada"
									inputMode="decimal"
								/>
								<Input
									value={trade.stopLoss}
									onChange={(event) =>
										updateTrade({ stopLoss: event.target.value })
									}
									className="h-8 min-w-0 text-xs"
									aria-label="Stop Loss"
									placeholder="SL"
									inputMode="decimal"
								/>
								<Input
									value={trade.takeProfit}
									onChange={(event) =>
										updateTrade({ takeProfit: event.target.value })
									}
									className="h-8 min-w-0 text-xs"
									aria-label="Take Profit"
									placeholder="TP"
									inputMode="decimal"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Input
									value={trade.result ?? ""}
									onChange={(event) =>
										updateTrade({ result: event.target.value })
									}
									className="h-8 min-w-0 flex-1 text-xs"
									aria-label="Resultado"
									placeholder="Resultado (ej. +3R)"
								/>
								<span className="shrink-0 text-xs font-semibold text-foreground">
									R:R {riskReward}
								</span>
							</div>
							<Button
								type="button"
								size="sm"
								className="h-8 w-full text-xs"
								onClick={() => onApply(buildTradeCardPatch(trade, frameAspect))}
							>
								Crear tarjeta
							</Button>
						</div>
					</div>

					<label className="flex cursor-pointer items-start gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] p-2">
						<input
							type="checkbox"
							checked={pinned}
							onChange={(event) => onApply({ pinToFrame: event.target.checked })}
							className="mt-0.5 h-3.5 w-3.5 shrink-0"
							style={{ accentColor: SKY_GOLD }}
						/>
						<span className="text-[11px] leading-snug text-foreground">
							<span className="font-semibold">Fijar al marco</span>
							<span className="block text-muted-foreground">
								No se mueve con el zoom. Ideal para logo, marca de agua y tarjeta.
							</span>
						</span>
					</label>

					<button
						type="button"
						onClick={() => onApply({ style: { ...SKY_CLEAR_BOX_STYLE } })}
						className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
					>
						Quitar estilo SKY de esta anotación
					</button>
				</div>
			) : null}
		</div>
	);
}

function LogoButton({ src, label, onClick }: { src: string; label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={`${label} como marca de agua fija en todo el video`}
			className="flex h-14 min-w-0 items-center gap-2 rounded-lg border border-foreground/10 bg-[#0A0A0A] px-2 text-left text-[11px] font-semibold text-[#F5E6B3] transition-colors hover:border-[#D4AF37]"
		>
			<img src={src} alt="" className="h-10 w-10 shrink-0 object-contain" draggable={false} />
			<span className="truncate">{label}</span>
		</button>
	);
}

function PresetChip({
	preset,
	onApply,
}: {
	preset: (typeof SKY_SMC_PRESETS)[number];
	onApply: (patch: SkyAnnotationPatch) => void;
}) {
	return (
		<button
			type="button"
			title={preset.description}
			aria-label={preset.description}
			onClick={() => onApply(preset.patch)}
			className="flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.1]"
		>
			<span
				className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
				style={{ background: preset.swatch }}
			/>
			<span className="truncate">{preset.label}</span>
		</button>
	);
}

function DirectionToggle({
	value,
	onChange,
}: {
	value: SkyTradeDirection;
	onChange: (value: SkyTradeDirection) => void;
}) {
	const options: Array<{ value: SkyTradeDirection; label: string; color: string }> = [
		{ value: "compra", label: "Compra", color: "#10B981" },
		{ value: "venta", label: "Venta", color: "#EF4444" },
	];
	return (
		<div className="flex shrink-0 overflow-hidden rounded-lg border border-foreground/10">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={cn(
						"h-8 px-2 text-[11px] font-semibold transition-colors",
						value === option.value ? "text-white" : "text-muted-foreground",
					)}
					style={value === option.value ? { background: option.color } : undefined}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
