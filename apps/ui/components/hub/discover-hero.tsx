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
 *
 * The big card's words come from Store Admin now, seeded from that fixture
 * and editable from then on — it is the most valuable surface in the store
 * and it was the one surface nobody could change without a deploy. It can
 * be switched off, and it can carry the same disclosed sponsorship badge
 * the banners do, counted the same way: half the card on screen, once per
 * page load. The three quicklinks under it stay fixture copy, because they
 * point at app groupings rather than at anything anybody buys.
 */

import { AppTile } from "@/components/hub/app-icon";
import { useSeenOnce } from "@/components/hub/use-promo-impression";
import { recordHeroImpression, useAdminPromoState } from "@/lib/admin-store";
import { content, getHubApp } from "@/lib/data";
import { discoverQuicklinks } from "@/lib/data/discover";
import { Play } from "lucide-react";
import type { ReactNode } from "react";

export function DiscoverHero(): ReactNode {
  const hero = useAdminPromoState().hero;
  const copy = content.library.apps;
  const ref = useSeenOnce<HTMLDivElement>("hero", recordHeroImpression);

  return (
    <section>
      {/* Off means gone, not empty: a hero with the words removed is a
          large blank rectangle at the top of the store, which reads as
          something failing to load rather than as a slot nobody has sold. */}
      {hero.enabled && (
        <div
          ref={ref}
          className="bg-surface-raised grid overflow-hidden rounded-2xl lg:grid-cols-[minmax(0,1fr)_1.4fr]"
        >
          {/* Below `lg` this stacks — a phone and a narrow desktop window
              both read the still before the words, which is the reference's
              own order; `order-none` at `lg` puts the words back on the left
              where the side-by-side layout wants them. */}
          <div className="order-2 flex flex-col justify-between p-6 lg:order-none">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                  {hero.eyebrow}
                </p>
                {hero.sponsored && (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    {copy.sponsoredLabel}
                    {hero.advertiser ? ` · ${hero.advertiser}` : ""}
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl leading-tight font-bold text-pretty">
                {hero.title}
              </h1>
            </div>
            <p className="text-muted-foreground mt-6 text-sm text-pretty lg:mt-0">
              {hero.hint}
            </p>
          </div>
          {/* The clip itself does not exist yet — this is the still and the
              button that will one day start it, not a video pretending to be
              ready. */}
          <div className="from-accent/70 to-accent relative order-1 min-h-40 bg-gradient-to-br sm:min-h-64 lg:order-none">
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
      )}

      {/* Stacked on a phone and on a narrow desktop window alike — below
          `lg` there still isn't room for two of these side by side without
          cramping both. Two across from `lg`, three only on a genuinely
          wide monitor: the third stays out in between, where the grid
          would otherwise squeeze three into a row that only fits two.

          `lg:max-3xl:` bounds each override to that one range rather than
          pairing an unbounded `lg:` rule against an unbounded `3xl:` one:
          two separate rules that both match at 1900px would leave whichever
          one Tailwind happened to emit last in the stylesheet as the
          winner — true for `grid-cols` and `display` alike here, since a
          custom breakpoint added after the built-ins doesn't reliably sort
          after them. A single bounded rule has nothing left to compete
          with once the range ends. */}
      <div className="mt-4 grid gap-4 lg:max-3xl:grid-cols-2 3xl:grid-cols-3">
        {discoverQuicklinks.map((card, i) => (
          <QuickCard
            key={card.id}
            card={card}
            className={i === 2 ? "lg:max-3xl:hidden" : ""}
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
