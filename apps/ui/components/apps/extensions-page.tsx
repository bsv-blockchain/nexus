"use client";

/**
 * Extensions, on the canvas the page would have had.
 *
 * A `chrome://extensions` of our own: two views behind a column, a search that
 * filters both, and a developer-mode switch that has nowhere to be but the top
 * right. Chromium's own layout, because this screen is one people have already
 * learned and there is nothing to gain by teaching it again.
 *
 * It replaces the webview rather than opening in a tab. An extension manager is
 * part of the browser, not a site the browser is pointed at — giving it an
 * address bar would invite somebody to navigate away from it and expect to come
 * back with a Back button.
 *
 * @see lib/data/extensions.ts for what is in it, and why there is one
 */

import { content, getExtensions, type BrowserExtension } from "@/lib/data";
import { useHub } from "@/components/hub/hub-provider";
import { Keyboard, Pencil, Puzzle, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

const copy = content.extensions;

type View = "installed" | "shortcuts";

/** An extension's mark: its letters on its own colour. */
function Mark({
  extension,
  size = 40,
}: {
  extension: BrowserExtension;
  size?: number;
}): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-lg font-bold"
      style={{
        width: size,
        height: size,
        background: extension.mark.background,
        color: extension.mark.color,
        fontSize: size * 0.4,
      }}
    >
      {extension.mark.letters}
    </span>
  );
}

/**
 * The switch that turns an extension off without removing it.
 *
 * Off rather than gone is the whole reason this control exists: an extension
 * you are debugging a site against comes back on in one press, where a removed
 * one comes back through a store and a permission prompt.
 */
function Power({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (next: boolean) => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`focus-ring relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-muted-foreground/40"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
          on ? "left-4.5" : "left-0.5"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

function ExtensionCard({
  extension,
  on,
  onToggle,
  onDetails,
  onRemove,
}: {
  extension: BrowserExtension;
  on: boolean;
  onToggle: (next: boolean) => void;
  onDetails: () => void;
  onRemove: () => void;
}): ReactNode {
  return (
    <div className="border-border bg-surface-raised flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Mark extension={extension} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{extension.name}</p>
          <p className="text-muted-foreground mt-1 text-xs text-pretty">
            {extension.blurb}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onDetails}
          className="focus-ring border-border hover:bg-surface-hover rounded-full border px-3.5 py-1.5 text-xs font-semibold"
        >
          {copy.details}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="focus-ring border-border hover:bg-surface-hover rounded-full border px-3.5 py-1.5 text-xs font-semibold"
        >
          {copy.remove}
        </button>
        <span className="flex-1" />
        <Power
          on={on}
          label={`${extension.name} — ${on ? copy.on : copy.off}`}
          onChange={onToggle}
        />
      </div>
    </div>
  );
}

/**
 * What an extension can be given a chord for, and the chord it has.
 *
 * Every one reads "Not set", which is the truth: nothing here binds a key yet.
 * A screen that showed invented bindings would be a screen that lies twice —
 * about what is bound, and about what pressing it would do.
 */
function ShortcutRows({ extension }: { extension: BrowserExtension }): ReactNode {
  return (
    <div className="border-border bg-surface-raised overflow-hidden rounded-xl border">
      <div className="border-border flex items-center gap-2.5 border-b px-4 py-3">
        <Mark extension={extension} size={24} />
        <p className="text-sm font-semibold">{extension.name}</p>
      </div>
      <div className="divide-border/60 divide-y">
        {extension.commands.map((command) => (
          <div
            key={command}
            className="flex flex-wrap items-center gap-3 px-4 py-2.5"
          >
            <p className="w-52 shrink-0 text-sm">{command}</p>
            <span className="bg-muted text-muted-foreground min-w-32 rounded-lg px-3 py-1.5 text-xs">
              {copy.notSet}
            </span>
            <button
              type="button"
              aria-label={`${copy.editShortcut} — ${command}`}
              className="focus-ring text-muted-foreground hover:text-foreground rounded-md p-1"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
            {/* Disabled rather than absent: the clear button is where it will
                be once a chord is set, and a control that appears only after
                you act is a control nobody knows is coming. */}
            <button
              type="button"
              disabled
              aria-label={`${copy.clearShortcut} — ${command}`}
              className="text-muted-foreground/40 rounded-md p-1"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
            <span className="border-border text-muted-foreground ml-auto rounded-lg border px-3 py-1.5 text-xs">
              {copy.inNexus}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExtensionsPage(): ReactNode {
  const { openLinkInBrowser, activeSpaceId } = useHub();
  const extensions = getExtensions();
  const [view, setView] = useState<View>("installed");
  const [query, setQuery] = useState("");
  const [developer, setDeveloper] = useState(false);
  /* Off-state kept here rather than in the fixture: turning an extension off is
     a thing you do to this session, and a fixture that remembered it would be
     a fixture editing itself. */
  const [off, setOff] = useState<string[]>([]);

  const found = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return extensions;
    return extensions.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        entry.blurb.toLowerCase().includes(needle),
    );
  }, [extensions, query]);

  const nav: { id: View; label: string; icon: typeof Puzzle }[] = [
    { id: "installed", label: copy.installed, icon: Puzzle },
    { id: "shortcuts", label: copy.shortcuts, icon: Keyboard },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="border-border/60 flex items-center gap-4 border-b px-5 py-3">
        <h1 className="w-48 shrink-0 text-lg font-bold">{copy.title}</h1>
        <div className="border-border bg-surface mx-auto flex w-full max-w-xl items-center gap-2.5 rounded-full border px-4 py-2">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.search}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-sm">{copy.developerMode}</span>
          <Power
            on={developer}
            label={copy.developerMode}
            onChange={setDeveloper}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={copy.title}
          className="border-border/60 w-56 shrink-0 border-r p-2"
        >
          {nav.map((entry) => {
            const active = entry.id === view;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setView(entry.id)}
                aria-current={active ? "page" : undefined}
                className={`focus-ring mb-0.5 flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-left text-sm font-semibold ${
                  active
                    ? "bg-accent/20 text-foreground"
                    : "hover:bg-surface-hover"
                }`}
              >
                <entry.icon className="size-4 shrink-0" aria-hidden="true" />
                {entry.label}
              </button>
            );
          })}

          {/* Where more come from. Nexus is Chromium underneath, so it is the
              Chrome Web Store — said plainly rather than dressed up as ours,
              because pretending otherwise would not survive the first install. */}
          <div className="border-border/60 mt-3 border-t pt-4">
            <p className="text-muted-foreground px-3.5 text-xs leading-relaxed text-pretty">
              {copy.discover}{" "}
              <button
                type="button"
                onClick={() =>
                  openLinkInBrowser(activeSpaceId, copy.storeUrl)
                }
                className="focus-ring text-accent rounded font-semibold underline underline-offset-2"
              >
                {copy.storeName}
              </button>
            </p>
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {view === "installed" ? (
            <>
              <h2 className="mb-4 text-base font-bold">{copy.allExtensions}</h2>
              {found.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {copy.noneMatch.replace("{query}", query.trim())}
                </p>
              ) : (
                <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
                  {found.map((extension) => (
                    <ExtensionCard
                      key={extension.id}
                      extension={extension}
                      on={!off.includes(extension.id)}
                      onToggle={(next) =>
                        setOff((current) =>
                          next
                            ? current.filter((id) => id !== extension.id)
                            : [...current, extension.id],
                        )
                      }
                      onDetails={() => setQuery("")}
                      onRemove={() => setQuery("")}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="max-w-4xl space-y-4">
              {found.map((extension) => (
                <ShortcutRows key={extension.id} extension={extension} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
