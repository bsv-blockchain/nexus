"use client";

import { SiteTile } from "@/components/hub/app-icon";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { OriginLabel } from "@/components/hub/origin-label";
import { content } from "@/lib/data";
import { displayOrigin } from "@/lib/rail/origin";
import type { PinnedSite } from "@/lib/rail/sites";
import { Globe, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** How long a revealed row stays highlighted. */
const FLASH_MS = 1400;

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
 * Escape abandons the edit. While a draft is open it wins over the store, so a
 * rename arriving from another tab is not shown until this one blurs — the right
 * way round: the half-typed name in front of you is the one you are looking at.
 */
function SiteRow({
  site,
  flash,
  onRemove,
}: {
  site: PinnedSite;
  flash: boolean;
  onRemove: () => void;
}): ReactNode {
  const copy = content.library.apps;
  const [draft, setDraft] = useState<string | null>(null);
  const { renameSite } = useHub();
  const row = useRef<HTMLLIElement>(null);

  const commit = (): void => {
    if (draft !== null && draft.trim()) renameSite(site.id, draft);
    setDraft(null);
  };

  // Bring a revealed row into view. The highlight's lifetime is the parent's —
  // one timer for the list, rather than one per row that any re-render restarts.
  useEffect(() => {
    if (flash) row.current?.scrollIntoView({ block: "nearest" });
  }, [flash]);

  return (
    <li
      ref={row}
      /* items-start, not items-center: through OriginLabel a long host wraps
         instead of being cut, so the row can grow — and when it does, the tile
         and the verb belong against the title rather than floating mid-row. */
      className={`bg-surface flex items-start gap-3 rounded-2xl p-3 ring-1 transition-shadow duration-300 ${
        flash ? "ring-accent" : "hover:ring-border ring-transparent"
      }`}
    >
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
        {/* The origin as stored, which is the origin the rail will open — the
            live page's host is the canvas chip's job, not this list's.

            Through OriginLabel, not `truncate`. This row is where somebody
            decides which of two similar pins is the real one before pressing
            Remove, and it renders at phone width from the mobile sheet.
            `text-overflow` clips the TAIL of a host, and the tail is the
            registrable domain, so truncation hides exactly the characters the
            decision rests on and keeps the attacker-chosen padding. */}
        <OriginLabel
          origin={displayOrigin(site.url)}
          className="block text-xs"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${copy.remove} ${site.title}`}
        className="focus-ring bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        <Minus className="size-3" aria-hidden="true" />
        {copy.remove}
      </button>
    </li>
  );
}

/**
 * Connected sites: the websites this profile has connected, and the one control
 * that matters on a list like this — disconnect.
 *
 * The same list every wallet keeps. It is not the Apps surface, which is where
 * you go to find something; this is where you go to see what already has a
 * grant against your wallet and take it away. Both reach the same store
 * underneath, and a listing connected from either shows up in the other.
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
  const { pinnedSites, pinSite, unpinSite } = useHub();
  const copy = content.library.apps;
  const [draft, setDraft] = useState("");
  /** What the field has to say back: nothing, a rejection, or a duplicate. */
  const [notice, setNotice] = useState<"invalid" | "duplicate" | null>(null);
  /**
   * A row to reveal — the one just added, or the one already there.
   *
   * A wrapper object rather than the bare id, so every reveal is a new value
   * even when it names the row already highlighted. A bare id made re-adding the
   * same URL a no-op state write: the effect below did not re-run, so the second
   * reveal inherited the first one's remaining time.
   */
  const [flash, setFlash] = useState<{ id: string } | null>(null);

  // One timer for the list, restarted by each reveal.
  useEffect(() => {
    if (flash === null) return;
    const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const submit = (): void => {
    if (!draft.trim()) return;
    const site = pinSite(draft);
    // Null is the only failure: not a web address.
    if (!site) {
      setNotice("invalid");
      return;
    }
    /*
     * `addPinnedSite` hands back the EXISTING row for a URL already pinned
     * rather than duplicating it, so a second attempt used to clear the field
     * and change nothing visible — indistinguishable from a silent failure.
     * `pinnedSites` is this render's pre-submit list, so finding the returned id
     * in it is what tells the two cases apart. Either way the row is revealed;
     * only the duplicate says so in words, because a highlight is invisible to a
     * screen reader and to anyone whose eye is still on the field.
     */
    const duplicate = pinnedSites.some((row) => row.id === site.id);
    setDraft("");
    setNotice(duplicate ? "duplicate" : null);
    setFlash({ id: site.id });
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">{copy.sitesTitle}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{copy.subtitle}</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setNotice(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder={copy.addPlaceholder}
            aria-label={copy.addLabel}
            aria-invalid={notice === "invalid"}
            className="focus-ring border-border bg-surface placeholder:text-muted-foreground min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
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
        {notice === "invalid" && (
          <p role="alert" className="text-negative mt-2 text-xs">
            {copy.addInvalid}
          </p>
        )}
        {notice === "duplicate" && (
          <p role="status" className="text-muted-foreground mt-2 text-xs">
            {copy.addDuplicate}
          </p>
        )}

        {pinnedSites.length === 0 ? (
          /* The empty state points at the field above, which is the only thing
             in this build that pins a site. It is not a placeholder for a list
             of sites Nexus would have suggested — there is no such list. */
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Globe
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <p className="text-muted-foreground max-w-xs text-sm text-balance">
              {copy.emptySites}
            </p>
          </div>
        ) : (
          <>
            <h2 className="mt-8 text-sm font-semibold">{copy.onRail}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {pinnedSites.map((site) => (
                <SiteRow
                  key={site.id}
                  site={site}
                  flash={flash?.id === site.id}
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
