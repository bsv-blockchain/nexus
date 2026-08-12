"use client";

import { useIsDesktop } from "@/lib/use-is-desktop";
import { ColorPicker } from "@/components/hub/color-picker";
import { useCustomTheme } from "@/components/hub/theme-provider";
import { content } from "@/lib/data";
import { themeGradient } from "@/lib/theme";
import { SpaceIcon } from "@/components/hub/space-icon";
import { useHub } from "@/components/hub/hub-provider";
import { Check, Moon, Palette, RotateCcw, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

const MODES: { n: number; key: "solid" | "gradient2" | "gradient3" }[] = [
  { n: 1, key: "solid" },
  { n: 2, key: "gradient2" },
  { n: 3, key: "gradient3" },
];

/** The wheel's main bullet colour within a theme's stops (2–3 stops store it at index 1). */
function mainColorOf(colors: string[]): string | undefined {
  if (colors.length <= 1) return colors[0];
  return colors[1] ?? colors[0];
}

/** Trigger position + viewport size, captured at click (avoids render-time window reads). */
export interface ThemeAnchor {
  left: number;
  top: number;
  vw: number;
  vh: number;
}

/**
 * Light or dark, as a pair of icons rather than a switch.
 *
 * They are mutually exclusive, so it is a radio group: a switch would imply one
 * of them is "on" and the other is the absence of it, and neither is the
 * default any more than the other. Sitting in the theme panel because that is
 * where someone goes when they are thinking about how the app looks.
 *
 * Picking one is picking the whole default theme, not just the mode. Setting a
 * profile to Dark while it keeps a custom palette gives you a dark version of
 * somebody's orange, which is neither what they chose nor what this button
 * says. So the palette goes back to the default with it — and because that
 * throws away work, the toast can put it back.
 */
function ModeToggle({ spaceId }: { spaceId: string }): ReactNode {
  const copy = content.theme;
  const { resolvedTheme } = useTheme();
  const { profileMode, setProfileMode, profileTheme, setProfileTheme, preview } =
    useCustomTheme();
  // What this profile is set to, falling back to what is on screen for a
  // profile that has never been given one.
  const current = profileMode(spaceId) ?? resolvedTheme;
  const modes: { key: "light" | "dark"; label: string; icon: ReactNode }[] = [
    { key: "light", label: copy.light, icon: <Sun className="size-3.5" /> },
    { key: "dark", label: copy.dark, icon: <Moon className="size-3.5" /> },
  ];

  const pick = (mode: "light" | "dark", label: string): void => {
    const previous = profileTheme(spaceId);
    setProfileMode(spaceId, mode);
    /* A half-applied preview would survive the reset and repaint the profile
       the moment the pointer moved. */
    preview(null);
    setProfileTheme(spaceId, null);
    toast.success(label, {
      description: copy.modeReset,
      ...(previous
        ? {
            action: {
              label: content.hub.undo,
              onClick: () => setProfileTheme(spaceId, previous),
            },
          }
        : {}),
    });
  };
  return (
    <div
      role="radiogroup"
      aria-label={copy.mode}
      className="flex shrink-0 gap-0.5 rounded-full bg-surface p-0.5 ring-1 ring-border"
    >
      {modes.map((mode) => {
        const on = current === mode.key;
        return (
          <button
            key={mode.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={mode.label}
            title={mode.label}
            onClick={() => pick(mode.key, mode.label)}
            className={`focus-ring grid size-6 place-items-center rounded-full transition-colors ${
              on
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode.icon}
          </button>
        );
      })}
    </div>
  );
}

function ThemePicker({
  spaceId,
  anchor,
  onClose,
}: {
  spaceId: string;
  anchor: ThemeAnchor | null;
  onClose: () => void;
}): ReactNode {
  const { saved, profileTheme, preview, setProfileTheme, saveToLibrary, removeSaved } =
    useCustomTheme();
  const initial = profileTheme(spaceId);
  const copy = content.theme;
  const { spaces } = useHub();
  const space = spaces.find((s) => s.id === spaceId);
  const isDesktop = useIsDesktop();
  const [stops, setStops] = useState(initial?.length ?? 1);
  const [colors, setColors] = useState<string[]>(initial ?? []);
  const [name, setName] = useState("");
  const [interacted, setInteracted] = useState(false);
  // Remount the wheel (new key) at a given colour when a preset is applied.
  const [pickerKey, setPickerKey] = useState(0);
  const [pickerColor, setPickerColor] = useState<string | undefined>(
    initial ? mainColorOf(initial) : undefined,
  );

  // Anchor the desktop popover just above the trigger button (pure from anchor).
  const desktopPos =
    isDesktop && anchor
      ? {
          left: Math.max(12, Math.min(anchor.left, anchor.vw - 312)),
          bottom: anchor.vh - anchor.top + 8,
        }
      : null;

  // Live-apply the picked colours once the user engages — targeted at the
  // profile being edited (previews on its column, not necessarily the chrome).
  useEffect(() => {
    if (interacted && colors.length) preview(colors, spaceId);
  }, [interacted, colors, preview, spaceId]);

  const close = (): void => {
    preview(null); // discard live preview → chrome reverts to the active profile
    onClose();
  };

  /*
   * Colours commit as they are chosen.
   *
   * A colour picker with a Save button asks the user to hold "what it looks
   * like" and "whether it is kept" apart, when the whole interaction is
   * looking at it. The button stays, as a readout: it says Saved once there is
   * something saved, and it is what adds the palette to the library under a
   * name when one is typed.
   */
  useEffect(() => {
    if (!interacted || !colors.length) return;
    setProfileTheme(spaceId, colors);
  }, [interacted, colors, setProfileTheme, spaceId]);

  // Naming a palette is the one deliberate act left: it puts it in the library.
  const onSave = (): void => {
    if (!colors.length) return;
    setProfileTheme(spaceId, colors);
    saveToLibrary(name, colors);
    setName("");
  };

  // Reset: clear this profile's theme (back to the default palette).
  const onReset = (): void => {
    setInteracted(false);
    setProfileTheme(spaceId, null);
    preview(null);
  };

  const panelBase =
    "z-70 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";
  const panelClass = isDesktop
    ? `fixed w-[300px] rounded-2xl ${panelBase}`
    : `fixed inset-x-0 bottom-0 top-12 rounded-t-3xl ${panelBase}`;

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close"
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-65 ${isDesktop ? "cursor-default" : "bg-black/40"}`}
      />
      <motion.div
        role="dialog"
        aria-label={copy.title}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(desktopPos
          ? { style: { left: desktopPos.left, bottom: desktopPos.bottom } }
          : {})}
        // The picker renders inside a profile column whose onClick activates the
        // profile for any non-button target. Dragging the colour-wheel bullet (a
        // div) synthesises a click that would bubble up and activate → remove the
        // column from the manager and close the picker (which read as "the theme
        // never applied to the column"). Contain clicks so wheel interaction only
        // previews — never activates or closes.
        onClick={(event) => event.stopPropagation()}
        className={panelClass}
      >
        {!isDesktop && (
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center gap-2">
            {/* The profile's own icon, not a palette. The palette is the
                button that opened this; repeating it in the heading says
                "colours" to somebody already looking at colours, where naming
                the profile says whose. */}
            <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold">
              {space && (
                <SpaceIcon value={space.emoji} size={16} className="shrink-0" />
              )}
              <span className="min-w-0 truncate">
                {space ? `${space.name} ${copy.ofTheme}` : copy.title}
              </span>
            </h2>
            <ModeToggle spaceId={spaceId} />
          </div>

          {/* Solid / 2-colour / 3-colour */}
          <div className="mb-4 flex gap-1 rounded-full bg-surface p-1 text-xs font-medium ring-1 ring-border">
            {MODES.map((mode) => {
              const on = stops === mode.n;
              return (
                <button
                  key={mode.n}
                  type="button"
                  onClick={() => {
                    setStops(mode.n);
                    setInteracted(true);
                  }}
                  aria-pressed={on}
                  className={`focus-ring flex-1 rounded-full px-2 py-1.5 transition-colors ${
                    on
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {copy[mode.key]}
                </button>
              );
            })}
          </div>

          <ColorPicker
            key={pickerKey}
            numPoints={stops}
            size={isDesktop ? 220 : 260}
            initialColor={pickerColor}
            onColorChange={setColors}
            onInteract={() => setInteracted(true)}
          />

          {/* Live preview of the current colour(s) */}
          <div
            className="mt-4 h-7 rounded-lg ring-1 ring-border"
            style={{ background: themeGradient(colors) }}
            aria-hidden="true"
          />

          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder={copy.namePlaceholder}
              aria-label={copy.namePlaceholder}
              className="focus-ring min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={onSave}
              disabled={!name.trim()}
              /* Enabled only with a name, because that is all it does now. */
              className="focus-ring shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-40"
            >
              {name.trim() ? copy.save : interacted ? copy.saved : copy.save}
            </button>
            <button
              type="button"
              onClick={onReset}
              aria-label={copy.reset}
              title={copy.reset}
              className="focus-ring shrink-0 rounded-lg bg-surface p-2 ring-1 ring-border hover:bg-surface-hover"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Saved themes */}
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
              {copy.savedTitle}
            </h3>
            {saved.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                {copy.noneSaved}
              </p>
            ) : (
              <ul className="space-y-1">
                {saved.map((theme) => (
                  <li key={theme.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileTheme(spaceId, theme.colors);
                        preview(theme.colors, spaceId);
                        setStops(theme.colors.length);
                        setColors(theme.colors);
                        setInteracted(false);
                        setPickerColor(mainColorOf(theme.colors));
                        setPickerKey((k) => k + 1);
                      }}
                      className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover"
                    >
                      <span
                        className="size-5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                        style={{ background: themeGradient(theme.colors) }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {theme.name}
                      </span>
                      {colors.join(",") === theme.colors.join(",") && (
                        <Check
                          className="size-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSaved(theme.id)}
                      aria-label={`${copy.delete} ${theme.name}`}
                      className="focus-ring shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-negative"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/**
 * Palette button that opens the theme picker for a specific profile (popover on
 * desktop, bottom sheet on mobile). The active profile's theme drives the chrome.
 */
export function ThemeButton({
  spaceId,
  className = "focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
}: {
  spaceId: string;
  className?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<ThemeAnchor | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label={content.theme.button}
        aria-expanded={open}
        onClick={(e) => {
          // Open the picker for this profile. The picker previews the edit onto
          // its own column, so there's no need to activate it first (activating
          // would drop it out of the Profiles manager and close the picker).
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({
            left: r.left,
            top: r.top,
            vw: window.innerWidth,
            vh: window.innerHeight,
          });
          setOpen(true);
        }}
        className={className}
      >
        <Palette className="size-4" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <ThemePicker
            spaceId={spaceId}
            anchor={anchor}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
