import type { CommandCard } from "./types";
/**
 * Timeline — the posts, rooms and suggestions behind the feed.
 *
 * People are NOT redefined here. Every author is an id from lib/data/messages,
 * so the face and handle you meet in a post are the same ones the same person
 * wears in a conversation, a hovercard and a wallet contact. A second roster
 * would be a second answer to "who is that", which is how a demo starts
 * contradicting itself.
 *
 * The writing is drawn from three places, deliberately rather than invented
 * whole: the BSV Forum's own categories (build, network, money, buy, price,
 * show and tell, standards), Treechad's threads, and FreeRadio's show titles.
 * That is what keeps it reading as a community with running arguments rather
 * than a wall of lorem about blockchain.
 */

import type { HubAppSlug } from "./types";

/** Which strip of the feed a post belongs to. */
export type TimelineFeed = "for-you" | "following" | "posts";

export interface TimelinePost {
  id: string;
  /** a MessagePerson id — see the note above */
  authorId: string;
  /** minutes ago, resolved to a label at render */
  ago: number;
  body: string;
  replies: number;
  reposts: number;
  likes: number;
  views: number;
  /** the forum category this would sit under, shown as a quiet chip */
  topic?: string;
  /** paid in satoshis, if anyone did */
  tipped?: number;
  /**
   * A command this post carries, shown as a pill in the body.
   *
   * Where `{command}` appears in `body` is where the pill goes, exactly as in a
   * chat bubble — so a post can say "sent it just now, {command}, shout if the
   * memo is wrong" rather than always leading with the card. The pill's
   * hovercard is the result, which is the only place the outcome is written.
   */
  command?: CommandCard;
  /** true for the handful the ranked strip promotes */
  forYou?: boolean;
  /** shown in Following: the signed-in user follows this author */
  following?: boolean;
  /**
   * One of your own.
   *
   * Which "your own" means depends on the profile the workspace is wearing, so
   * these posts live in lib/data/profiles keyed by profile rather than in the
   * shared pool — `mine` stopped being a property of a post the moment there
   * was more than one of you.
   */
  mine?: boolean;
}

/**
 * The feed.
 *
 * Ordered newest first and left that way — the strips filter this list rather
 * than each holding their own copy, so a post cannot say one thing under For
 * you and another under Following.
 */
