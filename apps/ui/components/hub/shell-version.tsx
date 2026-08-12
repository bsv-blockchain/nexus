"use client";

import { useEffect, useState } from "react";

/**
 * The version users quote in bug reports.
 *
 * The number is the SHELL's — asked over the bridge, not baked into this bundle —
 * because tools/version.mjs stamps every platform's metadata with one value per
 * release, and the shell manifest is where that value actually ships. The chrome
 * displaying its own package.json would show whatever the export was built from,
 * which can drift from the app that wraps it.
 *
 * Renders nothing without a host (plain-browser dev): there is no meaningful
 * version to report a bug against.
 */

type HostInfo = { version?: string; shell?: string; platform?: string };

export function ShellVersion({ className = "" }: { className?: string }) {
  const [info, setInfo] = useState<HostInfo | null>(null);

  useEffect(() => {
    let alive = true;
    const ask = () => {
      const host = (window as unknown as {
        nexusHost?: { info?: () => Promise<HostInfo> };
      }).nexusHost;
      if (!host?.info) return false;
      host
        .info()
        .then((i) => {
          if (alive) setInfo(i);
        })
        .catch(() => {
          // A shell that cannot answer host.info has bigger problems than a missing
          // version label; stay blank rather than show something wrong.
        });
      return true;
    };
    // Check-then-subscribe, in that order: Android's WebView injects the host
    // client asynchronously (the documented react-native-webview onPageStarted
    // race), so nexusHost can appear AFTER this mount. Both shells fire
    // nexushost:ready for exactly this case; a mount-only check would leave the
    // label permanently blank whenever injection loses the race.
    if (ask()) return () => { alive = false; };
    const onReady = () => void ask();
    window.addEventListener("nexushost:ready", onReady, { once: true });
    return () => {
      alive = false;
      window.removeEventListener("nexushost:ready", onReady);
    };
  }, []);

  if (!info?.version) return null;

  return (
    <span
      /* Never truncated. The whole job of this label is to be a version number
         somebody can read into a bug report, and "v..." does not do that job —
         better to render nothing than a string that has lost the part that
         matters. Callers give it a line wide enough or do not render it. */
      className={`shrink-0 whitespace-nowrap select-text text-[10px] tabular-nums text-muted-foreground/70 ${className}`}
      title={`Nexus v${info.version} — ${info.shell ?? "?"}/${info.platform ?? "?"}`}
    >
      v{info.version}
    </span>
  );
}
