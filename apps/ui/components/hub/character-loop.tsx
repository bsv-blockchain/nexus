"use client";

import type { PresetId } from "@/lib/data/presets";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The four people the presets are named for, one clip each.
 *
 * Keyed by preset rather than by the person, because that is the question every
 * caller is actually asking — "who did they say they were" — and a map from
 * `thinker` to a filename spelled after an actor is a lookup nobody can read.
 * Each clip is the same three cuts in the same order: a midshot, a closeshot,
 * and the one through the door, two seconds apiece.
 */
const CLIPS: Record<PresetId, string> = {
  maker: "/first-run/characters/maker.mp4",
  developer: "/first-run/characters/developer.mp4",
  thinker: "/first-run/characters/thinker.mp4",
  gamer: "/first-run/characters/gamer.mp4",
};

/**
 * The one that opens every run.
 *
 * Somebody who picked nothing still has to be met by a person rather than by a
 * tinted rectangle, so there is always at least one clip — and it is the same
 * one every time, so the tour opens on a face people recognise from the welcome
 * whatever they answered.
 */
const ALWAYS: PresetId = "maker";

/** Preset order, so two people who picked the same pair see the same run. */
const ORDER: PresetId[] = ["maker", "developer", "thinker", "gamer"];

/** The clips a run plays: the ones chosen, plus the one everybody gets. */
export function clipsFor(chosen: PresetId[]): string[] {
  const wanted = new Set<PresetId>([ALWAYS, ...chosen]);
  return ORDER.filter((preset) => wanted.has(preset)).map(
    (preset) => CLIPS[preset],
  );
}

/**
 * One clip after another, round and round.
 *
 * A playlist rather than a pre-cut reel because the set is not known until
 * somebody has answered: four presets is fifteen combinations, and rendering
 * fifteen files to avoid one `ended` handler would be fifteen files to re-cut
 * every time a clip changes.
 *
 * Both sources are set imperatively on one element instead of swapping a React
 * `src`, which resets the element and shows a frame of nothing between clips.
 * The next source is loaded on `ended` and played straight away; a browser that
 * refuses the play — no gesture yet, reduced data — leaves the last frame up,
 * which is a still rather than a gap.
 */
export function CharacterLoop({
  chosen,
  poster,
  className = "",
}: {
  chosen: PresetId[];
  /** shown until the first clip has arrived */
  poster?: string;
  className?: string;
}): ReactNode {
  const clips = clipsFor(chosen);
  const ref = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);

  /* Kept in a ref as well as in state: the `ended` handler is attached once and
     would otherwise close over the first index forever. */
  const at = useRef(0);
  useEffect(() => {
    at.current = index;
  }, [index]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = (): void => {
      const to = (at.current + 1) % clips.length;
      at.current = to;
      setIndex(to);
      el.src = clips[to]!;
      void el.play().catch(() => {
        /* Refused. The last frame stays up, which is a still and not a hole. */
      });
    };
    el.addEventListener("ended", next);
    return () => el.removeEventListener("ended", next);
  }, [clips]);

  return (
    <video
      ref={ref}
      src={clips[0]}
      {...(poster ? { poster } : {})}
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
