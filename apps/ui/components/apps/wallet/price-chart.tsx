"use client";

/**
 * A month of an asset's price, and what your balance was worth along it.
 *
 * The row sparklines in the portfolio are decoration — a direction, at a
 * glance. This is the one screen about one asset, so it is a chart you can
 * read: a smoothed curve over a gradient, and a scrub that answers "what was
 * this worth on the eleventh".
 *
 * Drawn by hand rather than with a charting library. It is one series of thirty
 * points with one interaction, and the nearest library and its d3 dependencies
 * are half a megabyte to draw it — the same trade this codebase already refused
 * for two flags. What it costs instead is the monotone interpolation below,
 * which is thirty lines and is the part a library would actually have saved.
 *
 * The scrub reports upward rather than drawing its own tooltip: the figure it
 * would print is already on the screen, above the chart, and two answers to
 * "what is this worth" in one card is one too many.
 *
 * @see lib/exchange-rate.ts — where the closes come from
 * @see components/apps/wallet/portfolio.tsx — the small sparkline this is not
 */

import { useBsvHistory, type BsvClose } from "@/lib/exchange-rate";
import { content } from "@/lib/data";
import { change24hOf, sparkSeries, usd, type Holding } from "@/lib/wallet";
import { formatUnits } from "@/components/apps/wallet/token-mark";
import { motion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/** Room above and below the line, so a peak is not clipped by the frame. */
const PAD_Y = 10;

/** What the reading over a scrubbed point says. */
export interface ScrubPoint {
  /** the day, already formatted */
  date: string;
  /** what the holding was worth that day */
  usd: number;
  /** what one unit cost that day */
  rate: number;
}

/**
 * Tangents that do not overshoot.
 *
 * Fritsch–Carlson, the same monotone cubic a charting library reaches for. A
 * plain cardinal spline through daily closes invents peaks between them — it
 * will draw a high that never traded, which on a price chart is not a smoothing
 * artefact but a false statement.
 */
function monotoneTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = (xs[i + 1] as number) - (xs[i] as number);
    slopes.push(
      dx === 0 ? 0 : ((ys[i + 1] as number) - (ys[i] as number)) / dx
    );
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = slopes[0] ?? 0;
  m[n - 1] = slopes[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i += 1) {
    const a = slopes[i - 1] as number;
    const b = slopes[i] as number;
    m[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  for (let i = 0; i < n - 1; i += 1) {
    const s = slopes[i] as number;
    if (s === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = (m[i] as number) / s;
    const b = (m[i + 1] as number) / s;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * s;
      m[i + 1] = t * b * s;
    }
  }
  return m;
}

function curve(xs: number[], ys: number[]): string {
  if (xs.length < 2) return "";
  const m = monotoneTangents(xs, ys);
  let d = `M${(xs[0] as number).toFixed(2)},${(ys[0] as number).toFixed(2)}`;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const x0 = xs[i] as number;
    const x1 = xs[i + 1] as number;
    const y0 = ys[i] as number;
    const y1 = ys[i + 1] as number;
    const dx = (x1 - x0) / 3;
    d +=
      `C${(x0 + dx).toFixed(2)},${(y0 + (m[i] as number) * dx).toFixed(2)}` +
      ` ${(x1 - dx).toFixed(2)},${(y1 - (m[i + 1] as number) * dx).toFixed(2)}` +
      ` ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** UTC, because that is where the closes land. */
function dayLabel(seconds: number): string {
  const date = new Date(seconds * 1000);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function PriceChart({
  holding,
  height = 150,
  onScrub,
}: {
  holding: Holding;
  height?: number;
  /** the day under the pointer, or null when it leaves */
  onScrub?: (point: ScrubPoint | null) => void;
}): ReactNode {
  const copy = content.wallet.chart;
  const closes = useBsvHistory();
  const token = holding.token;
  const up = change24hOf(token) >= 0;

  /*
   * Measured rather than stretched.
   *
   * A viewBox scaled to fit would need `preserveAspectRatio="none"`, which
   * distorts the stroke and — with `pathLength` — turns a draw-on into a dashed
   * pattern. Drawing at the real pixel width is one observer and no surprises.
   */
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth((previous) => (previous === next ? previous : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [at, setAt] = useState<number | null>(null);

  /*
   * Real closes where there are any, the deterministic wobble otherwise.
   *
   * Only bitcoin has a price anyone can look up. The invented tokens get the
   * same drawing without the scrub, because a reading of "$186.00 on 11 Aug"
   * against a made-up series would be the one figure on this screen that looks
   * like a fact and is not.
   */
  const live: readonly BsvClose[] = token.id === "bsv" ? closes : [];
  const values =
    live.length >= 2 ? live.map((c) => c.rate) : sparkSeries(token);
  const scrubbable = live.length >= 2;

  const inner = Math.max(0, height - PAD_Y * 2);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xs = values.map((_, i) => (i / (values.length - 1)) * width);
  const ys = values.map((v) => PAD_Y + inner - ((v - min) / span) * inner);
  const line = width > 0 ? curve(xs, ys) : "";
  const area =
    line === "" ? "" : `${line} L${width.toFixed(2)},${height} L0,${height} Z`;

  const report = (index: number | null): void => {
    setAt(index);
    if (!onScrub) return;
    const point = index === null ? null : live[index];
    if (!point) {
      onScrub(null);
      return;
    }
    onScrub({
      date: dayLabel(point.time),
      usd: holding.units * point.rate,
      rate: point.rate,
    });
  };

  const nearest = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!scrubbable || width === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / (box.width || 1);
    const index = Math.round(ratio * (values.length - 1));
    report(Math.min(values.length - 1, Math.max(0, index)));
  };

  const onKey = (event: ReactKeyboardEvent<SVGSVGElement>): void => {
    if (!scrubbable) return;
    const last = values.length - 1;
    const current = at ?? last;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      report(Math.max(0, current - 1));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      report(Math.min(last, current + 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      report(0);
    } else if (event.key === "End") {
      event.preventDefault();
      report(last);
    } else if (event.key === "Escape") {
      report(null);
    }
  };

  const marked = at === null ? null : { x: xs[at] ?? 0, y: ys[at] ?? 0 };
  const held = live[at ?? -1];
  const reading = held
    ? copy.reading
        .replaceAll("{date}", dayLabel(held.time))
        .replaceAll("{value}", usd(holding.units * held.rate))
        .replaceAll("{units}", formatUnits(holding.units, token.decimals))
        /* replaceAll, not replace: the symbol appears twice in this sentence
           and the second one stayed as a literal `{symbol}`. */
        .replaceAll("{symbol}", token.symbol)
        .replaceAll("{rate}", usd(held.rate))
    : "";

  /* One gradient per token, since two charts on one page would otherwise share
     an id and the second would paint with the first one's colour. */
  const fillId = `spark-fill-${token.id}`;

  return (
    <div
      ref={frame}
      className={`relative w-full select-none ${up ? "text-positive" : "text-negative"}`}
      style={{ height }}
    >
      {width > 0 && (
        <motion.svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block overflow-visible"
          /* The reveal is a wipe rather than a dashed stroke: see the note in
             portfolio.tsx for why the dash approach cannot work here. */
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
              <stop offset="68%" stopColor="currentColor" stopOpacity="0.07" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${fillId})`} stroke="none" />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {marked && (
            <g>
              <line
                x1={marked.x}
                y1={PAD_Y}
                x2={marked.x}
                y2={height}
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <circle
                cx={marked.x}
                cy={marked.y}
                r="3.5"
                fill="currentColor"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            </g>
          )}
        </motion.svg>
      )}

      {/*
        The interaction is its own layer, on top and transparent.

        A slider rather than a graphic with a mouse handler: the thing being
        chosen is which day you are reading, it has an order and a range, and
        that is what a slider is. It also means the chart answers to arrow keys
        without a second implementation.
      */}
      {scrubbable && (
        <svg
          className="focus-ring absolute inset-0 z-10 h-full w-full cursor-crosshair touch-pan-y"
          role="slider"
          tabIndex={0}
          aria-label={copy.label}
          aria-valuemin={0}
          aria-valuemax={values.length - 1}
          aria-valuenow={at ?? values.length - 1}
          aria-valuetext={reading}
          onPointerMove={nearest}
          onPointerDown={nearest}
          onPointerLeave={() => report(null)}
          onBlur={() => report(null)}
          onKeyDown={onKey}
        />
      )}
    </div>
  );
}
