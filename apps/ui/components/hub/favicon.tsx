"use client";

import { useState, type ReactNode } from "react";

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Shows a site's real favicon (via Google's favicon service), falling back to
 * a colored letter tile when there's no URL or the icon fails to load.
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
  const host = hostOf(url);
  const [failed, setFailed] = useState(false);

  if (!host || failed) {
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
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
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
