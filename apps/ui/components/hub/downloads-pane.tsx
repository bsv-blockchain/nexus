"use client";

import { formatBytes } from "@/components/hub/downloads-panel";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getDownloads,
  getSpaces,
  type DownloadItem,
} from "@/lib/data";
import {
  Archive,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Package,
  RotateCw,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const ICONS: Record<DownloadItem["fileType"], LucideIcon> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  archive: Archive,
  app: Package,
};

const copy = content.library.downloads;

/** "6 Aug" — enough to place it, short enough for a 340px column. */
function shortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

function Row({ item }: { item: DownloadItem }): ReactNode {
  const Icon = ICONS[item.fileType];
  const failed = item.status === "failed";
  const running = item.status === "in-progress";
  return (
    <li className="flex items-start gap-2.5 px-4 py-2.5">
      <span
        className="bg-surface text-muted-foreground mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">
          {item.fileName}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-[10px] tabular-nums">
          {formatBytes(item.sizeBytes)} · {shortDate(item.createdAt)}
        </span>
        {/* Only where it says something. A full bar under every finished file
            is a row of green ticks nobody reads. */}
        {running && (
          <span className="bg-muted mt-1.5 block h-1 overflow-hidden rounded-full">
            <span
              className="bg-accent block h-full rounded-full"
              style={{ width: `${item.progress}%` }}
            />
          </span>
        )}
        {failed && (
          <span className="text-negative mt-0.5 block text-[10px]">
            {copy.failed}
          </span>
        )}
      </span>
      {failed ? (
        <button
          type="button"
          aria-label={copy.retry}
          title={copy.retry}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground mt-0.5 shrink-0 rounded-md p-1"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
        </button>
      ) : running ? (
        <span className="text-muted-foreground mt-1 shrink-0 text-[10px] tabular-nums">
          {item.progress}%
        </span>
      ) : (
        <Check
          className="text-positive mt-1 size-3.5 shrink-0"
          aria-hidden="true"
        />
      )}
    </li>
  );
}

/**
 * What each profile has downloaded.
 *
 * The profile picker is at the top rather than the pane being per-profile,
 * because the question people actually arrive with is "where did that file go" —
 * and if the answer is "in your other workspace", a pane that only ever shows the
 * current one cannot give it. Switching here changes what is listed and nothing
 * else: it does not switch the profile you are browsing in, which would be a
 * large thing to do from a settings row.
 */
export function DownloadsPane(): ReactNode {
  const { activeSpaceId } = useHub();
  const spaces = getSpaces();
  const [spaceId, setSpaceId] = useState(activeSpaceId);
  const [picking, setPicking] = useState(false);
  const space = spaces.find((entry) => entry.id === spaceId) ?? spaces[0];
  const items = getDownloads(spaceId);

  return (
    <div>
      <div className="border-border/60 border-b p-3">
        <button
          type="button"
          onClick={() => setPicking((value) => !value)}
          aria-expanded={picking}
          className="focus-ring border-border bg-surface hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground block text-[10px] font-bold tracking-wide uppercase">
              {copy.profile}
            </span>
            <span className="block truncate text-sm font-semibold">
              {space?.name}
            </span>
          </span>
          <ChevronDown
            className={`text-muted-foreground size-4 shrink-0 transition-transform ${
              picking ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
        {picking && (
          <div role="radiogroup" className="mt-1.5 space-y-0.5">
            {spaces.map((entry) => {
              const active = entry.id === spaceId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSpaceId(entry.id);
                    setPicking(false);
                  }}
                  className={`focus-ring flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${
                    active ? "bg-accent/15 font-medium" : "hover:bg-surface-hover"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  <span className="text-muted-foreground text-[10px] tabular-nums">
                    {getDownloads(entry.id).length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground p-4 text-xs text-pretty">
          {copy.empty}
        </p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
