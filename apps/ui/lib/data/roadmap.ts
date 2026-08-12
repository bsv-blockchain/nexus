/**
 * table: roadmap — every feature Nexus has shipped, been paid for, or wants.
 *
 * One roadmap, because there is one product. The three columns are the only
 * states a feature can be in and they say something different from a normal
 * backlog: **fundable** means nobody has paid for it yet, **funded** means the
 * money is there and the work is not, **shipped** means it is in your hands.
 *
 * The shipped column is not written here. It is derived from `releases`, so a
 * feature appears on the board because it actually shipped rather than because
 * somebody remembered to add it twice. The consequence is worth stating: you
 * cannot fake a shipped feature without also claiming a release.
 *
 * Amounts are satoshis, like everywhere else in this client. A roadmap
 * denominated in a unit the wallet does not use makes people convert in their
 * heads before they can tell whether a number is large.
 */

import { releases } from "./releases";

export type RoadmapStatus = "fundable" | "funded" | "shipped";

/** How the board orders a column. */
export type RoadmapSort =
  | "top-funded"
  | "closest"
  | "newest"
  | "most-discussed";

/** Risk, time and unknowns — not lines of code. */
export type Complexity = "low" | "medium" | "high";

export interface RoadmapPledge {
  /** MessagePerson id, or "me" for the signed-in user */
  personId: string;
  sats: number;
  at: string;
}

export interface RoadmapComment {
  id: string;
  personId: string;
  body: string;
  at: string;
}

export interface RoadmapFeature {
  /** stable slug; also what `/roadmap` takes as its argument */
  id: string;
  title: string;
  /** the one line a card shows */
  summary: string;
  /** what it is and why it is worth building */
  body: string;
  status: RoadmapStatus;
  complexity: Complexity;
  /** what it costs to get built */
  goalSats: number;
  /** what has been put behind it so far */
  pledgedSats: number;
  pledges: RoadmapPledge[];
  comments: RoadmapComment[];
  createdAt: string;
  fundedAt?: string;
  shippedAt?: string;
  /** the release it went out in, where it shipped */
  release?: string;
  /** the specification behind it, where there is one */
  reference?: string;
  /**
   * What whoever scoped it said about the size of it.
   *
   * A complexity of "high" tells a reader almost nothing on its own — the
   * useful part is *why*, and the person who wrote the ticket is the one who
   * knows. Shown in the complexity popover, next to what the three levels mean.
   */
  devNote?: string;
}

/** FNV-1a, so derived figures are stable across renders and reloads. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The people who put money behind shipped work, drawn from the address book. */
const BACKERS = [
  "tw-elonmoist",
  "tw-randy",
  "tw-shruggr",
  "tw-utxo",
  "siggi-oskarsson",
  "darren-kellenschwiler",
  "connor-murray",
  "tc-thoth",
  "tc-kuro",
  "tw-mikey",
  "asgeir-oskarsson",
  "mohammad-jaber",
];

/**
 * Backfills the pledges behind a shipped feature.
 *
 * Every shipped feature was paid for before it was built, so its ledger has to
 * add up to its goal — a shipped card showing a part-filled bar would be
 * telling you the money never arrived. The last backer takes the remainder,
 * which is also what happens in practice: somebody closes the gap.
 */
function pledgesFor(id: string, goal: number, at: string): RoadmapPledge[] {
  const seed = hash(id);
  const count = 3 + (seed % 5);
  const out: RoadmapPledge[] = [];
  let left = goal;
  for (let i = 0; i < count; i += 1) {
    const personId = BACKERS[(seed + i * 7) % BACKERS.length]!;
    const last = i === count - 1;
    const share = last
      ? left
      : Math.round((goal / count) * (0.6 + (hash(`${id}:${i}`) % 80) / 100));
    const sats = Math.max(1, Math.min(share, left - (count - 1 - i)));
    left -= sats;
    out.push({ personId, sats, at });
  }
  return out;
}

/** Round numbers, but not the same round number for everything. */
function goalFor(id: string, complexity: Complexity): number {
  const base = complexity === "low" ? 8 : complexity === "medium" ? 24 : 60;
  const spread = (hash(`goal:${id}`) % 9) * (complexity === "high" ? 6 : 2);
  return (base + spread) * 1_000_000;
}

/**
 * Which release feature is how hard. Judged rather than derived: the data has
 * no field for it, and guessing from the length of a description would be
 * inventing a signal.
 */
const SHIPPED_COMPLEXITY: Record<string, Complexity> = {
  once: "high",
  saved: "low",
  "message-options": "low",
  "render-image": "medium",
  "chain-policy": "medium",
  permanence: "low",
  settings: "medium",
  repositories: "low",
  send: "medium",
  escrow: "high",
  gates: "high",
  roles: "medium",
  timelock: "high",
  vouch: "medium",
  renounce: "low",
};

