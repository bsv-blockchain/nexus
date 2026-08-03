"use client";

import { paletteContrast } from "@/lib/theme";
import { useEffect, useRef, useState, type ReactNode } from "react";

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  s /= 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number =>
    l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1));
  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function hexToHsl(hex: string): { h: number; l: number } {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = (parseInt(full.slice(0, 2), 16) || 0) / 255;
  const g = (parseInt(full.slice(2, 4), 16) || 0) / 255;
  const b = (parseInt(full.slice(4, 6), 16) || 0) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, l: l * 100 };
}

/**
 * Lightness the wheel paints at a given radius, and the inverse.
 *
 * One mapping, used by the paint, the selection and the legibility map. They
 * disagreed before — the canvas ramped lightness from `minLight` to `maxLight`
 * while selection read `maxLight * (r / RADIUS)` — so the colour under the
 * pointer was not the colour you got, and a scrim drawn from one could never
 * line up with the other.
 */
function lightAt(
  radius: number,
  RADIUS: number,
  minLight: number,
  maxLight: number,
): number {
  return minLight + (maxLight - minLight) * (RADIUS ? radius / RADIUS : 0);
}

function radiusAt(
  light: number,
  RADIUS: number,
  minLight: number,
  maxLight: number,
): number {
  const span = maxLight - minLight;
  const t = span ? (light - minLight) / span : 0;
  return Math.max(0, Math.min(RADIUS, t * RADIUS));
}

/** Reverse a colour to a wheel position (hue → angle, lightness → radius). */
function wheelFromColor(
  hex: string,
  minLight: number,
  maxLight: number,
  radius: number,
): { angle: number; radius: number } {
  const { h, l } = hexToHsl(hex);
  return {
    angle: (h * Math.PI) / 180,
    radius: radiusAt(l, radius, minLight, maxLight),
  };
}

/* ------------------------------------------------------- legibility map */

/** Hue step, in degrees, of the sampled legibility grid. */
const HUE_STEP = 5;
/** Lightness step, in percent. */
const LIGHT_STEP = 2;

/**
 * Which parts of the wheel produce a theme that can render its own text.
 *
 * Roughly a third of a fully-saturated wheel cannot: a mid-lightness stop sits
 * close enough to the light/dark boundary that its tinted panels and the raw
 * gradient behind the transparent rail pull text in opposite directions, and no
 * single ink satisfies both. Those colours look appealing in the wheel and
 * produce a theme you cannot read, so the pointer is kept out of them.
 *
 * Sampled on a coarse grid and cached per picker configuration. A full
 * per-pixel map would mean tens of thousands of palette derivations on open;
 * this is a few thousand, computed once, and the bands are wide enough that the
 * grid resolution is not visible.
 */
const legibilityCache = new Map<string, boolean[][]>();

function legibilityMap(
  minLight: number,
  maxLight: number,
  stopsFor: (hue: number, light: number) => string[],
  key: string,
): boolean[][] {
  const cached = legibilityCache.get(key);
  if (cached) return cached;

  const map: boolean[][] = [];
  for (let li = 0; li * LIGHT_STEP + minLight <= maxLight; li += 1) {
    const light = minLight + li * LIGHT_STEP;
    const row: boolean[] = [];
    for (let h = 0; h < 360; h += HUE_STEP) {
      row.push(paletteContrast(stopsFor(h, light)).legible);
    }
    map.push(row);
  }
  legibilityCache.set(key, map);
  return map;
}

function isLegible(
  map: boolean[][],
  minLight: number,
  hue: number,
  light: number,
): boolean {
  const li = Math.round((light - minLight) / LIGHT_STEP);
  const row = map[Math.max(0, Math.min(map.length - 1, li))];
  if (!row) return true;
  const hi = Math.round((((hue % 360) + 360) % 360) / HUE_STEP) % row.length;
  return row[hi] ?? true;
}

