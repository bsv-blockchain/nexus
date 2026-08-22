"use client";

/**
 * The last thing the first run asks: what are you here for?
 *
 * A full-bleed filmstrip on a pointer, a stack of cards on a phone. Both are
 * the same question and the same data; only the geometry differs, because the
 * desktop version's whole idea — neighbours cropped to half height either side
 * of one full card — needs horizontal room it does not have on a phone, where
 * it would be three slivers and a postage stamp.
 *
 * Geometry is measured rather than hard-coded: one ResizeObserver reads the
 * stage and every size below is a ratio of it, so this is the same picture in a
 * 900px window and on a display twice that.
 *
 * Multi-select, because the presets are additive by design — the tick is on the
 * card and the strip does not advance when you set one, so choosing three is
 * three taps rather than a negotiation with a carousel.
 */

import { presets, type PresetId } from "@/lib/data/presets";
import { content } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useReducedMotion } from "@/lib/motion";
import { Check } from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const copy = content.firstRun.presets;

/* Ratios, all relative to the stage box. */
const CARD_H = 0.42; // focused card height ÷ stage height
const CARD_AR = 406 / 720; // the clips are portrait; the card is their shape
const GAP = 0.06; // gap ÷ card width
const STRIP_TOP = 0.4; // the strip's shared top edge, down the stage

/** Wheel distance that commits to a step, and the lockout after one. */
const WHEEL_THRESHOLD = 60;
const WHEEL_COOLDOWN = 420;

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

/**
 * A clip, playing.
 *
 * `playsInline` and `muted` are not decoration: without both, iOS refuses to
 * play inline and hands back a fullscreen player, which is the opposite of a
 * background. `preload="auto"` because all four are on screen at once and a
 * card that starts black while it buffers reads as broken.
 */
