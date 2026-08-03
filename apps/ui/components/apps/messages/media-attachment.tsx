"use client";

import {
  AudioCard,
  DocumentCard,
} from "@/components/apps/messages/document-card";
import { content, type MediaItem } from "@/lib/data";
import { Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

/**
 * True where there is no hover, so inline controls can never be revealed.
 *
 * On a phone a tap has to mean "open this", not "start playing it behind a
 * control bar you cannot summon". Checked at the moment of the tap rather than
 * during render, so the server and the client agree on the first paint.
 */
function tapOpensViewer(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches
  );
}

/** `137` seconds as `2:17`, and an hour-long clip as `1:02:17`. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * A video in the transcript.
 *
 * Plays inline where it sits, the way Slack does, rather than throwing you into
 * a viewer for a nine-second clip. At rest it is the poster frame with a
 * duration chip in the bottom-left corner; on hover the real controls appear
 * along the bottom and a fullscreen button in the top-right corner.
 *
 * The controls are custom rather than `controls`, for one reason: the stock
 * control bar is a fixed-height black slab that cannot be themed and looks
 * wrong at thumbnail size. The lightbox uses native controls instead, where
 * there is room for them and scrubbing actually matters.
 *
 * Muted by default and never autoplaying. Sound that starts on its own in a
 * chat window is the single most hostile thing a message client can do.
 */