export const timelinePosts: TimelinePost[] = [
  {
    id: "p-lamint-burn",
    authorId: "lm-pia",
    ago: 14,
    body: "Someone asked why issue 44 is short by one.\n\nBecause the buyer changed their mind before it settled and asked me to burn it rather than resell it. {command} That is the whole story, and it is on chain.",
    replies: 12,
    reposts: 8,
    likes: 96,
    views: 4200,
    topic: "Buy, sell and custody",
    command: { verb: "vouch", status: "issued", recipientIds: ["lm-arto"] },
    forYou: true,
  },
  {
    id: "p-twetch-ownership",
    authorId: "tw-randy",
    ago: 38,
    body: "Owning the post is not the interesting part. Owning the graph is.\n\nEvery client that reads it has to ask you, and that is a relationship, not a feed.",
    replies: 61,
    reposts: 44,
    likes: 388,
    views: 21800,
    topic: "Show and tell",
    forYou: true,
  },
  {
    id: "p-twetch-fees",
    authorId: "tw-shruggr",
    ago: 190,
    body: "Spent the morning on indexer fees and came out where I started: the cost of writing has never been the problem. The cost of reading it back is.",
    replies: 18,
    reposts: 23,
    likes: 174,
    views: 9600,
    topic: "Build on BSV",
  },
  {
    id: "p-lamint-editions",
    authorId: "lm-arto",
    ago: 260,
    body: "A run of a thousand is not an edition, it is inventory.\n\nPick a number you can defend to the twentieth buyer and stop there.",
    replies: 29,
    reposts: 17,
    likes: 211,
    views: 12400,
    topic: "Buy, sell and custody",
  },
  {
    id: "p-teranode-numbers",
    authorId: "darren-kellenschwiler",
    ago: 6,
    body: "Teranode numbers from last Thursday are up. 1.2M tx in a single block, held for eleven minutes, no mempool backlog worth the name.\n\nThe interesting part is not the peak. It is that fees did not move.",
    replies: 34,
    reposts: 61,
    likes: 412,
    views: 18400,
    topic: "Run the network",
    forYou: true,
    following: true,
  },
  {
    id: "p-handle-costs",
    authorId: "siggi-oskarsson",
    ago: 22,
    body: "Every few weeks someone asks why a handle costs money.\n\nBecause a free one is worth exactly what you paid, and the registry fills with squatters inside a month. The fee is not revenue, it is a filter.",
    replies: 88,
    reposts: 40,
    likes: 620,
    views: 41200,
    topic: "Standards and specs",
    tipped: 12000,
    forYou: true,
    following: true,
  },
  {
    id: "p-spv-first",
    authorId: "asgeir-oskarsson",
    ago: 51,
    body: "SPV from first principles, one more time:\n\nYou do not need the chain. You need the header chain, a merkle path, and someone who will hand you both. That is it. That is the whole trick.",
    replies: 19,
    reposts: 77,
    likes: 503,
    views: 27600,
    topic: "Build on BSV",
    forYou: true,
  },
  {
    id: "p-reorg-inscriptions",
    authorId: "connor-murray",
    ago: 96,
    body: "The reorg ate four hundred inscriptions and the lesson everyone took from it was the wrong one.\n\nIt was never a chain problem. It was four hundred people treating one confirmation as settled.",
    replies: 142,
    reposts: 53,
    likes: 388,
    views: 33900,
    topic: "Show and tell",
    forYou: true,
  },
  {
    id: "p-ninety-seconds",
    authorId: "mohammad-jaber",
    ago: 128,
    body: "Ninety seconds a customer. That is the number the till has to hit or the queue goes out the door.\n\nWe are at 2.4s end to end including the wallet prompt. Nobody in the shop has noticed it is Bitcoin, which is the point.",
    replies: 27,
    reposts: 44,
    likes: 511,
    views: 22100,
    topic: "Show and tell",
    tipped: 4500,
    following: true,
  },
  {
    id: "p-tax-warnings",
    authorId: "lena-fischer",
    ago: 163,
    body: "81,000 tax warnings went out this year and the guidance still does not say what a micropayment is.\n\nIf you take 400 payments of 8p in a day, that is 400 disposals on paper. Nobody is filing that. The rules need to meet the tech.",
    replies: 96,
    reposts: 71,
    likes: 445,
    views: 51800,
    topic: "Money, tax and accounting",
    forYou: true,
  },
  {
    id: "p-fee-markets",
    authorId: "tomas-lindqvist",
    ago: 201,
    body: "Fee markets after dark: when a block is not full, a fee market is a fiction people negotiate with themselves.",
    replies: 58,
    reposts: 29,
    likes: 297,
    views: 15300,
    topic: "Price and markets",
  },
  {
    id: "p-overlay-plainly",
    authorId: "rhea-mensah",
    ago: 244,
    body: "An overlay is an index that agreed in advance what it would index.\n\nThat is the whole diagram. Everything else in the talk is plumbing.",
    replies: 12,
    reposts: 66,
    likes: 402,
    views: 19700,
    topic: "Standards and specs",
    following: true,
  },
  {
    id: "p-wallet-start-finish",
    authorId: "austin-rappaport",
    ago: 305,
    body: "Set up a wallet start to finish on stream tonight, no cuts. Twelve words, one backup, one payment out and one in.\n\nIf it takes longer than four minutes I will say so on air rather than edit it out.",
    replies: 41,
    reposts: 18,
    likes: 233,
    views: 12600,
    topic: "Build on BSV",
  },
  {
    id: "p-two-hosts",
    authorId: "dylan-murray",
    ago: 366,
    body: "Two hosts, one name. We both had @dylan on different ecosystems and neither of us is giving it up, so now the room shows both and the audience picks.\n\nTurns out this is a feature.",
    replies: 73,
    reposts: 22,
    likes: 318,
    views: 17400,
    topic: "Standards and specs",
  },
  {
    id: "p-custody-question",
    authorId: "amara-okonkwo",
    ago: 420,
    body: "Buy, sell and custody, in that order of difficulty.\n\nEveryone solves buying. Selling is a support problem. Custody is where the honest projects admit what they are actually offering.",
    replies: 64,
    reposts: 37,
    likes: 356,
    views: 24800,
    topic: "Buy, sell and custody",
    following: true,
  },
  {
    id: "p-thoth-unit",
    authorId: "tc-thoth",
    ago: 74,
    body: "The greatest psyop was convincing bitcoiners to stop thinking in bitcoin as a unit of account.\n\nPrice everything in sats for a week and watch which of your opinions survive.",
    replies: 156,
    reposts: 92,
    likes: 730,
    views: 62100,
    topic: "Price and markets",
    tipped: 25000,
    forYou: true,
  },
  {
    id: "p-kuro-rooms",
    authorId: "tc-kuro",
    ago: 310,
    body: "Hosting the town square again tonight, same frequency. Bring the argument you lost last week.",
    replies: 29,
    reposts: 12,
    likes: 164,
    views: 8700,
  },
  {
    id: "p-j1-primate",
    authorId: "tc-j1pelaez",
    ago: 640,
    body: "Non-custodial, zero friction, invoices and demo mode. Took eleven months and the last two were entirely about the words on four buttons.",
    replies: 48,
    reposts: 35,
    likes: 391,
    views: 23800,
    topic: "Show and tell",
    following: true,
  },
  {
    id: "p-kenji-tooling",
    authorId: "kenji-watanabe",
    ago: 540,
    body: 'Shipped a change to the transaction builder that drops a whole class of "why is this unsigned" support tickets. The fix was a better error message, not better code.',
    replies: 21,
    reposts: 14,
    likes: 188,
    views: 9800,
    topic: "Build on BSV",
    following: true,
  },
  {
    id: "p-marcel-provenance",
    authorId: "marcel-van-silfhout",
    ago: 610,
    body: "A crate of tomatoes now carries more verifiable history than most company accounts.\n\nGrower, cold chain, three handovers, all signed. The supermarket still prints a sticker.",
    replies: 33,
    reposts: 48,
    likes: 401,
    views: 21500,
    topic: "Show and tell",
    forYou: true,
  },
  {
    id: "p-mark-commons",
    authorId: "mark-frederiks",
    ago: 700,
    body: "Open sourcing the whole publishing pipeline this week. Not because it is finished — because it is the only way anyone can check the thing does what the README claims.",
    replies: 17,
    reposts: 31,
    likes: 262,
    views: 13900,
    topic: "Build on BSV",
  },
  {
    id: "p-els-archive",
    authorId: "els-verheijen",
    ago: 880,
    body: "Nine thousand pages of a local archive, on chain, readable without our software.\n\nIf we go under tomorrow the archive does not. That was the requirement.",
    replies: 26,
    reposts: 55,
    likes: 470,
    views: 28300,
    topic: "Show and tell",
    forYou: true,
  },
  {
    id: "p-oli-price",
    authorId: "oli-oskarsson",
    ago: 1020,
    body: "Price and markets thread, weekly. Same rule as always: nobody posts a chart without saying what would prove them wrong.",
    replies: 112,
    reposts: 16,
    likes: 205,
    views: 19100,
    topic: "Price and markets",
  },
  {
    id: "p-sanne-standards",
    authorId: "sanne-verhoeven",
    ago: 1180,
    body: "Read 173 specifications so you do not have to. The three that matter are the three everything else is built on, and two of them are shorter than this post.",
    replies: 44,
    reposts: 89,
    likes: 604,
    views: 47200,
    topic: "Standards and specs",
    forYou: true,
    following: true,
  },
  {
    id: "p-isa-nodes",
    authorId: "isa-van-den-berg",
    ago: 1380,
    body: "Ran a node on a mini PC under the stairs for a month to see what would break. Answer: nothing, and the electricity bill went up by less than a coffee.",
    replies: 38,
    reposts: 27,
    likes: 349,
    views: 20400,
    topic: "Run the network",
  },
];

