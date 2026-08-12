"use client";

import { AppHelpBar } from "@/components/hub/app-help-bar";
import { useHub } from "@/components/hub/hub-provider";
import { RepositoriesButton } from "@/components/hub/repositories-button";
import {
  content,
  getAppCollections,
  getCollectionAppSlugs,
  getEssentialAppSlugs,
  type AppCollection,
} from "@/lib/data";
import {
  Briefcase,
  Code2,
  Globe,
  Palette,
  ShoppingBag,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const collectionIcons: Record<string, LucideIcon> = {
  Sparkles,
  Globe,
  Star,
  ShoppingBag,
  Briefcase,
  Palette,
  Code2,
};

function Toggle({
  on,
  disabled = false,
}: {
  on: boolean;
  disabled?: boolean;
}): ReactNode {
  return (
    <span
      className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors ${
        on ? "bg-accent" : "bg-muted-foreground/30"
      } ${disabled ? "opacity-50" : ""}`}
      aria-hidden="true"
    >
      <span
        className={`size-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  );
}

// Collections made up entirely of essential (always-on) apps can't be toggled
// — their switch is shown on but disabled. Web apps stay removable.
const alwaysOnSlugs = new Set(getEssentialAppSlugs());

function CollectionRow({
  collection,
}: {
  collection: AppCollection;
}): ReactNode {
  const {
    isInstalled,
    appsCollection,
    setAppsCollection,
    openCollectionPrompt,
  } = useHub();
  const slugs = getCollectionAppSlugs(collection.id);
  const allInstalled = slugs.every((slug) => isInstalled(slug));
  const Icon = collectionIcons[collection.icon] ?? Sparkles;
  const selected = appsCollection === collection.id;
  const count = slugs.length;
  // Essentials is entirely always-on — nothing to toggle.
  const locked =
    slugs.length > 0 && slugs.every((slug) => alwaysOnSlugs.has(slug));

  // Toggling routes through the approve/revoke permission sheet.
  const toggle = (): void =>
    openCollectionPrompt(collection.id, allInstalled ? "uninstall" : "install");

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl p-2 transition-colors ${
        selected ? "bg-surface-raised shadow-sm" : "hover:bg-surface-hover"
      }`}
    >
      <button
        type="button"
        onClick={() => setAppsCollection(collection.id)}
        aria-pressed={selected}
        className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            selected
              ? "bg-accent/15 text-accent"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {collection.name}
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">
            {count} app{count === 1 ? "" : "s"}
          </span>
        </span>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={locked ? true : allInstalled}
        aria-disabled={locked}
        disabled={locked}
        aria-label={
          locked
            ? `${collection.name} apps are always on`
            : `${allInstalled ? content.appStore.disableAll : content.appStore.enableAll}: ${collection.name}`
        }
        onClick={locked ? undefined : toggle}
        className={`shrink-0 rounded-full p-0.5 ${locked ? "cursor-not-allowed" : "focus-ring"}`}
      >
        <Toggle on={locked ? true : allInstalled} disabled={locked} />
      </button>
    </div>
  );
}

/** Collections column shown alongside the App Store. */
export function AppCollections(): ReactNode {
  const collections = getAppCollections();

  return (
    <div className="bg-surface flex h-full flex-col rounded-2xl p-3">
      <h2 className="px-1.5 pb-2 text-sm font-semibold">
        {content.appStore.collectionsTitle}
      </h2>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {collections.map((collection) => (
          <CollectionRow key={collection.id} collection={collection} />
        ))}
      </div>

      {/* The same bar every other column ends in: whatever that column keeps
          down here on the left, help on the right. Apps keeps the repositories
          the store pulls its listings from. */}
      <AppHelpBar slug="store">
        <RepositoriesButton />
      </AppHelpBar>
    </div>
  );
}