function VideoTile({
  item,
  onExpand,
  className = "",
}: {
  item: MediaItem;
  onExpand: () => void;
  className?: string;
}): ReactNode {
  const copy = content.messages.media;
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const duration = item.duration ?? 0;

  /**
   * Tap or click the tile. On a hover-capable pointer this plays in place, the
   * way Slack does for a short clip; on touch it opens the full-screen viewer,
   * where the platform's own controls are available.
   */
  const activate = (): void => {
    if (tapOpensViewer()) {
      onExpand();
      return;
    }
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  /** Play/pause from the control bar, which only exists on hover pointers. */
  const toggle = (): void => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const scrub = (event: React.MouseEvent<HTMLDivElement>): void => {
    const video = ref.current;
    if (!video || !video.duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    video.currentTime = ratio * video.duration;
  };

  return (
    <div className={`group/video relative overflow-hidden rounded-lg bg-black ${className}`}>
      <video
        ref={ref}
        src={item.src}
        poster={item.poster}
        muted={muted}
        playsInline
        preload="metadata"
        aria-label={item.alt}
        className="block size-full object-cover"
        onClick={activate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setElapsed(video.currentTime);
          if (video.duration) setProgress(video.currentTime / video.duration);
        }}
      />

      {/* Resting state: a big play affordance and the duration, like Slack. */}
      {!playing && (
        <button
          type="button"
          onClick={activate}
          aria-label={`${copy.play} ${item.alt ?? ""}`.trim()}
          className="focus-ring absolute inset-0 grid place-items-center bg-black/15 transition-colors hover:bg-black/25"
        >
          <span className="grid size-12 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
            <Play className="size-5 translate-x-px fill-current" aria-hidden="true" />
          </span>
        </button>
      )}

      {/* Duration chip, bottom-left, inset. Hidden once the bar takes over. */}
      {duration > 0 && (
        <span
          className={`pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums transition-opacity ${
            playing ? "opacity-0" : "group-hover/video:opacity-0"
          }`}
        >
          <Play className="size-2.5 fill-current" aria-hidden="true" />
          {formatDuration(duration)}
        </span>
      )}

      {/* Fullscreen, top-right, on hover. Opens the letterbox viewer. */}
      <button
        type="button"
        onClick={onExpand}
        aria-label={copy.fullscreen}
        className="focus-ring absolute top-2 right-2 hidden size-8 place-items-center rounded-lg bg-black/60 text-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover/video:opacity-100 focus-visible:opacity-100 hover:text-white [@media(hover:hover)]:grid"
      >
        <Maximize2 className="size-4" aria-hidden="true" />
      </button>

      {/* Full controls along the bottom, on hover or while playing. */}
      <div
        /* `hover:` guards keep the bar out of the way on touch, where it can
           never be revealed and would only intercept taps. */
        className={`pointer-events-none absolute inset-x-0 bottom-0 hidden items-center gap-2 bg-linear-to-t from-black/85 to-transparent px-2 pt-6 pb-1.5 transition-opacity hover:pointer-events-auto [@media(hover:hover)]:flex [@media(hover:hover)]:pointer-events-auto ${
          playing ? "opacity-100" : "opacity-0 group-hover/video:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? copy.pause : copy.play}
          className="focus-ring grid size-7 shrink-0 place-items-center rounded-full text-white/90 hover:bg-white/15 hover:text-white"
        >
          {playing ? (
            <Pause className="size-3.5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="size-3.5 fill-current" aria-hidden="true" />
          )}
        </button>

        {/* Scrub bar. A div rather than a range input so the filled portion can
            be styled consistently across browsers. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={copy.seek}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(elapsed)}
          onClick={scrub}
          onKeyDown={(event) => {
            const video = ref.current;
            if (!video) return;
            if (event.key === "ArrowRight") video.currentTime += 2;
            if (event.key === "ArrowLeft") video.currentTime -= 2;
          }}
          className="focus-ring group/bar h-4 min-w-0 flex-1 cursor-pointer py-1.5"
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <span className="shrink-0 text-[11px] text-white/90 tabular-nums">
          {formatDuration(elapsed)}
          {duration > 0 ? ` / ${formatDuration(duration)}` : ""}
        </span>

        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? copy.unmute : copy.mute}
          className="focus-ring grid size-7 shrink-0 place-items-center rounded-full text-white/90 hover:bg-white/15 hover:text-white"
        >
          {muted ? (
            <VolumeX className="size-3.5" aria-hidden="true" />
          ) : (
            <Volume2 className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function ImageTile({
  item,
  onExpand,
  className = "",
}: {
  item: MediaItem;
  onExpand: () => void;
  className?: string;
}): ReactNode {
  const copy = content.messages.media;
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={item.alt ? `${copy.open} ${item.alt}` : copy.open}
      className={`focus-ring group/image relative block overflow-hidden rounded-lg bg-surface ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt={item.alt ?? ""}
        loading="lazy"
        width={item.width}
        height={item.height}
        className="block size-full object-cover transition-transform duration-300 group-hover/image:scale-[1.02]"
      />
      <span className="absolute top-2 right-2 hidden size-8 place-items-center rounded-lg bg-black/55 text-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover/image:opacity-100 [@media(hover:hover)]:grid">
        <Maximize2 className="size-4" aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * The media in one message.
 *
 * A single item keeps its own aspect ratio, because one photo of a valley
 * cropped to a grid cell is a worse photo. Two or more go into a mosaic of equal
 * cells, which is the only way a set stays scannable, with anything past four
 * collapsed behind a "+N" that opens the viewer at the right index.
 */
export function MediaAttachment({
  items,
  onOpen,
  mine = false,
}: {
  items: MediaItem[];
  onOpen: (index: number) => void;
  /** on the user's own bubble, which is already accent-filled */
  mine?: boolean;
}): ReactNode {
  const copy = content.messages.media;
  if (items.length === 0) return null;

  /*
   * Pictures and documents are laid out differently, so they are separated
   * before either is rendered: a mosaic works for things you look at, and reads
   * as a puzzle for things you open. The viewer only ever receives the visual
   * ones, which keeps its index meaningful.
   */
  const visual = items.filter(
    (item) => item.kind === "image" || item.kind === "video",
  );
  const documents = items.filter(
    (item) => item.kind === "file" || item.kind === "audio",
  );

  if (documents.length > 0) {
    return (
      <div className="space-y-1.5">
        {visual.length > 0 && (
          <MediaAttachment items={visual} onOpen={onOpen} mine={mine} />
        )}
        {documents.map((item) =>
          item.kind === "audio" ? (
            <AudioCard key={item.src} item={item} mine={mine} />
          ) : (
            <DocumentCard key={item.src} item={item} mine={mine} />
          ),
        )}
      </div>
    );
  }

  if (items.length === 1) {
    const item = items[0]!;
    const portrait = item.height > item.width;
    return (
      <div
        className={`w-full ${portrait ? "max-w-52" : "max-w-md"}`}
        style={{ aspectRatio: `${item.width} / ${item.height}` }}
      >
        {item.kind === "video" ? (
          <VideoTile item={item} onExpand={() => onOpen(0)} className="size-full" />
        ) : (
          <ImageTile item={item} onExpand={() => onOpen(0)} className="size-full" />
        )}
      </div>
    );
  }

  const shown = items.slice(0, 4);
  const hidden = items.length - shown.length;

  return (
    <div
      className={`grid w-full max-w-md gap-1 ${
        shown.length === 2 ? "grid-cols-2" : "grid-cols-2"
      }`}
    >
      {shown.map((item, index) => {
        // Three items read best as one tall lead and two stacked beside it.
        const lead = shown.length === 3 && index === 0;
        return (
          <div
            key={item.src}
            className={`relative ${lead ? "row-span-2 aspect-2/3" : "aspect-4/3"}`}
          >
            {item.kind === "video" ? (
              <VideoTile
                item={item}
                onExpand={() => onOpen(index)}
                className="size-full"
              />
            ) : (
              <ImageTile
                item={item}
                onExpand={() => onOpen(index)}
                className="size-full"
              />
            )}
            {hidden > 0 && index === shown.length - 1 && (
              <button
                type="button"
                onClick={() => onOpen(index)}
                aria-label={`${copy.more} ${hidden}`}
                className="focus-ring absolute inset-0 grid place-items-center rounded-lg bg-black/60 text-lg font-bold text-white backdrop-blur-[2px]"
              >
                +{hidden}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
