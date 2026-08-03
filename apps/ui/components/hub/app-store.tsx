"use client";

import { AppDetailPanel } from "@/components/hub/app-detail-panel";
import { AppTile } from "@/components/hub/app-icon";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { PopoverMenu } from "@/components/hub/popover-menu";
import {
  content,
  getAppCollections,
  getCollectionAppSlugs,
  getHubApp,
  getHubApps,
  type AppCategory,
  type AppDeveloper,
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
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import { useState, type ReactNode } from "react";

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
];

// Grid columns; the narrow variant reflows the grid when the detail sheet is open.
const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";
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

const SORTS: { id: SortKey; label: string }[] = [
  { id: "trending", label: content.appStore.sortTrending },
  { id: "popular", label: content.appStore.sortPopular },
  { id: "newest", label: content.appStore.sortNewest },
  { id: "oldest", label: content.appStore.sortOldest },
];

const DEVS: { id: AppDeveloper; label: string }[] = [
  { id: "bsv-association", label: content.appStore.devBsvAssociationApps },
  { id: "babbage", label: content.appStore.devBabbageApps },
  { id: "third-party", label: content.appStore.devThirdPartyApps },
];

const DEV_LABEL: Record<AppDeveloper, string> = {
  "bsv-association": content.appStore.devBsvAssociation,
  babbage: content.appStore.devBabbage,
  "third-party": content.appStore.devThirdParty,
};

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
        b.createdAt.localeCompare(a.createdAt) || b.popularity - a.popularity,
    );
  }
  return sorted;
}

function DevBadge({ developer }: { developer: AppDeveloper }): ReactNode {
  const verified = developer !== "third-party";
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
      {verified ? (
        <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0]">
          <Check className="size-2.5 text-white" strokeWidth={3.5} aria-hidden="true" />
        </span>
      ) : (
        <span
          className="size-3.5 shrink-0 rounded-full border border-muted-foreground/40"
          aria-hidden="true"
        />
      )}
      {DEV_LABEL[developer]}
    </p>
  );
}

function AppCard({
  app,
  onSelect,
  onHover,
  selected,
}: {
  app: HubApp;
  onSelect: (app: HubApp) => void;
  onHover: (app: HubApp) => void;
  selected: boolean;
}): ReactNode {
  const { installedApps, openAppPrompt } = useHub();
  const installed = installedApps.includes(app.slug);
  const copy = content.library.apps;

  return (
    <article
      className={`flex flex-col rounded-2xl bg-surface p-4 ring-1 transition-shadow ${
        selected ? "ring-accent" : "ring-transparent"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(app)}
        onMouseEnter={() => onHover(app)}
        aria-label={`View ${app.name} details`}
        className="focus-ring flex flex-1 flex-col text-left"
      >
        <div className="flex items-start gap-3">
          <span className="block shrink-0">
            <AppTile app={app} size={52} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{app.name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {app.publisher} · v{app.version}
            </p>
            <DevBadge developer={app.developer} />
          </div>
        </div>
        <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
          {app.description}
        </p>
      </button>
      {app.essential ? (
        <span
          aria-label={`${app.name} is ${copy.essential}`}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          <Check className="size-3 text-positive" strokeWidth={3} aria-hidden="true" />
          {copy.essential}
        </span>
      ) : (
        <button
          type="button"
          onClick={() =>
            openAppPrompt(app.slug, installed ? "uninstall" : "install")
          }
          aria-label={`${installed ? copy.uninstall : copy.install} ${app.name}`}
          className={`focus-ring mt-3 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            installed
              ? "bg-muted text-muted-foreground transition-colors hover:bg-negative/15 hover:text-negative"
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
}: {
  label: string;
  apps: HubApp[];
  onSelect: (app: HubApp) => void;
  onHover: (app: HubApp) => void;
  selectedSlug: string | null;
  expanded: boolean;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const previews = apps.slice(0, 4);
  const extra = apps.length - previews.length;
  const listVariants = reduced
    ? { hidden: {}, visible: {} }
    : CARD_LIST;
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
            className="rounded-2xl bg-surface/60 p-4 ring-1 ring-accent/30"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-expanded={true}
              className="focus-ring flex w-full items-center gap-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <FolderOpen className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                {label}
              </h3>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {apps.length}
                <ChevronUp className="size-3.5" aria-hidden="true" />
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
            className="focus-ring group flex h-full min-h-38 w-full flex-col justify-between rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition-colors hover:ring-accent/50"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent transition-transform duration-200 group-hover:scale-105">
                <Folder className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                {label}
              </h3>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {apps.length}
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-center">
              <div className="flex -space-x-3">
                {previews.map((app) => (
                  <span
                    key={app.slug}
                    className="rounded-[22%] ring-2 ring-surface"
                  >
                    <AppTile app={app} size={44} />
                  </span>
                ))}
              </div>
              {extra > 0 && (
                <span className="ml-2.5 text-xs font-medium text-muted-foreground">
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
}: {
  groups: { id: AppCategory; label: string; apps: HubApp[] }[];
  onSelect: (app: HubApp) => void;
  onHover: (app: HubApp) => void;
  selectedSlug: string | null;
  expanded: boolean;
}): ReactNode {
  return (
    <div className={`mt-5 ${gridFor(expanded)}`}>
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
          />
        ),
      )}
    </div>
  );
}