/** A room on air right now, in the shape "On air now" wants it. */
export interface LiveRoom {
  id: string;
  /** host, as a MessagePerson id */
  hostId: string;
  title: string;
  /** what the host is doing, e.g. "is hosting" */
  verb: string;
  listeners: number;
  /** the faces stacked on the right of the row */
  facepile: string[];
}

/**
 * On air now.
 *
 * Titles are FreeRadio's own shows rather than invented ones; the station is a
 * real thing in this world and this is the panel that says so.
 */
export const liveRooms: LiveRoom[] = [
  {
    id: "room-teranode",
    hostId: "darren-kellenschwiler",
    title: "Teranode numbers, last Thursday",
    verb: "is hosting",
    listeners: 1240,
    facepile: ["asgeir-oskarsson", "siggi-oskarsson", "kenji-watanabe"],
  },
  {
    id: "room-spv",
    hostId: "asgeir-oskarsson",
    title: "SPV, from first principles",
    verb: "is hosting",
    listeners: 380,
    facepile: ["rhea-mensah", "tomas-lindqvist"],
  },
  {
    id: "room-handle",
    hostId: "siggi-oskarsson",
    title: "Why a handle costs money",
    verb: "is listening",
    listeners: 96,
    facepile: ["mohammad-jaber", "austin-rappaport", "dylan-murray"],
  },
  {
    id: "room-fees",
    hostId: "tomas-lindqvist",
    title: "Fee markets after dark, part one",
    verb: "is hosting",
    listeners: 54,
    facepile: ["oli-oskarsson"],
  },
  {
    id: "room-founders",
    hostId: "connor-murray",
    title: "Founders talk, the first one",
    verb: "is hosting",
    listeners: 210,
    facepile: ["amara-okonkwo", "lena-fischer"],
  },
];

