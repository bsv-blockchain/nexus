"use client";

import { AppDetailPanel } from "@/components/hub/app-detail-panel";
import { AppTile } from "@/components/hub/app-icon";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { DevBadge } from "@/components/hub/dev-badge";
import { useBrandMode, withBrand } from "@/lib/brand";
import { CollectionRow } from "@/components/hub/app-collections";
import { useHub } from "@/components/hub/hub-provider";
import { PopoverMenu } from "@/components/hub/popover-menu";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getAppCollections,
  getCollectionAppSlugs,
  getHubApp,
  getHubApps,
  type AppCategory,
  type HubApp,
} from "@/lib/data";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Folder,
  FolderOpen,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import { useEnabledRepositories } from "@/lib/repositories-store";
import { markStoreVisited, newSinceLastVisit } from "@/lib/store-visits";
import { appsForRepo, RepoSection } from "@/components/hub/repo-section";
import {
  filterCount,
  NO_FILTERS,
  StoreFilterPane,
  type StoreFilters,
} from "@/components/hub/store-filter";
import { useEffect, useState, type ReactNode } from "react";

/** Ordered category groupings for the Available section, with headings. */
const CATEGORY_ORDER: { id: AppCategory; label: string }[] = [
  { id: "core", label: "Essentials" },
  { id: "system", label: "Web" },
  { id: "finance", label: "Finance" },
  { id: "identity", label: "Identity & security" },
  { id: "social", label: "Social" },
  { id: "media", label: "Media & publishing" },
  { id: "learning", label: "Learning" },
  { id: "developer", label: "Developer" },
  { id: "gaming", label: "Games" },
  { id: "marketplace", label: "Marketplaces" },
  { id: "productivity", label: "Productivity" },
];

// Grid columns; the narrow variant reflows the grid when the detail sheet is open.
const GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";
const GRID_NARROW = "grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3";
const gridFor = (expanded: boolean): string => (expanded ? GRID_NARROW : GRID);

const EASE = [0.4, 0, 0.2, 1] as const;

// Staggered reveal for a folder's cards — whole cards (icon + text) rise and
// fade in together, so nothing animates in isolation.
const CARD_LIST = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};
const CARD_ITEM = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", damping: 24, stiffness: 300 },
  },
} as const;

type SortKey = "newest" | "oldest" | "popular" | "trending";

/*
 * How the listings are ordered.
 *
 * Trending and Most popular are rankings, and a ranking is a claim about what
 * other people did — which needs a registry counting them. Newest and Oldest
 * are dates on rows this build ships with, which is a fact about the build. So
 * a live build keeps the two that are true and drops the two that are not,
 * rather than dropping the whole control and leaving a catalogue with no order
 * anybody chose.
 */
const ALL_SORTS: { id: SortKey; label: string; needsRegistry?: boolean }[] = [
  { id: "trending", label: content.appStore.sortTrending, needsRegistry: true },
  { id: "popular", label: content.appStore.sortPopular, needsRegistry: true },
  { id: "newest", label: content.appStore.sortNewest },
  { id: "oldest", label: content.appStore.sortOldest },
];

const SORTS = DEMO_SURFACES
  ? ALL_SORTS
  : ALL_SORTS.filter((sort) => !sort.needsRegistry);

/*
 * The publisher facet is gone, folded into Sources.
 *
 * It listed the five publishing organisations, and every app's publisher is the
 * organisation running the repo it comes from — so the two facets returned the
 * same sets under different names, and the store now groups by source visibly.
 * Two controls that cannot disagree are one control shown twice.
 */

