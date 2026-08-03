"use client";

import type { HubApp } from "@/lib/data";
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
