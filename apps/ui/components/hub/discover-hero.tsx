"use client";

/**
 * The top of Discover: one big card, three small ones underneath.
 *
 * All four are decorative rather than a decision — nothing here connects
 * anything, they only point further down the page or, on the hero, at a
 * clip that does not exist yet. `discoverHero` / `discoverQuicklinks` in
 * lib/data/discover.ts are the only made-up copy on this whole page; every
 * app they mention by slug is real and read live off the catalogue for its
 * icon.
 */

import { AppTile } from "@/components/hub/app-icon";
import { getHubApp } from "@/lib/data";
import { discoverHero, discoverQuicklinks } from "@/lib/data/discover";
import { Play } from "lucide-react";
import type { ReactNode } from "react";

export function DiscoverHero(): ReactNode {
  return (
    <section>
      <div className="bg-surface-raised grid overflow-hidden rounded-2xl sm:grid-cols-[minmax(0,1fr)_1.4fr]">
        <div className="flex flex-col justify-between p-6">
          <div>
            <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
              {discoverHero.eyebrow}
            </p>
            <h1 className="mt-3 text-2xl leading-tight font-bold text-pretty">
              {discoverHero.title}
            </h1>
          </div>
          <p className="text-muted-foreground mt-6 text-sm text-pretty sm:mt-0">
            {discoverHero.hint}
          </p>
        </div>
        {/* The clip itself does not exist yet — this is the still and the
            button that will one day start it, not a video pretending to be
            ready. */}
        <div className="from-accent/70 to-accent relative min-h-40 bg-gradient-to-br sm:min-h-64">
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(60% 80% at 80% 20%, rgba(255,255,255,0.25), transparent 60%)",
            }}
          />
          <span
            aria-label="Play"
            className="bg-background/90 text-foreground absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg"
          >
            <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* Three across on a phone (stacked) and on a wide monitor, but a
          laptop-width desktop only has room for two of these before each
          one gets too cramped to read — so the third stays out at every
          desktop width up to a genuinely wide one, rather than the grid
          quietly squeezing three into a row that only fits two.

          `sm:max-3xl:` bounds each override to that one range rather than
          pairing an unbounded `sm:` rule against an unbounded `3xl:` one:
          two separate rules that both match at 1900px would leave whichever
          one Tailwind happened to emit last in the stylesheet as the
          winner — true for `grid-cols` and `display` alike here, since a
          custom breakpoint added after the built-ins doesn't reliably sort
          after them. A single bounded rule has nothing left to compete
          with once the range ends. */}
      <div className="mt-4 grid gap-4 sm:max-3xl:grid-cols-2 3xl:grid-cols-3">
        {discoverQuicklinks.map((card, i) => (
          <QuickCard
            key={card.id}
            card={card}
            className={i === 2 ? "sm:max-3xl:hidden" : ""}
          />
        ))}
      </div>
    </section>
  );
}

function QuickCard({
  card,
  className = "",
}: {
  card: (typeof discoverQuicklinks)[number];
  className?: string;
}): ReactNode {
  const apps = card.appSlugs
    .map((slug) => getHubApp(slug))
    .filter((app): app is NonNullable<typeof app> => Boolean(app))
    .slice(0, 4);

  return (
    <div
      className={`bg-surface-raised flex items-center gap-4 rounded-2xl p-5 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
          {card.eyebrow}
        </p>
        <p className="mt-1 text-base font-bold text-pretty">{card.title}</p>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">
          {card.subtitle}
        </p>
      </div>
      {/* The same overlapping-circle stack the collapsed App Store folders
          draw — see CategoryFolder — reused rather than reinvented, since it
          is the same picture: a handful of apps, named on hover, without
          opening anything yet. AppTile rather than a raw <img>: a web
          listing like Scribe carries no tile of its own and falls back to
          its favicon, and a bare <img src={app.iconSrc}> would have handed
          that fallback an empty string instead. */}
      <div className="flex shrink-0 -space-x-3">
        {apps.map((app) => (
          <span
            key={app.slug}
            className="ring-surface-raised size-11 overflow-hidden rounded-full shadow ring-2"
            title={app.name}
          >
            <AppTile app={app} size={44} />
          </span>
        ))}
      </div>
    </div>
  );
}
