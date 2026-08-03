"use client";

import { formatDuration } from "@/components/apps/messages/media-attachment";
import { content, type MediaItem } from "@/lib/data";
import {
  Download,
  FileText,
  FileType,
  Music,
  Pause,
  Play,
  Presentation,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

/** The mark for a document, chosen from its extension. */
function DocIcon({ name }: { name: string }): ReactNode {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pptx" || ext === "key") return <Presentation className="size-5" />;
  if (ext === "md" || ext === "txt") return <FileType className="size-5" />;
  return <FileText className="size-5" />;
}

/**
 * A document in a message.
 *
 * With a page preview it leads with the page, because recognising a document by
 * sight is faster than reading its filename — the same reason Slack and mail
 * clients render a first page. Without one it is a compact row, which is all a
 * plain-text file warrants.
 */
export function DocumentCard({
  item,
  mine,
}: {
  item: MediaItem;
  mine: boolean;
}): ReactNode {
  const copy = content.messages.media;
  const name = item.fileName ?? item.src.split("/").pop() ?? "file";
  const tone = mine
    ? "border-white/25 bg-white/10"
    : "border-border bg-surface-raised";

  if (item.poster) {
    return (
      <a
        href={item.src}
        download
        className={`focus-ring group/doc block w-full max-w-64 overflow-hidden rounded-xl border ${tone}`}
      >
        <span className="block aspect-4/3 overflow-hidden bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.poster}
            alt={item.alt ?? ""}
            loading="lazy"
            className="size-full object-cover object-top transition-transform duration-300 group-hover/doc:scale-[1.02]"
          />
        </span>
        <span className="flex items-center gap-2 px-2.5 py-2">
          <span className="shrink-0 opacity-70">
            <DocIcon name={name} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{name}</span>
            {item.fileSize && (
              <span className="block text-[11px] opacity-70">
                {item.fileSize}
              </span>
            )}
          </span>
          <Download className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </span>
      </a>
    );
  }

  return (
    <a
      href={item.src}
      download
      aria-label={`${copy.download} ${name}`}
      className={`focus-ring flex w-full max-w-72 items-center gap-2.5 rounded-xl border px-3 py-2.5 ${tone}`}
    >
      <span className="shrink-0 opacity-70">
        <DocIcon name={name} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        {item.fileSize && (
          <span className="block text-[11px] opacity-70">{item.fileSize}</span>
        )}
      </span>
      <Download className="size-4 shrink-0 opacity-60" aria-hidden="true" />
    </a>
  );
}

/**
 * An audio file, as a player rather than a download.
 *
 * A track you cannot hear without leaving the conversation is a worse
 * attachment than one you can, and audio is short enough to belong inline.
 */
export function AudioCard({
  item,
  mine,
}: {
  item: MediaItem;
  mine: boolean;
}): ReactNode {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const name = item.fileName ?? "audio";
  const tone = mine
    ? "border-white/25 bg-white/10"
    : "border-border bg-surface-raised";

  return (
    <div
      className={`flex w-full max-w-72 items-center gap-2.5 rounded-xl border px-3 py-2.5 ${tone}`}
    >
      <audio
        ref={ref}
        src={item.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const el = event.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
      />
      <button
        type="button"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        aria-label={playing ? content.messages.media.pause : content.messages.media.play}
        className="focus-ring grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
      >
        {playing ? (
          <Pause className="size-4 fill-current" aria-hidden="true" />
        ) : (
          <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
        )}
      </button>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Music className="size-3 shrink-0 opacity-60" aria-hidden="true" />
          <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        </span>
        {item.artist && (
          <span className="block truncate text-[11px] opacity-70">
            {item.artist}
          </span>
        )}
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-current/20">
          <span
            className="block h-full rounded-full bg-current"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      </span>
      {item.duration !== undefined && (
        <span className="shrink-0 text-[11px] opacity-70 tabular-nums">
          {formatDuration(item.duration)}
        </span>
      )}
    </div>
  );
}
