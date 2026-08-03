/**
 * table: downloads — placeholder rows.
 */
import type { DownloadItem } from "./types";

export const downloads: DownloadItem[] = [
  {
    id: "dl-whitepaper",
    fileName: "bitcoin-whitepaper.pdf",
    fileType: "document",
    sizeBytes: 184_292,
    sourceUrl: "https://bsvblockchain.org/bitcoin-whitepaper.pdf",
    status: "completed",
    progress: 100,
    thumbnail: null,
    createdAt: "2026-07-05T16:42:00.000Z",
  },
  {
    id: "dl-logo-pack",
    fileName: "bsv-brand-assets.zip",
    fileType: "archive",
    sizeBytes: 24_811_520,
    sourceUrl: "https://bsvblockchain.org/brand",
    status: "completed",
    progress: 100,
    thumbnail: { from: "#38bdf8", to: "#1d4ed8" },
    createdAt: "2026-07-04T11:15:00.000Z",
  },
  {
    id: "dl-keynote",
    fileName: "london-blockchain-keynote.mp4",
    fileType: "video",
    sizeBytes: 734_003_200,
    sourceUrl: "https://example.com/keynote",
    status: "in-progress",
    progress: 62,
    thumbnail: { from: "#f472b6", to: "#7c3aed" },
    createdAt: "2026-07-06T09:20:00.000Z",
  },
  {
    id: "dl-headshot",
    fileName: "team-photo.png",
    fileType: "image",
    sizeBytes: 2_411_724,
    sourceUrl: "https://example.com/media",
    status: "completed",
    progress: 100,
    thumbnail: { from: "#34d399", to: "#0f766e" },
    createdAt: "2026-07-01T08:30:00.000Z",
  },
];
