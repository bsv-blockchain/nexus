"use client";

import { useHub } from "@/components/hub/hub-provider";
import { content, getAppOnboarding, type OnboardingSlug } from "@/lib/data";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The way into a column's help, at its foot.
 *
 * Messages had this and nothing else did, because Messages is the one app that
 * draws its own chrome and so never gets the header that carries the button
 * everywhere else. The result was the reverse of what it should be: help was
 * reachable from one app and hidden in fourteen.
 *
 * Now shared, because Apps needed it too and its column already had a bar of
 * its own doing something else — two bars at the foot of two columns, looking
 * different, is how a shell stops feeling like one product. `children` is the
 * left-hand side, which is where a column puts whatever else belongs down
 * here; the help button is always the last thing on the right.
 *
 * A toggle rather than an open. The pane takes width from the canvas, so the
 * control that opened it has to be the one that gives it back. Nothing renders
 * at all when there is no guide written — a button onto an empty pane is worse
 * than no button.
 */
export function AppHelpBar({
  slug,
  pane,
  children,
}: {
  slug: OnboardingSlug;
  /**
   * A pane to open instead of this slug's guide.
   *
   * Settings has no app behind it and no fixture guide — what it needs
   * explaining is its own list of categories, which is built in the component
   * rather than written down in lib/data. So the bar stays the bar, and only
   * what it opens changes; a second bar beside the first, looking almost the
   * same, is how a shell stops feeling like one product.
   */
  pane?: { kind: "settings-guide"; id: string };
  children?: ReactNode;
}): ReactNode {
  const { detailPane, openDetailPane, closeDetailPane } = useHub();
  const target = pane ?? { kind: "onboarding" as const, id: slug };
  const open =
    detailPane?.kind === target.kind && detailPane.id === target.id;
  const helped = pane ? true : Boolean(getAppOnboarding(slug));
  if (!helped && !children) return null;

  return (
    <div className="border-border/60 relative flex items-center gap-1 border-t px-1 py-1">
      {children}
      {helped && (
        <button
          type="button"
          onClick={() => (open ? closeDetailPane() : openDetailPane(target))}
          aria-pressed={open}
          aria-label={content.onboarding.button}
          title={content.onboarding.button}
          className={`focus-ring ml-auto rounded-md p-1.5 transition-colors ${
            open
              ? "bg-accent/15 text-foreground"
              : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <Info className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
