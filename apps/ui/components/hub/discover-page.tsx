"use client";

/**
 * Discover's whole tab, assembled from its pieces and switched by one shared
 * view state — see lib/store-view.ts for why that has to be a store rather
 * than a prop, and lib/data/discover.ts for the editorial copy this reads
 * alongside the live catalogue.
 *
 * AppStore (the canvas) mounts this in place of Manage's grid; DiscoverSidebar
 * (the column beside it) reads the same `useStoreView()` to stay in step, and
 * DiscoverMobileBar stands in for that column on a phone, where it does not
 * render at all.
 */

import { DiscoverHero } from "@/components/hub/discover-hero";
import {
  RankedRow,
  RankedListPage,
} from "@/components/hub/discover-ranked-row";
import { ExtensionRow } from "@/components/hub/discover-extension-row";
import {
  EditorialRow,
  EditorialGridPage,
  EDITORIAL_PREVIEW_COUNT,
} from "@/components/hub/discover-editorial-row";
import {
  CategoriesPage,
  CategoryDetailPage,
} from "@/components/hub/discover-categories-page";
import { UpdatesPage } from "@/components/hub/discover-updates-page";
import { StoryPage } from "@/components/hub/discover-story-page";
import { SearchResultsPage } from "@/components/hub/discover-search-page";
import { DiscoverMobileBar } from "@/components/hub/discover-sidebar";
import { content, getExtensions, getHubApp, getHubApps, type HubApp } from "@/lib/data";
import { discoverCategoryPages } from "@/lib/data/discover";
import { closeStoreView, openStoreView, useStoreView } from "@/lib/store-view";
import type { ReactNode } from "react";

function openStory(app: HubApp): void {
  openStoreView({ kind: "story", slug: app.slug });
}

function DiscoverFrontPage(): ReactNode {
  const apps = getHubApps();
  const freeApps = apps.filter((app) => !app.pricing);
  const paidApps = apps.filter((app) => Boolean(app.pricing));

  return (
    <>
      <DiscoverHero />
      <RankedRow
        freeApps={freeApps}
        paidApps={paidApps}
        onSelect={openStory}
        onSeeAll={(tier) => openStoreView({ kind: "ranked", tier })}
      />
      <ExtensionRow extensions={getExtensions()} />
      {discoverCategoryPages.map((page) => {
        const pageApps = apps.filter((app) => app.category === page.category);
        return (
          <EditorialRow
            key={page.id}
            title={page.sectionTitle}
            apps={pageApps.slice(0, EDITORIAL_PREVIEW_COUNT)}
            onSeeAll={
              pageApps.length > EDITORIAL_PREVIEW_COUNT
                ? () => openStoreView({ kind: "category", category: page.id })
                : undefined
            }
          />
        );
      })}
    </>
  );
}

export function DiscoverPage(): ReactNode {
  const view = useStoreView();
  const apps = getHubApps();
  const copy = content.library.apps;

  let body: ReactNode;
  switch (view.kind) {
    case "category": {
      const page = discoverCategoryPages.find((p) => p.id === view.category);
      body = page ? (
        <EditorialGridPage
          title={page.label}
          hint={page.hint}
          apps={apps.filter((app) => app.category === page.category)}
          onBack={closeStoreView}
        />
      ) : null;
      break;
    }
    case "categories":
      body = (
        <CategoriesPage
          onOpenCategory={(category, label) =>
            openStoreView({ kind: "category-detail", category, label })
          }
        />
      );
      break;
    case "category-detail":
      body = (
        <CategoryDetailPage
          category={view.category}
          label={view.label}
          onSelect={openStory}
          onBack={() => openStoreView({ kind: "categories" })}
        />
      );
      break;
    case "updates":
      body = <UpdatesPage onOpen={(slug) => openStoreView({ kind: "story", slug })} />;
      break;
    case "story": {
      const app = getHubApp(view.slug);
      // The catalogue is live data; a slug this view was opened with can, in
      // principle, stop resolving between one render and the next. Falling
      // back to the front page is the honest answer, not a blank pane.
      body = app ? <StoryPage app={app} onBack={closeStoreView} /> : null;
      break;
    }
    case "ranked": {
      const scoped =
        view.tier === "free"
          ? apps.filter((app) => !app.pricing)
          : apps.filter((app) => Boolean(app.pricing));
      body = (
        <RankedListPage
          title={view.tier === "free" ? copy.topFreeApps : copy.topPaidApps}
          apps={scoped}
          onSelect={openStory}
          onBack={closeStoreView}
        />
      );
      break;
    }
    case "search":
      body = (
        <SearchResultsPage query={view.query} onSelect={openStory} onBack={closeStoreView} />
      );
      break;
    default:
      body = <DiscoverFrontPage />;
  }

  return (
    <>
      <DiscoverMobileBar />
      {body}
    </>
  );
}
