"use client";

import { formatDuration } from "@/components/apps/messages/media-attachment";
import { Sheet } from "@/components/apps/messages/sheet";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { content, media, type MediaItem } from "@/lib/data";
import { Check, Play, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

/**
 * Reads the intrinsic size (and, for a clip, the duration) of a file the user
 * picked, by loading it and asking the element.
 *
 * Worth the round trip: without real dimensions the tile cannot reserve its box,
 * and the thread jumps as each attachment decodes.
 */
async function describe(file: File): Promise<MediaItem | null> {
  const src = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    URL.revokeObjectURL(src);
    return null;
  }

  return new Promise((resolve) => {
    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          kind: "video",
          src,
          duration: video.duration,
          width: video.videoWidth || 1280,
          height: video.videoHeight || 720,
          alt: file.name,
        });
      video.onerror = () => resolve(null);
      video.src = src;
      return;
    }
    const image = new Image();
    image.onload = () =>
      resolve({
        kind: "image",
        src,
        width: image.naturalWidth,
        height: image.naturalHeight,
        alt: file.name,
      });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

const LIBRARY: MediaItem[] = Object.values(media);

/** Pictures and clips, or documents and audio — never both in one picker. */
function libraryFor(mode: "media" | "files"): MediaItem[] {
  const visual = (item: MediaItem): boolean =>
    item.kind === "image" || item.kind === "video";
  return LIBRARY.filter((item) => (mode === "media" ? visual(item) : !visual(item)));
}

/**
 * Attachment picker.
 *
 * Two ways in, because a prototype needs both. The library is the seeded mock
 * media, so the flow can be demonstrated on any machine with no files to hand;
 * the file input is real, and a photo or clip chosen there is measured, attached
 * and played exactly like a seeded one. Multi-select throughout, since the point
 * of the carousel is more than one item.
 */
export function MediaPicker({
  open,
  onClose,
  onAttach,
  mode = "media",
}: {
  open: boolean;
  onClose: () => void;
  onAttach: (items: MediaItem[]) => void;
  /** which half of the library to offer, and which file types to accept */
  mode?: "media" | "files";
}): ReactNode {
  const copy = content.messages.media;
  const library = libraryFor(mode);
  const [chosen, setChosen] = useState<MediaItem[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const toggle = (item: MediaItem): void =>
    setChosen((current) =>
      current.some((c) => c.src === item.src)
        ? current.filter((c) => c.src !== item.src)
        : [...current, item],
    );

  const commit = (): void => {
    if (chosen.length === 0) return;
    onAttach(chosen);
    setChosen([]);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setChosen([]);
        onClose();
      }}
      label={mode === "files" ? copy.attachFile : copy.attach}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setChosen([]);
              onClose();
            }}
            className="focus-ring flex-1 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={chosen.length === 0}
            className={`focus-ring flex-1 rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${PRIMARY_CTA}`}
          >
            {chosen.length > 1 ? `${copy.send} (${chosen.length})` : copy.send}
          </button>
        </div>
      }
    >
      <div className="px-5 pt-3 pb-4">
        <p className="text-base font-bold">
          {mode === "files" ? copy.pickFiles : copy.pick}
        </p>
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
          {mode === "files" ? copy.pickFilesHint : copy.pickHint}
        </p>

        <button
          type="button"
          onClick={() => input.current?.click()}
          className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <Upload className="size-4" aria-hidden="true" />
          {mode === "files" ? copy.attachFile : copy.attach}
        </button>
        <input
          ref={input}
          type="file"
          accept={mode === "files" ? "*/*" : "image/*,video/*"}
          multiple
          hidden
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            const described = await Promise.all(files.map(describe));
            const items = described.filter((item): item is MediaItem =>
              Boolean(item),
            );
            if (items.length > 0) setChosen((current) => [...current, ...items]);
          }}
        />

        <ul className="mt-3 grid grid-cols-3 gap-1.5">
          {[...chosen.filter((c) => !library.includes(c)), ...library].map(
            (item) => {
              const selected = chosen.some((c) => c.src === item.src);
              const order = chosen.findIndex((c) => c.src === item.src);
              return (
                <li key={item.src}>
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    aria-pressed={selected}
                    aria-label={item.alt ?? item.src}
                    className={`focus-ring relative block aspect-square w-full overflow-hidden rounded-lg bg-surface ${
                      selected ? "ring-2 ring-accent" : ""
                    }`}
                  >
                    {item.poster || item.kind === "image" ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.poster ?? item.src}
                        alt=""
                        className="size-full object-cover object-top"
                      />
                    ) : (
                      <span className="grid size-full place-items-center px-1 text-center text-[9px] leading-tight text-muted-foreground">
                        {item.fileName}
                      </span>
                    )}
                    {item.kind === "video" && (
                      <span className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-px text-[10px] font-medium text-white tabular-nums">
                        <Play className="size-2 fill-current" aria-hidden="true" />
                        {item.duration ? formatDuration(item.duration) : ""}
                      </span>
                    )}
                    {selected && (
                      <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                        {chosen.length > 1 ? order + 1 : <Check className="size-3" />}
                      </span>
                    )}
                  </button>
                </li>
              );
            },
          )}
        </ul>
      </div>
    </Sheet>
  );
}
