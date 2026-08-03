/**
 * table: app_collections — persona bundles surfaced in the App Store column.
 * Toggling a collection installs/removes all of its apps at once. "all"
 * covers every app (handled in the accessor, not listed here).
 */
import type { AppCollection } from "./types";

export const appCollections: AppCollection[] = [
  {
    id: "essentials",
    name: "Essentials",
    description: "The apps to get started.",
    icon: "Star",
    apps: ["messages", "wallet", "identity"],
  },
  {
    id: "core",
    name: "Web",
    description: "Browse and connect to the web.",
    icon: "Globe",
    apps: ["browser", "connect"],
  },
  {
    id: "consumer",
    name: "Consumer",
    description: "Pay, chat and shop.",
    icon: "ShoppingBag",
    apps: ["identity", "wallet", "messages", "market"],
    bundlesWeb: true,
  },
  {
    id: "knowledge",
    name: "Knowledge Worker",
    description: "Sign, store, learn and vote.",
    icon: "Briefcase",
    apps: ["identity", "signer", "vault", "learn", "vote"],
  },
  {
    id: "creator",
    name: "Creator",
    description: "Publish and monetize your work.",
    icon: "Palette",
    apps: ["identity", "publisher", "market", "wallet"],
    bundlesWeb: true,
  },
  {
    id: "developer",
    name: "Developer",
    description: "Inspect chains, baskets and keys.",
    icon: "Code2",
    apps: ["identity", "tx-viewer", "baskets", "vault", "wallet"],
    bundlesWeb: true,
  },
  {
    id: "all",
    name: "Everything",
    description: "Enable every app in Nexus.",
    icon: "Sparkles",
    apps: [],
  },
];
