"use client";

import type { ReactNode } from "react";

/** Extensions the browser can play rather than paint. */
const VIDEO = /\.(mp4|webm|mov)(\?|$)/i;

/**
 * A collectible's artwork, whether it is a still or a clip.
 *
 * Some art moves. Rendering an `.mp4` through an `<img>` yields a broken icon
 * and no explanation, and the three places that draw a collectible had all
 * assumed a still — so the choice is made once, here, rather than three times
 * in a row with an `endsWith` each.
 *
 * Muted, looping and inline: a wallet is not a place where anything should
 * start making noise, and `playsInline` keeps iOS from taking the tile
 * fullscreen the moment it plays.
 */
export function CollectibleArt({
  src,
  poster,
  className = "",
  style,
}: {
  src: string;
  /** the clip's first frame, so the tile paints before the video decodes */
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
}): ReactNode {
  if (VIDEO.test(src)) {
    return (
      <video
        src={src}
        {...(poster ? { poster } : {})}
        className={className}
        {...(style ? { style } : {})}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      className={className}
      {...(style ? { style } : {})}
      draggable={false}
    />
  );
}