/**
 * What the person who scoped each one said about its size.
 *
 * Written against the same ids as the complexity table, and deliberately about
 * the *difficulty* rather than the feature — the description already covers
 * what it does.
 */
const SHIPPED_NOTES: Record<string, string> = {
  once: "Most of the cost is in being sure the client genuinely cannot open what it sealed. The UI was two days; convincing ourselves about the key handling was three weeks.",
  saved:
    "A snapshot rather than a pointer, which is the only decision here. Everything else is a list.",
  "message-options":
    "A context menu. The long pole was deciding which entries to hide rather than grey out.",
  "render-image":
    "Canvas composition, so it is its own layout at its own size. Straightforward once we stopped trying to screenshot the bubble.",
  "chain-policy":
    "Three settings is easy. Making every surface report the same answer honestly is what took the time.",
  permanence:
    "One confirmation, remembered per conversation. Small, and it protects the most expensive mistake in the product.",
  settings: "Mostly relocation. The scope is wide, the risk is near zero.",
  repositories:
    "A warning and a sheet. Cheap, and it is the last thing standing between somebody and unreviewed code.",
  send: "Transfers a specific output rather than an amount, so the confirmation has to show the artwork. That is the whole job.",
  escrow:
    "No script and no arbiter, which makes the code small and the copy hard. Most of the effort went into saying plainly what the agent can do to you.",
  gates:
    "Four independent gate types that have to compose without contradicting each other. Every combination is a case.",
  roles:
    "Falls out of the gates once they exist. On its own it would have been twice the work.",
  timelock:
    "Custody nobody takes is the interesting part and the risky part. Getting the lock semantics wrong loses somebody's stake.",
  vouch:
    "A signed statement and a list. Kept deliberately separate from /attest so regard cannot pass for verification.",
  renounce:
    "Anonymous by default, which is one flag, and the reason the verb is worth having at all.",
};

/** Every release feature, as a shipped card. Newest release first. */
const shipped: RoadmapFeature[] = releases.flatMap((release) =>
  release.features.map((feature) => {
    const complexity = SHIPPED_COMPLEXITY[feature.id] ?? "medium";
    const goal = goalFor(feature.id, complexity);
    return {
      id: feature.id,
      title: feature.title,
      summary: feature.summary,
      body: feature.body,
      status: "shipped" as const,
      complexity,
      goalSats: goal,
      pledgedSats: goal,
      pledges: pledgesFor(feature.id, goal, release.date),
      comments: [],
      createdAt: release.date,
      fundedAt: release.date,
      shippedAt: release.date,
      release: release.version,
      ...(feature.reference ? { reference: feature.reference } : {}),
      ...(SHIPPED_NOTES[feature.id]
        ? { devNote: SHIPPED_NOTES[feature.id]! }
        : {}),
    };
  })
);

/**
 * Paid for, not built.
 *
 * The uncomfortable column, and the reason the board is worth having: these are
 * promises with money already behind them. Each one is something this prototype
 * visibly stops short of doing.
 */
