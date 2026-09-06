"use client";

/**
 * The "Work Smarter" shape: a heading, and a row of stories rather than a
 * row of listings.
 *
 * The difference from the ranked and extension rows is deliberate and comes
 * straight from the reference: those carry a Get/price pill because they are
 * a decision — connect this or do not — and a tap opens the side panel that
 * decision already lives in. A card here carries no pill at all, because it
 * is not asking anything; it is pointing at an app the way a magazine points
 * at a restaurant. Tapping one opens the app's own story page, one level in,
 * which is where the decision to connect actually lives.
 *
 * One component rather than three, since Work / Create / Develop are the
 * same card in the same row with a different heading and a different
 * category behind it — see lib/data/discover.ts for what tells them apart.
 */

import { AppArt } from "@/components/hub/app-art";
import { spotlightEyebrow } from "@/lib/data/discover";
import { content, type HubApp } from "@/lib/data";
import { openStoreView } from "@/lib/store-view";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** How many cards a preview row shows before it hands off to "See All". */
export const EDITORIAL_PREVIEW_COUNT = 5;

export function EditorialRow({
  title,
  apps,
  onSeeAll,
}: {
  title: string;
  apps: HubApp[];
  /** omitted once every app already fits in the preview */
  onSeeAll?: (() => void) | undefined;
}): ReactNode {
  const copy = content.library.apps;
  if (apps.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="focus-ring text-accent text-sm font-semibold hover:underline"
          >
            {copy.seeAll}
          </button>
        )}
      </div>
      {/* Two across on a laptop-width desktop, not the three this used to
          force into the same room the quicklinks and extensions above it
          just gave up on — five only once a monitor is wide enough that
          five actually fit without shrinking every card into its caption. */}
      <div className="scrollbar-none -mx-1 flex gap-4 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-5">
        {apps.map((app) => (
          <EditorialCard key={app.slug} app={app} />
        ))}
      </div>
    </section>
  );
}

function EditorialCard({ app }: { app: HubApp }): ReactNode {
  const eyebrow = spotlightEyebrow[app.category] ?? "APPS WE LOVE";
  return (
    <button
      type="button"
      onClick={() => openStoreView({ kind: "story", slug: app.slug })}
      className="focus-ring group w-44 shrink-0 text-left sm:w-auto"
    >
      <AppArt
        app={app}
        iconSize={40}
        className="aspect-video w-full overflow-hidden rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
      />
      <p className="text-muted-foreground mt-2 text-[10px] font-bold tracking-wide uppercase">
        {eyebrow}
      </p>
      <p className="mt-0.5 text-sm font-bold text-pretty">{app.name}</p>
      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs text-pretty">
        {app.tagline}
      </p>
    </button>
  );
}

/**
 * The same cards, as a full page — what "See All" and the sidebar's Work /
 * Create / Develop entries both open. A back arrow rather than a close: this
 * replaces Discover's own front page rather than floating over it.
 */
export function EditorialGridPage({
  title,
  hint,
  apps,
  onBack,
}: {
  title: string;
  hint: string;
  apps: HubApp[];
  onBack: () => void;
}): ReactNode {
  const copy = content.library.apps;
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
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{hint}</p>
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {apps.map((app) => (
          <EditorialCard key={app.slug} app={app} />
        ))}
      </div>
    </div>
  );
}
