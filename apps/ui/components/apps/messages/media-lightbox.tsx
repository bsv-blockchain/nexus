"use client";

import { content, type MediaItem } from "@/lib/data";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Full-screen media viewer: letterboxed, keyboard-driven, one item at a time.
 *
 * Letterbox rather than crop-to-fill. A shared photo is someone's framing, and
 * "fill the window" throws away the edges of it — so the item is fitted inside
 * the viewport with the backdrop showing through, which is what every viewer
 * worth using does. The chrome sits over the backdrop rather than the media, so
 * it never covers the thing you opened.
 *
 * Videos autoplay here (you asked to watch it) with native controls, which is
 * the one place stock controls beat anything custom: real scrubbing, real volume,
 * captions, picture-in-picture, and the platform's own fullscreen.
 */
export function MediaLightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: MediaItem[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}): ReactNode {
  const copy = content.messages.media;
  const item = items[index];
  const many = items.length > 1;
  const frame = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
      if (!many) return;
      if (event.key === "ArrowRight") {
        onIndex((index + 1) % items.length);
      }
      if (event.key === "ArrowLeft") {
        onIndex((index - 1 + items.length) % items.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, many, onClose, onIndex]);

  // Opening a viewer should not let the thread behind it scroll.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!item) return null;

  const step = (delta: number): void =>
    onIndex((index + delta + items.length) % items.length);

  return (
    <div
      className="fixed inset-0 z-100 flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={copy.viewer}
    >
      {/* Top bar. Always over the backdrop, never over the media. */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-white/90">
        <span className="min-w-0 truncate text-xs">
          {many ? `${index + 1} / ${items.length}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <a
            href={item.src}
            download
            aria-label={copy.download}
            className="focus-ring grid size-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Download className="size-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            aria-label={copy.fullscreen}
            onClick={() => void frame.current?.requestFullscreen?.()}
            className="focus-ring grid size-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Maximize2 className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.close}
            onClick={onClose}
            className="focus-ring grid size-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* The letterbox. The item is contained, so nothing is ever cropped. */}
      <div
        ref={frame}
        className="relative flex min-h-0 flex-1 items-center justify-center bg-black"
        onClick={(event) => {
          // Clicking the surround closes; clicking the media itself does not.
          if (event.target === event.currentTarget) onClose();
        }}
        /* Swipe to page, since arrow buttons are not what a thumb reaches for.
           Tracked on the container rather than the media, so a video's own
           controls keep their gestures. */
        onTouchStart={(event) => {
          swipe.current = event.touches[0]
            ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
            : null;
        }}
        onTouchEnd={(event) => {
          const from = swipe.current;
          const to = event.changedTouches[0];
          swipe.current = null;
          if (!from || !to || !many) return;
          const dx = to.clientX - from.x;
          const dy = to.clientY - from.y;
          // Horizontal intent only, so a vertical scroll never pages the set.
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
          step(dx < 0 ? 1 : -1);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={item.src}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex max-h-full max-w-full items-center justify-center"
          >
            {item.kind === "video" ? (
              <video
                key={item.src}
                src={item.src}
                poster={item.poster}
                controls
                autoPlay
                playsInline
                className="max-h-[calc(100dvh-8rem)] max-w-full object-contain"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.src}
                alt={item.alt ?? ""}
                className="max-h-[calc(100dvh-8rem)] max-w-full object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {many && (
          <>
            <button
              type="button"
              aria-label={copy.previous}
              onClick={() => step(-1)}
              className="focus-ring absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70 sm:left-4"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.next}
              onClick={() => step(1)}
              className="focus-ring absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70 sm:right-4"
            >
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Filmstrip. Only earns its space when there is more than one item. */}
      {many && (
        <div className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {items.map((thumb, i) => (
            <button
              key={thumb.src}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`${copy.show} ${i + 1}`}
              aria-current={i === index}
              className={`focus-ring relative h-12 w-16 shrink-0 overflow-hidden rounded-md transition-opacity ${
                i === index
                  ? "ring-2 ring-white"
                  : "opacity-55 hover:opacity-90"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb.poster ?? thumb.src}
                alt=""
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Opens the lightbox for a set of items, remembering which one was clicked.
 * Kept as a hook so a thread can host one viewer for every message in it.
 */
export function useLightbox(): {
  open: (items: MediaItem[], index: number) => void;
  viewer: ReactNode;
} {
  const [state, setState] = useState<{
    items: MediaItem[];
    index: number;
  } | null>(null);

  return {
    open: (items, index) => setState({ items, index }),
    viewer: state ? (
      <MediaLightbox
        items={state.items}
        index={state.index}
        onIndex={(index) => setState((s) => (s ? { ...s, index } : s))}
        onClose={() => setState(null)}
      />
    ) : null,
  };
}
