"use client";

/**
 * "Essential Nexus Extensions" — the same ranked-row shape, for the one other
 * thing this browser connects that is not a HubApp.
 *
 * No "See All": the whole catalogue is two extensions, TumbleUpon and uBlock
 * Origin, which is the honest count for a Chromium browser that already
 * builds most of what an extension is usually reached for into the shell
 * itself — see the note in lib/data/extensions.ts. A "See All" pointing at a
 * page with nothing more on it would be a control that answers its own
 * question before you press it.
 */

import { PRIMARY_CTA } from "@/components/hub/cta";
import { content, type BrowserExtension } from "@/lib/data";
import {
  extensionIsOn,
  removeExtension,
  restoreExtension,
  useInstalledExtensions,
} from "@/lib/extensions-store";
import type { ReactNode } from "react";

/** The extension's own mark: its letters, in its own colours. Mirrors the
    same small badge ExtensionsPage draws, kept local since it is three lines. */
function Mark({ extension }: { extension: BrowserExtension }): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-xl text-base font-bold"
      style={{
        background: extension.mark.background,
        color: extension.mark.color,
      }}
    >
      {extension.mark.letters}
    </span>
  );
}

export function ExtensionRow({
  extensions,
}: {
  extensions: BrowserExtension[];
}): ReactNode {
  const copy = content.appStore;
  const installed = useInstalledExtensions();
  if (extensions.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">
        {content.library.apps.extensionsTitle}
      </h2>
      {/* One column below `lg` (a laptop-width window doesn't have room
          to spare for two side by side), two from there, three once a
          monitor is wide enough that a third row of the same content
          isn't reading as cramped either. */}
      <div className="divide-border/60 grid divide-y lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0 2xl:grid-cols-3">
        {extensions.map((extension) => {
          const on = installed.some((entry) => entry.id === extension.id);
          const wasRemoved = !on && !extensionIsOn(extension.id);
          return (
            <div
              key={extension.id}
              // `min-w-0`: a grid item's implicit min-width is its content's,
              // not the track's — without this, a row too wide for its
              // column grows the column to match instead of handing the
              // overflow to the name/blurb's own `truncate` below.
              className="lg:border-border/60 flex min-w-0 items-center gap-3 border-b py-2.5"
            >
              <Mark extension={extension} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {extension.name}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {extension.blurb}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  on ? removeExtension(extension.id) : restoreExtension(extension.id)
                }
                aria-label={`${on ? copy.installHint : "Get"} ${extension.name}`}
                className={`focus-ring shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  on
                    ? "bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative transition-colors"
                    : PRIMARY_CTA
                }`}
              >
                {on ? "Added" : wasRemoved ? "Get" : copy.installHint}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
