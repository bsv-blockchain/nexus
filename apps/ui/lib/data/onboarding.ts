/**
 * table: app_onboarding — the few things worth knowing about each app.
 *
 * One entry per app in the store, read by the onboarding pane. Kept as data so
 * that a mini app evolving is an edit here rather than a change to a component:
 * the pane renders whatever this file says, in the order it says it, and an app
 * with no entry simply has no pane rather than an empty one.
 *
 * Deliberately short. This is the pane somebody opens once, so it carries the
 * two or three things that make the app make sense — not its manual.
 */
import type { HubApp } from "./types";

/** The store's own slug type, so an entry cannot name an app that is not there. */
type AppSlug = HubApp["slug"];

/**
 * What a guide can be about.
 *
 * Almost always an app, but not only: `store` and `profiles` are shell
 * surfaces, which people need explained for the same reasons an app does and
 * had no way to say so. Kept as a widened slug rather than a second table — one shape, one
 * pane, one help button, and the store's entry is written the same way as
 * everything else's.
 */
export type OnboardingSlug = AppSlug | "store" | "profiles";

/**
 * The band at the top of the pane.
 *
 * A still today and a looping clip later, which is why both live on one type:
 * when `video` is set the pane plays it muted and on repeat with `image` as the
 * poster, so the still is never wasted and a clip can be dropped in per app
 * without touching the component. `width`/`height` are the intrinsic size, so
 * the band reserves its box and the pane does not reflow as media loads.
 */
export interface OnboardingMedia {
  image: string;
  /** looping clip; when present it replaces the still and `image` is its poster */
  video?: string;
  width: number;
  height: number;
  alt: string;
}

export interface OnboardingFeature {
  id: string;
  title: string;
  /** the one line the row shows */
  summary: string;
  body: string;
  /** how to reach it, where it takes more than a sentence */
  steps?: string[];
  /** the specification behind it, where there is one */
  reference?: string;
}

export interface AppOnboarding {
  slug: OnboardingSlug;
  /**
   * What to call it, for guides that are not an app.
   *
   * An app's name comes from its store entry, which is the only copy of it that
   * can be right. Anything else has to say.
   */
  title?: string;
  /** what the app is for, in one line */
  headline: string;
  /** absent until a still has been captured; the pane drops the band without it */
  media?: OnboardingMedia;
  features: OnboardingFeature[];
}

/** Every captured still is this shape, so a clip can replace it in place. */
const BAND = { width: 1280, height: 720 } as const;

function band(slug: string, alt: string): OnboardingMedia {
  return { image: `/onboarding/${slug}.png`, ...BAND, alt };
}

