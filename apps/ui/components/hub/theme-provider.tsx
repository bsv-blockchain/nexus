"use client";

import { useHub } from "@/components/hub/hub-provider";
import { useTheme } from "next-themes";
import {
  derivePalette,
  gradientStops,
  paletteVars,
  type CustomTheme,
} from "@/lib/theme";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const SAVED_KEY = "nexus.theme.saved";
const BY_PROFILE_KEY = "nexus.theme.byProfile";
const MODE_KEY = "nexus.theme.modeByProfile";

interface CustomThemeContextValue {
  /** user-saved named themes — a reusable palette library across profiles */
  saved: CustomTheme[];
  /** the colour stops assigned to a profile, or null for the default palette */
  profileTheme: (spaceId: string) => string[] | null;
  /**
   * Light or dark for one profile, or null where it has never been set and the
   * profile follows the system.
   */
  profileMode: (spaceId: string) => "light" | "dark" | null;
  /** `null` clears it, which hands the profile back to the system setting */
  setProfileMode: (spaceId: string, mode: "light" | "dark" | null) => void;
  /**
   * Live-apply colours without committing (null clears). Pass a spaceId to
   * target a specific profile — the chrome only previews when the target is the
   * active profile, and [[previewFor]] lets a profile column preview its own edit.
   */
  preview: (colors: string[] | null, spaceId?: string) => void;
  /** the live-preview colours currently targeting `spaceId`, or null */
  previewFor: (spaceId: string) => string[] | null;
  /** assign (or clear) a profile's theme; the active profile drives the chrome */
  setProfileTheme: (spaceId: string, colors: string[] | null) => void;
  /** add a named theme to the reusable library */
  saveToLibrary: (name: string, colors: string[]) => void;
  /** remove a saved library theme */
  removeSaved: (id: string) => void;
}

const Ctx = createContext<CustomThemeContextValue | null>(null);