/** Full-area app store shown when the Apps rail tab is active. */
export function AppStore(): ReactNode {
  const { installedApps, appsCollection } = useHub();
  const copy = content.library.apps;
  const store = content.appStore;
  const collection = getAppCollections().find((c) => c.id === appsCollection);
  const slugSet = new Set(getCollectionAppSlugs(appsCollection));

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("trending");
  const [devFilter, setDevFilter] = useState<AppDeveloper[]>([]);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // The app whose detail sheet is open (reflows the grid on desktop).
  const [selectedSlug, setSelectedSlug] = useState<HubApp["slug"] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
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
    (app) => appsCollection === "all" || slugSet.has(app.slug),
  );
  const matched = scoped.filter((app) => {
    if (
      q &&
      !app.name.toLowerCase().includes(q) &&
      !app.description.toLowerCase().includes(q)
    )
      return false;
    if (devFilter.length > 0 && !devFilter.includes(app.developer)) return false;
    return true;
  });
  const apps = sortApps(matched, sort);
  const installed = apps.filter((app) => installedApps.includes(app.slug));
  const available = apps.filter((app) => !installedApps.includes(app.slug));
  const groupByCategory = (
    list: HubApp[],
  ): { id: AppCategory; label: string; apps: HubApp[] }[] =>
    CATEGORY_ORDER.map((category) => ({
      ...category,
      apps: list.filter((app) => app.category === category.id),
    })).filter((group) => group.apps.length > 0);
  const installedGroups = groupByCategory(installed);
  const availableGroups = groupByCategory(available);

  const toggleDev = (dev: AppDeveloper): void =>
    setDevFilter((current) =>
      current.includes(dev)
        ? current.filter((d) => d !== dev)
        : [...current, dev],
    );

  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? "";

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
       <div className="mx-auto max-w-400">
        <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {collection && appsCollection !== "all"
            ? collection.description
            : "Add apps to your Nexus. Installed apps appear in the sidebar rail."}
        </p>

        {/* Search + sort + filter */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={store.searchPlaceholder}
              aria-label={store.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((open) => !open)}
              aria-expanded={sortOpen}
              className="focus-ring flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              <ArrowUpDown className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{store.sortLabel}:</span>
              {sortLabel}
              <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
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
                  className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-hover"
                >
                  <span className="flex-1">{option.label}</span>
                  {sort === option.id && (
                    <Check className="size-4 text-accent" aria-hidden="true" />
                  )}
                </button>
              ))}
            </PopoverMenu>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              aria-expanded={filterOpen}
              className="focus-ring flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {store.filterLabel}
              {devFilter.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {devFilter.length}
                </span>
              )}
            </button>
            <PopoverMenu
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              label={store.filterLabel}
              className="top-full right-0 mt-2 min-w-56"
            >
              {DEVS.map((option) => {
                const checked = devFilter.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleDev(option.id)}
                    className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-hover"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border"
                      }`}
                      aria-hidden="true"
                    >
                      {checked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">{option.label}</span>
                  </button>
                );
              })}
            </PopoverMenu>
          </div>
        </div>

        <LayoutGroup>
          {installed.length > 0 && (
            <>
              <div className="mt-8 flex items-center gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Check className="size-4 text-positive" aria-hidden="true" />
                  {copy.installedSection}
                </h2>
              </div>
              <CategoryGroups
                groups={installedGroups}
                onSelect={onSelect}
                onHover={onHover}
                selectedSlug={selectedSlug}
                expanded={detailExpanded}
              />
            </>
          )}

          {available.length > 0 && (
            <>
              <div className="mt-8">
                <h2 className="text-sm font-semibold">
                  {copy.availableSection}
                </h2>
              </div>
              <CategoryGroups
                groups={availableGroups}
                onSelect={onSelect}
                onHover={onHover}
                selectedSlug={selectedSlug}
                expanded={detailExpanded}
              />
            </>
          )}
        </LayoutGroup>

        {installed.length === 0 && available.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {store.noResults}
          </p>
        )}
       </div>
      </div>

      {/* Desktop: inline side sheet that reflows the grid; collapses to a bar. */}
      <AnimatePresence initial={false}>
        {selectedApp && (
          <motion.aside
            key="detail"
            initial={{ width: 0 }}
            animate={{ width: collapsed ? 52 : 420 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="hidden shrink-0 overflow-hidden border-l border-border md:block"
          >
            {collapsed ? (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label={content.appStore.detail.expand}
                className="focus-ring flex h-full w-13 flex-col items-center gap-3 py-4 transition-colors hover:bg-surface-hover"
              >
                <ChevronLeft
                  className="size-5 text-muted-foreground"
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
            className="fixed inset-0 z-60 bg-background md:hidden"
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
