import { useEffect, useRef, useState } from "react";
import { type NormalizedRect, screenRectToRecordingRect } from "./zoomArea";

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface ZoomAreaPickerProps {
	/** Zoom currently applied to the preview (stage pixels). */
	getTransform: () => { scale: number; x: number; y: number };
	/** Unzoomed recording rectangle (stage pixels). */
	getBaseMask: () => Rect;
	onPicked: (area: NormalizedRect) => void;
	onCancel: () => void;
}

/** A click without dragging picks this much of the recording around the point. */
const CLICK_AREA = 0.3;

/**
 * SKY: full-preview layer to draw the zoom rectangle. Esc or right click cancels.
 */
export function ZoomAreaPicker({
	getTransform,
	getBaseMask,
	onPicked,
	onCancel,
}: ZoomAreaPickerProps) {
	const layerRef = useRef<HTMLDivElement | null>(null);
	const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
	const [rect, setRect] = useState<Rect | null>(null);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onCancel]);

	const local = (event: React.PointerEvent) => {
		const box = layerRef.current?.getBoundingClientRect();
		return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
	};

	const finish = (screen: Rect) => {
		const mask = getBaseMask();
		const transform = getTransform();
		let area = screenRectToRecordingRect(screen, transform, mask);
		if (Math.abs(screen.width) < 12 || Math.abs(screen.height) < 12) {
			const center = screenRectToRecordingRect(
				{ x: screen.x, y: screen.y, width: 0, height: 0 },
				transform,
				mask,
			);
			area = {
				x: Math.min(1 - CLICK_AREA, Math.max(0, center.x - CLICK_AREA / 2)),
				y: Math.min(1 - CLICK_AREA, Math.max(0, center.y - CLICK_AREA / 2)),
				width: CLICK_AREA,
				height: CLICK_AREA,
			};
		}
		if (area.width <= 0 || area.height <= 0) {
			onCancel();
			return;
		}
		onPicked(area);
	};

	const normalized = rect
		? {
				left: Math.min(rect.x, rect.x + rect.width),
				top: Math.min(rect.y, rect.y + rect.height),
				width: Math.abs(rect.width),
				height: Math.abs(rect.height),
			}
		: null;

	return (
		<div
			ref={layerRef}
			className="absolute inset-0 z-50 cursor-crosshair"
			style={{ pointerEvents: "auto", touchAction: "none", background: "rgba(0,0,0,0.25)" }}
			onContextMenu={(event) => {
				event.preventDefault();
				onCancel();
			}}
			onPointerDown={(event) => {
				event.stopPropagation();
				if (event.button !== 0) return;
				const point = local(event);
				startRef.current = { ...point, pointerId: event.pointerId };
				event.currentTarget.setPointerCapture(event.pointerId);
				setRect({ x: point.x, y: point.y, width: 0, height: 0 });
			}}
			onPointerMove={(event) => {
				event.stopPropagation();
				const start = startRef.current;
				if (!start || start.pointerId !== event.pointerId) return;
				const point = local(event);
				setRect({
					x: start.x,
					y: start.y,
					width: point.x - start.x,
					height: point.y - start.y,
				});
			}}
			onPointerUp={(event) => {
				event.stopPropagation();
				const start = startRef.current;
				if (!start || start.pointerId !== event.pointerId) return;
				startRef.current = null;
				const point = local(event);
				setRect(null);
				finish({
					x: start.x,
					y: start.y,
					width: point.x - start.x,
					height: point.y - start.y,
				});
			}}
		>
			<div
				className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold shadow"
				style={{
					background: "rgba(212,175,55,0.95)",
					color: "#0A0A0A",
					whiteSpace: "nowrap",
				}}
			>
				Dibuje un recuadro sobre la zona · Esc para cancelar
			</div>
			{normalized ? (
				<div
					className="pointer-events-none absolute rounded-md"
					style={{
						...normalized,
						border: "2px dashed #D4AF37",
						background: "rgba(212,175,55,0.12)",
						boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
					}}
				/>
			) : null}
		</div>
	);
}
