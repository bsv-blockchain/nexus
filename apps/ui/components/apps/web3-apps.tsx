"use client";

import { SiteTile } from "@/components/hub/app-icon";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { displayOrigin } from "@/lib/rail/origin";
import type { PinnedSite } from "@/lib/rail/sites";
import { Globe, Minus, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * One pinned site: its tile, an editable title, its origin, and the one verb.
 *
 * The title field keeps a local draft rather than writing every keystroke
 * straight through. `renamePinnedSite` ignores a blank title on purpose — an
 * empty name is a slip, not an instruction — so a field bound directly to the
 * store cannot be cleared: the store refuses the empty string and the next
 * render puts the old character back. The draft lets the field go empty while
 * the user retypes, and only a non-blank value on blur or Enter is committed.
 *
 * Escape abandons the edit, and a rename from elsewhere (another tab, the
 * rail) is picked up because the draft is keyed to the row's current title.
 */
function SiteRow({
  site,
  onRemove,
}: {
  site: PinnedSite;
  onRemove: () => void;
}): ReactNode {
  const copy = content.library.apps;
  const [draft, setDraft] = useState<string | null>(null);
  const { renameSite } = useHub();

  const commit = (): void => {
    if (draft !== null && draft.trim()) renameSite(site.id, draft);
    setDraft(null);
  };

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-transparent transition-colors hover:ring-border">
      <SiteTile site={site} size={36} />
      <div className="min-w-0 flex-1">
        <input
          value={draft ?? site.title}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
          aria-label={`${copy.rename} ${site.title}`}
          className="focus-ring w-full truncate rounded bg-transparent text-sm font-semibold outline-none"
        />
        {/* The origin as stored, which is the origin the rail will open. The
            live page's host is the canvas chip's job, not this list's. */}
        <p className="truncate text-xs text-muted-foreground">
          {displayOrigin(site.url)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${copy.remove} ${site.title}`}
        className="focus-ring flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-negative/15 hover:text-negative"
      >
        <Minus className="size-3" aria-hidden="true" />
        {copy.remove}
      </button>
    </li>
  );
}

/**
 * Web3 Apps: the sites the user pinned to the rail.
 *
 * There is no catalog here, and no section of things Nexus suggests. Every icon
 * on the rail beyond the apps compiled into this build is there because somebody
 * chose it, which is what makes this a browser's bookmarks rather than a store.
 * A suggestions list, a directory, or a search across sites Nexus knows about
 * would each turn this screen back into distribution — that is the specific
 * thing review Guideline 4.7 attaches to, and none of them are here.
 *
 * The built-in apps are deliberately absent too. Nothing on this screen can
 * affect them, and leaving them out is the clearest way to say they are a
 * different kind of thing from a bookmark.
 */
export function Web3Apps(): ReactNode {
  const { pinnedSites, pinSite, unpinSite, setActiveRef } = useHub();
  const copy = content.library.apps;
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submit = (): void => {
    if (!draft.trim()) return;
    // Null means the input is not a web address. An already-pinned URL comes
    // back as the existing row, so a duplicate is a no-op rather than an error.
    if (!pinSite(draft)) {
      setInvalid(true);
      return;
    }
    setDraft("");
    setInvalid(false);
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder={copy.addPlaceholder}
            aria-label={copy.addLabel}
            aria-invalid={invalid}
            className="focus-ring min-w-52 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={submit}
            className={`focus-ring flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${PRIMARY_CTA}`}
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.add}
          </button>
        </div>
        {invalid && (
          <p role="alert" className="mt-2 text-xs text-negative">
            {copy.addInvalid}
          </p>
        )}

        {pinnedSites.length === 0 ? (
          /* The empty state teaches pinning. It is not a placeholder for a
             list of sites Nexus would have suggested — there is no such list. */
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Globe className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-xs text-sm text-balance text-muted-foreground">
              {copy.empty}
            </p>
            <button
              type="button"
              onClick={() => setActiveRef({ kind: "app", slug: "browser" })}
              className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${PRIMARY_CTA}`}
            >
              {copy.emptyAction}
            </button>
          </div>
        ) : (
          <>
            <h2 className="mt-8 text-sm font-semibold">{copy.onRail}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {pinnedSites.map((site) => (
                <SiteRow
                  key={site.id}
                  site={site}
                  onRemove={() => unpinSite(site.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
