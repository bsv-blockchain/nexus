"use client";

import { content } from "@/lib/data";
import { useReducedMotion } from "@/lib/motion";
import {
  Globe,
  HelpCircle,
  Keyboard,
  Layers,
  LayoutGrid,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const EASE = [0.4, 0, 0.2, 1] as const;

const stepIcons: Record<string, LucideIcon> = {
  LayoutGrid,
  Layers,
  Globe,
  Wallet,
};

function openExternal(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Onboarding "Getting Started" canvas (Nexus Basics → Getting Started). */
export function GettingStartedPage(): ReactNode {
  const copy = content.gettingStarted;
  const reduce = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(shortcutsOpen);

  // Hold the sharp photo ~1s longer before the blur + content animate in.
  const HOLD = 1;
  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay: delay + HOLD, ease: EASE },
        };

  const progress = ((activeStep + 1) / copy.steps.length) * 100;

  const topButtons = (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => setShortcutsOpen(true)}
        className="focus-ring inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-[#1e2a5e] shadow-sm ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white"
      >
        <Keyboard className="size-4" aria-hidden="true" />
        {copy.learnShortcuts}
      </button>
      <button
        type="button"
        onClick={() => openExternal(copy.helpUrl)}
        className="focus-ring inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-[#1e2a5e] shadow-sm ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white"
      >
        <HelpCircle className="size-4" aria-hidden="true" />
        {copy.helpResources}
      </button>
    </div>
  );

  return (
    <div className="relative h-full overflow-hidden text-[#1e2a5e]">
      {/* Background photo: fades in, then blurs heavily for contrast. */}
      <motion.img
        src="/images/ricardo-gomez-angel-58uZCE8zrdk-unsplash.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover"
        initial={
          reduce
            ? { opacity: 1, filter: "blur(34px)" }
            : { opacity: 0, filter: "blur(0px)" }
        }
        animate={
          reduce
            ? { opacity: 1, filter: "blur(34px)" }
            : {
                opacity: [0, 1, 1, 1],
                filter: ["blur(0px)", "blur(0px)", "blur(0px)", "blur(34px)"],
              }
        }
        transition={
          reduce ? {} : { duration: 2.3, times: [0, 0.2, 0.63, 1], ease: EASE }
        }
      />
      {/* White matte lifts contrast for the foreground. */}
      <motion.div
        className="absolute inset-0 bg-linear-to-b from-white/60 to-white/45"
        initial={reduce ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? {} : { duration: 0.6, delay: 1.75, ease: EASE }}
      />

      {/* Content: buttons top, heading + steps + preview bottom-aligned. */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-8 lg:px-10 lg:py-10">
          <motion.div {...rise(1.3)}>{topButtons}</motion.div>

          <div className="mt-auto grid grid-cols-1 gap-8 pt-10 lg:grid-cols-2 lg:items-end lg:gap-10">
            <div className="min-w-0">
              <motion.h1
                className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl"
                {...rise(1.0)}
              >
                {copy.headingLine1}
                <br />
                {copy.headingLine2}
              </motion.h1>

              <motion.div className="mt-6 space-y-2" {...rise(1.15)}>
                {copy.steps.map((step, index) => {
                  const active = index === activeStep;
                  const Icon = stepIcons[step.icon] ?? LayoutGrid;
                  if (active) {
                    return (
                      <div
                        key={step.title}
                        className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eef0fb] text-[#4353ff]">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <div>
                            <h3 className="text-base font-bold">
                              {step.title}
                            </h3>
                            <p className="mt-1 text-sm text-[#5b6484]">
                              {step.body}
                            </p>
                          </div>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/5">
                          <motion.div
                            className="h-full rounded-r-full bg-[#4353ff]"
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.6, ease: EASE }}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={step.title}
                      type="button"
                      onClick={() => setActiveStep(index)}
                      className="focus-ring flex w-full items-center gap-3 rounded-2xl bg-white/55 px-5 py-4 text-left shadow-sm transition-colors hover:bg-white/80"
                    >
                      <span className="text-sm font-semibold text-[#8089ab]">
                        {index + 1}
                      </span>
                      <span className="text-base font-bold">{step.title}</span>
                    </button>
                  );
                })}
              </motion.div>
            </div>

            <motion.div className="min-w-0" {...rise(1.3)}>
              <PreviewWindow />
            </motion.div>
          </div>
        </div>
      </div>

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

/** A stylized browser-window placeholder standing in for a screenshot. */
function PreviewWindow(): ReactNode {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
      <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <span
          className="ml-3 h-6 flex-1 rounded-md bg-black/5"
          aria-hidden="true"
        />
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#8089ab] uppercase">
          <span>Nexus</span>
          <span aria-hidden="true">›</span>
          <span>Preview</span>
        </div>
        <div
          className="mt-3 h-6 w-3/4 rounded bg-black/10"
          aria-hidden="true"
        />
        <div className="mt-2 h-4 w-1/2 rounded bg-black/5" aria-hidden="true" />
        {/*
          The mark, on the one surface in this mockup with room for it.

          Masked rather than dropped in as an image: the file is a fixed
          #F4F2F0, which is off-white against a gradient that is not, so used as
          a mask the colour is ours to set — the same trick first-run uses to
          make one asset work on a light theme and a dark one.
        */}
        <div
          className="mt-4 flex h-40 items-center rounded-xl bg-linear-to-br from-[#4353ff] via-[#7c86ff] to-[#22d3ee] px-6"
          aria-hidden="true"
        >
          <span
            className="size-14 bg-white"
            style={{
              maskImage: "url(/icons/Nexus-logo-white.svg)",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              maskSize: "contain",
              WebkitMaskImage: "url(/icons/Nexus-logo-white.svg)",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              WebkitMaskSize: "contain",
            }}
          />
        </div>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-3 w-full rounded bg-black/5" />
          <div className="h-3 w-5/6 rounded bg-black/5" />
          <div className="h-3 w-2/3 rounded bg-black/5" />
        </div>
      </div>
    </div>
  );
}

/** Shortcuts panel styled to match the command bar (black/white + glow). */
function ShortcutsOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const copy = content.gettingStarted;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={copy.shortcutsTitle}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-[0_12px_90px_-8px_rgba(0,0,0,0.85)] ring-1 ring-black/10 dark:bg-black dark:text-white dark:shadow-[0_12px_90px_-4px_rgba(0,0,0,0.95)] dark:ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Keyboard className="size-5 shrink-0 opacity-50" aria-hidden="true" />
          <span className="text-base font-medium">{copy.shortcutsTitle}</span>
        </div>
        <div className="border-t border-black/10 p-2 dark:border-white/10">
          {copy.shortcuts.map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span>{shortcut.label}</span>
              <kbd className="shrink-0 rounded-md bg-black/5 px-2 py-1 font-mono text-xs font-semibold ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/15">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
