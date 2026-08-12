"use client";

import {
  PHASE_FEATURES,
  PHASE_LABELS,
  PHASES,
  setPhase,
  usePhase,
  type Phase,
} from "@/lib/phase";
import { AnimatePresence, motion } from "motion/react";
import { Check, Wrench, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const ORDER: Record<Phase, number> = { now: 0, next: 1, later: 2 };

function Level({
  label,
  value,
}: {
  label: string;
  value: "low" | "medium" | "high";
}): ReactNode {
  const filled = value === "low" ? 1 : value === "medium" ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex gap-0.5" aria-label={`${label} ${value}`}>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-1 w-1.5 rounded-[1px] ${
              index < filled ? "bg-muted-foreground" : "bg-muted-foreground/25"
            }`}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Which product state the prototype is showing.
 *
 * Bottom-right, deliberately unlike everything around it: this is a control for
 * whoever is running the demo, not part of the product, and a pill that matched
 * the house style would eventually be mistaken for one.
 *
 * The checklist is the point as much as the switch. Each feature shows what it
 * costs, what it is worth and what it waits on, so the phase it landed in is an
 * argument on screen rather than an assertion in a file.
 */
export function PhaseSwitcher(): ReactNode {
  const phase = usePhase();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  /* Client-only, and asked rather than latched: an effect that sets state on
     mount is exactly what the compiler rejects, and `useSyncExternalStore`
     already answers "am I on the client" through its server snapshot. */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!mounted) return null;

  const rank = ORDER[phase];
  /* The selected state first with its own new features, then what it carries
     over from the states before it. Later states are not listed: the point of
     the control is to show what this state contains, not what it lacks. */
  const groups = [rank, ...PHASES.map((_, i) => i).filter((i) => i < rank)];

  return (
    /* Clear of the phone's bottom bar, which owns the last ~84px of the screen
       plus its safe-area inset. At `bottom-4` the chip sat on top of the tab
       switcher — the one control somebody reaching for it is most likely to hit
       by accident. Desktop has nothing down there, so the offset only applies
       below the breakpoint where the bar exists. */
    <div
      ref={box}
      className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[70] md:bottom-4"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="border-border bg-surface-raised absolute right-0 bottom-12 w-80 overflow-hidden rounded-xl border shadow-2xl"
          >
            <div className="border-border/60 flex items-center gap-2 border-b p-3">
              <p className="text-muted-foreground flex-1 text-[10px] font-semibold tracking-[1px] uppercase">
                Product state
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="focus-ring text-muted-foreground hover:text-foreground rounded p-0.5"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="border-border/60 border-b p-3">
              <div
                role="group"
                aria-label="Product state"
                className="bg-surface ring-border/60 grid grid-cols-3 gap-0.5 rounded-lg p-0.5 ring-1"
              >
                {PHASES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={phase === option}
                    onClick={() => setPhase(option)}
                    /* Tint behind, words unchanged — the house rule. It was
                       `bg-surface-raised`, which is the popover's own colour,
                       so the selected tab had nothing separating it from the
                       panel it sits on. */
                    className={`focus-ring rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                      phase === option
                        ? "bg-accent/20 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {PHASE_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {groups.map((index) => {
                const group = PHASES[index]!;
                const features = PHASE_FEATURES.filter(
                  (feature) => feature.phase === group
                );
                if (features.length === 0) return null;
                return (
                  <div key={group} className="mb-2 last:mb-0">
                    <p className="text-muted-foreground px-1.5 py-1 text-[10px] font-semibold tracking-[1px] uppercase">
                      {PHASE_LABELS[group]}
                      {index !== rank && " · carried over"}
                    </p>
                    <ul>
                      {features.map((feature) => (
                        <li
                          key={feature.key}
                          className="hover:bg-surface-hover rounded-lg px-1.5 py-1.5"
                        >
                          <p className="flex items-start gap-1.5">
                            <Check
                              className="text-positive mt-0.5 size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 text-xs font-medium text-pretty">
                              {feature.label}
                            </span>
                          </p>
                          <p className="text-muted-foreground mt-0.5 pl-5 text-[10px] leading-relaxed text-pretty">
                            {feature.why}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-5 text-[10px]">
                            <Level label="Impact" value={feature.impact} />
                            <Level label="Effort" value={feature.effort} />
                            {feature.depends.length > 0 && (
                              <span className="text-muted-foreground">
                                after {feature.depends.join(", ")}
                              </span>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Switch product state"
        /* Hover deepens in both themes. It was one `hover:bg-amber-200/90` for
           both, which in dark mode swapped a near-black pill for a pale one
           under pale text — the hover made it harder to read than at rest.
           The lift and the brighter edge do the "you can press this" work. */
        className="focus-ring flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-100/90 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-amber-900 uppercase shadow-lg backdrop-blur transition-[background-color,border-color,box-shadow,translate] hover:-translate-y-px hover:border-amber-500/70 hover:bg-amber-200/95 hover:shadow-xl active:translate-y-0 dark:border-amber-400/30 dark:bg-amber-950/80 dark:text-amber-200 dark:hover:border-amber-300/60 dark:hover:bg-amber-900/90"
      >
        <Wrench className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        {PHASE_LABELS[phase]}
      </button>
    </div>
  );
}
