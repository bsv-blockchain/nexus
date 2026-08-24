"use client";

import { Favicon } from "@/components/hub/favicon";
import { getHubApps, type HubApp } from "@/lib/data";
import type { PinnedSite } from "@/lib/rail/sites";
import { faviconColorFor, sameUrl } from "@/lib/tabs";
import { Folder, Globe, Palette, Pin, type LucideIcon } from "lucide-react";

const DEFAULT_ACCENT = "#4353ff";

/**
 * Resolves icon names stored in the data layer (future Postgres rows) to
 * lucide components — used for space items. App icons are image tiles, see
 * AppTile below.
 */
const iconMap: Record<string, LucideIcon> = {
  Folder,
  Palette,
  Pin,
};

export function DataIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}): React.ReactNode {
  const Icon = iconMap[name] ?? Globe;
  return <Icon className={className} style={style} aria-hidden="true" />;
}

/**
 * Rounded app-tile icon from /public/icons. Plain <img> so both PNG and SVG
 * tiles work without next/image remote/SVG configuration.
 *
 * A listing with no tile of its own is a website, and it wears its own favicon
 * rather than a mark we drew for it — a logo is the one thing in a listing that
 * has to come from whoever it belongs to. `Favicon` falls back to a letter on
 * the app's accent when the site has none, so nothing ever renders as a broken
 * image.
 */
export function AppTile({
  app,
  size,
  className = "",
}: {
  app: Pick<HubApp, "iconSrc" | "name"> &
    Partial<Pick<HubApp, "web" | "accent">>;
  size: number;
  className?: string;
}): React.ReactNode {
  if (!app.iconSrc && app.web) {
    return (
      <Favicon
        url={app.web.url}
        letter={app.name.slice(0, 1).toUpperCase()}
        color={app.accent ?? DEFAULT_ACCENT}
        size={size}
        rounded="rounded-[22%]"
        {...(className ? { className } : {})}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={app.iconSrc}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * A pinned site's tile. Same geometry as AppTile so the rail reads as one row
 * of icons, with the letter fallback for the many sites that serve no
 * /favicon.ico — a normal outcome here, not an edge case.
 *
 * The fallback colour is the one the site's own tab uses, so a pinned site is
 * the same colour wherever it appears. It is not `--color-surface-raised`:
 * that is #ffffff in the light theme, and Favicon draws the letter in white.
 */
export function SiteTile({
  site,
  size,
  className = "",
}: {
  site: Pick<PinnedSite, "title" | "url">;
  size: number;
  className?: string;
}): React.ReactNode {
  /*
   * A site the store lists is drawn as that listing.
   *
   * Connecting a web listing pins its URL, and the rail then holds a site ref
   * rather than an app ref — so everything past that point knew only a title
   * and a URL and fell back to `/favicon.ico`, then to a letter. Every
   * third-party listing in the catalogue was a coloured letter on the rail
   * while its own mark sat unused in the very same row of the store.
   *
   * Matched on the URL because that is the only thing the two halves share; a
   * listing with no bundled mark falls through to the favicon exactly as
   * before, which is still right for a site somebody pinned themselves.
   */
  const listed = getHubApps().find(
    (app) => app.iconSrc && app.web && sameUrl(app.web.url, site.url)
  );
  if (listed) {
    return <AppTile app={listed} size={size} className={className} />;
  }

  return (
    <Favicon
      url={site.url}
      // Spread, not [0]: a page title starting with an emoji — and page titles
      // are exactly what arrives here — indexes to half a surrogate pair, which
      // draws as the replacement character.
      letter={([...site.title.trim()][0] ?? "?").toUpperCase()}
      color={faviconColorFor(site.url)}
      size={size}
      rounded="rounded-[22%]"
      className={className}
    />
  );
}
