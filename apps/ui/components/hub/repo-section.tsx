"use client";

import { Favicon } from "@/components/hub/favicon";
import { IdentitySigil } from "@/components/hub/identity-sigil";
import { PopoverMenu } from "@/components/hub/popover-menu";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { content, type AppRepository, type HubApp } from "@/lib/data";
import { Check, ChevronDown, ExternalLink, Star } from "lucide-react";
import { toggleRepoCollapsed, useCollapsedRepos } from "@/lib/collapsed-repos";
import { useReducedMotion } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

const copy = content.appStore;
/** The letter-tile colour when a site serves no favicon; see app/globals.css. */
const DEFAULT_ACCENT = "#4353ff";

/**
 * A rating and how much of it there is.
 *
 * The count is the half of a rating that says whether to believe it: 4.9 from
 * six people and 4.5 from nine thousand are not the same claim, and a bare
 * average lets the first impersonate the second.
 */
function Stars({
  value,
  reviews,
}: {
  value: number;
  reviews: number;
}): ReactNode {
  return (
    <span className="flex items-center gap-1" title={`${value.toFixed(1)} / 5`}>
      <Star
        className="size-3.5 fill-[#FFAF00] text-[#FFAF00]"
        aria-hidden="true"
      />
      <span className="text-[11px] font-semibold tabular-nums">
        {value.toFixed(1)}
      </span>
      <span className="text-muted-foreground text-[11px] tabular-nums">
        {copy.repoReviews.replace("{n}", reviews.toLocaleString("en-GB"))}
      </span>
    </span>
  );
}

/**
 * How long ago, in the coarsest unit that is still true.
 *
 * "3 weeks ago" rather than a date, because the question a reader is asking of
 * this line is whether the source is maintained, and a date makes them do the
 * arithmetic to find out.
 */
export function sinceLabel(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return copy.repoToday;
  if (days === 1) return copy.repoYesterday;
  if (days < 14) return copy.repoDays.replace("{n}", String(days));
  if (days < 60)
    return copy.repoWeeks.replace("{n}", String(Math.floor(days / 7)));
  return copy.repoMonths.replace("{n}", String(Math.floor(days / 30)));
}

/**
 * The mark of whoever runs a source.
 *
 * Three fallbacks deep, in order of how much it is really theirs. A bundled
 * icon where we ship one; otherwise the site's own favicon, which is the mark
 * the operator actually publishes and the same one the browser shows on their
 * tab — a source and its website looking like two different organisations is
 * exactly the confusion this header exists to remove. A generated sigil last,
 * keyed on the repo's id, so a source added by raw URL still reads as a
 * distinct thing rather than a blank square that looks like a failed image.
 */
export function RepoMark({
  repo,
  size = 32,
}: {
  repo: AppRepository;
  size?: number;
}): ReactNode {
  if (repo.iconSrc) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={repo.iconSrc}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg object-contain"
      />
    );
  }
  if (repo.website) {
    return (
      <Favicon
        url={repo.website}
        letter={repo.name.slice(0, 1).toUpperCase()}
        color={DEFAULT_ACCENT}
        size={size}
        rounded="rounded-lg"
      />
    );
  }
  return <IdentitySigil value={repo.id} size={size} className="rounded-lg" />;
}

/**
 * A source, and everything it is serving.
 *
 * The store used to be one flat catalogue split into Connected and Available,
 * which quietly said every listing came from the same place. It does not: four
 * sources are switched on by default and one of them is a third party nobody
 * has vetted. Grouping by source puts that where somebody deciding whether to
 * connect an app can see it, next to who runs the source and when they last
 * touched it.
 *
 * Collapsible, because a reader who trusts a source does not need to scroll
 * past it, and a reader who does not can shut it.
 */