/** Somebody worth following, with the one line that says why. */
export interface Suggestion {
  personId: string;
  reason: string;
}

export const whoToFollow: Suggestion[] = [
  { personId: "rhea-mensah", reason: "Writes the overlay explainers" },
  { personId: "marcel-van-silfhout", reason: "Provenance, from the field" },
  { personId: "kenji-watanabe", reason: "Ships the tooling you use" },
  { personId: "els-verheijen", reason: "Archives that outlive their software" },
  { personId: "austin-rappaport", reason: "Builds on stream, unedited" },
];

/** A line in the Nexus Sync panel. */
export const nexusSyncFeatures: string[] = [
  "Workspaces, tabs & wallets on every device",
  "Encrypted backup of the things only you hold",
  "Exports of your activity in .csv, .pdf",
];

/**
 * Posts that arrive while you are looking at the page.
 *
 * Held out of the first render rather than generated, so the thing the "Show N
 * posts" pill promises is a real post with a real author waiting behind it. A
 * counter that ticks up and then reveals filler is the tell that makes a demo
 * stop being believable, and it is the one part of a live feed people watch
 * closely.
 *
 * Ordered newest first, and their `ago` values are smaller than anything in the
 * main list — they are newer than everything already on screen, which is what
 * puts them at the top when they land.
 */
export const incomingPosts: TimelinePost[] = [
  {
    id: "p-fresh-fees",
    authorId: "kenji-watanabe",
    ago: 0,
    body: "Pushed the fee estimator rewrite. It now asks the overlay what the last hundred blocks actually charged instead of guessing from a constant somebody set in 2021.",
    replies: 4,
    reposts: 9,
    likes: 61,
    views: 1900,
    topic: "Build on BSV",
    forYou: true,
    following: true,
  },
  {
    id: "p-fresh-till",
    authorId: "mohammad-jaber",
    ago: 1,
    body: "Second shop is live. Same till, same handle, different workspace — took the afternoon, most of which was the printer.",
    replies: 11,
    reposts: 6,
    likes: 143,
    views: 4200,
    topic: "Show and tell",
    following: true,
  },
  {
    id: "p-fresh-custody",
    authorId: "amara-okonkwo",
    ago: 2,
    body: "If your custody page does not say who holds the key, it is not a custody page, it is a marketing page.",
    replies: 22,
    reposts: 18,
    likes: 207,
    views: 8800,
    topic: "Buy, sell and custody",
    forYou: true,
  },
  {
    id: "p-fresh-standards",
    authorId: "rhea-mensah",
    ago: 3,
    body: "Draft is up for the lookup-response envelope. Two fields fewer than last time, which is the only direction a spec should ever move.",
    replies: 7,
    reposts: 14,
    likes: 98,
    views: 3400,
    topic: "Standards and specs",
    following: true,
  },
  {
    id: "p-fresh-price",
    authorId: "tomas-lindqvist",
    ago: 4,
    body: "Volume is up 40% on the week and the price has not moved. Every time this happens somebody explains it, and the explanation is always different.",
    replies: 39,
    reposts: 12,
    likes: 176,
    views: 11200,
    topic: "Price and markets",
    forYou: true,
  },
];

