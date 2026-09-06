"use client";

/**
 * What is known about one extension, on its own page.
 *
 * Built from the fixture and nothing else: the name, the blurb, the version,
 * what it asked for at install, what it can be given a chord for, and where it
 * came from. That is a short page, and short is the honest length — a details
 * screen padded out with invented sections is a screen that reads as a feature
 * until somebody looks at it.
 *
 * TumbleUpon has its own page instead, because it has a social graph and a
 * history to show; see components/apps/tumbleupon-page.tsx.
 */

import { useHub } from "@/components/hub/hub-provider";
import { content, type BrowserExtension } from "@/lib/data";
import {
  extensionIsOn,
  removeExtension,
  setExtensionEnabled,
  useInstalledExtensions,
} from "@/lib/extensions-store";
import { ExternalLink, Keyboard, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

const copy = content.extensions;

export function ExtensionDetailPage({
  extension,
}: {
  extension: BrowserExtension;
}): ReactNode {
  const { openLinkInBrowser, activeSpaceId } = useHub();
  const installed = useInstalledExtensions();
  const present = installed.some((entry) => entry.id === extension.id);
  const on = extensionIsOn(extension.id);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-2xl text-xl font-bold"
            style={{
              background: extension.mark.background,
              color: extension.mark.color,
            }}
          >
            {extension.mark.letters}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{extension.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">
              {extension.blurb}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {copy.version} {extension.version}
            </p>
          </div>
        </header>

        {!present ? (
          <p className="border-border text-muted-foreground mt-6 rounded-xl border border-dashed p-4 text-sm">
            {copy.removedNote}
          </p>
        ) : (
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExtensionEnabled(extension.id, !on)}
              className="focus-ring border-border hover:bg-surface-hover rounded-full border px-3.5 py-1.5 text-xs font-semibold"
            >
              {on ? copy.turnOff : copy.turnOn}
            </button>
            <button
              type="button"
              onClick={() => {
                removeExtension(extension.id);
                toast.success(
                  copy.removedToast.replace("{name}", extension.name),
                );
              }}
              className="focus-ring border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {copy.remove}
            </button>
            <button
              type="button"
              onClick={() => openLinkInBrowser(activeSpaceId, extension.site)}
              className="focus-ring text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {copy.homepage}
            </button>
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-base font-bold">{copy.permissionsTitle}</h2>
          <ul className="border-border divide-border/60 bg-surface-raised mt-3 divide-y overflow-hidden rounded-xl border">
            {extension.permissions.map((permission) => (
              <li
                key={permission}
                className="flex items-start gap-2.5 px-3 py-2.5 text-xs"
              >
                <ShieldCheck
                  className="text-muted-foreground mt-px size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {permission}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-bold">{copy.shortcuts}</h2>
          <ul className="border-border divide-border/60 bg-surface-raised mt-3 divide-y overflow-hidden rounded-xl border">
            {extension.commands.map((command) => (
              <li
                key={command}
                className="flex items-center gap-3 px-3 py-2.5 text-xs"
              >
                <Keyboard
                  className="text-muted-foreground size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">{command}</span>
                <span className="text-muted-foreground">{copy.notSet}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
