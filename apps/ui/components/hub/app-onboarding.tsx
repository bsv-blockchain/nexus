"use client";

import { AppTile } from "@/components/hub/app-icon";
import { DevBadge } from "@/components/hub/dev-badge";
import { StepMark } from "@/components/hub/step-mark";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import {
  content,
  getAppOnboarding,
  getHubApp,
  type OnboardingMedia,
  type OnboardingSlug,
} from "@/lib/data";
import { ChevronDown, LayoutGrid, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The band at the top of the pane.
 *
 * A still today, a looping clip when one exists — the swap is this component and
 * nothing else, which is why both live on one type in the data. The clip plays
 * muted, looped and inline with the still as its poster, so it behaves like a
 * moving screenshot rather than a video somebody has to start: nobody opens an
 * onboarding pane to press play.
 *
 * `prefers-reduced-motion` gets the still. A looping animation is exactly what
 * that setting is asking to be spared, and the poster carries the same content.
 */
function Band({ media }: { media: OnboardingMedia }): ReactNode {
  return (
    <div
      className="bg-surface relative w-full overflow-hidden"
      style={{ aspectRatio: `${media.width} / ${media.height}` }}
    >
      {media.video ? (
        <>
          <video
            src={media.video}
            poster={media.image}
            autoPlay
            loop
            muted
            playsInline
            aria-label={media.alt}
            className="size-full object-cover motion-reduce:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.image}
            alt={media.alt}
            className="hidden size-full object-cover motion-reduce:block"
          />
        </>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media.image}
          alt={media.alt}
          className="size-full object-cover"
        />
      )}
    </div>
  );
}

/**
 * The few things worth knowing about one app.
 *
 * Same pane as the release notes, and deliberately the same shape: a band, who
 * it is from, then a short list of features with what they are and how to reach
 * them. An app with no entry in the data renders nothing rather than an empty
 * pane, so adding a mini app does not require remembering to write this too.
 */
export function AppOnboardingPane({
  slug,
}: {
  slug: OnboardingSlug;
}): ReactNode {
  const app = getHubApp(slug as AppSlug);
  const guide = getAppOnboarding(slug);
  if (!guide) return null;

  return (
    <div>
      {guide.media && <Band media={guide.media} />}

      <div className="border-border/60 flex items-start gap-2.5 border-b p-4">
        {/* A mod has a tile and a publisher; the store itself has neither, so
            it gets the mark the rail uses for it rather than a blank square
            where an icon should be. */}
        {app ? (
          <AppTile app={app} size={32} />
        ) : (
          <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg">
            <LayoutGrid className="size-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold">
            {app?.name ?? guide.title}
          </h3>
          {/* Same badge the store card carries, directly under the name: whoever
              publishes an app is part of deciding whether to trust it, and this
              pane is often the first place somebody meets the app. */}
          {app && <DevBadge developer={app.developer} />}
          <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
            {guide.headline}
          </p>
        </div>
      </div>

      {/*
        Collapsed but for the first.

        A pane that opens with four features fully expanded is a document, and the
        reader has to scroll past three of them to find out there were four. Built
        on `<details>` rather than component state, as the help card is: it opens,
        closes, takes focus and answers Enter with no JavaScript, and this is the
        last place to reimplement that by hand.
      */}
      <div className="divide-border/60 divide-y">
        {guide.features.map((feature, index) => (
          <details
            key={feature.id}
            open={index === 0}
            className="group/feat p-4"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
              {/* The step's position, not its identity: these are read in
                  order, and a number tells the reader where they are in a way
                  a unique mark per feature never could. */}
              <StepMark step={index + 1} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-pretty">
                  {feature.title}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                  {feature.summary}
                </span>
                {feature.reference && (
                  <span className="text-muted-foreground mt-0.5 block font-mono text-[10px]">
                    {feature.reference}
                  </span>
                )}
              </span>
              <ChevronDown
                className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-open/feat:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-2 pl-11 text-xs leading-relaxed text-pretty">
              {feature.body}
            </p>
            {feature.steps && (
              <ol className="mt-2.5 space-y-1.5 pl-11">
                {feature.steps.map((step, stepIndex) => (
                  <li key={step} className="flex items-start gap-2">
                    <span
                      className="text-muted-foreground mt-px w-3.5 shrink-0 text-right text-[11px] font-semibold tabular-nums"
                      aria-hidden="true"
                    >
                      {stepIndex + 1}.
                    </span>
                    <span className="text-[11px] leading-relaxed text-pretty">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

/**
 * The way out of the pane, docked rather than scrolled to.
 *
 * Separate from the body so it can be the {@link SidePane}'s own footer, which
 * pins it below the scroll area — a call to action that only appears once you
 * have read to the bottom is a call to action most people never see. Into the
 * app rather than back to a list: somebody who has read this wants to try the
 * thing it described.
 *
 * A guide that is not about one mod gets no footer. The store's own guide can
 * only be opened from the store, so a button offering to take you there is
 * offering you where you already are.
 */
export function AppOnboardingFooter({
  slug,
}: {
  slug: OnboardingSlug;
}): ReactNode {
  const copy = content.onboarding;
  const app = getHubApp(slug as AppSlug);
  const { openApp, closeDetailPane } = useHub();
  if (!app || !getAppOnboarding(slug)) return null;
  return (
    <button
      type="button"
      onClick={() => {
        openApp(slug as AppSlug);
        closeDetailPane();
      }}
      className="focus-ring bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
    >
      <Sparkles className="size-4" aria-hidden="true" />
      {copy.open} {app.name}
    </button>
  );
}
