"use client";

/**
 * An app's own story page — where every no-pill card on Discover leads.
 *
 * The editorial cards (EditorialRow, and the ranked/extension rows once an
 * app carries no decision of its own) are a magazine pointing at something;
 * this is the article. It carries the one decision that was missing —
 * Connect/Disconnect, pinned to the hero image the reference anchors it to —
 * plus the app's own words: its description, a second screenshot in context,
 * and a pull-quote. That quote is the app's own tagline rather than invented
 * editorial praise, for the same reason the extensions fixture gives for
 * never padding a section with content that isn't real: a "what we love"
 * that nobody actually wrote is a lie dressed as taste.
 */

import { AppArt } from "@/components/hub/app-art";
import { AppTile } from "@/components/hub/app-icon";
import { AppName } from "@/components/hub/app-name";
import { useHub } from "@/components/hub/hub-provider";
import { content, type HubApp } from "@/lib/data";
import { categoryLabel, spotlightEyebrow } from "@/lib/data/discover";
import { ChevronRight, Star } from "lucide-react";
import type { ReactNode } from "react";

/** A row of five filled stars, amber up to `value` and grey beyond — mirrors AppDetailPanel's own. */
function Stars({ value }: { value: number }): ReactNode {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted-foreground/25 text-muted-foreground/25"
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function StoryPage({
  app,
  onBack,
}: {
  app: HubApp;
  onBack: () => void;
}): ReactNode {
  const copy = content.library.apps;
  const { isInstalled, openAppPrompt } = useHub();
  const installed = isInstalled(app.slug);
  const eyebrow = spotlightEyebrow[app.category] ?? "APPS WE LOVE";
  const paragraphs = app.description
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: the hero shot, with the eyebrow/title over it and the
            connect decision pinned to its bottom edge. */}
        <div className="bg-surface-raised relative overflow-hidden rounded-2xl">
          <AppArt app={app} iconSize={72} className="aspect-4/3 w-full lg:aspect-auto lg:h-full" />
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-5">
            <p className="text-[11px] font-bold tracking-wide text-white/80 uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-pretty text-white">
              {app.name}
            </h1>
          </div>
          <div className="bg-background/95 absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl p-3 shadow-lg backdrop-blur">
            <AppTile app={app} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                <AppName app={app} />
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {categoryLabel[app.category]}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                openAppPrompt(app.slug, installed ? "uninstall" : "install")
              }
              aria-label={`${installed ? copy.uninstall : copy.install} ${app.name}`}
              className={`focus-ring shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                installed
                  ? "bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative transition-colors"
                  : "bg-surface-raised text-accent border-border border"
              }`}
            >
              {app.pricing
                ? app.pricing.summary
                : installed
                  ? copy.uninstall
                  : copy.install}
            </button>
          </div>
        </div>

        {/* Right: the app's own words. */}
        <div>
          <div className="flex items-center gap-2">
            <Stars value={app.rating} />
            <span className="text-muted-foreground text-xs">
              {app.rating.toFixed(1)} · {app.reviews.toLocaleString("en-US")}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{app.tagline}</p>

          <div className="mt-4 space-y-3">
            {/* Clamped on a phone only: a page this is one long scroll on a
                phone already, and an app whose description runs long should
                not be the one that makes this the longest screen in
                Discover. Full length back from `sm` up, where the second
                column stops competing with it for room. */}
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className="line-clamp-6 text-sm leading-relaxed text-pretty sm:line-clamp-none"
              >
                {p}
              </p>
            ))}
          </div>

          {app.screenshots?.[1] && (
            <figure className="mt-5">
              <AppArt
                app={app}
                index={1}
                iconSize={48}
                className="aspect-video w-full overflow-hidden rounded-xl"
              />
              <figcaption className="text-muted-foreground mt-2 text-xs">
                {app.name}
              </figcaption>
            </figure>
          )}

          <div className="border-border/60 mt-5 border-t pt-4">
            <p className="text-xs font-bold tracking-wide uppercase">
              {copy.whatWeLove}
            </p>
            <p className="mt-1 text-sm text-pretty italic">
              &ldquo;{app.tagline}.&rdquo;
            </p>
          </div>

          {!app.screenshots?.length && (
            <p className="text-muted-foreground mt-5 text-xs">
              {copy.storyEmpty}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
