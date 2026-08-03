"use client";

import { useHub } from "@/components/hub/hub-provider";
import { panelContainer, panelItem } from "@/components/hub/panel-motion";
import { content, getDownloads, type DownloadItem } from "@/lib/data";
import {
  Archive,
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Package,
  Video,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

const fileTypeIcons: Record<DownloadItem["fileType"], LucideIcon> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  archive: Archive,
  app: Package,
};

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

export function DownloadsPanel(): ReactNode {
  const { setLibraryTab } = useHub();
  const downloads = getDownloads();

  return (
    <motion.div
      className="flex h-full flex-col rounded-2xl bg-surface p-3"
      variants={panelContainer}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <motion.div
        variants={panelItem}
        className="flex items-center gap-1.5 px-1 pb-2"
      >
        <button
          type="button"
          aria-label="Back to profiles"
          onClick={() => setLibraryTab("spaces")}
          className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <h2 className="text-sm font-semibold">
          {content.library.downloads.title}
        </h2>
      </motion.div>

      <motion.div
        variants={panelContainer}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto"
      >
        {downloads.length === 0 && (
          <motion.p
            variants={panelItem}
            className="px-1.5 text-sm text-muted-foreground"
          >
            {content.library.downloads.empty}
          </motion.p>
        )}
        {downloads.map((item) => {
          const Icon = fileTypeIcons[item.fileType];
          return (
            <motion.div
              key={item.id}
              variants={panelItem}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface-hover"
            >
              {item.thumbnail ? (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${item.thumbnail.from}, ${item.thumbnail.to})`,
                  }}
                  aria-hidden="true"
                >
                  <Icon className="size-4 text-white/85" />
                </span>
              ) : (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"
                  aria-hidden="true"
                >
                  <Icon className="size-4 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                {item.status === "in-progress" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={item.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Downloading ${item.fileName}`}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {item.progress}%
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(item.sizeBytes)}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