export function RepoSection({
  repo,
  version,
  onVersion,
  rating,
  reviews,
  count,
  hasNew,
  children,
  now,
}: {
  repo: AppRepository;
  /** the selected catalogue version; the first entry is the latest */
  version: string | null;
  onVersion: (version: string) => void;
  /** mean of the ratings of what it carries, or null when it carries nothing */
  rating: number | null;
  /** how many ratings that average is over, across everything it serves */
  reviews: number;
  count: number;
  hasNew: boolean;
  children: ReactNode;
  now: number;
}): ReactNode {
  const collapsed = useCollapsedRepos();
  const open = !collapsed.has(repo.id);
  const toggle = (): void => toggleRepoCollapsed(repo.id);
  const [picking, setPicking] = useState(false);
  const still = useReducedMotion();
  const [anchor, setAnchor] = useState<
    { top: number; left: number; right: number; bottom: number } | undefined
  >(undefined);
  const versions = repo.versions ?? [];
  const latest = versions[0];
  const current = version ?? latest?.version ?? null;
  const selected = versions.find((entry) => entry.version === current);
  const isLatest = !current || current === latest?.version;

  return (
    <section className="mt-3 first:mt-2">
      {/*
        The row is the control, not just the chevron.

        A 16px target for a thing whose whole job is "show me less of this" is
        a target people miss, and the rest of the row was inert — a header that
        looks like a heading and behaves like one until you find the one pixel
        that does not. Clicks are ignored when they land on something that
        already does its own job, so the name still opens the site and the
        version chip still opens its menu.

        The chevron stays a real button. It is what keyboards and screen
        readers reach for, and moving the handler onto a div would take that
        away to buy a bigger mouse target.
      */}
      <header
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a,button")) return;
          toggle();
        }}
        className="border-border/60 flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 border-b pt-3 pb-2.5"
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`${open ? copy.repoCollapse : copy.repoExpand}: ${repo.name}`}
          className="focus-ring text-muted-foreground hover:text-foreground -ml-1 shrink-0 rounded-md p-1"
        >
          <ChevronDown
            className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
        </button>
        <RepoMark repo={repo} />

        <span className="flex min-w-0 items-center gap-2">
          {/* The name links out. Deciding whether to trust a source means
              reading about who runs it, and the store cannot answer that. */}
          {repo.website ? (
            <a
              href={repo.website}
              target="_blank"
              rel="noreferrer noopener"
              className="focus-ring group flex min-w-0 items-center gap-1 rounded-md"
            >
              <span className="truncate text-sm font-bold group-hover:underline">
                {repo.name}
              </span>
              <ExternalLink
                className="text-muted-foreground size-3 shrink-0"
                aria-hidden="true"
              />
            </a>
          ) : (
            <span className="truncate text-sm font-bold">{repo.name}</span>
          )}
          {hasNew && (
            <span
              aria-label={copy.repoHasNew}
              title={copy.repoHasNew}
              className="bg-accent size-1.5 shrink-0 rounded-full"
            />
          )}
        </span>

        {/*
          Three claims on this row that only a registry could make: the rating,
          the catalogue version, and how long ago it moved. Nexus operates no
          registry, so on a shipping build there is nothing to ask and nobody to
          be wrong on behalf of — they render in demo builds and nowhere else.
          The app count survives because it counts what is in front of you.
          See docs/SPEC-design-catchup.md §1 and lib/surfaces.ts.
        */}
        <span className="text-muted-foreground flex flex-1 items-center justify-end gap-3 text-[11px]">
          {DEMO_SURFACES && rating !== null && (
            <Stars value={rating} reviews={reviews} />
          )}
          <span className="tabular-nums">
            {copy.repoApps.replace("{n}", String(count))}
          </span>

          {DEMO_SURFACES && versions.length > 0 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setAnchor({
                    top: rect.top,
                    left: rect.left,
                    right: rect.right,
                    bottom: rect.bottom,
                  });
                  setPicking(true);
                }}
                aria-haspopup="menu"
                aria-expanded={picking}
                /* Filled, not outlined. Every other chip on this row sits
                   on a surface; a bare border on the canvas read as a gap in
                   the header rather than as the one control in it. */
                className={`focus-ring border-border bg-surface hover:bg-surface-raised hover:text-foreground hover:border-border flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition-colors ${
                  isLatest ? "" : "text-warning border-warning/40 bg-warning/10"
                }`}
              >
                {/* Shut, it answers "am I current?" — and "latest" answers
                    that, where "v2026.08 latest" made a reader check a number
                    against a word that already told them. Pinned to an older
                    catalogue it shows which one, because then the number IS
                    the answer. The menu lists every version either way. */}
                {isLatest ? <span>{copy.repoLatest}</span> : <>v{current}</>}
                <ChevronDown className="size-3" aria-hidden="true" />
              </button>
              <PopoverMenu
                open={picking}
                {...(anchor ? { anchor } : {})}
                onClose={() => setPicking(false)}
                label={copy.repoVersion}
              >
                {versions.map((entry, index) => (
                  <button
                    key={entry.version}
                    type="button"
                    role="menuitemradio"
                    aria-checked={entry.version === current}
                    onClick={() => {
                      onVersion(entry.version);
                      setPicking(false);
                    }}
                    className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs"
                  >
                    <span
                      className={`size-3.5 shrink-0 ${entry.version === current ? "text-accent" : "opacity-0"}`}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex-1 font-semibold">
                      v{entry.version}
                    </span>
                    {index === 0 && (
                      <span className="text-muted-foreground">
                        {copy.repoLatest}
                      </span>
                    )}
                  </button>
                ))}
              </PopoverMenu>
            </>
          )}

          {DEMO_SURFACES && selected && (
            <span className="hidden sm:inline">
              {sinceLabel(selected.releasedAt, now)}
            </span>
          )}
        </span>
      </header>

      {/* Said out loud rather than left for somebody to notice a short list:
          an older catalogue is missing things, and silence about that reads as
          the source having fewer apps than it does. */}
      {!isLatest && (
        <p className="text-warning mt-2 ml-8 text-[11px] text-pretty">
          {copy.repoPinned.replace("{version}", `v${current ?? ""}`)}
        </p>
      )}

      {/*
        Height, not a fade.

        A source's apps appearing at full opacity in a box that was not there a
        frame ago reads as a jump; growing the box is what tells the eye the
        rest of the page moved because of something it just did. Kept short —
        this is a disclosure, not a transition somebody should be waiting on.

        `prefers-reduced-motion` gets the old behaviour, which was correct all
        along for anybody who asked for it.
      */}
      {still ? (
        open && children
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              /* The clip is what makes a height animation read as a reveal,
                 but it stays after the animation lands — so the box keeps a
                 little room below for the cards' rings and shadows to sit in
                 rather than being shaved off at the boundary. */
              className="overflow-hidden pb-1"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </section>
  );
}

/** Apps a repository is serving, for a chosen catalogue version. */
export function appsForRepo(
  apps: HubApp[],
  repo: AppRepository,
  version: string | null
): HubApp[] {
  const mine = apps.filter((app) => app.repoId === repo.id);
  const versions = repo.versions ?? [];
  const chosen = version
    ? versions.find((entry) => entry.version === version)
    : versions[0];
  if (!chosen || chosen === versions[0]) return mine;
  /* An older catalogue is the apps that existed when it was published. Derived
     from the dates already on both tables rather than a per-version app list,
     which would be a second copy of the catalogue to keep in step. */
  const cutoff = new Date(chosen.releasedAt).getTime();
  return mine.filter((app) => new Date(app.createdAt).getTime() <= cutoff);
}
