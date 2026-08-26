"use client";

/**
 * TumbleUpon's own page: who you tumble with, and what you have said.
 *
 * The extension's details screen, reached from Connections in the toolbar and
 * from Details in the extensions manager. Four sections, all of them things the
 * toolbar can only hint at — the toolbar is a row of buttons, and a row of
 * buttons has nowhere to show you six people or a list of what you muted.
 *
 * @see components/apps/browser/tumble-bar.tsx
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { EcosystemMark } from "@/components/apps/messages/ecosystem-tag";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getExtensions,
  getMessagePeople,
  getTumbleCatalogue,
  getTumbleConnections,
  storeCategories,
} from "@/lib/data";
import {
  unblockApp,
  unblockCategory,
  useTumble,
} from "@/lib/tumbleupon-store";
import {
  extensionIsOn,
  removeExtension,
  setExtensionEnabled,
  useInstalledExtensions,
} from "@/lib/extensions-store";
import { toast } from "sonner";
import { ExternalLink, Send, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.tumbleupon;
const extCopy = content.extensions;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-base font-bold">{title}</h2>
      {hint && (
        <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
          {hint}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function TumbleUponPage(): ReactNode {
  const tumble = useTumble();
  const { openLinkInBrowser, activeSpaceId } = useHub();
  const installed = useInstalledExtensions();
  const extension = getExtensions().find((entry) => entry.id === "tumbleupon");
  const present = installed.some((entry) => entry.id === "tumbleupon");
  const on = extensionIsOn("tumbleupon");
  const people = getTumbleConnections();
  const catalogue = getTumbleCatalogue();
  const liked = catalogue.filter((app) => tumble.liked.includes(app.slug));
  const mutedApps = catalogue.filter((app) =>
    tumble.blockedApps.includes(app.slug),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-start gap-4">
          {extension && (
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
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{copy.detailsTitle}</h1>
            <p className="text-muted-foreground mt-1 text-sm text-pretty">
              {copy.tagline}
            </p>
            {extension && (
              <p className="text-muted-foreground mt-1 text-xs">
                {extCopy.version} {extension.version}
              </p>
            )}
          </div>
        </header>

        {/* The same row every other extension's page carries. This one has more
            to show underneath it, which is not a reason for it to be the one
            page you cannot turn its extension off from. */}
        {extension &&
          (present ? (
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExtensionEnabled(extension.id, !on)}
                className="focus-ring border-border hover:bg-surface-hover rounded-full border px-3.5 py-1.5 text-xs font-semibold"
              >
                {on ? extCopy.turnOff : extCopy.turnOn}
              </button>
              <button
                type="button"
                onClick={() => {
                  removeExtension(extension.id);
                  toast.success(
                    extCopy.removedToast.replace("{name}", extension.name),
                  );
                }}
                className="focus-ring border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {extCopy.remove}
              </button>
              <button
                type="button"
                onClick={() => openLinkInBrowser(activeSpaceId, extension.site)}
                className="focus-ring text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {extCopy.homepage}
              </button>
            </div>
          ) : (
            <p className="border-border text-muted-foreground mt-5 rounded-xl border border-dashed p-4 text-sm">
              {extCopy.removedNote}
            </p>
          ))}

        <Section title={copy.people} hint={copy.peopleHint}>
          <div className="grid gap-3 sm:grid-cols-2">
            {people.map((person) => (
              <div
                key={person.id}
                className="border-border bg-surface-raised flex items-start gap-3 rounded-xl border p-3"
              >
                <MemberAvatar person={person} size={36} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {person.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 flex items-center truncate font-mono text-[11px]">
                    {`@${person.handle}@`}
                    <EcosystemMark
                      ecosystem={person.ecosystem}
                      size={11}
                      className="mx-0.5"
                    />
                    nexus.free
                  </p>
                  {person.role && (
                    <p className="text-muted-foreground mt-1 truncate text-[11px]">
                      {person.role}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title={copy.likes} hint={copy.likesHint}>
          {liked.length === 0 ? (
            <p className="text-muted-foreground text-sm">{copy.likesEmpty}</p>
          ) : (
            <div className="border-border divide-border/60 bg-surface-raised divide-y overflow-hidden rounded-xl border">
              {liked.map((app) => (
                <button
                  key={app.slug}
                  type="button"
                  onClick={() =>
                    app.web && openLinkInBrowser(activeSpaceId, app.web.url)
                  }
                  className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {app.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {app.tagline}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title={copy.muted} hint={copy.mutedHint}>
          {mutedApps.length === 0 && tumble.blockedCategories.length === 0 ? (
            <p className="text-muted-foreground text-sm">{copy.mutedEmpty}</p>
          ) : (
            <div className="border-border divide-border/60 bg-surface-raised divide-y overflow-hidden rounded-xl border">
              {mutedApps.map((app) => (
                <div
                  key={app.slug}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-sm">{app.name}</span>
                  <button
                    type="button"
                    onClick={() => unblockApp(app.slug)}
                    className="focus-ring border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  >
                    <Undo2 className="size-3" aria-hidden="true" />
                    {copy.restore}
                  </button>
                </div>
              ))}
              {tumble.blockedCategories.map((category) => {
                const label =
                  storeCategories.find((entry) => entry.id === category)
                    ?.label ?? category;
                return (
                  <div
                    key={category}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 text-sm">{label}</span>
                    <button
                      type="button"
                      onClick={() => unblockCategory(category)}
                      className="focus-ring border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    >
                      <Undo2 className="size-3" aria-hidden="true" />
                      {copy.restore}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title={copy.sentTitle}>
          {tumble.sent.length === 0 ? (
            <p className="text-muted-foreground text-sm">{copy.sentEmpty}</p>
          ) : (
            <div className="border-border divide-border/60 bg-surface-raised divide-y overflow-hidden rounded-xl border">
              {tumble.sent.map((entry, index) => {
                const person = getMessagePeople().find(
                  (candidate) => candidate.handle === entry.toPersonId,
                );
                const app = catalogue.find(
                  (candidate) => candidate.slug === entry.appSlug,
                );
                return (
                  <div
                    key={`${entry.toPersonId}-${entry.appSlug}-${index}`}
                    className="flex items-start gap-3 px-3 py-2.5"
                  >
                    <Send
                      className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="min-w-0 flex-1 text-xs text-pretty">
                      <span className="font-mono font-semibold">
                        @{person?.handle ?? entry.toPersonId}
                      </span>{" "}
                      · {app?.name ?? entry.appSlug}
                      {entry.message && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {entry.message}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {extension && (
          <Section title={copy.permissions}>
            <ul className="border-border divide-border/60 bg-surface-raised divide-y overflow-hidden rounded-xl border">
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
          </Section>
        )}
      </div>
    </div>
  );
}
