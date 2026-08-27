"use client";

/**
 * The window the app is drawn in, as the renderer sees it.
 *
 * Only the desktop shell provides this. In a browser tab, and during the server
 * render, `platform` is null and every caller treats that as "no title bar to
 * draw" rather than as an error.
 *
 * @see apps/desktop/src/preload-chrome.cjs — the other half of this bridge
 */

import { useEffect, useState, useSyncExternalStore } from "react";

export type WindowAction = "minimize" | "toggle-maximize" | "close";

interface WindowBridge {
  platform: string;
  titleBarHeight: number;
  action: (
    action: WindowAction
  ) => Promise<{ ok: boolean; maximized?: boolean; error?: string }>;
  onFullscreen: (callback: (value: boolean) => void) => () => void;
  onMaximized: (callback: (value: boolean) => void) => () => void;
}

function bridge(): WindowBridge | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { nexusWindow?: WindowBridge }).nexusWindow ?? null
  );
}

export interface DesktopWindow {
  /** "darwin" | "win32" | "linux", or null outside the shell */
  platform: string | null;
  /** true where this build draws its own minimise/maximise/close */
  ownsControls: boolean;
  fullscreen: boolean;
  maximized: boolean;
  run: (action: WindowAction) => void;
}

/*
 * The platform, as an external value React reads rather than one it holds.
 *
 * The bridge is injected by a preload that has not run during the server
 * render, so reading it while rendering the server pass would make the first
 * client paint disagree with the HTML and hydration would tear. Null is the
 * honest server-side answer, and it is also the right answer in a plain
 * browser.
 *
 * `useSyncExternalStore` rather than state filled in by an effect: the value
 * never changes once the window exists, so there is nothing to subscribe to and
 * an effect that only ever calls setState once is a cascading render for a
 * constant. This is the shape React provides for exactly this — a value the
 * server cannot see and the client can.
 */
function subscribePlatform(): () => void {
  return () => {};
}

function platformSnapshot(): string | null {
  return bridge()?.platform ?? null;
}

function serverPlatform(): null {
  return null;
}

export function useDesktopWindow(): DesktopWindow {
  const platform = useSyncExternalStore(
    subscribePlatform,
    platformSnapshot,
    serverPlatform
  );
  /* These two do change, and only the shell can say when. Set from the
     subscription's callback, which is what an effect is for. */
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const api = bridge();
    if (!api) return;
    /* Both return an unsubscribe, which is what keeps a development
       double-mount from stacking listeners until Electron complains. */
    const offFullscreen = api.onFullscreen(setFullscreen);
    const offMaximized = api.onMaximized(setMaximized);
    return () => {
      offFullscreen();
      offMaximized();
    };
  }, []);

  /*
   * Reflected onto the document so CSS can answer for itself.
   *
   * The traffic-light inset is a stylesheet concern — see globals.css — and a
   * component passing it down as a prop would mean every layer between here and
   * the bar had to know about macOS.
   */
  useEffect(() => {
    if (!platform) return;
    const root = document.documentElement;
    root.dataset["platform"] = platform;
    root.dataset["fullscreen"] = String(fullscreen);
    return () => {
      delete root.dataset["platform"];
      delete root.dataset["fullscreen"];
    };
  }, [platform, fullscreen]);

  return {
    platform,
    ownsControls:
      platform !== null && platform !== "darwin" && platform !== "win32",
    fullscreen,
    maximized,
    run: (action) => {
      void bridge()
        ?.action(action)
        .then((result) => {
          if (result.ok && typeof result.maximized === "boolean") {
            setMaximized(result.maximized);
          }
        });
    },
  };
}