/**
 * One thing that happened inside an app.
 *
 * The Activity strip is the timeline read from the other side: not what people
 * posted, but what the apps this workspace is connected to actually did. It is
 * filtered by connection at render, so a workspace that has never opened Market
 * never hears about a listing — an activity feed that reports on apps you do
 * not hold is an advert wearing a notification's clothes.
 */
export interface ActivityItem {
  id: string;
  /**
   * The app this came from. Typed as the slug union rather than a string so a
   * fixture cannot name an app that does not exist — the filter below drops
   * unconnected apps silently, which would have hidden the typo too.
   */
  app: HubAppSlug;
  ago: number;
  text: string;
  /** the other party, when there is one */
  personId?: string;
  /** satoshis, where the event has an amount */
  amount?: number;
}

export const timelineActivity: ActivityItem[] = [
  {
    id: "a-wallet-in",
    app: "wallet",
    ago: 4,
    text: "Received from",
    personId: "mohammad-jaber",
    amount: 42000,
  },
  {
    id: "a-messages-thread",
    app: "messages",
    ago: 11,
    text: "New message from",
    personId: "rhea-mensah",
  },
  {
    id: "a-signer-request",
    app: "signer",
    ago: 26,
    text: "Signing request from fractional.farm, waiting on you",
  },
  {
    id: "a-market-listing",
    app: "market",
    ago: 38,
    text: "Your listing sold — Overlay lookup, one month",
    amount: 180000,
  },
  {
    id: "a-vault-backup",
    app: "vault",
    ago: 52,
    text: "Backup finished, 3 items sealed",
  },
  {
    id: "a-mail-receipt",
    app: "mail",
    ago: 63,
    text: "Paid mail received from",
    personId: "lena-fischer",
    amount: 2000,
  },
  {
    id: "a-vote-open",
    app: "vote",
    ago: 88,
    text: "Proposal open for two more days — fee floor for overlay writes",
  },
  {
    id: "a-baskets-token",
    app: "baskets",
    ago: 104,
    text: "12 outputs moved to the Tickets basket",
  },
  {
    id: "a-identity-cert",
    app: "identity",
    ago: 140,
    text: "Certificate issued to your Work handle",
  },
  {
    id: "a-attestations-vouch",
    app: "attestations",
    ago: 176,
    text: "Vouched for you",
    personId: "kenji-watanabe",
  },
  {
    id: "a-publisher-post",
    app: "publisher",
    ago: 210,
    text: "Published — Reading BRC-100 properly, 4 min",
  },
  {
    id: "a-txviewer-conf",
    app: "tx-viewer",
    ago: 244,
    text: "A transaction you were watching reached 6 confirmations",
  },
  {
    id: "a-learn-course",
    app: "learn",
    ago: 300,
    text: "You finished SPV, from first principles",
  },
  {
    id: "a-connect-grant",
    app: "connect",
    ago: 355,
    text: "fractional.farm asked for spending up to 50,000 sats a day",
  },
  {
    id: "a-roadmap-ship",
    app: "roadmap",
    ago: 420,
    text: "Shipped — Horizontal tabs, in this build",
  },
  {
    id: "a-browser-pin",
    app: "browser",
    ago: 470,
    text: "treechad.vercel.app pinned to this workspace",
  },
];

/**
 * Replies, by the post they answer.
 *
 * Only the posts most likely to be opened carry them, and only a handful each.
 * A thread that scrolls for pages would be a fixture pretending to be a
 * community; three or four replies is enough to show what a thread is and
 * honest about how much is here.
 *
 * They are `TimelinePost`s so the thread can render them with the same row the
 * feed uses — a reply that looked different from a post would be a second
 * component to keep in step with the first.
 */
