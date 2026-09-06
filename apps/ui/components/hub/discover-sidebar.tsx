"use client";

/**
 * The column beside the App Store when Discover is the active tab.
 *
 * Manage's column (AppCollections) holds Nexus Presets and App repositories —
 * questions about where a listing comes from, which do not apply here.
 * Discover's own question is "what am I looking for": a search field, then
 * the sections the reference calls Work / Create / Develop as their own full
 * pages, then Categories and Updates. Same shell as every other column
 * (bg-surface, rounded-2xl, AppHelpBar at the foot) so switching tabs swaps
 * what is inside the frame, not the frame itself.
 */

import { AppHelpBar } from "@/components/hub/app-help-bar";
import { content } from "@/lib/data";
import { discoverCategoryPages } from "@/lib/data/discover";
import { closeStoreView, openStoreView, useStoreView } from "@/lib/store-view";
import {
  Braces,
  Compass,
  LayoutGrid,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const PAGE_ICON: Record<(typeof discoverCategoryPages)[number]["id"], LucideIcon> =
  {
    work: Sparkles,
    create: Palette,
    develop: Braces,
  };

/** The search field itself — shared, byte for byte, with the mobile bar. */
export function DiscoverSearchField({ className = "" }: { className?: string }): ReactNode {
  const view = useStoreView();
  const query = view.kind === "search" ? view.query : "";
  return (
    <div
      className={`border-border bg-surface-raised flex items-center gap-2 rounded-lg border px-3 py-2 ${className}`}
    >
      <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <input
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          if (next.trim().length === 0) closeStoreView();
          else openStoreView({ kind: "search", query: next });
        }}
        placeholder={content.appStore.searchPlaceholder}
        aria-label={content.appStore.searchPlaceholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
        active ? "bg-accent/10 font-medium" : "hover:bg-surface-hover"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

export function DiscoverSidebar(): ReactNode {
  const view = useStoreView();

  return (
    <div className="bg-surface flex h-full flex-col rounded-2xl p-3">
      <div className="scrollbar-slim min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        <DiscoverSearchField />

        <div className="flex flex-col gap-0.5">
          <NavButton
            icon={Compass}
            label="Discover"
            active={view.kind === "grid"}
            onClick={closeStoreView}
          />
          {discoverCategoryPages.map((page) => (
            <NavButton
              key={page.id}
              icon={PAGE_ICON[page.id]}
              label={page.label}
              active={view.kind === "category" && view.category === page.id}
              onClick={() => openStoreView({ kind: "category", category: page.id })}
            />
          ))}
        </div>

        <div className="border-border/60 flex flex-col gap-0.5 border-t pt-3">
          <NavButton
            icon={LayoutGrid}
            label={content.library.apps.categoriesTitle}
            active={view.kind === "categories" || view.kind === "category-detail"}
            onClick={() => openStoreView({ kind: "categories" })}
          />
          <NavButton
            icon={RefreshCw}
            label={content.library.apps.updatesTitle}
            active={view.kind === "updates"}
            onClick={() => openStoreView({ kind: "updates" })}
          />
        </div>
      </div>

      <AppHelpBar slug="store" />
    </div>
  );
}

/**
 * The same three doors — search, Categories, Updates — as a bar above the
 * canvas on a phone, where the column above does not render at all. Work /
 * Create / Develop need no equivalent here: each of their sections on the
 * front page already carries its own "See All" straight into the same page
 * this sidebar's nav would have opened.
 */
export function DiscoverMobileBar(): ReactNode {
  const view = useStoreView();
  return (
    <div className="mb-4 flex items-center gap-2 md:hidden">
      <DiscoverSearchField className="flex-1" />
      <button
        type="button"
        onClick={() => openStoreView({ kind: "categories" })}
        aria-label={content.library.apps.categoriesTitle}
        aria-current={
          view.kind === "categories" || view.kind === "category-detail"
            ? "page"
            : undefined
        }
        className="focus-ring border-border bg-surface hover:bg-surface-hover flex shrink-0 items-center justify-center rounded-lg border p-2.5"
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => openStoreView({ kind: "updates" })}
        aria-label={content.library.apps.updatesTitle}
        aria-current={view.kind === "updates" ? "page" : undefined}
        className="focus-ring border-border bg-surface hover:bg-surface-hover flex shrink-0 items-center justify-center rounded-lg border p-2.5"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
