"use client";

import { Favicon } from "@/components/hub/favicon";
import type { HubApp } from "@/lib/data";
import type { PinnedSite } from "@/lib/rail/sites";
import { faviconColorFor } from "@/lib/tabs";
import { Folder, Globe, Palette, Pin, type LucideIcon } from "lucide-react";

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
 */
export function AppTile({
  app,
  size,
  className = "",
}: {
  app: Pick<HubApp, "iconSrc" | "name">;
  size: number;
  className?: string;
}): React.ReactNode {
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
  return (
    <Favicon
      url={site.url}
      letter={(site.title.trim()[0] ?? "?").toUpperCase()}
      color={faviconColorFor(site.url)}
      size={size}
      rounded="rounded-[22%]"
      className={className}
    />
  );
}
