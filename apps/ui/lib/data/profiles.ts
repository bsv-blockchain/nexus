/**
 * table: profiles — the personas you own, and the feed each one sees.
 *
 * A profile is what everybody else gets when they open your card: a name, a
 * handle, a face, and the few lines of context under it. Typed as a
 * `MessagePerson` rather than a shape of its own, because it IS one — the
 * avatar, hovercard and whois components all take that type, and a parallel
 * "but mine" type would mean reimplementing every one of them to show the
 * person looking at the screen.
 *
 * One profile is connected to each workspace, the way a handle or a wallet is.
 * Switching swaps who this workspace is, which is why the feeds live here too:
 * a persona with somebody else's timeline behind it is not a separate persona,
 * it is a different name on the same account.
 */

import type { MessagePerson } from "./types";
import type { TimelinePost } from "./timeline";

export const profiles: MessagePerson[] = [
  {
    id: "me",
    name: "Crumbs",
    handle: "crumbs",
    ecosystem: "nexus",
    role: "Overlay engineer",
    bio: "Builds overlay services and payment rails on BSV. Keeps one foot in the food-network world.",
    organization: "Nexus",
    city: "Amsterdam",
    photo: "/avatars/fox1.png",
    avatarColors: ["#4353ff", "#0ea5e9", "#16a34a"],
    registeredAt: "2022-04-01T09:00:00.000Z",
    expertise: ["Overlay services", "Payment rails", "SPV"],
    contact: { email: "vincent@nexus.example", github: "crumbs" },
  },
  {
    /*
     * The second persona, and deliberately not "the same person at work".
     *
     * It holds the other handle Settings already lists, writes about different
     * things and knows different people — which is the only way the switcher
     * demonstrates anything. Two profiles that differ by job title would make
     * connecting one look like a no-op.
     */
    id: "me-studio",
    name: "Breadcrumbs",
    handle: "breadcrumbs",
    ecosystem: "nexus",
    role: "Type and interface design",
    bio: "Draws the parts of software people actually touch. Currently on wallets, receipts and the small print nobody reads until it is wrong.",
    organization: "Studio Breadcrumbs",
    city: "Rotterdam",
    photo: "/avatars/fox4.png",
    avatarColors: ["#f59e0b", "#ec4899", "#8b5cf6"],
    registeredAt: "2024-09-16T09:00:00.000Z",
    expertise: ["Interface design", "Typography", "Receipts"],
    contact: { email: "studio@breadcrumbs.example", github: "breadcrumbs" },
  },
];

/**
 * What each profile has posted.
 *
 * Held per profile rather than flagged `mine` on the shared pool, because
 * "mine" stopped being a property of a post the moment there was more than one
 * of you. These are merged into the pool at render, so a profile's own posts
 * appear in its feed alongside everyone else's.
 */
export const profilePosts: Record<string, TimelinePost[]> = {
  me: [
    {
      id: "p-mine-first",
      authorId: "me",
      ago: 480,
      body: "Spent the afternoon reading BRC-100 properly instead of skimming it, and half my objections were things it already answers in section four.\n\nRecommend the exercise.",
      replies: 8,
      reposts: 5,
      likes: 74,
      views: 3100,
      topic: "Standards and specs",
      mine: true,
    },
    {
      id: "p-mine-second",
      authorId: "me",
      ago: 1490,
      body: "Three workspaces, three handles, one device. Work does not know what Personal is doing and that is not a compromise, that is the product.",
      replies: 15,
      reposts: 11,
      likes: 129,
      views: 5400,
      mine: true,
    },
  ],
  "me-studio": [
    {
      id: "p-studio-receipts",
      authorId: "me-studio",
      ago: 95,
      body: "A receipt is the only part of a payment anybody keeps. We spend months on the tap and ten minutes on the thing that outlives it.",
      replies: 22,
      reposts: 31,
      likes: 268,
      views: 9700,
      topic: "Show and tell",
      mine: true,
    },
    {
      id: "p-studio-numerals",
      authorId: "me-studio",
      ago: 610,
      body: "Tabular numerals in every balance, everywhere, no exceptions. A column of money that shifts as it updates is a column you cannot read at a glance, which is the only way anybody reads money.",
      replies: 9,
      reposts: 18,
      likes: 194,
      views: 6100,
      topic: "Show and tell",
      mine: true,
    },
    {
      id: "p-studio-forms",
      authorId: "me-studio",
      ago: 2200,
      body: "Spent the week on one form. It has four fields.",
      replies: 31,
      reposts: 7,
      likes: 221,
      views: 8300,
      mine: true,
    },
  ],
};

/**
 * Which of the shared posts each profile's strips promote.
 *
 * Ids rather than copies, so a post says one thing wherever it is read. What
 * differs per profile is which posts reach it: an overlay engineer's ranked
 * strip is about the network, a designer's is about what people see. That
 * divergence is the point of having two — a switcher that swapped the name over
 * an identical column would be a rename button.
 */
export const profileFeeds: Record<
  string,
  { forYou: string[]; following: string[] }
> = {
  me: {
    forYou: [
      "p-lamint-burn",
      "p-twetch-ownership",
      "p-lamint-editions",
      "p-teranode-numbers",
      "p-handle-costs",
      "p-spv-first",
      "p-reorg-inscriptions",
      "p-tax-warnings",
      "p-thoth-unit",
      "p-fresh-fees",
      "p-fresh-custody",
      "p-fresh-price",
    ],
    following: [
      "p-teranode-numbers",
      "p-handle-costs",
      "p-ninety-seconds",
      "p-overlay-plainly",
      "p-custody-question",
      "p-j1-primate",
      "p-fresh-fees",
      "p-fresh-till",
      "p-fresh-standards",
    ],
  },
  "me-studio": {
    forYou: [
      "p-ninety-seconds",
      "p-overlay-plainly",
      "p-two-hosts",
      "p-reorg-inscriptions",
      "p-j1-primate",
      "p-handle-costs",
      "p-fresh-till",
      "p-fresh-standards",
    ],
    following: [
      "p-overlay-plainly",
      "p-two-hosts",
      "p-ninety-seconds",
      "p-wallet-start-finish",
      "p-kuro-rooms",
      "p-fresh-till",
    ],
  },
};