export function useCustomTheme(): CustomThemeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useCustomTheme must be used within a CustomThemeProvider");
  return ctx;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `theme-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Representative stop used for the profile dot (middle-ish). */
function repColor(colors: string[]): string {
  return colors[Math.floor((colors.length - 1) / 2)] ?? colors[0] ?? "#4353ff";
}

export function CustomThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { activeSpaceId, setSpaceThemeColor } = useHub();
  const { setTheme } = useTheme();
  const [saved, setSaved] = useState<CustomTheme[]>(() =>
    readJSON<CustomTheme[]>(SAVED_KEY, []),
  );
  const [byProfile, setByProfile] = useState<Record<string, string[]>>(() =>
    readJSON<Record<string, string[]>>(BY_PROFILE_KEY, {}),
  );
  const [modeByProfile, setModeByProfile] = useState<
    Record<string, "light" | "dark">
  >(() => readJSON<Record<string, "light" | "dark">>(MODE_KEY, {}));
  const [livePreview, setLivePreview] = useState<{
    colors: string[];
    spaceId?: string;
  } | null>(null);

  // The chrome shows a live preview only when the edit targets the active
  // profile (or is untargeted); editing another profile previews on its column.
  const previewForChrome =
    livePreview &&
    (livePreview.spaceId == null || livePreview.spaceId === activeSpaceId)
      ? livePreview.colors
      : null;
  const effective = previewForChrome ?? byProfile[activeSpaceId] ?? null;
  const key = effective ? effective.join(",") : "";

  useEffect(() => {
    const root = document.documentElement;
    const gradVars = ["--grad-a", "--grad-b", "--grad-c"] as const;
    if (!effective) {
      for (const name of Object.keys(paletteVars(derivePalette(["#4353ff"])))) {
        root.style.removeProperty(name);
      }
      // Fall back to the light/dark backdrop defaults from globals.css.
      for (const name of gradVars) root.style.removeProperty(name);
      root.removeAttribute("data-themed");
      return;
    }
    const palette = derivePalette(effective);
    for (const [name, value] of Object.entries(paletteVars(palette))) {
      root.style.setProperty(name, value);
    }
    const stops = gradientStops(effective);
    gradVars.forEach((name, i) => root.style.setProperty(name, stops[i] ?? ""));
    root.setAttribute("data-themed", palette.dark ? "dark" : "light");
    // key drives re-application when the stops change
  }, [effective, key]);

  // Arm the crossfade one frame after the first theme application, so the
  // initial paint lands instantly and only later switches animate.
  const armed = useRef(false);
  useEffect(() => {
    if (armed.current) return;
    armed.current = true;
    const root = document.documentElement;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.add("theme-animate")),
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  /*
   * A profile's light/dark choice follows it.
   *
   * Light and dark are as much a part of "this is my Work workspace" as its
   * colour is, and a profile that comes back in the wrong one has not really
   * been remembered. Applied on activation rather than only when set, so
   * switching profiles carries it across.
   *
   * A profile with no choice goes back to the system, and that `?? "system"` is
   * load-bearing. Leaving it alone meant it kept whatever the last profile was
   * wearing: set Work to light, switch to a profile that has never been given a
   * mode, and the screen stayed light while the picker — correctly reading an
   * empty setting — showed Match this device. Clicking Light then changed
   * nothing, because light was already on, and the control looked broken.
   */
  const activeMode = modeByProfile[activeSpaceId];
  useEffect(() => {
    setTheme(activeMode ?? "system");
  }, [activeMode, setTheme]);

  const setProfileMode = useCallback(
    (spaceId: string, mode: "light" | "dark" | null) => {
      setModeByProfile((current) => {
        const next = { ...current };
        /* Removed rather than stored as "system": this map is the record of
           profiles that have been given an opinion, and the effect above only
           forces a theme for the ones that have. Writing "system" into it
           would make every profile look decided. */
        if (mode) next[spaceId] = mode;
        else delete next[spaceId];
        writeJSON(MODE_KEY, next);
        return next;
      });
      // Applied at once when it is the profile you are actually looking at.
      // Setting another profile's mode saves it for when you switch to it.
      if (spaceId === activeSpaceId) setTheme(mode ?? "system");
    },
    [activeSpaceId, setTheme],
  );

  const profileMode = useCallback(
    (spaceId: string): "light" | "dark" | null => modeByProfile[spaceId] ?? null,
    [modeByProfile],
  );

  const preview = useCallback((colors: string[] | null, spaceId?: string) => {
    setLivePreview(
      colors && colors.length
        ? spaceId === undefined
          ? { colors }
          : { colors, spaceId }
        : null,
    );
  }, []);

  const previewFor = useCallback(
    (spaceId: string): string[] | null =>
      livePreview && livePreview.spaceId === spaceId ? livePreview.colors : null,
    [livePreview],
  );

  const setProfileTheme = useCallback(
    (spaceId: string, colors: string[] | null) => {
      setByProfile((current) => {
        const next = { ...current };
        if (colors && colors.length) next[spaceId] = colors;
        else delete next[spaceId];
        writeJSON(BY_PROFILE_KEY, next);
        return next;
      });
      // Keep the profile dot in sync with its theme.
      setSpaceThemeColor(spaceId, colors?.length ? repColor(colors) : "#4353ff");
    },
    [setSpaceThemeColor],
  );

  const saveToLibrary = useCallback((name: string, colors: string[]) => {
    const theme: CustomTheme = {
      id: newId(),
      name: name.trim() || "Custom",
      colors,
    };
    setSaved((current) => {
      const next = [...current, theme];
      writeJSON(SAVED_KEY, next);
      return next;
    });
  }, []);

  const removeSaved = useCallback((id: string) => {
    setSaved((current) => {
      const next = current.filter((t) => t.id !== id);
      writeJSON(SAVED_KEY, next);
      return next;
    });
  }, []);

  const profileTheme = useCallback(
    (spaceId: string): string[] | null => byProfile[spaceId] ?? null,
    [byProfile],
  );

  const value = useMemo<CustomThemeContextValue>(
    () => ({
      saved,
      profileTheme,
      profileMode,
      setProfileMode,
      preview,
      previewFor,
      setProfileTheme,
      saveToLibrary,
      removeSaved,
    }),
    [
      saved,
      profileTheme,
      profileMode,
      setProfileMode,
      preview,
      previewFor,
      setProfileTheme,
      saveToLibrary,
      removeSaved,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
