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
  tumbleConnectionHandles,
} from "@/lib/data";
import {
  addPerson,
  connectionHandles,
  dropPerson,
  unblockApp,
  unblockCategory,
  useTumble,
} from "@/lib/tumbleupon-store";
import {
  ProfileActionsProvider,
  ProfileActionsRow,
} from "@/components/apps/messages/profile-hovercard";
import { useProfileQuickActions } from "@/components/apps/messages/use-profile-actions";
import {
  extensionIsOn,
  removeExtension,
  setExtensionEnabled,
  useInstalledExtensions,
} from "@/lib/extensions-store";
import { toast } from "sonner";
import {
  ChevronDown,
  ExternalLink,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

const copy = content.tumbleupon;
const extCopy = content.extensions;

/**
 * A section you can fold away.
 *
 * Open by default, because a page whose contents you have to unfold before you
 * can see any of them is a page that has hidden itself. Folding is for the
 * parts you have finished with — the muted list once you have put things back,
 * the people once you know who is there.
 *
 * The count sits in the header so a folded section still says how much is
 * behind it; "Likes" closed and "Likes 7" closed are different facts.
 */
function Section({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint?: string;
  /** shown beside the title, so a folded section still reports its size */
  count?: number;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-8 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="focus-ring group flex w-full items-center gap-2 rounded-lg text-left"
      >
        <ChevronDown
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
          aria-hidden="true"
        />
        <span className="text-base font-bold">{title}</span>
        {typeof count === "number" && count > 0 && (
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] font-semibold">
            {count}
          </span>
        )}
      </button>
      {hint && open && (
        <p className="text-muted-foreground mt-0.5 pl-6 text-xs text-pretty">
          {hint}
        </p>
      )}
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

/**
 * Adding a handle, without leaving the page to do it.
 *
 * Searches everybody, not only the people already here — the point of the
 * field is to reach somebody who is not. Shows nothing until you type, because
 * a list of six strangers under a search box is a suggestion nobody asked for.
 */
function AddPerson({ already }: { already: string[] }): ReactNode {
  const [query, setQuery] = useState("");

  const found = useMemo(() => {
    const needle = query.trim().replace(/^@/, "").toLowerCase();
    if (!needle) return [];
    return getMessagePeople()
      .filter(
        (person) =>
          !already.includes(person.handle) &&
          (person.handle.toLowerCase().includes(needle) ||
            person.name.toLowerCase().includes(needle))
      )
      .slice(0, 5);
  }, [query, already]);

  return (
    <div className="relative mt-3">
      <div className="border-border bg-surface flex items-center gap-2 rounded-full border px-3 py-1.5">
        <Search
          className="text-muted-foreground size-3.5 shrink-0"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.addPersonPlaceholder}
          aria-label={copy.addPerson}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </div>
      {found.length > 0 && (
        <div className="border-border bg-surface-raised absolute top-full right-0 left-0 z-20 mt-1 rounded-xl border p-1 shadow-2xl">
          {found.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                addPerson(person.handle);
                setQuery("");
                toast.success(`${copy.added} @${person.handle}`);
              }}
              className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left"
            >
              <MemberAvatar person={person} size={20} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">
                  @{person.handle}
                </span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {person.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {query.trim() && found.length === 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          {copy.nobodyMatches}
        </p>
      )}
    </div>
  );
}

export function TumbleUponPage(): ReactNode {
  const tumble = useTumble();
  const actions = useProfileQuickActions();
  const { openLinkInBrowser, activeSpaceId } = useHub();
  const installed = useInstalledExtensions();
  const extension = getExtensions().find((entry) => entry.id === "tumbleupon");
  const present = installed.some((entry) => entry.id === "tumbleupon");
  const on = extensionIsOn("tumbleupon");
  /* Seeded, less what has been dropped, plus what has been added — see
     `connectionHandles`. Read through the store so a removal here is the same
     removal the toolbar's share list sees. */
  const people = getTumbleConnections(
    connectionHandles(tumbleConnectionHandles())
  );
  const catalogue = getTumbleCatalogue();
  const liked = catalogue.filter((app) => tumble.liked.includes(app.slug));
  const mutedApps = catalogue.filter((app) =>
    tumble.blockedApps.includes(app.slug)
  );

  /* The row on each card is the shell's, and it needs the shell's handlers —
     without the provider it renders the one action that needs none, which is a
     card offering only "follow" and looking broken beside every other card in
     the app. Messages and the Timeline wrap it the same way. */
  return (
    <ProfileActionsProvider actions={actions}>
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
                      extCopy.removedToast.replace("{name}", extension.name)
                    );
                  }}
                  className="focus-ring border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {extCopy.remove}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openLinkInBrowser(activeSpaceId, extension.site)
                  }
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

          <Section
            title={copy.people}
            hint={copy.peopleHint}
            count={people.length}
          >
            <AddPerson already={people.map((person) => person.handle)} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {people.map((person) => (
                <div
                  key={person.id}
                  className="border-border bg-surface-raised group relative rounded-xl border p-3"
                >
                  <div className="flex items-start gap-3">
                    <MemberAvatar
                      person={person}
                      size={36}
                      className="shrink-0"
                    />
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
                  {/* The same row the hovercard carries, from the same component.
                    A card about a person that offers a different set of things
                    to do with them than every other card about a person is a
                    card people have to read twice. */}
                  <div className="border-border/60 mt-3 border-t pt-2">
                    <ProfileActionsRow person={person} />
                  </div>
                  {/* Top-right, on hover, the way the rail's tiles do it. Always
                    in the DOM so a keyboard can reach it. */}
                  <button
                    type="button"
                    onClick={() => {
                      dropPerson(person.handle);
                      toast.success(`${copy.removed} @${person.handle}`);
                    }}
                    aria-label={`${copy.removePerson} @${person.handle}`}
                    className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-negative absolute top-2 right-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title={copy.likes}
            hint={copy.likesHint}
            count={liked.length}
          >
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

          <Section
            title={copy.muted}
            hint={copy.mutedHint}
            count={mutedApps.length + tumble.blockedCategories.length}
          >
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

          <Section title={copy.sentTitle} count={tumble.sent.length}>
            {tumble.sent.length === 0 ? (
              <p className="text-muted-foreground text-sm">{copy.sentEmpty}</p>
            ) : (
              <div className="border-border divide-border/60 bg-surface-raised divide-y overflow-hidden rounded-xl border">
                {tumble.sent.map((entry, index) => {
                  const person = getMessagePeople().find(
                    (candidate) => candidate.handle === entry.toPersonId
                  );
                  const app = catalogue.find(
                    (candidate) => candidate.slug === entry.appSlug
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
    </ProfileActionsProvider>
  );
}