export const appOnboarding: AppOnboarding[] = [
  {
slug: "profiles",
    title: "Profiles",
    headline: "One device, several lives, kept apart.",
    features: [
      {
        id: "what",
        title: "A context, not an account",
        summary: "Nothing to sign into. You are the same person in all of them.",
        body: "A profile answers which version of you is doing this, and the answer decides which name people see and which money moves. Work and Personal are the obvious pair; a shop, a side project or a shared household are the same idea.",
      },
      {
        id: "connections",
        title: "One handle, one wallet, its own apps",
        summary: "Connected from what you own, not owned by the profile.",
        body: "One of each rather than several: a context holding three wallets puts which one did that come from back on every payment, which is what a profile is meant to settle. The same wallet can serve two profiles, and the left column says when it does.",
        steps: [
          "Pick a handle and a wallet under a profile's Connections tab.",
          "Connect an app another profile already has from the row above its list.",
          "Anything new comes from Apps, which asks for permissions first.",
        ],
      },
      {
        id: "switching",
        title: "Switching moves everything with it",
        summary: "The rail, the wallet and your handle follow the ringed column.",
        body: "Clicking a column makes it active and leaves you here, so several can be set up in a row without being thrown into each one.",
      },
      {
        id: "browsing",
        title: "Browsing stays where it happened",
        summary: "Tabs and bookmarks belong to the profile that opened them.",
        body: "A tab opened in Work stays in Work. Drag one onto another column to move it — a profile without Browse gets it connected on the drop, since a bookmark it cannot open is no use to it.",
      },
    ],
  },
  {
    slug: "store",
    title: "Apps",
    headline: "Mini apps you connect to Nexus, and what they can do once you do.",
    features: [
      {
        id: "what",
        title: "An app runs inside Nexus, not beside it",
        summary: "Connecting one puts it in the rail; disconnecting takes it out.",
        body: "A mini app borrows the parts of Nexus you already have — your keys, your wallet, your identity — rather than asking you to set them up again. That is the whole reason it connects rather than being a bookmark, and also the reason it has to ask permission before it does anything with them.",
        steps: [
          "Connect from the store and the app appears in the left rail.",
          "Disconnect there or from the store; nothing it stored is kept.",
          "Essentials cannot be disconnected. They are what other apps rely on.",
        ],
      },
      {
        id: "collections",
        title: "Collections connect a set at once",
        summary: "One switch, several apps, one permission sheet.",
        body: "A collection is somebody's answer to a question — what a developer needs, what a shop needs — rather than a category. The switch connects every app in it, and the sheet that opens first lists what the whole set is asking for, because approving five things one at a time is how people stop reading.",
      },
      {
        id: "permissions",
        title: "What it asked for is not what it keeps",
        summary: "Permissions are granted once here and changed any time in Connect.",
        body: "Identifying you and acting without asking are two separate grants, and an app can have one without the other. Both are revocable, and revoking is not disconnecting — an app can stay in your rail with nothing but the screen it draws.",
      },
      {
        id: "repositories",
        title: "The store is a view over lists you chose",
        summary: "Repositories decide what appears; you decide the repositories.",
        body: "Nexus ships with a few and you can add your own. What appears in one is decided by whoever runs it and nobody else, including us — so an unsigned repository is off by default, and turning it on is a setting with a warning attached rather than a checkbox.",
        steps: [
          "Open App repositories at the foot of this column.",
          "Enable or disable a list; the store reflows to what is left.",
        ],
      },
    ],
  },
  {
    slug: "roadmap",
    headline: "What is being built, and what people are asking for.",
    media: band("roadmap", "The Nexus roadmap board, three columns of feature cards"),
    features: [
      {
        id: "columns",
        title: "Three columns, three different claims",
        summary: "Fundable, funded, shipped — and they are not the same as a backlog.",
        body: "Fundable means nobody has paid for it yet. Funded means the money is here and the work is not, which is the uncomfortable column and the reason the board is worth having. Shipped is not written by hand: it is read from the release notes, so a feature cannot appear there without a release claiming it.",
        steps: [
          "Filter to one column from the left, which is also how the board reads on a phone.",
          "Sort by what is closest to its goal to find what one more pledge would finish.",
        ],
      },
      {
        id: "fund",
        title: "Funding is a signal, not an order",
        summary: "It weighs on what we pick up next. It does not buy the work.",
        body: "Nothing on this board is a promise. Putting satoshis behind a feature says how much you want it, and a feature people have paid for is one we weigh more heavily when deciding what to do next — but it can still be reconsidered, reshaped, or turned down, and some of it will be. Anybody telling you a public roadmap guarantees delivery is selling you something.",
        steps: [
          "Open a card and pick an amount, or type your own.",
          "It goes through Payments like anything else you spend — a second way to send money is a second way to get it wrong.",
          "Every pledge is attributable to a handle, so the backer list is people rather than a total.",
        ],
        reference: "BRC-169",
      },
      {
        id: "in-chat",
        title: "Argue about a feature where the argument is",
        summary: "/roadmap #slug puts a card in a conversation.",
        body: "The card carries the live figures and opens the full view. It is read-only in the thread on purpose: what somebody wants is worth discussing in a room, and what they spend is worth confirming in a wallet.",
        reference: "BRC-218",
      },
    ],
  },
  {
    slug: "messages",
    headline: "Conversations that can carry money, proof and secrets.",
    media: band("messages", "A Nexus conversation with command pills in the thread"),
    features: [
      {
        id: "commands",
        title: "Type a command in the message box",
        summary: "Pay, request, sign or look somebody up without leaving the chat.",
        body: "A command reads as the line you typed, and the pill it leaves carries every parameter it took. Nothing moves until you confirm it, and nothing you receive is ever parsed as a command — only what you compose locally.",
        steps: [
          "Type / to see every command this client runs.",
          "Type /help for the same list with what each one does.",
          "In a one-to-one you can leave the handle out.",
        ],
        reference: "BRC-218",
      },
      {
        id: "once",
        title: "Send a secret with /once",
        summary: "A credential or document each handle can open exactly once.",
        body: "Sealed to the recipient's key, so this client cannot open it either. They see five dots until they open it and five hollow ones afterwards, and so do you — opening it tells you it was opened whether they mention it or not.",
        reference: "BRC-218 §5.22",
      },
      {
        id: "onchain",
        title: "Decide what outlives the conversation",
        summary: "Messages, delivery proofs, or nothing.",
        body: "Set the default in Settings and override it for one room from that conversation's settings. Anchoring whole messages is offered per conversation only, and the first permanent message in a room asks before it writes.",
      },
    ],
  },
  {
    slug: "wallet",
    headline: "Pay a handle, not an address.",
    media: band("wallet", "The Nexus wallet showing balance and recent activity"),
    features: [
      {
        id: "handles",
        title: "Send to a handle",
        summary: "The name resolves to a key at the moment you pay.",
        body: "You are paying the person the handle names rather than an address somebody pasted. The confirmation shows the fully-qualified handle, and a key that has changed since you last saw it blocks the payment rather than warning about it.",
        reference: "BRC-169",
      },
      {
        id: "unbroadcast",
        title: "Payments arrive unbroadcast",
        summary: "The recipient decides when it hits the network.",
        body: "A payment to a handle is delivered inside a signed envelope rather than pushed at the chain, so the memo can live in the encrypted content instead of the metadata — where operators can read it.",
      },
      {
        id: "splits",
        title: "Divide one amount across handles",
        summary: "Independent payments, so one failing does not undo the rest.",
        body: "Each share is its own payment with its own outcome, and the remainder goes to whoever was named first rather than wherever the client felt like — so both sides can work out who got the extra satoshi.",
        reference: "BRC-218 §5.5",
      },
    ],
  },
  {
    slug: "identity",
    headline: "Your keys, and what other people say about them.",
    media: band("identity", "Identity keys and certificates in Nexus"),
    features: [
      {
        id: "keys",
        title: "One identity, many keys",
        summary: "Add, rename and retire keys without losing the identity.",
        body: "A retired key stays visible rather than vanishing: something signed under it is still signed, and a list that hides it makes old signatures unexplainable.",
      },
      {
        id: "certificates",
        title: "Certificates you hold and issued",
        summary: "Attestations, delegations and vouches in one list.",
        body: "Every certificate carries who issued it, what it claims, and when it lapses. A delegation's cap is described per action rather than as a total, because a cumulative limit is not enforceable unless each action is funded.",
        reference: "BRC-169 §9",
      },
    ],
  },
  {
    slug: "browser",
    headline: "The web, with a wallet and an identity already in it.",
    media: band("browser", "Browsing with Nexus profiles and spaces"),
    features: [
      {
        id: "spaces",
        title: "Spaces keep contexts apart",
        summary: "Each profile has its own tabs, theme and identity.",
        body: "Work and personal browsing do not share a key, a history or a look. Switching profile switches all three at once, so there is no state left behind to leak between them.",
      },
      {
        id: "connect",
        title: "Sites ask, they do not take",
        summary: "Every permission a site wants is a prompt you can refuse.",
        body: "A site asking for your identity, a signature or a payment gets a prompt naming exactly what it asked for. Granting one is not granting the next.",
      },
    ],
  },
  {
    slug: "connect",
    headline: "What you have let in, and how to let it back out.",
    media: band("connect", "Connected apps and their permissions"),
    features: [
      {
        id: "review",
        title: "Every connection in one list",
        summary: "What it can do, and when you granted it.",
        body: "A permission granted months ago is a permission you have forgotten. This is the list that makes that visible, with the scope beside each entry rather than behind it.",
      },
      {
        id: "revoke",
        title: "Revoking is detectable, not instant",
        summary: "Treat an app as able to act until the spend confirms.",
        body: "Revocation is a claim you publish rather than a switch you flip on somebody else's machine, so it takes effect as fast as the other side checks. The app says so rather than implying otherwise.",
      },
    ],
  },
  {
    slug: "signer",
    headline: "Put your key on something, and prove you did.",
    media: band("signer", "Signing a document in Nexus"),
    features: [
      {
        id: "sign",
        title: "Sign a document",
        summary: "The signature commits to exactly what you were shown.",
        body: "What you sign is what was on screen, and the confirmation shows it back to you first. Change a byte afterwards and the signature stops verifying, which is the whole point of it.",
        reference: "BRC-3",
      },
      {
        id: "countersign",
        title: "Countersign somebody else's",
        summary: "Two keys on one document, in order.",
        body: "Each signature covers the document as it stood, so a chain of them records who agreed to what and when rather than collapsing into one flat approval.",
      },
    ],
  },
  {
    slug: "publisher",
    headline: "Publish something nobody can quietly take down.",
    media: band("publisher", "Publishing media on-chain with Nexus"),
    features: [
      {
        id: "publish",
        title: "Write it to the chain",
        summary: "Images, video and documents, addressed by their content.",
        body: "Published means published: there is no console anybody can log into to remove it. That is the feature and the risk, so the flow says so before it writes rather than afterwards.",
      },
      {
        id: "library",
        title: "Your library is the record",
        summary: "Drafts, processing and published, in one place.",
        body: "A draft is yours alone until you publish it. Once written, the library shows the transaction rather than a status word, so you can check the claim instead of taking it.",
      },
    ],
  },
  {
    slug: "tx-viewer",
    headline: "Read a transaction rather than trust a summary.",
    media: band("tx-viewer", "Inspecting a transaction and its overlays"),
    features: [
      {
        id: "inspect",
        title: "Inputs, outputs and scripts",
        summary: "What was spent, what was created, and under what conditions.",
        body: "Every claim another app makes about a payment ends up here as something you can check. A client that says 'confirmed' is asking to be believed; this is where you stop having to.",
      },
      {
        id: "overlays",
        title: "Overlay topics on a transaction",
        summary: "Which services indexed it, and what they saw.",
        body: "An overlay is how a transaction becomes findable without a registry. Seeing which topics carried it explains why an app knew about it at all.",
      },
    ],
  },
  {
    slug: "mail",
    headline: "Email where the postage is a payment.",
    media: band("mail", "The Nexus mail inbox"),
    features: [
      {
        id: "paid",
        title: "A price on your attention",
        summary: "Strangers attach a payment; contacts do not.",
        body: "The toll is due on every message and is not refunded when you reply — which is what makes it a filter rather than a deposit. People already in your contacts are unaffected.",
        reference: "BRC-218 §5.10",
      },
      {
        id: "encrypted",
        title: "Encrypted to a key, not a server",
        summary: "The provider sees a sender and a size.",
        body: "Content is encrypted to the recipient's identity key, so what an operator can read is who wrote to whom and how much of it — not what it said.",
      },
    ],
  },
  {
    slug: "learn",
    headline: "How this works, in the order it makes sense.",
    media: band("learn", "Courses and guides in Nexus Learn"),
    features: [
      {
        id: "courses",
        title: "Short courses, in sequence",
        summary: "Keys, payments, identity and overlays.",
        body: "Ordered so each one only assumes what came before it. The point is to stop the product being a set of features you have to already understand.",
      },
    ],
  },
  {
    slug: "market",
    headline: "Buy and sell the things you actually hold.",
    media: band("market", "Ordinals and tokens listed in Nexus Market"),
    features: [
      {
        id: "listings",
        title: "Listings you can verify",
        summary: "Every item resolves to an output you can open.",
        body: "A listing is a claim about something on chain, and the market shows you the thing rather than a picture of it. What you are buying is checkable before you pay for it.",
      },
      {
        id: "transfer",
        title: "The item moves, not a claim on it",
        summary: "The transfer settles as its own transaction.",
        body: "You end up holding the output, not an entry in somebody's database. That is what makes it possible to sell it somewhere else afterwards.",
      },
    ],
  },
  {
    slug: "vault",
    headline: "Somewhere to put the things that must not leak.",
    media: band("vault", "Encrypted items in the Nexus vault"),
    features: [
      {
        id: "items",
        title: "Seed backups, keys and credentials",
        summary: "Encrypted to your identity, kept apart from your files.",
        body: "The vault is deliberately not a folder. Everything in it is encrypted to a key you hold, and nothing in it is readable by an app that has not asked for it.",
      },
      {
        id: "backup",
        title: "A backup you can actually restore",
        summary: "Tested by restoring it, not by having made one.",
        body: "A backup nobody has restored is a hope. The flow walks the restore as well as the export, because the first time you try it should not be the day you need it.",
      },
    ],
  },
  {
    slug: "vote",
    headline: "Decisions with a record behind them.",
    media: band("vote", "Open and closed proposals in Nexus Vote"),
    features: [
      {
        id: "proposals",
        title: "Proposals, open and closed",
        summary: "What was decided, by whom, and when.",
        body: "A closed proposal keeps its result and its participants rather than disappearing, so a decision can be checked later by somebody who was not there.",
      },
    ],
  },
  {
    slug: "baskets",
    headline: "The outputs behind your balance.",
    media: band("baskets", "Output baskets in Nexus"),
    features: [
      {
        id: "baskets",
        title: "Outputs grouped by what they are for",
        summary: "Spendable, locked, and holding something.",
        body: "A balance is a sum, and a sum hides the shape of what you hold. Baskets show the outputs themselves, which is the difference between knowing your total and knowing what you can actually spend today.",
      },
    ],
  },
  {
    slug: "attestations",
    headline: "Say something about somebody, and sign it.",
    media: band("attestations", "Attestations issued and received"),
    features: [
      {
        id: "attest",
        title: "Attest a handle to a key",
        summary: "One narrow claim: this handle resolves to this key.",
        body: "It says nothing about whether they are worth dealing with. Your key is on it, so a careless attestation is a cost you carry.",
        reference: "BRC-169",
      },
      {
        id: "vouch",
        title: "Vouch for a person",
        summary: "A different claim from attesting, kept visibly separate.",
        body: "One is about a key, the other is about a person. Letting the two look alike would let regard pass for verification, which is why they are separate verbs with separate records.",
      },
    ],
  },
];

export function getAppOnboarding(
  slug: OnboardingSlug,
): AppOnboarding | undefined {
  return appOnboarding.find((entry) => entry.slug === slug);
}
