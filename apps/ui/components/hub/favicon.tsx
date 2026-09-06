"use client";

import { faviconCandidates } from "@/lib/rail/origin";
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
  /*
   * Walks the candidates rather than trying one.
   *
   * `/favicon.ico` is 16 or 32 pixels, and a site with anything better usually
   * publishes it at a path browsers already probe for — so the list runs
   * biggest first and each `onError` steps to the next. Landing past the end is
   * the letter tile, which is a normal outcome here rather than an edge case.
   */
  const candidates = faviconCandidates(url);
  const [at, setAt] = useState(0);
  const src = candidates[at];

  if (!src) {
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
      /* `key` on the src so a step through the list remounts the element;
         without it the browser keeps the failed image and never re-requests. */
      key={src}
      onError={() => setAt((current) => current + 1)}
      className={`shrink-0 ${rounded} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