const funded: RoadmapFeature[] = [
  {
    id: "onboarding-clips",
    title: "Moving pictures in the help panes",
    summary: "Every app's guide opens with a loop of the thing working.",
    body: "The help panes already carry a still and the data already has a slot for a clip, because a screenshot of a chat is a picture of some words. Showing /once actually sealing, or a gate actually turning somebody away, takes four seconds and replaces two paragraphs.",
    status: "funded",
    complexity: "medium",
    goalSats: 28_000_000,
    pledgedSats: 28_000_000,
    pledges: [
      { personId: "tw-mikey", sats: 12_000_000, at: "2026-07-22" },
      { personId: "sophie-meijer", sats: 9_000_000, at: "2026-07-24" },
      { personId: "me", sats: 7_000_000, at: "2026-07-30" },
    ],
    comments: [
      {
        id: "c-clips-1",
        personId: "sophie-meijer",
        body: "The still for Messages is unreadable at 340 wide. A clip that zooms the composer would fix the same problem twice.",
        at: "2026-07-24",
      },
    ],
    devNote:
      "The data already has the slot and the component already branches on it. The cost is producing ten clips, not writing code.",
    createdAt: "2026-07-18",
    fundedAt: "2026-07-30",
  },
  {
    id: "device-sync",
    title: "Sync across devices",
    summary: "The pairing code in Settings actually pairs something.",
    body: "Settings shows a QR and three steps and does nothing, which is worse than not offering it. Sync means your handles, saved messages and chain policy follow you, and that the keys never leave either device in the clear.",
    status: "funded",
    complexity: "high",
    goalSats: 96_000_000,
    pledgedSats: 96_000_000,
    pledges: [
      { personId: "darren-kellenschwiler", sats: 40_000_000, at: "2026-07-11" },
      { personId: "tw-utxo", sats: 31_000_000, at: "2026-07-14" },
      { personId: "connor-murray", sats: 25_000_000, at: "2026-07-19" },
    ],
    comments: [
      {
        id: "c-sync-1",
        personId: "darren-kellenschwiler",
        body: "Pairing has to be key exchange, not an account. The moment there is a server holding both sides this stops being the same product.",
        at: "2026-07-12",
      },
      {
        id: "c-sync-2",
        personId: "connor-murray",
        body: "Agreed. Would also want a visible list of paired devices with a way to drop one.",
        at: "2026-07-19",
      },
    ],
    devNote:
      "Key exchange between two devices with no server holding both halves. Everything about this is the hard version.",
    createdAt: "2026-07-08",
    fundedAt: "2026-07-19",
  },
  {
    id: "social-recovery",
    title: "Recovery through people you already trust",
    summary: "Lose the device, not the identity.",
    body: "A handle is only worth building on if losing a laptop does not end it. Name a few peers, and a quorum of them can attest to a new key. It leans on the same vouches /vouch already produces, which is why it is worth doing here rather than bolting on a seed phrase.",
    status: "funded",
    complexity: "high",
    goalSats: 72_000_000,
    pledgedSats: 72_000_000,
    pledges: [
      { personId: "siggi-oskarsson", sats: 30_000_000, at: "2026-07-02" },
      { personId: "asgeir-oskarsson", sats: 22_000_000, at: "2026-07-03" },
      { personId: "tc-thoth", sats: 20_000_000, at: "2026-07-09" },
    ],
    comments: [
      {
        id: "c-recovery-1",
        personId: "tc-thoth",
        body: "Quorum has to be set when you are calm, not when you are locked out. Put it in the same place as the vouches.",
        at: "2026-07-09",
      },
    ],
    devNote:
      "A quorum scheme is well understood; the risk is entirely in the recovery flow, which people only use once and always under stress.",
    createdAt: "2026-06-28",
    fundedAt: "2026-07-09",
  },
  {
    id: "nexus-telegram",
    title: "Nexus for Telegram",
    summary: "Pay and prove inside a chat that is not ours.",
    body: "Most people will not move rooms to try a payment. A bot that speaks the same BRC-218 verbs inside Telegram lets somebody receive a /pay or open a /once without installing anything, and gives the handle somewhere to be used before it has a home.",
    status: "funded",
    complexity: "medium",
    goalSats: 34_000_000,
    pledgedSats: 34_000_000,
    pledges: [
      { personId: "tw-randy", sats: 18_000_000, at: "2026-07-26" },
      { personId: "tw-shruggr", sats: 16_000_000, at: "2026-07-28" },
    ],
    comments: [],
    devNote:
      "A bot that speaks the same verbs. Bounded, but it is a second client to keep in step with this one.",
    createdAt: "2026-07-20",
    fundedAt: "2026-07-28",
  },
];

/**
 * Wanted, unpaid.
 *
 * Ordered by nothing in particular — the board's sort does that. A card here
 * carries a part-filled bar rather than a promise, and the honest thing about
 * this column is that most of it will never move.
 */
