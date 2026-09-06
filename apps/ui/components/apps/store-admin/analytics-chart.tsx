"use client";

/**
 * A day-by-day bar chart for impressions or clicks — drawn by hand, the same
 * trade components/apps/wallet/price-chart.tsx already made for a price
 * series: one short chart, one interaction, and the nearest charting library
 * is half a megabyte to draw thirty rectangles.
 *
 * Bars rather than PriceChart's smoothed curve, on purpose. A day's count is
 * a discrete total, not a sample of something continuous — a monotone spline
 * through it would draw a value between Tuesday and Wednesday that nobody
 * ever counted, which on a chart meant to back up a number in a sales
 * conversation is a false statement about what happened.
 *
 * Same scrub-to-read shape as PriceChart: the figure lives above the chart,
 * not in a tooltip, and dragging or arrowing across the bars moves which day
 * it reads.
 */

import { useReducedMotion } from "@/lib/motion";
import { motion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { DailyPoint } from "@/lib/admin-analytics";

const BAR_GAP = 4;

function dayLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIndex = Number(month) - 1;
  return `${Number(day)} ${MONTHS[monthIndex] ?? ""}`;
}

export function AnalyticsChart({
  data,
  metric,
  height = 140,
  label,
}: {
  data: DailyPoint[];
  metric: "impressions" | "clicks";
  height?: number;
  /** what the reading above the chart calls this metric, e.g. "impressions" */
  label: string;
}): ReactNode {
  const reduced = useReducedMotion();
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
  const values = data.map((point) => point[metric]);
  const max = Math.max(1, ...values);
  const barWidth = data.length > 0 ? Math.max(1, width / data.length - BAR_GAP) : 0;

  const report = (index: number | null): void => setAt(index);

  const nearest = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (width === 0 || data.length === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / (box.width || 1);
    const index = Math.round(ratio * (data.length - 1));
    report(Math.min(data.length - 1, Math.max(0, index)));
  };

  const onKey = (event: ReactKeyboardEvent<SVGSVGElement>): void => {
    const last = data.length - 1;
    const current = at ?? last;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      report(Math.max(0, current - 1));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      report(Math.min(last, current + 1));
    } else if (event.key === "Escape") {
      report(null);
    }
  };

  const shown = at ?? data.length - 1;
  const point = data[shown];

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs">
        {point ? (
          <>
            {dayLabel(point.date)}:{" "}
            <span className="text-foreground font-semibold">
              {point[metric].toLocaleString()}
            </span>{" "}
            {label}
          </>
        ) : (
          "No data yet"
        )}
      </p>
      <div ref={frame} className="text-accent relative w-full" style={{ height }}>
        {width > 0 && data.length > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="focus-ring block cursor-crosshair overflow-visible"
            role="slider"
            tabIndex={0}
            aria-label={`${label} by day`}
            aria-valuemin={0}
            aria-valuemax={data.length - 1}
            aria-valuenow={shown}
            aria-valuetext={point ? `${dayLabel(point.date)}: ${point[metric]}` : ""}
            onPointerMove={nearest}
            onPointerDown={nearest}
            onPointerLeave={() => report(null)}
            onBlur={() => report(null)}
            onKeyDown={onKey}
          >
            {data.map((d, i) => {
              const value = d[metric];
              const barHeight = (value / max) * (height - 4);
              const x = (i / data.length) * width + BAR_GAP / 2;
              const y = height - barHeight;
              return (
                <motion.rect
                  key={d.date}
                  x={x}
                  width={barWidth}
                  rx={Math.min(2, barWidth / 2)}
                  initial={reduced ? false : { height: 0, y: height }}
                  animate={{ height: barHeight, y }}
                  transition={{ duration: 0.3, delay: reduced ? 0 : i * 0.015 }}
                  className={i === shown ? "fill-accent" : "fill-accent/35"}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
