"use client";

/**
 * Focus's own column: how today is going.
 *
 * Every other app's column is a way of narrowing what the canvas shows — the
 * Timeline's ecosystems, Mail's folders, the wallet's sections. Focus has
 * nothing to narrow. It is one day and one photograph, so a column of filters
 * would be filters over a list of three things.
 *
 * So this answers the other question a contextual column can answer: not "which
 * part of it" but "how is it going". The date, because a screen about today
 * should say which today. What is left. How much of the morning has actually
 * been spent working, which is the number a focus timer exists to produce and
 * the one nothing was keeping. And the way out of a list that has become a
 * history.
 *
 * It is deliberately short. A column that fills itself up is a column competing
 * with the thing it is beside, and the thing it is beside is a mountain.
 */

import { AppHelpBar } from "@/components/hub/app-help-bar";
import { useMinute } from "@/lib/clock";
import { content } from "@/lib/data";
import {
  clearDoneTasks,
  goalFor,
  sessionsFor,
  today,
  useHome,
} from "@/lib/home-store";
import { Check, Circle, Eraser } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.home;

/** Ten is a long day; past it the pips stop counting and start saying "lots". */
const PIP_MAX = 10;

export function FocusSidebar({
  /**
   * Whether this is the column, or a card in a stack.
   *
   * A phone has no contextual column, so on one this renders in the scroll
   * under the photograph alongside the tasks and the timer — where filling the
   * height it is given would be filling a height nothing gave it, and the help
   * bar pushed to the bottom would be pushed to the bottom of the page.
   */
  asCard = false,
}: {
  asCard?: boolean;
} = {}): ReactNode {
  const { tasks } = useHome();
  /* Once a minute, so a window left open overnight does not still say
     yesterday — and from the same timer the stage beside it reads. */
  const stamp = useMinute();
  const now = stamp > 0 ? new Date(stamp) : null;

  const day = now ? today(now) : "";
  const { goal, done: goalDone } = goalFor(day);
  const sessions = sessionsFor(day);

  const finished = tasks.filter((task) => task.done).length;
  const total = tasks.length;
  const fraction = total === 0 ? 0 : finished / total;

  return (
    <div
      className={`bg-surface flex flex-col rounded-2xl p-3 ${
        asCard ? "" : "h-full"
      }`}
    >
      <h2 className="px-1.5 pt-0.5 pb-3 text-sm font-semibold">
        {copy.columnTitle}
      </h2>

      <div className="px-1.5">
        <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
          {copy.columnToday}
        </p>
        <p className="mt-0.5 text-[15px] font-semibold">
          {now
            ? now.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : ""}
        </p>
        {/* The goal, restated. It is the one thing on the canvas that can be
            scrolled past on a short window, and it is the point of the screen. */}
        <p className="text-muted-foreground mt-1 text-xs text-pretty">
          {goal ? (
            <span className={goalDone ? "line-through" : ""}>{goal}</span>
          ) : (
            copy.columnNoGoal
          )}
        </p>
      </div>

      <div className="border-border/60 mt-4 border-t px-1.5 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
            {copy.columnDone}
          </p>
          <p className="text-xs font-semibold tabular-nums">
            {copy.columnOf
              .replace("{done}", String(finished))
              .replace("{total}", String(total))}
          </p>
        </div>
        <div
          className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={finished}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="bg-accent h-full rounded-full transition-[width] duration-300"
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        {finished > 0 && (
          <button
            type="button"
            onClick={clearDoneTasks}
            className="focus-ring text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1.5 rounded-md text-[11px] transition-colors"
          >
            <Eraser className="size-3.5" aria-hidden="true" />
            {copy.columnClear}
          </button>
        )}
      </div>

      <div className="border-border/60 mt-4 border-t px-1.5 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
            {copy.columnSessions}
          </p>
          <p className="text-xs font-semibold tabular-nums">{sessions}</p>
        </div>
        {/* Pips rather than only a number: four of anything is a shape you can
            take in without reading, and the empty ones say what a day could be
            without nagging about it. */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {Array.from({ length: PIP_MAX }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={i < sessions ? "text-accent" : "text-border"}
            >
              {i < sessions ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : (
                <Circle className="size-3.5" />
              )}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px] text-pretty">
          {sessions === 0 ? copy.columnNoSessions : copy.columnSessionsHint}
        </p>
      </div>

      {/* Docked to the bottom of the column, and simply last in a card. */}
      {!asCard && (
        <div className="mt-auto">
          <AppHelpBar slug="focus" />
        </div>
      )}
    </div>
  );
}