const fundable: RoadmapFeature[] = [
  {
    id: "roadmap-on-chain",
    title: "Anchor the pledges",
    summary: "A funded feature you can check without trusting this board.",
    body: "Right now the numbers on these cards are ours. Anchoring each pledge makes the total something anybody can recount from the chain, and makes it impossible for us to quietly move a feature from fundable to funded.",
    status: "fundable",
    complexity: "medium",
    goalSats: 30_000_000,
    pledgedSats: 19_400_000,
    pledges: [
      { personId: "tw-utxo", sats: 9_000_000, at: "2026-08-01" },
      { personId: "darren-kellenschwiler", sats: 6_400_000, at: "2026-08-02" },
      { personId: "tc-kuro", sats: 4_000_000, at: "2026-08-04" },
    ],
    comments: [
      {
        id: "c-anchor-1",
        personId: "tw-utxo",
        body: "This one first, surely. Every other number on this page is a claim until it is done.",
        at: "2026-08-01",
      },
    ],
    devNote:
      "One anchor per pledge and a way to recount them. The work is small; the reason to do it first is that it makes every other number here checkable.",
    createdAt: "2026-07-31",
  },
  {
    id: "cross-app-search",
    title: "One search across every app",
    summary: "Find a message, a file, a payment and a certificate at once.",
    body: "Everything is filed by which app produced it, which is the one thing you do not remember. A single index over messages, mail, the vault and wallet activity, searched from the rail, with results that say which app they came from.",
    status: "fundable",
    complexity: "high",
    goalSats: 64_000_000,
    pledgedSats: 12_800_000,
    pledges: [
      { personId: "connor-murray", sats: 7_800_000, at: "2026-07-29" },
      { personId: "mohammad-jaber", sats: 5_000_000, at: "2026-08-03" },
    ],
    comments: [
      {
        id: "c-search-1",
        personId: "mohammad-jaber",
        body: "Would pay more for this than anything else on the board. I know the payment exists, I cannot remember whether it was Mail or Messages.",
        at: "2026-08-03",
      },
    ],
    devNote:
      "An index over five apps that currently share nothing. The search box is an afternoon; the index is not.",
    createdAt: "2026-07-25",
  },
  {
    id: "hardware-keys",
    title: "Keys on a device you can unplug",
    summary: "Sign with a hardware key instead of one this browser holds.",
    body: "Everything here rests on a key in local storage. For anybody holding more than pocket money that is the wrong place, and the fix is not a stronger password. Signing moves to the device, and the browser never sees the private half.",
    status: "fundable",
    complexity: "high",
    goalSats: 88_000_000,
    pledgedSats: 41_000_000,
    pledges: [
      { personId: "siggi-oskarsson", sats: 22_000_000, at: "2026-07-21" },
      { personId: "tw-elonmoist", sats: 12_000_000, at: "2026-07-27" },
      { personId: "asgeir-oskarsson", sats: 7_000_000, at: "2026-08-02" },
    ],
    comments: [],
    devNote:
      "Signing has to move off the page entirely. That touches every place we currently reach for a key, which is most of them.",
    createdAt: "2026-07-16",
  },
  {
    id: "group-calls",
    title: "Talk, in the room you are already in",
    summary: "Voice and video inside a conversation, gated the same way.",
    body: "A room with an access gate on it already knows who is allowed in. A call in that room should inherit the door rather than send everybody to a link that anybody can forward.",
    status: "fundable",
    complexity: "high",
    goalSats: 76_000_000,
    pledgedSats: 8_200_000,
    pledges: [
      { personId: "tw-shruggr", sats: 5_000_000, at: "2026-08-01" },
      { personId: "tc-treechad", sats: 3_200_000, at: "2026-08-04" },
    ],
    comments: [
      {
        id: "c-calls-1",
        personId: "tc-treechad",
        body: "Inheriting the gate is the whole argument. A call link that outlives the room is how every other tool leaks.",
        at: "2026-08-04",
      },
    ],
    devNote:
      "Media routing plus inheriting the room gate. Either half is a project.",
    createdAt: "2026-07-27",
  },
  {
    id: "offline-drafts",
    title: "Write with no connection",
    summary: "Compose, queue, and send when the network comes back.",
    body: "A message you typed on a train should not be lost because the tunnel was long. Drafts and commands queue locally and go out in order, with the composer honest about what has left and what has not.",
    status: "fundable",
    complexity: "medium",
    goalSats: 26_000_000,
    pledgedSats: 3_100_000,
    pledges: [{ personId: "tc-kuro", sats: 3_100_000, at: "2026-08-03" }],
    comments: [],
    devNote:
      "A queue and honest status in the composer. Ordinary work, and it has to be right about what has actually left.",
    createdAt: "2026-08-01",
  },
  {
    id: "languages",
    title: "Nexus in more than English",
    summary: "The interface, the commands, and the errors.",
    body: "Every string in this client already lives in one content table, which is most of the work. The part that is not is the command grammar: a verb somebody types has to keep working whichever language the labels are in.",
    status: "fundable",
    complexity: "medium",
    goalSats: 22_000_000,
    pledgedSats: 6_600_000,
    pledges: [
      { personId: "els-verheijen", sats: 4_000_000, at: "2026-07-30" },
      { personId: "isa-van-den-berg", sats: 2_600_000, at: "2026-08-02" },
    ],
    comments: [
      {
        id: "c-lang-1",
        personId: "els-verheijen",
        body: "Dutch first and I will proofread it myself.",
        at: "2026-07-30",
      },
    ],
    devNote:
      "The strings are already in one table. The command grammar is the part nobody costs correctly: a verb has to keep working whichever language the labels are in.",
    createdAt: "2026-07-24",
  },
];

/** The board, one list. Column membership is `status`, not position. */
export const roadmapFeatures: RoadmapFeature[] = [
  ...fundable,
  ...funded,
  ...shipped,
];

export function getRoadmapFeature(id: string): RoadmapFeature | undefined {
  return roadmapFeatures.find((feature) => feature.id === id);
}

export const ROADMAP_STATUSES: RoadmapStatus[] = [
  "fundable",
  "funded",
  "shipped",
];
