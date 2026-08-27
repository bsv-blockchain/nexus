/**
 * tables: spaces, space_items, tabs, favorites, pages — placeholder rows.
 */
import type { BrowserTab, Favorite, MockPage, Space, SpaceItem } from "./types";

export const favorites: Favorite[] = [
  {
    id: "fav-woc",
    title: "WhatsOnChain",
    url: "https://whatsonchain.com",
    favicon: "W",
    faviconColor: "#facc15",
    sortOrder: 0,
    createdAt: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "fav-bsv",
    title: "BSV Blockchain",
    url: "https://bsvblockchain.org",
    favicon: "▲",
    faviconColor: "#3b82f6",
    sortOrder: 1,
    createdAt: "2026-07-01T08:01:00.000Z",
  },
];

export const spaces: Space[] = [
  {
    id: "space-my-hub",
    name: "My Workspace",
    // "hub" renders the Nexus brand mark via SpaceIcon (default profile icon).
    /* One of the picker's own, like every other profile. The brand mark said
       "this is Nexus" on a thing that is one profile among several, and nobody
       could pick it again after changing it. A house is no longer one of the
       picker's own either — the strip's Home button wears that — so this is the
       nearest thing the picker still offers. */
    emoji: "lucide:Coffee",
    sortOrder: 0,
    createdAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "space-work",
    name: "Work",
    /* One of the picker's own icons rather than an emoji. A seeded profile
       wearing something the picker cannot produce is a profile nobody can
       recreate, and it renders at a different weight from every other one. */
    emoji: "lucide:Briefcase",
    sortOrder: 1,
    createdAt: "2026-02-14T10:00:00.000Z",
  },
];

export const spaceItems: SpaceItem[] = [
  {
    id: "item-basics",
    spaceId: "space-my-hub",
    kind: "folder",
    title: "Nexus Basics",
    icon: "Folder",
    iconColor: "#4353ff",
    sortOrder: 0,
    createdAt: "2026-02-01T10:05:00.000Z",
  },
  {
    id: "child-getting-started",
    spaceId: "space-my-hub",
    parentId: "item-basics",
    kind: "page",
    pageId: "getting-started",
    title: "Getting Started",
    icon: "Rocket",
    iconColor: "#4353ff",
    sortOrder: 0,
    createdAt: "2026-02-01T10:06:00.000Z",
  },
  {
    id: "child-resources",
    spaceId: "space-my-hub",
    parentId: "item-basics",
    kind: "link",
    url: "https://bsvblockchain.org",
    title: "Nexus Resources",
    icon: "Globe",
    iconColor: "#3b82f6",
    sortOrder: 1,
    createdAt: "2026-02-01T10:07:00.000Z",
  },
  {
    id: "child-skills",
    spaceId: "space-my-hub",
    parentId: "item-basics",
    kind: "link",
    url: "https://docs.bsvblockchain.org",
    title: "BSV Skills Center",
    icon: "Globe",
    iconColor: "#16a34a",
    sortOrder: 2,
    createdAt: "2026-02-01T10:08:00.000Z",
  },
  {
    id: "child-woc",
    spaceId: "space-my-hub",
    parentId: "item-basics",
    kind: "link",
    url: "https://whatsonchain.com",
    title: "WhatsOnChain Explorer",
    icon: "Globe",
    iconColor: "#facc15",
    sortOrder: 3,
    createdAt: "2026-02-01T10:09:00.000Z",
  },
  {
    id: "item-work-notes",
    spaceId: "space-work",
    kind: "folder",
    title: "Meeting Notes",
    icon: "Folder",
    iconColor: "#16a34a",
    sortOrder: 0,
    createdAt: "2026-02-14T10:10:00.000Z",
  },
];

export const browserTabs: BrowserTab[] = [
  {
    id: "tab-fractional",
    spaceId: "space-my-hub",
    title: "Fractional Farming",
    url: "https://www.fractional.farm",
    favicon: "F",
    faviconColor: "#16a34a",
    sortOrder: 0,
    createdAt: "2026-07-06T08:00:00.000Z",
  },
  {
    id: "tab-woc",
    spaceId: "space-my-hub",
    title: "WhatsOnChain.com – BSV Explorer",
    url: "https://whatsonchain.com",
    favicon: "W",
    faviconColor: "#facc15",
    sortOrder: 1,
    createdAt: "2026-07-06T08:05:00.000Z",
  },
  {
    id: "tab-bsv",
    spaceId: "space-my-hub",
    title: "BSV Blockchain | Scalable Blockchain",
    url: "https://bsvblockchain.org",
    favicon: "▲",
    faviconColor: "#3b82f6",
    sortOrder: 2,
    createdAt: "2026-07-06T08:10:00.000Z",
  },
  {
    id: "tab-docs",
    spaceId: "space-work",
    title: "BSV Skills Center",
    url: "https://docs.bsvblockchain.org",
    favicon: "D",
    faviconColor: "#16a34a",
    sortOrder: 0,
    createdAt: "2026-07-05T14:00:00.000Z",
  },
];

export const mockPages: MockPage[] = [
  {
    id: "page-fractional",
    url: "https://www.fractional.farm",
    heading: "Fractional Farming",
    body: "Invest in a fraction of a local farm's production and receive your share of the harvest: raw milk, cheese, vegetables and more, straight from the producer.",
    linkText: "Browse campaigns",
    linkHref: "#",
  },
  {
    id: "page-woc",
    url: "https://whatsonchain.com",
    heading: "WhatsOnChain",
    body: "Explore blocks, transactions and addresses on the BSV blockchain. Search by txid, block height or address to inspect on-chain activity.",
    linkText: "Open explorer",
    linkHref: "#",
  },
  {
    id: "page-bsv",
    url: "https://bsvblockchain.org",
    heading: "BSV Blockchain",
    body: "The scalable public blockchain for enterprise. Unbounded scaling, low fees and a stable protocol for building real applications.",
    linkText: "Discover BSV",
    linkHref: "#",
  },
  {
    id: "page-docs",
    url: "https://docs.bsvblockchain.org",
    heading: "BSV Skills Center",
    body: "Guides, references and courses for building on the BSV blockchain, from first transaction to production infrastructure.",
    linkText: "Start learning",
    linkHref: "#",
  },
];