interface ColorPickerProps {
  size?: number;
  padding?: number;
  bulletRadius?: number;
  spreadFactor?: number;
  minSpread?: number;
  maxSpread?: number;
  minLight?: number;
  maxLight?: number;
  numPoints?: number;
  /** initial main colour to position the wheel (e.g. when a preset is applied) */
  initialColor?: string | undefined;
  onColorChange?: (colors: string[]) => void;
  onInteract?: () => void;
}

/**
 * Radial HSL colour picker. Drag the main bullet to pick; with 2–3 points it
 * derives symmetric gradient stops around the main hue. Adapted for Nexus.
 */
export function ColorPicker({
  size = 240,
  padding = 20,
  bulletRadius = 20,
  spreadFactor = 0.4,
  minSpread = Math.PI / 1.5,
  maxSpread = Math.PI / 3,
  minLight = 15,
  maxLight = 90,
  numPoints = 1,
  initialColor,
  onColorChange,
  onInteract,
}: ColorPickerProps): ReactNode {
  const RADIUS = size / 2 - padding;

  const [angle, setAngle] = useState(() =>
    initialColor
      ? wheelFromColor(initialColor, minLight, maxLight, RADIUS).angle
      : -Math.PI / 2,
  );
  const [radius, setRadius] = useState(() =>
    initialColor
      ? wheelFromColor(initialColor, minLight, maxLight, RADIUS).radius
      : RADIUS * 0.7,
  );
  const [drag, setDrag] = useState(false);

  const ref = useRef<HTMLCanvasElement>(null);

  const hue = (angle * 180) / Math.PI;
  const light = lightAt(radius, RADIUS, minLight, maxLight);
  const color = hslToHex(hue, 100, light);

  const normalizedRadius = radius / RADIUS;
  const spread =
    (minSpread + (maxSpread - minSpread) * Math.pow(normalizedRadius, 3)) *
    spreadFactor;

  const bx1 = size / 2 + Math.cos(angle - spread) * radius;
  const by1 = size / 2 + Math.sin(angle - spread) * radius;
  const bx2 = size / 2 + Math.cos(angle + spread) * radius;
  const by2 = size / 2 + Math.sin(angle + spread) * radius;

  const hue1 = ((angle - spread) * 180) / Math.PI;
  const hue2 = ((angle + spread) * 180) / Math.PI;
  const lightSide = light;
  const color1 = hslToHex(hue1, 100, lightSide);
  const color2 = hslToHex(hue2, 100, lightSide);

  /**
   * The stop set a given wheel position would produce — the same arithmetic the
   * render uses, factored out so the legibility map is measuring exactly what
   * dragging there would select rather than an approximation of it.
   */
  const stopsAt = (hueDeg: number, lightValue: number): string[] => {
    // Derived from the lightness being sampled, not from the pointer's current
    // radius: the map is cached per configuration, so it must not depend on
    // where the bullet happens to be sitting.
    const n = RADIUS
      ? radiusAt(lightValue, RADIUS, minLight, maxLight) / RADIUS
      : 0;
    const sp =
      (minSpread + (maxSpread - minSpread) * Math.pow(n, 3)) * spreadFactor;
    const deg = (sp * 180) / Math.PI;
    const c = hslToHex(hueDeg, 100, lightValue);
    const cLeft = hslToHex(hueDeg - deg, 100, lightValue);
    const cRight = hslToHex(hueDeg + deg, 100, lightValue);
    if (numPoints === 1) return [c];
    if (numPoints === 2) return [cRight, c];
    return [cRight, c, cLeft];
  };

  const mapKey = `${numPoints}:${minLight}:${maxLight}:${spreadFactor}:${minSpread}:${maxSpread}`;
  const legible = legibilityMap(minLight, maxLight, stopsAt, mapKey);

  const lightAtRadius = (r: number): number =>
    lightAt(r, RADIUS, minLight, maxLight);

  /**
   * Pull the pointer to the nearest radius whose theme is readable.
   *
   * Snapping rather than clamping, because the unusable region is a band in the
   * middle of the wheel: the colours just inside and just outside it are both
   * fine, so the nearest legible position is often outward, not inward.
   */
  const snapRadius = (a: number, r: number): number => {
    const hueDeg = (a * 180) / Math.PI;
    if (isLegible(legible, minLight, hueDeg, lightAtRadius(r))) return r;
    const step = RADIUS / 60;
    for (let d = step; d <= RADIUS; d += step) {
      const out = r + d;
      const inward = r - d;
      if (out <= RADIUS && isLegible(legible, minLight, hueDeg, lightAtRadius(out))) {
        return out;
      }
      if (inward >= 0 && isLegible(legible, minLight, hueDeg, lightAtRadius(inward))) {
        return inward;
      }
    }
    return r;
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, RADIUS, 0, Math.PI * 2);
    ctx.clip();
    for (let r = 0; r <= RADIUS; r++) {
      for (let a = 0; a < 360; a += 1) {
        const rad = (a * Math.PI) / 180;
        const x = size / 2 + Math.cos(rad) * r;
        const y = size / 2 + Math.sin(rad) * r;
        const lightness = minLight + (maxLight - minLight) * (r / RADIUS);
        ctx.beginPath();
        ctx.strokeStyle = hslToHex(a, 100, lightness);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y + 1);
        ctx.stroke();
      }
    }

    /*
     * The wheel is painted whole. Colours that fail the contrast check are
     * still refused — the pointer snaps past them — but they are not marked
     * out on the wheel. Scrimming them turned a colour picker into a map of
     * what you may not have, which is a lot of visual weight for a rule the
     * snap already enforces silently.
     */
  }, [size, RADIUS, minLight, maxLight]);

  useEffect(() => {
    const colors =
      numPoints === 1
        ? [color]
        : numPoints === 2
          ? [color2, color]
          : [color2, color, color1];
    onColorChange?.(colors);
  }, [color, color1, color2, numPoints, onColorChange]);

  function setFromPointer(e: React.PointerEvent): void {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    let r = Math.sqrt(x * x + y * y);
    let a = Math.atan2(y, x);
    if (a < 0) a += 2 * Math.PI;
    r = Math.max(0, Math.min(RADIUS, r));
    setAngle(a);
    setRadius(snapRadius(a, r));
  }

  function onPointerDown(e: React.PointerEvent): void {
    setDrag(true);
    onInteract?.();
    setFromPointer(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent): void {
    if (!drag) return;
    setFromPointer(e);
  }
  function onPointerUp(): void {
    setDrag(false);
  }

  const bx = size / 2 + Math.cos(angle) * radius;
  const by = size / 2 + Math.sin(angle) * radius;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative mx-auto touch-none select-none"
    >
      <canvas
        ref={ref}
        width={size}
        height={size}
        className="rounded-full ring-1 ring-black/10 dark:ring-white/10"
      />

      {numPoints >= 2 && (
        <div
          className="pointer-events-none absolute z-20 rounded-full border-2 border-white/80 opacity-90 shadow"
          style={{
            left: bx2 - bulletRadius / 1.7,
            top: by2 - bulletRadius / 1.7,
            width: bulletRadius * 1.2,
            height: bulletRadius * 1.2,
            background: color2,
          }}
        />
      )}

      <div
        className="absolute z-30 cursor-grab touch-none rounded-full border-[3px] border-white/90 shadow active:cursor-grabbing"
        style={{
          left: bx - bulletRadius,
          top: by - bulletRadius,
          width: bulletRadius * 2,
          height: bulletRadius * 2,
          background: color,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />

      {numPoints >= 3 && (
        <div
          className="pointer-events-none absolute z-20 rounded-full border-2 border-white/80 opacity-90 shadow"
          style={{
            left: bx1 - bulletRadius / 1.7,
            top: by1 - bulletRadius / 1.7,
            width: bulletRadius * 1.2,
            height: bulletRadius * 1.2,
            background: color1,
          }}
        />
      )}
    </div>
  );
}
