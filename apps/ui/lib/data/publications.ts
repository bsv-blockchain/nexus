/**
 * tables: publications, mint_tiers — placeholder rows.
 */
import type { MintTier, Publication } from "./types";

export const mintTiers: MintTier[] = [
  {
    id: "tier-free",
    name: "Free",
    supplyPct: 67,
    price: "Free",
    accent: "#4353ff",
  },
  {
    id: "tier-supporter",
    name: "Supporter",
    supplyPct: 25,
    price: "0.05 BSV",
    accent: "#16a34a",
  },
  {
    id: "tier-founder",
    name: "Founder",
    supplyPct: 8,
    price: "0.25 BSV",
    accent: "#d97706",
  },
];

export const publications: Publication[] = [
  {
    id: "pub-sunrise",
    title: "Sunrise over the Bay",
    mediaType: "image",
    fileName: "sunrise-bay.jpg",
    sizeBytes: 3_204_812,
    status: "published",
    txid: "aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66",
    thumbnail: { from: "#f97316", to: "#7c3aed" },
    createdAt: "2026-06-28T06:45:00.000Z",
  },
  {
    id: "pub-demo",
    title: "Product Demo v2",
    mediaType: "video",
    fileName: "product-demo-v2.mp4",
    sizeBytes: 182_400_000,
    status: "published",
    txid: "bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66ee77",
    thumbnail: { from: "#0ea5e9", to: "#1e293b" },
    createdAt: "2026-06-20T14:10:00.000Z",
  },
  {
    id: "pub-roadmap",
    title: "Public Roadmap 2026",
    mediaType: "document",
    fileName: "roadmap-2026.pdf",
    sizeBytes: 1_044_480,
    status: "published",
    txid: "cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66ee77ff88",
    thumbnail: { from: "#22c55e", to: "#0f766e" },
    createdAt: "2026-05-30T09:00:00.000Z",
  },
  {
    id: "pub-teaser",
    title: "Launch Teaser",
    mediaType: "video",
    fileName: "launch-teaser.mp4",
    sizeBytes: 96_500_000,
    status: "processing",
    txid: null,
    thumbnail: { from: "#e11d48", to: "#4c1d95" },
    createdAt: "2026-07-06T08:55:00.000Z",
  },
  {
    id: "pub-cover",
    title: "Album Cover Draft",
    mediaType: "image",
    fileName: "album-cover-draft.png",
    sizeBytes: 5_820_416,
    status: "draft",
    txid: null,
    thumbnail: { from: "#64748b", to: "#111827" },
    createdAt: "2026-07-03T21:30:00.000Z",
  },
];
