"use client";

import { faviconUrlFor } from "@/lib/rail/origin";
import { useState, type ReactNode } from "react";

/**
 * Shows a site's real favicon, falling back to a coloured letter tile when
 * there's no URL or the icon fails to load.
 *
 * The icon comes from the site's OWN origin. It used to come from Google's
 * favicon-by-domain endpoint (google's domain, "s2" subpath), which handed
 * Google the hostname of every pinned site, every open tab and every
 * favourite, on every render, from a wallet browser. BSV Browser derives the
 * same `origin + /favicon.ico` URL in components/browser/BookmarkList.tsx.
 *
 * Not every site serves /favicon.ico, and that is what `onError` is for — the
 * letter tile is a normal outcome here, not an edge case.
 */
export function Favicon({
  url,
  letter,
  color,
  size = 16,
  rounded = "rounded",
  className = "",
}: {
  url: string;
  letter: string;
  color: string;
  size?: number;
  rounded?: string;
  className?: string;
}): ReactNode {
  const src = faviconUrlFor(url);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center ${rounded} font-bold text-white ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          fontSize: Math.round(size * 0.6),
        }}
        aria-hidden="true"
      >
        {letter}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 ${rounded} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
