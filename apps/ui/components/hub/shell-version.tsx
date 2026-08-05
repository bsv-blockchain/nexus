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
    const host = (window as unknown as {
      nexusHost?: { info?: () => Promise<HostInfo> };
    }).nexusHost;
    if (!host?.info) return;
    let alive = true;
    host
      .info()
      .then((i) => {
        if (alive) setInfo(i);
      })
      .catch(() => {
        // A shell that cannot answer host.info has bigger problems than a missing
        // version label; stay blank rather than show something wrong.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!info?.version) return null;

  return (
    <span
      className={`select-text text-[10px] tabular-nums text-muted-foreground/70 ${className}`}
      title={`Nexus v${info.version} — ${info.shell ?? "?"}/${info.platform ?? "?"}`}
    >
      v{info.version}
    </span>
  );
}