function sortApps(apps: HubApp[], sort: SortKey): HubApp[] {
  const sorted = [...apps];
  if (sort === "newest") {
    sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else if (sort === "oldest") {
    sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else if (sort === "popular") {
    sorted.sort((a, b) => b.popularity - a.popularity);
  } else {
    // trending: recent activity weighted by popularity
    sorted.sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.popularity - a.popularity
    );
  }
  return sorted;
}

function AppCard({
  app,
  onSelect,
  onHover,
  selected,
  isNew,
}: {
  app: HubApp;
  onSelect: (app: HubApp) => void;
  onHover: (app: HubApp) => void;
  selected: boolean;
  isNew?: boolean;
}): ReactNode {
  /* isInstalled, not installedApps.includes: a listing that is a website has no
     app slot to be in — it is connected when its URL is on the rail. Asking the
     array directly left every web listing's button saying Connect after it had
     been connected. */
  const { isInstalled, openAppPrompt } = useHub();
  const installed = isInstalled(app.slug);
  const copy = content.library.apps;
  /* App copy is data, so the chain's name is substituted rather than composed
     from a component. */
  const brandMode = useBrandMode();
  /* Per card, not lifted: two open cards is a perfectly reasonable thing to
     want, and a shared "which one is open" would close the first. */
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      /* One height for every tile, set by the tallest thing a card holds:
         a three-line description. Ragged card bottoms in a grid make the
         Connect buttons land on four different lines, and a row of buttons
         you have to hunt for is worse than a little empty space.

         Until you open one. An expanded card is taller than its neighbours by
         definition — you asked for the rest of a description that did not fit,
         and the only way to honour that without moving the card is not to.
         `min-h-52` rather than free height, so opening a card whose description
         already fitted does not shrink it below the row it sits in.

         52 rather than the 56 it was: once the description became exactly three
         lines rather than whatever was left over, the card carried about 27px
         of nothing under the Connect button. The folder tile matches, because
         the two sit in the same grid. */
      className={`bg-surface flex flex-col rounded-2xl p-4 ring-1 transition-shadow ${
        expanded ? "min-h-52" : "h-52"
      } ${selected ? "ring-accent" : "ring-transparent"}`}
    >
      <button
        type="button"
        onClick={() => onSelect(app)}
        onMouseEnter={() => onHover(app)}
        aria-label={`View ${app.name} details`}
        className="focus-ring flex shrink-0 flex-col text-left"
      >
        <div className="flex items-start gap-3">
          <span className="block shrink-0">
            <AppTile app={app} size={52} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold">{app.name}</h3>
              {isNew && (
                <span className="bg-accent text-accent-foreground shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide uppercase">
                  {content.appStore.newLabel}
                </span>
              )}
            </span>
            {/* A version and a star, both of which need a registry behind them
                to mean anything. Demo builds have one; a shipped binary does
                not, and a rating nobody collected is worse than no rating.
                See docs/SPEC-design-catchup.md §1. */}
            {DEMO_SURFACES && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="truncate">v{app.version}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <Star
                    className="size-3 fill-[#FFAF00] text-[#FFAF00]"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">{app.rating.toFixed(1)}</span>
                </span>
              </p>
            )}
            <DevBadge developer={app.developer} className="mt-0.5" />
          </div>
        </div>
      </button>
      {/*
        The description, on its own and scrollable.

        Out of the select button rather than inside it, because it is now a
        control of its own and a button inside a button is markup no browser
        agrees on. Clicking it opens the card rather than the app: they are
        different intentions, and the old card answered both with "open the
        app".

        Three lines exactly, by max-height rather than `line-clamp`. Clamping
        hides the overflow so completely that the box cannot scroll, which is
        the one thing wanted here — a bar appears only when there is more, so
        the card says whether it is holding anything back.
      */}
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={`${expanded ? copy.collapseDescription : copy.expandDescription} ${app.name}`}
        className={`focus-ring scrollbar-slim text-muted-foreground mt-3 min-h-0 flex-1 overflow-y-auto text-left text-xs leading-relaxed ${
          expanded ? "max-h-none" : "max-h-[3.66rem]"
        }`}
      >
        {withBrand(app.description, brandMode)}
      </button>
      {app.essential ? (
        <span
          aria-label={`${app.name} is ${copy.essential}`}
          className="bg-muted text-muted-foreground mt-3 flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          <Check
            className="text-positive size-3"
            strokeWidth={3}
            aria-hidden="true"
          />
          {copy.essential}
        </span>
      ) : (
        <button
          type="button"
          onClick={() =>
            openAppPrompt(app.slug, installed ? "uninstall" : "install")
          }
          aria-label={`${installed ? copy.uninstall : copy.install} ${app.name}`}
          className={`focus-ring mt-3 flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            installed
              ? "bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative transition-colors"
              : PRIMARY_CTA
          }`}
        >
          {installed ? (
            <>
              <Minus className="size-3" aria-hidden="true" />
              {copy.uninstall}
            </>
          ) : (
            <>
              <Plus className="size-3" aria-hidden="true" />
              {copy.install}
            </>
          )}
        </button>
      )}
    </article>
  );
}

