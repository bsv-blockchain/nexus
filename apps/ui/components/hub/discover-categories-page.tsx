"use client";

/**
 * "Categories" — every app, sorted by what it is for, rather than by which
 * repository serves it. The reference draws one Safari-native icon per genre
 * (Business, Games, Music…); ours is `AppCategory`, the taxonomy the catalogue
 * already carries, so a row here can never name a group with nothing in it.
 */

import { AppTile } from "@/components/hub/app-icon";
import { AppName } from "@/components/hub/app-name";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { content, getHubApps, type AppCategory, type HubApp } from "@/lib/data";
import { categoryLabel } from "@/lib/data/discover";
import { useHub } from "@/components/hub/hub-provider";
import {
  Braces,
  ChevronRight,
  Fingerprint,
  Gamepad2,
  GraduationCap,
  Landmark,
  ListChecks,
  MessageCircle,
  Palette,
  Sparkles,
  Store,
  Globe,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const CATEGORY_ICON: Record<AppCategory, LucideIcon> = {
  core: Sparkles,
  system: Globe,
  productivity: ListChecks,
  media: Palette,
  developer: Braces,
  finance: Landmark,
  identity: Fingerprint,
  social: MessageCircle,
  learning: GraduationCap,
  gaming: Gamepad2,
  marketplace: Store,
};

const CATEGORY_ORDER: AppCategory[] = [
  "core",
  "system",
  "productivity",
  "media",
  "developer",
  "finance",
  "identity",
  "social",
  "learning",
  "gaming",
  "marketplace",
];

export function CategoriesPage({
  onOpenCategory,
}: {
  onOpenCategory: (category: AppCategory, label: string) => void;
}): ReactNode {
  const copy = content.library.apps;
  const apps = getHubApps();
  const counts = new Map<AppCategory, number>();
  for (const app of apps) {
    counts.set(app.category, (counts.get(app.category) ?? 0) + 1);
  }
  const present = CATEGORY_ORDER.filter((id) => counts.has(id));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        {copy.categoriesTitle}
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">{copy.categoriesHint}</p>
      <div className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {present.map((id) => {
          const Icon = CATEGORY_ICON[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpenCategory(id, categoryLabel[id])}
              className="focus-ring border-border/60 hover:bg-surface-hover flex items-center gap-3 border-b py-3 text-left"
            >
              <Icon className="text-accent size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-medium">
                {categoryLabel[id]}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {counts.get(id)}
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One category, drilled into: every app it holds, as a plain list. */
export function CategoryDetailPage({
  category,
  label,
  onSelect,
  onBack,
}: {
  category: AppCategory;
  label: string;
  onSelect: (app: HubApp) => void;
  onBack: () => void;
}): ReactNode {
  const copy = content.library.apps;
  const { isInstalled, openAppPrompt } = useHub();
  const apps = getHubApps()
    .filter((app) => app.category === category)
    .sort((a, b) => b.popularity - a.popularity);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="focus-ring text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm font-medium"
      >
        <ChevronRight className="size-4 rotate-180" aria-hidden="true" />
        {copy.back}
      </button>
      <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
      <div className="divide-border/60 mt-4 grid divide-y sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 lg:grid-cols-3">
        {apps.map((app) => {
          const installed = isInstalled(app.slug);
          return (
            <div
              key={app.slug}
              className="sm:border-border/60 flex items-center gap-3 py-2.5 sm:border-b"
            >
              <button
                type="button"
                onClick={() => onSelect(app)}
                className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <AppTile app={app} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    <AppName app={app} />
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {app.tagline}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openAppPrompt(app.slug, installed ? "uninstall" : "install")
                }
                aria-label={`${installed ? copy.uninstall : copy.install} ${app.name}`}
                className={`focus-ring shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  installed
                    ? "bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative transition-colors"
                    : PRIMARY_CTA
                }`}
              >
                {installed ? copy.uninstall : copy.install}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
