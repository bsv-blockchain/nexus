"use client";

/**
 * An app's own art, wherever Discover needs a picture bigger than a tile.
 *
 * `screenshots` is empty for every app today — there is no admin page yet to
 * put anything into it — so this is also the placeholder every editorial
 * card, hero and story page falls back to. The fallback is the app's own icon
 * on its own accent, scaled up: never wrong, because it is the same fact the
 * app already states everywhere else, only ever plain, because a placeholder
 * that looks like a placeholder is the honest version of one that looks like
 * a missing image.
 */

import { AppTile } from "@/components/hub/app-icon";
import type { HubApp } from "@/lib/data";
import type { ReactNode } from "react";

export function AppArt({
  app,
  index = 0,
  className = "",
  iconSize = 64,
}: {
  app: Pick<HubApp, "iconSrc" | "name" | "web" | "accent" | "screenshots">;
  /** which screenshot, for the story page's secondary image */
  index?: number;
  className?: string;
  /** the fallback icon's size; callers scale it to how big the frame is */
  iconSize?: number;
}): ReactNode {
  const shot = app.screenshots?.[index];
  if (shot) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={shot} alt="" className={`object-cover ${className}`} />;
  }
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center ${className}`}
      style={{
        backgroundColor: app.accent,
        backgroundImage:
          "radial-gradient(120% 120% at 20% 15%, rgba(255,255,255,0.22), transparent 60%)",
      }}
    >
      <AppTile app={app} size={iconSize} />
    </div>
  );
}
