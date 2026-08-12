"use client";

import { RepoMark } from "@/components/hub/repo-section";
import { SidePane } from "@/components/hub/side-pane";
import {
  content,
  storeCategories,
  type AppRepository,
  type StoreCategory,
} from "@/lib/data";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

/**
 * What the catalogue has been narrowed to.
 *
 * Empty means everything, in both fields — a filter with nothing ticked is a
 * reader who has not asked for anything, not a reader who has asked for
 * nothing. Both are transient: they narrow the view and are gone on reload,
 * unlike switching a repo off, which is a subscription and is remembered.
 */
export interface StoreFilters {
  /** repo ids; empty shows every source that is switched on */
  repos: string[];
  /** empty shows every shelf */
  categories: StoreCategory[];
}

export const NO_FILTERS: StoreFilters = { repos: [], categories: [] };

export function filterCount(filters: StoreFilters): number {
  return filters.repos.length + filters.categories.length;
}

function Box({ checked }: { checked: boolean }): ReactNode {
  return (
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
  );
}

function Heading({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="text-muted-foreground mb-1 text-[11px] font-bold tracking-wide uppercase">
      {children}
    </p>
  );
}

/**
 * One row, whichever facet it belongs to.
 *
 * Carries its own count, and a count of zero disables it rather than hiding
 * it. Hiding would make the taxonomy flicker as the search box narrows —
 * shelves appearing and vanishing under the cursor — and it would quietly
 * answer "is there nothing here, or am I looking in the wrong place?" by
 * removing the question. Dimmed and unclickable says which.
 */
function Row({
  checked,
  count,
  onToggle,
  mark,
  label,
  hint,
}: {
  checked: boolean;
  count: number;
  onToggle: () => void;
  mark?: ReactNode;
  label: string;
  hint?: string;
}): ReactNode {
  const empty = count === 0;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={empty}
      onClick={onToggle}
      className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left ${
        empty ? "cursor-default opacity-40" : "hover:bg-surface-hover"
      }`}
    >
      <Box checked={checked} />
      {mark}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {hint && (
          <span className="text-muted-foreground block truncate text-xs">
            {empty ? content.appStore.filterEmptyCategory : hint}
          </span>
        )}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {count}
      </span>
    </button>
  );
}

/**
 * The store's filter, as a pane rather than a menu.
 *
 * It was a popover listing publishers, which is one facet of one kind and had
 * to be dismissed before you could see what it did. Two facets with counts and
 * descriptions do not fit in a menu, and a filter you cannot watch working is a
 * filter you apply twice. The pane takes width from the catalogue instead, so
 * the grid renarrows beside it as each box is ticked.
 */
export function StoreFilterPane({
  open,
  onClose,
  filters,
  onChange,
  repos,
  repoCounts,
  categoryCounts,
  shown,
  total,
}: {
  open: boolean;
  onClose: () => void;
  filters: StoreFilters;
  onChange: (next: StoreFilters) => void;
  /** the sources currently switched on, in their listed order */
  repos: AppRepository[];
  /** how many listings each source serves, before either facet narrows it */
  repoCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  /** how many cards the catalogue is showing, and how many it could */
  shown: number;
  total: number;
}): ReactNode {
  const copy = content.appStore;
  const toggleRepo = (id: string): void =>
    onChange({
      ...filters,
      repos: filters.repos.includes(id)
        ? filters.repos.filter((entry) => entry !== id)
        : [...filters.repos, id],
    });
  const toggleCategory = (id: StoreCategory): void =>
    onChange({
      ...filters,
      categories: filters.categories.includes(id)
        ? filters.categories.filter((entry) => entry !== id)
        : [...filters.categories, id],
    });

  return (
    <SidePane
      open={open}
      title={copy.filterTitle}
      onClose={onClose}
      /* Pinned below the scroll, because the count is the answer to every tick
         above it and scrolling away from your own answer is no way to filter. */
      footer={
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {copy.filterShowing
              .replace("{shown}", String(shown))
              .replace("{total}", String(total))}
          </span>
          <button
            type="button"
            disabled={filterCount(filters) === 0}
            onClick={() => onChange(NO_FILTERS)}
            className="focus-ring shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {copy.filterClear}
          </button>
        </div>
      }
    >
      <div className="px-3 py-3">
        <Heading>{copy.filterSources}</Heading>
        {/* Said once, here, because unticking a source and switching one off
            look identical and are not: one is this visit, the other is a
            subscription. The Repositories sheet is where the second lives. */}
        <p className="text-muted-foreground mb-1 px-2 text-xs">
          {copy.filterSourcesHint}
        </p>
        {repos.map((repo) => (
          <Row
            key={repo.id}
            checked={filters.repos.includes(repo.id)}
            count={repoCounts[repo.id] ?? 0}
            onToggle={() => toggleRepo(repo.id)}
            mark={<RepoMark repo={repo} size={20} />}
            label={repo.name}
          />
        ))}

        <div className="mt-5">
          <Heading>{copy.filterCategories}</Heading>
          {storeCategories.map((category) => (
            <Row
              key={category.id}
              checked={filters.categories.includes(category.id)}
              count={categoryCounts[category.id] ?? 0}
              onToggle={() => toggleCategory(category.id)}
              label={category.label}
              hint={category.description}
            />
          ))}
        </div>
      </div>
    </SidePane>
  );
}