/**
 * A category with 2+ apps, shown as a collapsible folder (collapsed by
 * default). Collapsed shows a stack of app icons; expanded spans the full row
 * and reveals the apps' full cards.
 */
function CategoryFolder({
  label,
  apps,
  onSelect,
  onHover,
  selectedSlug,
  expanded,
  newSlugs,
}: {
  label: string;
  apps: HubApp[];
  onSelect: (app: HubApp) => void;
  onHover: (app: HubApp) => void;
  selectedSlug: string | null;
  newSlugs: Set<string>;
  expanded: boolean;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const folderNew = apps.some((app) => newSlugs.has(app.slug));
  const reduced = useReducedMotion();
  const previews = apps.slice(0, 4);
  const extra = apps.length - previews.length;
  const listVariants = reduced ? { hidden: {}, visible: {} } : CARD_LIST;
  const itemVariants = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : CARD_ITEM;

  return (
    <motion.div
      // `layout="position"` (not `layout`) animates only position, never size.
      // Animating size scales the box with a transform, which stretches the
      // folder's text label and optically thickens its border mid-animation.
      layout="position"
      transition={{ layout: { duration: reduced ? 0 : 0.32, ease: EASE } }}
      className={open ? "col-span-full" : "h-full"}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {open ? (
          <motion.section
            key="open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="bg-surface/60 ring-accent/30 rounded-2xl p-4 ring-1"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-expanded={true}
              className="focus-ring flex w-full items-center gap-3"
            >
              <span className="bg-accent/15 text-accent flex size-13 shrink-0 items-center justify-center rounded-2xl">
                <FolderOpen className="size-7" aria-hidden="true" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-left text-base font-bold">
                {label}
              </h3>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                {apps.length}
                <ChevronUp className="size-4.5" aria-hidden="true" />
              </span>
            </button>
            <motion.div
              className={`mt-4 ${gridFor(expanded)}`}
              variants={listVariants}
              initial="hidden"
              animate="visible"
            >
              {apps.map((app) => (
                <motion.div key={app.slug} variants={itemVariants}>
                  <AppCard
                    app={app}
                    onSelect={onSelect}
                    onHover={onHover}
                    selected={selectedSlug === app.slug}
                    isNew={newSlugs.has(app.slug)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        ) : (
          <motion.button
            key="closed"
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            aria-label={`${label} folder, ${apps.length} apps`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            /* Same height as an app card: a folder is a tile in the same grid,
               and one taller box in a row of shorter ones reads as a mistake
               rather than as a different kind of thing. */
            className="focus-ring group bg-surface ring-border hover:ring-accent/50 flex h-52 w-full flex-col justify-between rounded-2xl p-4 text-left ring-1 transition-colors"
          >
            {/* A folder is a tile in a grid of tiles, so its mark is the
                size of the app icons around it and its name is read at the
                same distance. At 32px against their 52px it looked like a
                control that had wandered into the catalogue. */}
            <div className="flex items-center gap-3">
              <span className="bg-accent/15 text-accent flex size-13 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105">
                <Folder className="size-7" aria-hidden="true" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-base font-bold">
                {label}
              </h3>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                {folderNew && (
                  <span
                    aria-label={content.appStore.repoHasNew}
                    className="bg-accent size-2 rounded-full"
                  />
                )}
                {apps.length}
                <ChevronDown className="size-4.5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-center">
              <div className="flex -space-x-3.5">
                {/* Named on hover. A shut folder shows a stack of marks and
                    nothing else, so without this the only way to learn what is
                    in one is to open it. */}
                {previews.map((app) => (
                  <Tooltip key={app.slug} label={app.name} side="top">
                    <span className="ring-surface flex rounded-[22%] shadow-lg ring-2 transition-transform hover:-translate-y-0.5">
                      <AppTile app={app} size={52} />
                    </span>
                  </Tooltip>
                ))}
              </div>
              {extra > 0 && (
                <span className="text-muted-foreground ml-2.5 text-xs font-medium">
                  +{extra}
                </span>
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Render a section's category groups: folders for 2+, bare cards for singles. */
function CategoryGroups({
  groups,
  onSelect,
  onHover,
  selectedSlug,
  expanded,
  newSlugs,
}: {
  groups: { id: AppCategory; label: string; apps: HubApp[] }[];
  onSelect: (app: HubApp) => void;
  onHover: (app: HubApp) => void;
  selectedSlug: string | null;
  expanded: boolean;
  newSlugs: Set<string>;
}): ReactNode {
  return (
    <div className={`mt-4 ml-8 ${gridFor(expanded)}`}>
      {groups.map((group) =>
        group.apps.length === 1 ? (
          <motion.div
            key={group.id}
            layout="position"
            transition={{ layout: { duration: 0.32, ease: EASE } }}
          >
            <AppCard
              app={group.apps[0]!}
              onSelect={onSelect}
              onHover={onHover}
              selected={selectedSlug === group.apps[0]!.slug}
              isNew={newSlugs.has(group.apps[0]!.slug)}
            />
          </motion.div>
        ) : (
          <CategoryFolder
            key={group.id}
            label={group.label}
            apps={group.apps}
            onSelect={onSelect}
            onHover={onHover}
            selectedSlug={selectedSlug}
            expanded={expanded}
            newSlugs={newSlugs}
          />
        )
      )}
    </div>
  );
}

/** Full-area app store shown when the Apps rail tab is active. */
export function AppStore(): ReactNode {
  const { appsCollection } = useHub();
  const copy = content.library.apps;
  const store = content.appStore;
  const collection = getAppCollections().find((c) => c.id === appsCollection);
  const slugSet = new Set(getCollectionAppSlugs(appsCollection));

  const [query, setQuery] = useState("");
  /* The first sort this build offers, which is Trending in demo and Newest in
     a live build — not the literal "trending", which would leave a live build
     ordered by a ranking whose control it does not show. */
  const [sort, setSort] = useState<SortKey>(SORTS[0]!.id);
  const [filters, setFilters] = useState<StoreFilters>(NO_FILTERS);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // The app whose detail sheet is open (reflows the grid on desktop).
  const [selectedSlug, setSelectedSlug] = useState<HubApp["slug"] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const repos = useEnabledRepositories();
  const [versionByRepo, setVersionByRepo] = useState<Record<string, string>>(
    {}
  );
  /*
   * Both fixed for the life of this visit.
   *
   * The mark is read from the previous visit and held, so browsing does not
   * clear the dot you are currently looking at; the stamp moves on the way in,
   * so the next visit is measured from this one. `now` is captured with it so
   * every "updated 3 weeks ago" on the page agrees with the others.
   */
  const [now] = useState(() => Date.now());
  const [newSlugs] = useState(() => newSinceLastVisit(now));
  useEffect(() => {
    markStoreVisited(now);
  }, [now]);
  const selectedApp = selectedSlug ? getHubApp(selectedSlug) : undefined;
  // The grid only reflows while the panel is fully expanded, not the thin bar.
  const detailExpanded = Boolean(selectedApp) && !collapsed;
  const onSelect = (app: HubApp): void => {
    setSelectedSlug(app.slug);
    setCollapsed(false);
  };
  // Hovering another card previews it, but only while the panel is expanded.
  const onHover = (app: HubApp): void =>
    setSelectedSlug((current) => (current && !collapsed ? app.slug : current));
  const closeDetail = (): void => {
    setSelectedSlug(null);
    setCollapsed(false);
  };

  const q = query.trim().toLowerCase();
  const scoped = getHubApps().filter(
    (app) => appsCollection === "all" || slugSet.has(app.slug)
  );
  const matched = scoped.filter((app) => {
    if (
      q &&
      !app.name.toLowerCase().includes(q) &&
      !app.description.toLowerCase().includes(q)
    )
      return false;
    if (filters.repos.length > 0 && !filters.repos.includes(app.repoId))
      return false;
    /* Any, not all: two shelves ticked is a reader asking for both kinds, not
       for the apps that happen to be both at once. */
    if (
      filters.categories.length > 0 &&
      !app.categories.some((category) => filters.categories.includes(category))
    )
      return false;
    return true;
  });
  const apps = sortApps(matched, sort);
  const activeFilters = filterCount(filters);

  /*
   * Facet counts, taken before either facet narrows anything.
   *
   * Counted against the sources that are switched on and the search box, so
   * they answer "how many are there" for the catalogue in front of you — but
   * not against the ticks themselves, which would make every number drop to
   * zero the moment you ticked its neighbour.
   */
  const enabledIds = new Set(repos.map((repo) => repo.id));
  const countable = scoped.filter(
    (app) =>
      enabledIds.has(app.repoId) &&
      (!q ||
        app.name.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q))
  );
  const repoCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const app of countable) {
    repoCounts[app.repoId] = (repoCounts[app.repoId] ?? 0) + 1;
    for (const category of app.categories) {
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }
  }
  const groupByCategory = (
    list: HubApp[]
  ): { id: AppCategory; label: string; apps: HubApp[] }[] =>
    CATEGORY_ORDER.map((category) => ({
      ...category,
      apps: list.filter((app) => app.category === category.id),
    })).filter((group) => group.apps.length > 0);

  /*
   * One block per source that is switched on.
   *
   * Search runs across all of them and then each block is filtered down, so a
   * query that matches nothing in a repo hides that repo rather than leaving an
   * empty heading — but the repos it does match keep their headers, which is
   * how somebody searching learns which source a result came from.
   */
  const sections = repos
    .map((repo) => {
      const inRepo = appsForRepo(apps, repo, versionByRepo[repo.id] ?? null);
      const all = appsForRepo(
        getHubApps(),
        repo,
        versionByRepo[repo.id] ?? null
      );
      /* Weighted by how many people rated each app, not a mean of means: an
         app with nine reviews should not move a source's score as far as one
         with nine thousand. */
      const reviews = all.reduce((sum, app) => sum + app.reviews, 0);
      const rating =
        reviews > 0
          ? all.reduce((sum, app) => sum + app.rating * app.reviews, 0) /
            reviews
          : null;
      return {
        repo,
        apps: inRepo,
        groups: groupByCategory(inRepo),
        rating,
        reviews,
        count: all.length,
        hasNew: inRepo.some((app) => newSlugs.has(app.slug)),
      };
    })
    .filter((section) => section.apps.length > 0);
  const total = sections.reduce((sum, section) => sum + section.apps.length, 0);

  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? "";

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-400">
          <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {collection && appsCollection !== "all"
              ? collection.description
              : copy.storeSubtitle}
          </p>

          {/* The setups. A column beside the store on a desktop — see
              hub-shell's LibraryPanel — and a row here on a phone, where that
              column does not exist. `md:hidden` lives inside the component, so
              this is one line either way. */}
          <div className="mt-5">
            <CollectionRow />
          </div>

          {/* Search + sort + filter */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="border-border bg-surface flex min-w-52 flex-1 items-center gap-2 rounded-lg border px-3 py-2">
              <Search
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={store.searchPlaceholder}
                aria-label={store.searchPlaceholder}
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((open) => !open)}
                aria-expanded={sortOpen}
                className="focus-ring border-border bg-surface hover:bg-surface-hover flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                <ArrowUpDown className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{store.sortLabel}:</span>
                {sortLabel}
                <ChevronDown
                  className="size-3.5 opacity-60"
                  aria-hidden="true"
                />
              </button>
              <PopoverMenu
                open={sortOpen}
                onClose={() => setSortOpen(false)}
                label={store.sortLabel}
                className="top-full right-0 mt-2 min-w-44"
              >
                {SORTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSort(option.id);
                      setSortOpen(false);
                    }}
                    className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm"
                  >
                    <span className="flex-1">{option.label}</span>
                    {sort === option.id && (
                      <Check
                        className="text-accent size-4"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </PopoverMenu>
            </div>

            <button
              type="button"
              onClick={() => {
                /* One panel at a time on this edge. Opening the filter over an
                 open detail sheet would squeeze the grid twice. */
                setSelectedSlug(null);
                setFilterOpen((open) => !open);
              }}
              aria-expanded={filterOpen}
              className="focus-ring border-border bg-surface hover:bg-surface-hover flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {store.filterLabel}
              {activeFilters > 0 && (
                <span className="bg-accent text-accent-foreground flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          <LayoutGroup>
            {sections.map((section) => (
              <RepoSection
                key={section.repo.id}
                repo={section.repo}
                version={versionByRepo[section.repo.id] ?? null}
                onVersion={(version) =>
                  setVersionByRepo((current) => ({
                    ...current,
                    [section.repo.id]: version,
                  }))
                }
                rating={section.rating}
                reviews={section.reviews}
                count={section.count}
                hasNew={section.hasNew}
                now={now}
              >
                <CategoryGroups
                  groups={section.groups}
                  onSelect={onSelect}
                  onHover={onHover}
                  selectedSlug={selectedSlug}
                  expanded={detailExpanded}
                  newSlugs={newSlugs}
                />
              </RepoSection>
            ))}
          </LayoutGroup>

          {total === 0 && (
            <p className="text-muted-foreground py-16 text-center text-sm">
              {store.noResults}
            </p>
          )}
        </div>
      </div>

      <StoreFilterPane
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        repos={repos}
        repoCounts={repoCounts}
        categoryCounts={categoryCounts}
        shown={total}
        total={countable.length}
      />

      {/* Desktop: inline side sheet that reflows the grid; collapses to a bar. */}
      <AnimatePresence initial={false}>
        {selectedApp && (
          <motion.aside
            key="detail"
            initial={{ width: 0 }}
            animate={{ width: collapsed ? 52 : 420 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="border-border hidden shrink-0 overflow-hidden border-l md:block"
          >
            {collapsed ? (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label={content.appStore.detail.expand}
                className="focus-ring hover:bg-surface-hover flex h-full w-13 flex-col items-center gap-3 py-4 transition-colors"
              >
                <ChevronLeft
                  className="text-muted-foreground size-5"
                  aria-hidden="true"
                />
                <AppTile app={selectedApp} size={30} />
              </button>
            ) : (
              <div className="h-full w-105">
                <AppDetailPanel
                  app={selectedApp}
                  onClose={() => setCollapsed(true)}
                />
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile: full-screen overlay sliding in from the right. */}
      <AnimatePresence>
        {selectedApp && (
          <motion.div
            key="detail-mobile"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            className="bg-background fixed inset-0 z-60 md:hidden"
          >
            <AppDetailPanel
              app={selectedApp}
              onClose={closeDetail}
              variant="overlay"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