function Clip({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}): ReactNode {
  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

export function PresetPicker({
  onDone,
}: {
  /** the chosen presets, in build order; may be empty */
  onDone: (chosen: PresetId[]) => void;
}): ReactNode {
  const isDesktop = useIsDesktop();
  const [chosen, setChosen] = useState<PresetId[]>([]);

  const toggle = useCallback((id: PresetId) => {
    setChosen((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    );
  }, []);

  /* Build order, not tick order: the strip reads left to right and a rail
     built in the order somebody happened to tap would not match it. */
  const ordered = presets
    .map((preset) => preset.id)
    .filter((id) => chosen.includes(id));

  return isDesktop ? (
    <Strip chosen={chosen} onToggle={toggle} onDone={() => onDone(ordered)} />
  ) : (
    <Stack chosen={chosen} onToggle={toggle} onDone={() => onDone(ordered)} />
  );
}

/* ------------------------------------------------------------------ desktop */

function Strip({
  chosen,
  onToggle,
  onDone,
}: {
  chosen: PresetId[];
  onToggle: (id: PresetId) => void;
  onDone: () => void;
}): ReactNode {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();

  const last = presets.length - 1;

  const go = useCallback(
    (next: number) => setIndex(clamp(next, 0, last)),
    [last]
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const read = (): void =>
      setBox({ w: stage.clientWidth, h: stage.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const fullH = clamp(box.h * CARD_H, 160, 520);
  const halfH = fullH * 0.58;
  const cardW = fullH * CARD_AR;
  const gap = Math.max(8, Math.round(cardW * GAP));
  const step = cardW + gap;

  const xFor = useCallback(
    (i: number) => box.w / 2 - (i * step + cardW / 2),
    [box.w, step, cardW]
  );
  const x = useMotionValue(0);
  const target = xFor(index);

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 34, mass: 0.9 };

  /* The track is driven by a motion value rather than an `animate` prop, so a
     drag starting mid-spring reads the real position rather than where the
     spring was headed — otherwise the release snaps a card off. */
  useEffect(() => {
    if (dragging) return;
    const run = animate(x, target, spring);
    return () => run.stop();
    // `spring` is a literal; `reduced` is everything it derives from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, dragging, reduced, x]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let acc = 0;
    let until = 0;
    const onWheel = (event: WheelEvent): void => {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      /* At either end, hand the gesture back rather than swallowing it: a
         full-height strip that eats every scroll is a trap. */
      if ((delta > 0 && index === last) || (delta < 0 && index === 0)) {
        acc = 0;
        return;
      }
      event.preventDefault();
      if (event.timeStamp < until) return;
      acc += delta;
      if (Math.abs(acc) < WHEEL_THRESHOLD) return;
      go(index + Math.sign(acc));
      acc = 0;
      until = event.timeStamp + WHEEL_COOLDOWN;
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [go, index, last]);

  const active = presets[index];
  if (!active) return null;

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      role="group"
      aria-label={copy.title}
      onKeyDown={(event) => {
        const keys: Record<string, number> = {
          ArrowLeft: index - 1,
          ArrowRight: index + 1,
          Home: 0,
          End: last,
        };
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onToggle(active.id);
          return;
        }
        if (!(event.key in keys)) return;
        event.preventDefault();
        go(keys[event.key]!);
      }}
      className="relative h-full w-full overflow-hidden bg-black text-white outline-none select-none"
    >
      {/* The focused clip, blown up and re-graded to its accent. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={active.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.7 }}
        >
          {/* Blurred, and scaled past the frame to pay for it: a blur samples
              beyond the element it is on, so without the extra scale the
              softened edges vignette in from the sides. 24px rather than 40 —
              far enough that the clip is a wash the tiles sit on, near enough
              that you can still tell what it is. */}
          <Clip src={active.video} className="scale-140 blur-xl" />
          {/* Keeps the clip's luminance, takes the accent's hue. */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: active.accent, mixBlendMode: "color" }}
          />
          <div
            className="absolute inset-0 opacity-50"
            style={{ backgroundColor: active.accent, mixBlendMode: "multiply" }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Legibility wash, above the swap so it never flickers. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/80" />

      {/* The question, above the strip's top edge. */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center justify-end px-10 text-center"
        style={{ height: `${STRIP_TOP * 100}%`, paddingBottom: box.h * 0.04 }}
      >
        <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase">
          {copy.eyebrow}
        </p>
        <h1
          className="mt-3 font-semibold tracking-tight"
          style={{ fontSize: Math.max(28, Math.round(box.h * 0.062)) }}
        >
          {copy.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-balance text-white/80">
          {copy.body}
        </p>
      </div>

      {/* The strip: one shared top edge, the focused card taller. */}
      <div
        className="absolute inset-x-0"
        style={{ top: `${STRIP_TOP * 100}%`, height: fullH }}
      >
        <motion.div
          className="flex items-start"
          style={{ gap, x, cursor: dragging ? "grabbing" : "grab" }}
          drag="x"
          dragMomentum={false}
          dragElastic={0.08}
          dragConstraints={{ left: xFor(last), right: xFor(0) }}
          onDragStart={() => setDragging(true)}
          onDragEnd={(_, info) => {
            setDragging(false);
            const thrown = x.get() + info.velocity.x * 0.12;
            go(Math.round((box.w / 2 - thrown - cardW / 2) / step));
          }}
        >
          {presets.map((preset, i) => {
            const focused = i === index;
            const picked = chosen.includes(preset.id);
            return (
              <motion.button
                key={preset.id}
                type="button"
                aria-pressed={picked}
                aria-label={`${preset.title} — ${preset.tagline}`}
                onClick={() => (focused ? onToggle(preset.id) : go(i))}
                className="relative shrink-0 overflow-hidden rounded-2xl bg-white/5"
                style={{ width: cardW }}
                animate={{ height: focused ? fullH : halfH }}
                transition={spring}
              >
                <Clip src={preset.video} />
                {/* Unfocused cards sit back without going grey. */}
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 bg-black"
                  animate={{ opacity: focused ? 0 : 0.35 }}
                  transition={spring}
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-left">
                  <span className="block text-sm font-semibold">
                    {preset.title}
                  </span>
                  {focused && (
                    <span className="mt-0.5 block text-[11px] text-white/75">
                      {preset.tagline}
                    </span>
                  )}
                </span>
                {/* The tick, which is the whole point of the card. */}
                <span
                  aria-hidden="true"
                  className={`absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full ring-2 transition-colors ${
                    picked
                      ? "bg-accent text-accent-foreground ring-accent"
                      : "bg-black/35 ring-white/60"
                  }`}
                >
                  {picked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* What the focused preset is for, and the way on. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-10 pb-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={active.id}
            className="max-w-md text-center text-sm text-balance text-white/85"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.3 }}
          >
            {active.blurb}
          </motion.p>
        </AnimatePresence>
        <Continue count={chosen.length} onDone={onDone} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- mobile */

/**
 * The same question as a scrolling stack.
 *
 * Not the strip at a smaller size: cropped neighbours either side of a focused
 * card need width a phone has not got, and shrinking it produces three slivers
 * nobody can read. A phone has vertical room instead, so each preset gets a
 * full-width clip with its words on top and its tick in the corner.
 */
function Stack({
  chosen,
  onToggle,
  onDone,
}: {
  chosen: PresetId[];
  onToggle: (id: PresetId) => void;
  onDone: () => void;
}): ReactNode {
  return (
    <div className="flex h-full w-full flex-col bg-black text-white">
      <div className="shrink-0 px-6 pt-8 pb-4 text-center">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-white/70 uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-balance text-white/75">{copy.body}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {presets.map((preset) => {
          const picked = chosen.includes(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={picked}
              onClick={() => onToggle(preset.id)}
              className={`focus-ring relative block h-36 w-full overflow-hidden rounded-2xl text-left ring-2 transition-shadow ${
                picked ? "ring-accent" : "ring-transparent"
              }`}
            >
              <Clip src={preset.video} />
              <span
                className="absolute inset-0"
                style={{
                  backgroundColor: preset.accent,
                  mixBlendMode: "color",
                }}
              />
              <span className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
              <span className="absolute inset-y-0 left-0 flex max-w-[70%] flex-col justify-center gap-1 p-4">
                <span className="text-lg font-semibold">{preset.title}</span>
                <span className="text-[11px] text-white/80">
                  {preset.blurb}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`absolute top-3 right-3 grid size-7 place-items-center rounded-full ring-2 transition-colors ${
                  picked
                    ? "bg-accent text-accent-foreground ring-accent"
                    : "bg-black/35 ring-white/60"
                }`}
              >
                {picked && <Check className="size-4" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pinned, so the way on is reachable without scrolling back. */}
      <div className="shrink-0 border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Continue count={chosen.length} onDone={onDone} />
      </div>
    </div>
  );
}

/**
 * The way on, which is never disabled.
 *
 * Choosing nothing is a real answer — it means the six apps everybody gets and
 * no folders — so the button changes its words rather than greying out. A
 * disabled control at the end of a first run is a dead end somebody has to
 * guess their way out of.
 */
function Continue({
  count,
  onDone,
}: {
  count: number;
  onDone: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onDone}
      className="focus-ring bg-accent text-accent-foreground w-full max-w-sm rounded-full px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
    >
      {count === 0
        ? copy.skip
        : count === 1
          ? copy.continueOne
          : copy.continueMany.replace("{count}", String(count))}
    </button>
  );
}
