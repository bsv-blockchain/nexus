"use client";

import { content, languages } from "@/lib/data";
import {
  setSetting,
  useSettings,
  type ClearOnQuit,
} from "@/lib/settings-store";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.mobileBrowser.settings;

/**
 * Which language pages are asked for.
 *
 * Its own pane rather than a row with a dropdown, because it is a list of nine
 * things written in nine scripts and a select collapses all of that into one
 * line of the wrong alphabet. Both surfaces reach it the same way: desktop
 * opens the side pane, the mobile sheet pushes it.
 */
export function LanguagesPane(): ReactNode {
  const settings = useSettings();
  return (
    <div className="p-4">
      <p className="text-muted-foreground text-xs text-pretty">
        {copy.languagesHint}
      </p>
      <ul
        role="radiogroup"
        aria-label={copy.languages}
        className="border-border divide-border/60 bg-surface-raised mt-3 divide-y overflow-hidden rounded-xl border"
      >
        {languages.map((language) => {
          const selected = language.tag === settings.language;
          return (
            <li key={language.tag}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setSetting("language", language.tag);
                  toast.success(language.name);
                }}
                className={`focus-ring flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                  selected ? "bg-accent/15" : "hover:bg-surface-hover"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {language.name}
                  </span>
                  {/* Only where it says something the name does not — a row
                      reading "English (UK) / English (UK)" is noise. */}
                  {language.english !== language.name && (
                    <span className="text-muted-foreground mt-0.5 block text-[11px]">
                      {language.english}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {language.tag}
                </span>
                {selected && (
                  <Check
                    className="text-accent size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const RANGES: { id: ClearOnQuit; label: string; hint: string }[] = [
  {
    id: "history",
    label: content.settings.privacy.clearHistory,
    hint: content.settings.privacy.clearHistoryHint,
  },
  {
    id: "everything",
    label: content.settings.privacy.clearEverything,
    hint: content.settings.privacy.clearEverythingHint,
  },
];

/**
 * Wiping what browsing left behind.
 *
 * Two ranges rather than a grid of checkboxes: the question people actually
 * arrive with is "how much", and a form with six boxes turns that into six
 * questions they did not ask. The button says what it will do before it does
 * it, and nothing here is undoable, which is why it is the only destructive
 * control in Settings drawn in the negative colour.
 */
export function ClearDataPane(): ReactNode {
  const [range, setRange] = useState<ClearOnQuit>("history");
  const chosen = RANGES.find((entry) => entry.id === range);
  return (
    <div className="p-4">
      <p className="text-muted-foreground text-xs text-pretty">
        {content.settings.privacy.clearHint}
      </p>
      <ul
        role="radiogroup"
        aria-label={copy.clearData}
        className="border-border divide-border/60 bg-surface-raised mt-3 divide-y overflow-hidden rounded-xl border"
      >
        {RANGES.map((entry) => {
          const selected = entry.id === range;
          return (
            <li key={entry.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRange(entry.id)}
                className={`focus-ring flex w-full items-start gap-3 px-3 py-2.5 text-left ${
                  selected ? "bg-accent/15" : "hover:bg-surface-hover"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {entry.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                    {entry.hint}
                  </span>
                </span>
                {selected && (
                  <Check
                    className="text-accent mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() =>
          toast.success(content.settings.privacy.clearDone, {
            description: chosen?.label,
          })
        }
        className="focus-ring bg-negative mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {content.settings.privacy.clearNow}
      </button>
    </div>
  );
}
