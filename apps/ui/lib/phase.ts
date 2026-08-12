"use client";

/**
 * Which product state Nexus is being shown in.
 *
 * The same demo affordance Common Source carries: Now, Next, Later, cumulative,
 * so Next shows Now plus Next and Later shows everything. It exists because
 * "here is the whole thing" and "here is what we would ship first" are two
 * different conversations, and holding both in one prototype otherwise means
 * showing people features you are not proposing yet.
 *
 * The assignment is a judgement, made on three things and recorded on every
 * entry so it can be argued with rather than taken on trust:
 *
 * - **impact** — how much of the product's argument stops working without it.
 * - **effort** — how much building it costs, including the risk of being wrong.
 * - **depends** — what has to exist first. This one usually decides it: a
 *   feature is not in Now because it is easy, it is in Now because everything
 *   else leans on it.
 *
 * Nothing here is persisted. A phase is how you are showing the prototype right
 * now, not a preference — leaving somebody in Later a week later, with no memory
 * of having chosen it, would make the product look like it has features it does
 * not.
 */

import { useSyncExternalStore } from "react";

export type Phase = "now" | "next" | "later";

export const PHASES: Phase[] = ["now", "next", "later"];
export const PHASE_LABELS: Record<Phase, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
};

const ORDER: Record<Phase, number> = { now: 0, next: 1, later: 2 };

type Level = "low" | "medium" | "high";

export interface PhaseFeature {
  /** app slug, or a sub-feature key gated inside an app */
  key: string;
  label: string;
  phase: Phase;
  impact: Level;
  effort: Level;
  /** keys this cannot ship before */
  depends: string[];
  /** why it landed in that phase, in one line */
  why: string;
}

/**
 * Everything the switcher governs.
 *
 * Keys are hub app slugs where the thing is an app, and free keys where it is a
 * capability inside one. An app slug missing from this list is always visible,
 * which is deliberate: forgetting to classify something should leave it on
 * screen rather than quietly delete it from the product.
 */