export const postReplies: Record<string, TimelinePost[]> = {
  "p-teranode-numbers": [
    {
      id: "r-teranode-1",
      authorId: "asgeir-oskarsson",
      ago: 4,
      body: "The flat fee is the headline and everyone is reading past it. A block that big with no fee pressure means the market cleared, not that it got lucky.",
      replies: 2,
      reposts: 1,
      likes: 47,
      views: 1900,
    },
    {
      id: "r-teranode-2",
      authorId: "connor-murray",
      ago: 3,
      body: "Eleven minutes is the part I want the numbers on. Was that propagation or was that one miner sitting on it?",
      replies: 1,
      reposts: 0,
      likes: 22,
      views: 1100,
    },
    {
      id: "r-teranode-3",
      authorId: "kenji-watanabe",
      ago: 1,
      body: "Ran the same shape through our indexer overnight and it kept up without falling behind. Happy to publish the graph if anyone wants it.",
      replies: 0,
      reposts: 4,
      likes: 68,
      views: 2400,
    },
  ],
  "p-handle-costs": [
    {
      id: "r-handle-1",
      authorId: "rhea-mensah",
      ago: 18,
      body: "The squatter point is the whole argument and it never lands until someone has watched a free registry fill up.",
      replies: 0,
      reposts: 3,
      likes: 91,
      views: 3600,
    },
    {
      id: "r-handle-2",
      authorId: "mark-frederiks",
      ago: 12,
      body: "It is a filter, agreed. It is also a floor. Price it too high and you have filtered out the people you wanted.",
      replies: 4,
      reposts: 2,
      likes: 55,
      views: 2800,
    },
  ],
  "p-spv-first": [
    {
      id: "r-spv-1",
      authorId: "darren-kellenschwiler",
      ago: 44,
      body: '"Someone who will hand you both" is doing an enormous amount of work in that sentence and it is the only interesting part.',
      replies: 3,
      reposts: 6,
      likes: 120,
      views: 5100,
    },
    {
      id: "r-spv-2",
      authorId: "lena-fischer",
      ago: 31,
      body: "Sent this to two people this week already. It is the shortest correct version I have found.",
      replies: 0,
      reposts: 1,
      likes: 34,
      views: 1500,
    },
  ],
  "p-reorg-inscriptions": [
    {
      id: "r-reorg-1",
      authorId: "amara-okonkwo",
      ago: 80,
      body: "Four hundred people and every one of them had been told. Being told is not the same as having built for it.",
      replies: 1,
      reposts: 5,
      likes: 76,
      views: 3300,
    },
  ],
  "p-ninety-seconds": [
    {
      id: "r-ninety-1",
      authorId: "els-verheijen",
      ago: 110,
      body: '"Nobody in the shop has noticed it is Bitcoin" should be on a poster somewhere.',
      replies: 0,
      reposts: 9,
      likes: 143,
      views: 6200,
    },
    {
      id: "r-ninety-2",
      authorId: "tomas-lindqvist",
      ago: 96,
      body: "2.4s including the prompt is quick. What is the split between the prompt and everything else?",
      replies: 2,
      reposts: 0,
      likes: 18,
      views: 900,
    },
  ],
};

/**
 * App events that land while you are watching, oldest first.
 *
 * The Activity strip's answer to `incomingPosts`. Dated at zero because they
 * arrive now by definition — the feed stamps them against its own clock the
 * moment they land, the same way it ages your own actions.
 */
export const incomingActivity: ActivityItem[] = [
  {
    id: "a-in-payment",
    app: "wallet",
    ago: 0,
    text: "Received from Rhea Mensah",
    personId: "rhea-mensah",
    amount: 8500,
  },
  {
    id: "a-in-message",
    app: "messages",
    ago: 0,
    text: "New message from Kenji Watanabe",
    personId: "kenji-watanabe",
  },
  {
    id: "a-in-vault",
    app: "vault",
    ago: 0,
    text: "Vault locked after five minutes idle",
  },
  {
    id: "a-in-connect",
    app: "connect",
    ago: 0,
    text: "treechad.vercel.app asked to read your handle",
  },
  {
    id: "a-in-identity",
    app: "identity",
    ago: 0,
    text: "Certificate renewed on your Personal handle",
  },
];