export const PHASE_FEATURES: PhaseFeature[] = [
  /* ---- Now: nothing else works without these, plus the three that carry
         the product's argument on their own. ---------------------------- */
  {
    key: "identity",
    label: "Identity & keys",
    phase: "now",
    impact: "high",
    effort: "medium",
    depends: [],
    why: "Every other feature addresses a handle. There is no product before this one.",
  },
  {
    key: "wallet",
    label: "Pay & Get paid",
    phase: "now",
    impact: "high",
    effort: "medium",
    depends: ["identity"],
    why: "The only place value is confirmed. Funding, tipping and escrow all end here.",
  },
  {
    key: "messages",
    label: "Messages",
    phase: "now",
    impact: "high",
    effort: "high",
    depends: ["identity"],
    why: "Where the command grammar lives, which is the argument the whole client is making.",
  },
  {
    key: "browser",
    label: "Browse",
    phase: "now",
    impact: "high",
    effort: "medium",
    depends: [],
    why: "It is a browser. Removing it leaves a chat app with a wallet attached.",
  },
  {
    key: "connect",
    label: "Web3 Connect",
    phase: "now",
    impact: "medium",
    effort: "low",
    depends: ["identity", "browser"],
    why: "Cheap, and the thing that makes the browser and the identity one product rather than two.",
  },
  {
    key: "commands-core",
    label: "Core verbs: /pay, /request, /tip, /whois",
    phase: "now",
    impact: "high",
    effort: "medium",
    depends: ["messages", "wallet"],
    why: "The smallest set that demonstrates a chat which moves money.",
  },
  {
    key: "settings",
    label: "Settings",
    phase: "now",
    impact: "medium",
    effort: "low",
    depends: [],
    why: "Reachability and chain policy were only reachable by typing a command nobody had read about.",
  },
  {
    key: "chain-policy",
    label: "What goes on chain",
    phase: "now",
    impact: "high",
    effort: "medium",
    depends: ["messages", "settings"],
    why: "A messaging client that will not say what it writes down is asking for trust it has not earned.",
  },

  {
    key: "gates",
    label: "Access gates & roles",
    phase: "now",
    impact: "high",
    effort: "high",
    depends: ["messages", "identity"],
    why: "The strongest idea in the product. Expensive, but a room with no door is not the thing being proposed.",
  },
  /* ---- Next: what the shell makes possible. ---------------------------- */
  {
    key: "once",
    label: "/once — one-time secrets",
    phase: "next",
    impact: "high",
    effort: "high",
    depends: ["messages", "identity"],
    why: "High impact and high risk: the guarantee is only worth making if the sealing is right.",
  },
  {
    key: "trade",
    label: "/send and /escrow",
    phase: "next",
    impact: "medium",
    effort: "high",
    depends: ["wallet", "commands-core"],
    why: "Moves a thing rather than an amount, which needs collectibles to exist.",
  },
  {
    key: "reputation",
    label: "/vouch and /renounce",
    phase: "next",
    impact: "medium",
    effort: "medium",
    depends: ["identity"],
    why: "Reputation is what makes a handle worth addressing, but it is useless before there are handles to address.",
  },
  {
    key: "roadmap",
    label: "Roadmap",
    phase: "now",
    impact: "high",
    effort: "medium",
    depends: ["wallet", "identity"],
    why: "Turns users into funders, and needs nothing beyond a wallet and attributable handles — both of which are here already.",
  },
  {
    key: "signer",
    label: "Sign",
    phase: "next",
    impact: "medium",
    effort: "medium",
    depends: ["identity"],
    why: "A clear use for the key that is not money, which broadens the argument.",
  },
  {
    key: "tx-viewer",
    label: "Explore",
    phase: "next",
    impact: "medium",
    effort: "low",
    depends: [],
    why: "Cheap, and it is what makes every 'view on chain' link go somewhere.",
  },
  {
    key: "mail",
    label: "Mail",
    phase: "next",
    impact: "medium",
    effort: "medium",
    depends: ["identity"],
    why: "Reaches people who will not move rooms, at the cost of being a second inbox.",
  },
  {
    key: "app-store",
    label: "App store & repositories",
    phase: "next",
    impact: "medium",
    effort: "medium",
    depends: [],
    why: "Only matters once there is more than one app worth installing.",
  },
  {
    key: "onboarding",
    label: "Per-app guides & release notes",
    phase: "now",
    impact: "medium",
    effort: "low",
    depends: [],
    why: "Cheap, and it is how anybody finds a command grammar they were never told about. Depends on the apps, not on the store that lists them.",
  },

  /* ---- Later: heavy, or leaning on most of the above. ------------------ */
  {
    key: "publisher",
    label: "Publish",
    phase: "later",
    impact: "medium",
    effort: "high",
    depends: ["wallet", "identity"],
    why: "Storage economics and moderation questions that none of the rest of the product has to answer.",
  },
  {
    key: "market",
    label: "Market",
    phase: "later",
    impact: "medium",
    effort: "high",
    depends: ["wallet", "trade"],
    why: "A marketplace is its own product. It needs transfer and escrow to be solid first.",
  },
  {
    key: "vault",
    label: "Vault",
    phase: "later",
    impact: "medium",
    effort: "high",
    depends: ["identity"],
    why: "Worth little until keys live somewhere better than this browser.",
  },
  {
    key: "baskets",
    label: "Baskets",
    phase: "later",
    impact: "low",
    effort: "medium",
    depends: ["wallet"],
    why: "A developer's view of the wallet. Real, and not what anybody is shown first.",
  },
  {
    key: "vote",
    label: "Vote",
    phase: "later",
    impact: "low",
    effort: "medium",
    depends: ["identity", "gates"],
    why: "Governance needs a constituency, which means it needs everything above it.",
  },
  {
    key: "learn",
    label: "Learn",
    phase: "later",
    impact: "low",
    effort: "low",
    depends: [],
    why: "Cheap, low impact, and mostly a link to material that lives elsewhere.",
  },
  {
    key: "attestations",
    label: "Attestations",
    phase: "later",
    impact: "medium",
    effort: "high",
    depends: ["identity", "reputation"],
    why: "The formal half of reputation, and the half with the legal questions attached.",
  },
  {
    key: "sync",
    label: "Device sync & social recovery",
    phase: "later",
    impact: "high",
    effort: "high",
    depends: ["identity", "reputation"],
    why: "High impact, and the hardest thing on the list to get right. Wrong here loses people's identities.",
  },
  {
    key: "search",
    label: "Search across every app",
    phase: "later",
    impact: "high",
    effort: "high",
    depends: ["messages", "mail", "vault", "wallet"],
    why: "Depends on almost everything, by definition — it is an index over all of it.",
  },
];

const FEATURE_PHASE: Record<string, Phase> = Object.fromEntries(
  PHASE_FEATURES.map((feature) => [feature.key, feature.phase]),
);

/** Visible in this phase? Unclassified keys are always visible. */
export function isVisibleInPhase(key: string, phase: Phase): boolean {
  const assigned = FEATURE_PHASE[key];
  if (!assigned) return true;
  return ORDER[assigned] <= ORDER[phase];
}

let phase: Phase = "now";
const listeners = new Set<() => void>();

export function setPhase(next: Phase): void {
  phase = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePhase(): Phase {
  return useSyncExternalStore(
    subscribe,
    () => phase,
    () => "now" as Phase,
  );
}

/** Reactive: is this feature part of the state being shown? */
export function useIsVisible(key: string): boolean {
  return isVisibleInPhase(key, usePhase());
}
