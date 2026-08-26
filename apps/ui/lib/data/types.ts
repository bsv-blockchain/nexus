/**
 * ============================================================================
 * DATA TYPES — placeholder for future Postgres schema
 * ============================================================================
 *
 * Every interface below maps 1:1 to a future Postgres table (noted above each
 * type). Records carry `id` (uuid), and `createdAt`/`updatedAt` ISO strings
 * where relevant, so seeding a real database later is a straight copy.
 * Foreign keys are modeled as `<table>Id` string fields.
 */

/** Apps Nexus ships as views of its own — each one has a component behind it. */
export type NativeAppSlug =
  | "browser"
  | "connect"
  | "wallet"
  | "signer"
  | "publisher"
  | "tx-viewer"
  | "messages"
  | "learn"
  | "market"
  | "vault"
  | "vote"
  | "baskets"
  | "mail"
  | "identity"
  | "attestations"
  | "roadmap"
  | "timeline";

/**
 * Listings that are somebody else's website.
 *
 * They connect, sit in the rail and open under the same app header as the rest,
 * because from where a person stands that is what an app is. What is behind the
 * header is a page we did not write, which is why the profile's theme stops at
 * the frame: recolouring another party's site would be us speaking for them.
 *
 * Split from the native slugs so `appViews` stays exhaustive — the compiler
 * still refuses a native app with no view, and never asks for one here.
 */
export type WebAppSlug =
  | "cookie-clucker"
  | "pelf"
  | "pixel-war"
  | "omnibazaar"
  | "soundbase"
  | "1sat-market"
  | "tonicpow"
  | "handcash-market"
  | "theme-token"
  | "jamify"
  | "scribe"
  | "free-radio"
  | "hexacities"
  | "bsv-radar"
  | "clndr";

export type HubAppSlug = NativeAppSlug | WebAppSlug;

/** table: identity_keys — the user's identity public keys */
export interface IdentityKey {
  id: string;
  label: string;
  /** compressed secp256k1 public key (hex) */
  publicKey: string;
  primary: boolean;
  /** retired badges are hidden from the active list (never the primary) */
  retired?: boolean;
}

/** table: identity_certificates — credentials issued to the user */
export interface IdentityCertificate {
  id: string;
  type: string;
  issuer: string;
  issuedAt: string;
  fields: { label: string; value: string }[];
}

/**
 * Which folder a listing sits in inside its repo's block.
 *
 * One per app, because a card can only be in one folder. This is shelving, not
 * description — see `StoreCategory` for what an app is *about*, which is a
 * different question and one an app can answer more than once.
 */
export type AppCategory =
  | "system"
  | "core"
  | "finance"
  | "identity"
  | "media"
  | "social"
  | "learning"
  | "developer"
  | "gaming"
  | "marketplace"
  | "productivity";

/**
 * What an app is for, in the words somebody would use looking for one.
 *
 * Many per app: a market for ordinals is a marketplace and a collectibles app
 * at once, and forcing that choice would hide it from half the people who want
 * it. Used by the store filter; the folder an app lands in is `AppCategory`.
 */
export type StoreCategory =
  | "block-explorers"
  | "collectibles"
  | "education"
  | "exchanges"
  | "finance"
  | "gaming"
  | "marketplaces"
  | "media"
  | "other"
  | "productivity"
  | "social"
  | "wallets";

/**
 * table: app_collections — the setups offered in the App Store's column.
 *
 * These are the first run's presets, plus the one thing everybody gets whether
 * they picked anything or not. Ids past "all" and "essentials" are `PresetId`
 * values verbatim, so a card here and a card on the welcome screen are the same
 * card — see lib/data/collections.ts, which builds this list from the presets
 * rather than restating them. Restated here as literals only to keep this
 * module free of an import cycle; collections.ts asserts the two agree.
 */
export type CollectionId =
  | "all"
  | "essentials"
  | "thinker"
  | "maker"
  | "developer"
  | "gamer"
  /* Repository ids, verbatim from lib/data/repositories.ts. A catalogue card is
     the repository, so giving it a second id would mean keeping two in step. */
  | "repo-bsv"
  | "repo-handcash"
  | "repo-1sat";

/**
 * What a card is, which decides what its switch does.
 *
 * `preset` applies a whole setup — apps, rail folder, sources, settings.
 * `always` is Essentials, which is on by definition and cannot be switched.
 * `repository` turns an app source on or off; nothing is installed either way.
 */
export type CollectionKind = "preset" | "always" | "repository";

export interface AppCollection {
  id: CollectionId;
  kind: CollectionKind;
  name: string;
  /**
   * The line under the name, where a card has one worth reading.
   *
   * Catalogue cards use it for the repository's own note — "More from BSVA",
   * "Featured 3rd party" — which is the only thing about a source that is not
   * already written across its banner.
   */
  note?: string;
  description: string;
  /** lucide icon name, for the places that draw a glyph rather than the card */
  icon: string;
  /** apps this connects ("all" ignores this and uses every app) */
  apps: HubAppSlug[];
  /**
   * The clip behind the card, and the frame it rests on.
   *
   * `video` is absent on Essentials, which is not a preset and has no clip of
   * its own; it carries only a `poster`. The preset's accent is deliberately
   * NOT here: the welcome screen grades its clips to it and the column does
   * not, so carrying it would be an unused field that reads like a promise.
   */
  video?: string;
  /** the still shown while the clip is not playing */
  poster?: string;
  /**
   * Where in the clip that still was taken, in seconds.
   *
   * The card seeks back to it when the pointer leaves, so the frame you get
   * before hovering and the frame you get after are the same one. Without it a
   * card would rest on whatever it happened to be paused on.
   */
  posterAt?: number;
  /**
   * Stills to fade through while the pointer is on the card.
   *
   * Essentials has no clip of its own, so it borrows the welcome's opening
   * sequence: the paintings that flicker behind the logo. `poster` is the one
   * it rests on and is the first of these.
   */
  stills?: string[];
  /**
   * `object-position` down the source, 0 to 1.
   *
   * Per card, because these are portrait clips cropped to a wide slot and the
   * subject is at a different height in each — one value for all of them put
   * the reader's head above the slot and the gamer's below it. Picked by eye
   * against the real crop; see the note in app-collections.tsx.
   */
  focus?: number;
  /**
   * Shown on, and not switchable.
   *
   * Essentials, and only Essentials: it is what every setup gets whatever was
   * picked, so a switch on it would be a switch whose off position does not
   * exist. Declared rather than inferred from whether every app in it is
   * `essential` — four of the seven are not, and that rule would have let the
   * card quietly disconnect Browse.
   */
  locked?: boolean;
}

/** table: hub_apps — installable apps shown in the icon rail / Apps manager */
/** Who publishes an app — surfaced as a verified badge and store filter. */
export type AppDeveloper =
  | "nexus"
  | "bsv-association"
  | "open-protocol-labs"
  | "handcash"
  | "third-party";

/** In-app purchase model surfaced in the install sheet. Absent ⇒ free. */
export interface AppPricing {
  /** short right-aligned tag, e.g. "Free to use", "Subscription" */
  summary: string;
  /** optional one-line note under the summary */
  note?: string;
  /** optional subscription tiers */
  plans?: { name: string; price: string }[];
}

export interface HubApp {
  id: string;
  slug: HubAppSlug;
  name: string;
  shortName: string;
  /**
   * Draw the name's vowels at reduced opacity.
   *
   * For a publisher whose wordmark is the word with its vowels dropped —
   * clndr.im spells itself Calendar and lets you read the consonants. Stored as
   * a flag rather than as markup in `name`, because `name` is also what search
   * matches on, what a screen reader announces and what a toast quotes; a field
   * that is sometimes a string and sometimes a fragment would have to be
   * handled at all thirty-odd places one of those is read.
   */
  quietVowels?: boolean;
  description: string;
  /** two or three word subtitle for tiles and tooltips */
  tagline: string;
  /** publishing organisation category */
  developer: AppDeveloper;
  /** 0–100 popularity score used for store sorting */
  popularity: number;
  /** app tile image, served from /public (later: asset url column) */
  iconSrc: string;
  /** accent used for badges and highlights */
  accent: string;
  /** installed for new users by default */
  defaultInstalled: boolean;
  /** always-on app that can't be removed (shown as "Essential") */
  essential?: boolean;
  /** in-app purchases; omitted for the (majority) free apps */
  pricing?: AppPricing;
  /** the folder it sits in within its repo's block */
  category: AppCategory;
  /** what it is for; one app can be several things, and the filter reads these */
  categories: StoreCategory[];
  /**
   * Set when the listing is a website rather than a view we ship.
   *
   * `embeds` is declared rather than detected, because a frame that a host
   * refuses fails silently and cross-origin — by the time the pane is blank
   * there is nothing left to ask. Hosts that say no open in Browse instead,
   * where the address bar and the back button already exist.
   */
  web?: { url: string; embeds: boolean };
  version: string;
  /** which repository serves this listing; see lib/data/repositories.ts */
  repoId: string;
  /** how many people the rating is an average of */
  reviews: number;
  /**
   * Stars out of five, to one decimal.
   *
   * Per app rather than per repo, because a repo's rating is the average of
   * what it carries — a source cannot be better than the things it serves.
   */
  rating: number;
  publisher: string;
  createdAt: string;
}

export type SpaceProfile = "personal" | "work" | "shared";

/** table: spaces */
export interface Space {
  id: string;
  name: string;
  emoji: string;
  sortOrder: number;
  /** accent color for this space's dot and controls (defaults to app accent) */
  themeColor?: string;
  /** who the space is for; surfaced as a subtitle */
  profile?: SpaceProfile;
  createdAt: string;
}

/** internal pages that render in the main view instead of a website */
/**
 * A screen that replaces the browser canvas outright, tabs and all.
 *
 * Only Getting Started. Screens that belong IN a tab — the extensions manager,
 * the search results page — are addressed instead, so they keep a title, an
 * icon, a place in the strip and a Back button. See `INTERNAL_PAGES` in
 * lib/tabs.
 */
export type PageId = "getting-started";

/**
 * A site somebody sent you through TumbleUpon.
 *
 * @see lib/data/tumbleupon.ts
 */
export interface TumbleInboxItem {
  id: string;
  /** a `messagePeople` id — the same person Messages knows */
  fromPersonId: string;
  /** the app they sent, by its slug in the catalogue */
  appSlug: string;
  message: string;
  /**
   * Minutes since it arrived, not a stamp.
   *
   * Same reasoning as `agoLabel` in lib/timeline: a static export has no "now",
   * and an inbox whose only message is three months old reads as abandoned.
   */
  minutesAgo: number;
  read: boolean;
}

/** An extension this browser is carrying. @see lib/data/extensions.ts */
export interface BrowserExtension {
  id: string;
  name: string;
  blurb: string;
  version: string;
  /** its mark, drawn rather than fetched — see the note in the fixture */
  mark: { letters: string; background: string; color: string };
  enabled: boolean;
  /** what it asked for at install, in the words the prompt used */
  permissions: string[];
  site: string;
  /**
   * The things it can be given a keyboard shortcut for.
   *
   * Its own commands in its own order, because the shortcuts screen lists them
   * verbatim and a re-ordered or invented list would be a screen about an
   * extension nobody ships.
   */
  commands: string[];
}

/** table: space_items — folders, their children, live folders and pins */
export interface SpaceItem {
  id: string;
  spaceId: string;
  kind: "folder" | "pin" | "live" | "page" | "link";
  title: string;
  /** lucide icon name */
  icon: string;
  iconColor: string;
  sortOrder: number;
  /** set on folder children — the folder they nest under */
  parentId?: string;
  /** for kind "page" — which internal page to open */
  pageId?: PageId;
  /** for kind "link" — url opened as a tab */
  url?: string;
  createdAt: string;
}

/** table: tabs — open browser tabs, per space */
export interface BrowserTab {
  id: string;
  spaceId: string;
  title: string;
  url: string;
  /** single letter / emoji favicon placeholder */
  favicon: string;
  faviconColor: string;
  sortOrder: number;
  createdAt: string;
}

/** table: favorites — pinned favicon tiles shown under the URL bar */
export interface Favorite {
  id: string;
  title: string;
  url: string;
  favicon: string;
  faviconColor: string;
  sortOrder: number;
  createdAt: string;
}

/** table: pages — mock page content rendered inside the browser app */
export interface MockPage {
  id: string;
  /** matches BrowserTab.url */
  url: string;
  heading: string;
  body: string;
  linkText: string;
  linkHref: string;
  /**
   * Render this page's content in the canvas instead of embedding the live
   * site. Needed for hosts that refuse to be framed (`X-Frame-Options`), which
   * would otherwise leave the canvas blank.
   */
  localOnly?: boolean;
}

/** table: downloads */
export interface DownloadItem {
  id: string;
  /**
   * Which profile downloaded it.
   *
   * Downloads belong to a profile for the same reason tabs and favourites do:
   * a profile is a separate person's-worth of browsing, and a work file showing
   * up in a personal one is the whole point of profiles failing.
   */
  spaceId: string;
  fileName: string;
  fileType: "image" | "video" | "document" | "archive" | "app";
  sizeBytes: number;
  sourceUrl: string;
  status: "completed" | "in-progress" | "failed";
  /** 0–100, only meaningful while in-progress */
  progress: number;
  /** css gradient placeholder standing in for a preview image; null = no preview */
  thumbnail: { from: string; to: string } | null;
  createdAt: string;
}

/** table: wallet_accounts */
/**
 * A place this identity is signed in.
 *
 * @see lib/data/devices.ts
 */
export interface LinkedDevice {
  id: string;
  /** what the person would call it — the model, or the name they gave it */
  label: string;
  /** which build is running there, which is what tells two Macs apart */
  platform: string;
  /** roughly where, because "somewhere I have never been" is the whole alarm */
  place: string;
  /**
   * Minutes since it was last used, or null for the device you are holding.
   *
   * Minutes rather than a stamp, for the reason `agoLabel` gives in
   * lib/timeline: a static export has no "now", so a fixture dated last
   * Tuesday reads as three months stale by the time somebody opens the build.
   */
  lastActiveMinutes: number | null;
  current: boolean;
}

export interface WalletAccount {
  id: string;
  label: string;
  address: string;
  /**
   * The key this wallet is, written once and never again.
   *
   * A label is what you call a wallet and can be changed on a whim; this is
   * what it *is*, and it is what appears in Identity beside your other
   * identifiers. Two wallets can be called "Everyday" — a prototype should not
   * pretend that is impossible — but they can never be this.
   */
  identifier: string;
  /**
   * Which chain the balance is denominated in.
   *
   * Absent means BSV, which is every wallet here today and is why every amount
   * in this file is named `...Satoshis`. It is declared rather than assumed so
   * that a second chain is a row in a table instead of a rename across the app:
   * a wallet on another chain sets this, and the amount fields keep meaning
   * "the chain's smallest unit". `WalletTransaction.tokenId` is the same seam
   * one level down, for assets carried ON a chain.
   */
  chain?: "bsv";
  /** the two stops of the wallet's gradient, so it is known by sight */
  colors: [string, string];
  /** a picture, where one has been set; without it the gradient carries it */
  avatar?: string;
  /**
   * Sealed until a password is given.
   *
   * Data rather than session state because it is a property of the wallet, not
   * of this visit: a locked wallet is locked on every device it appears on.
   */
  locked?: boolean;
  balanceSatoshis: number;
  fiatCurrency: string;
  /** placeholder exchange rate, BSV → fiat */
  fiatRate: number;
  createdAt: string;
}

/** table: wallet_transactions */
export interface WalletTransaction {
  id: string;
  accountId: string;
  txid: string;
  direction: "incoming" | "outgoing";
  amountSatoshis: number;
  /**
   * Token this moved, when it was not BSV. Absent means BSV, and
   * `amountSatoshis` is authoritative; present means `amountUnits` is.
   */
  tokenId?: string;
  amountUnits?: number;
  feeSatoshis: number;
  counterparty: string;
  memo: string;
  status: "confirmed" | "pending";
  confirmations: number;
  createdAt: string;
}

/** table: signing_keys */
export interface SigningKey {
  id: string;
  label: string;
  /** truncated placeholder public key for display */
  publicKey: string;
  keyType: "identity" | "document" | "delegated";
  createdAt: string;
}

/** table: documents — items in the signing app */
export interface SignableDocument {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  status: "awaiting-signature" | "signed" | "verified";
  signedWithKeyId: string | null;
  signedAt: string | null;
  requestedBy: string;
  createdAt: string;
}

/** table: sign_envelopes — documents in the Sign app */
export interface SignEnvelope {
  id: string;
  title: string;
  createdAt: string;
  actionDate: string | null;
  status: "completed" | "awaiting" | "draft" | "declined";
  tag: string;
}

/** table: mint_tiers — token tiers configured in the Publish app */
export interface MintTier {
  id: string;
  name: string;
  supplyPct: number;
  price: string;
  accent: string;
}

/** table: publications — items in the publishing app */
export interface Publication {
  id: string;
  title: string;
  mediaType: "image" | "video" | "document";
  fileName: string;
  sizeBytes: number;
  status: "published" | "processing" | "draft";
  txid: string | null;
  /** css gradient placeholder standing in for a stored thumbnail url */
  thumbnail: { from: string; to: string };
  createdAt: string;
}

/** table: transactions — detailed records for the tx viewer app */
export interface ChainTransaction {
  id: string;
  txid: string;
  blockHeight: number | null;
  blockHash: string | null;
  confirmations: number;
  sizeBytes: number;
  feeSatoshis: number;
  totalInputSatoshis: number;
  totalOutputSatoshis: number;
  inputs: TxIO[];
  outputs: TxIO[];
  /** overlay network annotations shown in the detail panel */
  overlays: TxOverlay[];
  createdAt: string;
}

export interface TxIO {
  address: string;
  satoshis: number;
  scriptType: string;
}

/** table: tx_overlays — overlay-network metadata attached to a transaction */
export interface TxOverlay {
  id: string;
  transactionId: string;
  network: string;
  topic: string;
  summary: string;
  dataPreview: string;
}

/** Which wallet ecosystem owns a handle's namespace. */
export type EcosystemId =
  | "nexus"
  | "yours"
  | "treechat"
  | "twetch"
  | "handcash"
  | "commonsource"
  | "lamint"
  | "mycelia";

/** table: ecosystems — a handle-issuing authority, per BRC-169 section 2.1 */
export interface Ecosystem {
  id: EcosystemId;
  name: string;
  /** dotless short form, e.g. `treechat` */
  alias: string;
  /** fully-qualified authority, e.g. `treechat.app` */
  domain: string;
  /** one line on what this ecosystem is, for its hovercard */
  description?: string;
  /** mark shown beside a foreign handle; `null` falls back to a letter tile */
  icon: string | null;
  /** background plate for marks that are a bare monochrome glyph */
  iconPlate?: string;
  /** handles are account numbers, with the readable name held separately */
  numericHandles?: boolean;
  /**
   * Verbs this ecosystem defines itself, advertised the way BRC-218 section 8
   * describes so foreign clients can surface them or explain why they cannot.
   * A custom verb may never shadow a global one (section 7).
   */
  commands?: {
    verb: string;
    description: string;
  }[];
  /** the user's own ecosystem — its handles need no suffix (section 2.2) */
  local?: boolean;
}

/**
 * table: tokens — a holdable, sendable asset. BSV is the base currency; the
 * rest are issued by an ecosystem and inherit its mark.
 */
export interface Token {
  id: string;
  /** always displayed upper-case, e.g. NUTRI */
  symbol: string;
  name: string;
  /** issuing ecosystem, or null for BSV and independent stablecoins */
  ecosystem: EcosystemId | null;
  /** own mark; null falls back to the issuing ecosystem's */
  icon: string | null;
  /**
   * What to draw behind the mark, for an icon that is a glyph rather than a
   * picture. Absent means the icon fills the circle on its own — which is what
   * a full-bleed logo wants, and what a transparent one must not have.
   */
  plate?: string;
  /** brand tint, for generated tiles and accents */
  color: string;
  decimals: number;
  /**
   * The chain it lives on, where that is not BSV.
   *
   * Absent means BSV, which is every token this wallet issues. Present means
   * the coin arrived by a cross-chain swap and is held on somebody else's
   * chain — which is worth stating on the row, because "0.4 ETH" in a BSV
   * wallet is otherwise a claim nobody can place.
   *
   * The value is ChangeNOW's network code, so a holding and a swap route are
   * talking about the same network. See lib/swap-assets.
   */
  chain?: string;
  /** the base currency — the default for a bare amount */
  base?: boolean;
  /** fiat peg, for stablecoins */
  peg?: { currency: string; note: string };
  /**
   * ISO country/region code for the pegged fiat's flag. Following Vela, a
   * stablecoin is recognised by its flag before its ticker.
   */
  flag?: string;
  blurb: string;
  /** minting protocol, e.g. BSV-21 or 1Sat */
  protocol: string;
  /** where that protocol is documented, when it has a home worth opening */
  protocolUrl?: string;
  /**
   * Who issued it, where that is neither an ecosystem in this app nor nobody.
   * Bitcoin has an author and no issuing company, which "Independent" says
   * poorly.
   */
  issuer?: string;
  issuerUrl?: string;
  usdPerUnit: number;
  /** 24h move as a percentage */
  change24h: number;
}

/**
 * A collectible's lifetime, which is what decides how it is treated: permanent
 * never expires, finite runs out, expired is kept rather than dropped.
 */
export type CollectibleBucket = "permanent" | "finite" | "expired";

/** table: collectibles — an on-chain item the wallet holds */
/** One trait of a collectible, with how many others share it. */
export interface CollectibleTrait {
  name: string;
  value: string;
  /** how many items in the contract carry this exact value */
  count?: number;
  /** the trait's own rarity band, which is not the item's */
  rarity?: string;
}

export interface Collectible {
  id: string;
  /**
   * The wallet holding it.
   *
   * An item is held by a key, not by a person, so "my collectibles" is only
   * ever the union of what each wallet holds — and a wallet you have selected
   * should show you its own. Required rather than optional: an unattributed
   * row would show up under every wallet, which is the bug this prevents.
   */
  accountId: string;
  bucket: CollectibleBucket;
  name: string;
  /** issuing organisation; items sharing one are bundled in the grid */
  org?: string;
  serialNumber: string;
  contract?: string;
  url?: string;
  venue?: string;
  event?: string;
  /** ISO date acquired */
  attained?: string;
  /** ISO date it stops being valid */
  validThrough?: string;
  imageUrl: string;
  /**
   * A clip that is the real artwork, where `imageUrl` is only its first frame.
   *
   * Kept apart from `imageUrl` rather than replacing it: a still paints
   * instantly and a folder stack of six autoplaying videos does not, so the
   * grid wants the frame and the detail wants the clip.
   */
  videoUrl?: string;
  /** where the item sits in its contract's own rarity ladder */
  rarity?: string;
  /** rank within the collection, 1 being the rarest */
  rank?: number;
  /** traits, in the order the contract lists them */
  traits?: CollectibleTrait[];
  redeemed?: boolean;
  expired?: boolean;
  /** burn automatically once expired, rather than leaving dead weight */
  autoBurn?: boolean;
  attributes?: Record<string, string>;
}

/** table: payment_links — a shareable request anyone can pay */
export interface PaymentLink {
  id: string;
  /** the wallet the money lands in */
  accountId: string;
  /** last path segment of the shared link */
  code: string;
  description: string;
  tokenId: string;
  /** fixed amount per payer; absent means the payer chooses */
  amountUnits?: number;
  status: "open" | "closed" | "expired";
  createdAt: string;
  expiresAt: string;
  payments: {
    id: string;
    personId: string;
    units: number;
    paidAt: string;
  }[];
}

/** table: split_bills — an amount divided across handles, with who has paid */
export interface SplitBill {
  id: string;
  /** the wallet the shares settle into, or out of when somebody else raised it */
  accountId: string;
  description: string;
  tokenId: string;
  totalUnits: number;
  createdAt: string;
  /**
   * Who raised it, when it was not you.
   *
   * Absent means this is yours and the shares are owed TO you. Set means
   * somebody else divided an amount and named you in it, so one of the shares
   * is yours to pay. The same row either way — a split is one object seen from
   * two ends, and modelling the second as its own table would let the two
   * disagree about what was owed.
   */
  raisedBy?: string;
  /** which share is yours, on a split somebody else raised */
  yourShareUnits?: number;
  /** what your own share is doing, on a split somebody else raised */
  yourShareStatus?: "paid" | "pending" | "failed";
  shares: {
    personId: string;
    units: number;
    status: "paid" | "pending" | "failed";
  }[];
}

/** table: message_people — everyone the user can hold a conversation with */
/** An account somebody has proved belongs to their identity key. */
export interface AttestedSocial {
  provider: "x" | "github" | "google" | "linkedin";
  handle: string;
}

/**
 * One row of somebody's "link in bio".
 *
 * A label as well as a URL, because a bare address is a thing to read rather
 * than a thing to press: "Portfolio" says what is on the other side and
 * `https://…` makes you work it out. The label is what the card draws; the URL
 * is what it opens.
 */
export interface ProfileLink {
  label: string;
  url: string;
}

export interface MessagePerson {
  id: string;
  name: string;
  /**
   * The handle without `@` or ecosystem suffix. On numeric ecosystems this is
   * the account number, e.g. `23` for Thoth on Treechat.
   */
  handle: string;
  /**
   * Named form of a numeric handle. `@23@treechat` and `@thoth@treechat`
   * address the same identity; both are shown on the profile card.
   */
  username?: string;
  ecosystem: EcosystemId;
  role: string;
  bio: string;
  /** organisation / community shown under the name in a thread header */
  organization: string | null;
  city: string;
  /**
   * Accounts attested to this person's key.
   *
   * Distinct from a vouch: a vouch is somebody's opinion of a person, this is
   * proof that an account you already know is the same key. Absent means none
   * have been linked, which is the common case.
   */
  socials?: AttestedSocial[];
  /**
   * The handful of places this person points people at.
   *
   * Ordered, because the first one is the one somebody actually wants found.
   * Absent means none set, which is the common case and renders as nothing
   * rather than as an empty heading.
   */
  links?: ProfileLink[];
  /** avatar image path; `null` falls back to the generated colour tile */
  photo: string | null;
  /** colour stops for the generated fallback avatar */
  avatarColors: string[];
  /**
   * Web profile on the person's own ecosystem. Federated people always have
   * one (opened as a page in Browse); Nexus people are viewed in-app instead.
   */
  profileUrl?: string;
  /**
   * When the handle was first registered with its ecosystem. Shown with its age,
   * because a handle registered last week and one registered four years ago
   * deserve different amounts of trust even when both resolve.
   */
  registeredAt?: string;
  /** What they work on, as short tags. */
  expertise?: string[];
  /**
   * Ways to reach them off-protocol, as published by their ecosystem.
   *
   * Not attested by anything: an ecosystem host serves these alongside the
   * display name, and like the display name they are unverified. Every field is
   * optional because people publish different amounts.
   */
  contact?: {
    email?: string;
    phone?: string;
    github?: string;
  };
  /**
   * Per-message toll in satoshis this person charges to be reached, per
   * BRC-169 section 8.2. Surfaced as a quote before `/pay` and `/message`.
   */
  tollSats?: number;
  /** peer attestations of this handle-to-key binding, per BRC-169 section 10 */
  attestations?: number;
  /** identity key changed since the user added them (section 4.4) */
  keyChanged?: boolean;
}

/** Read/delivery state of a message the user sent. */
export type MessageStatus = "sent" | "delivered" | "read";

/** An image or file riding along with a message. */
/**
 * One picture or clip in a message.
 *
 * Images and videos share a list rather than living in separate fields, because
 * a single message can carry both and the viewer pages through them in the
 * order they were attached. That ordering is the whole point of a carousel, and
 * it is lost the moment the two kinds are stored apart.
 */
export interface MediaItem {
  /**
   * `file` covers documents; `audio` is a document you can play. Both ride in
   * the same list as pictures because a message carries one set of
   * attachments, whatever they happen to be.
   */
  kind: "image" | "video" | "file" | "audio";
  src: string;
  /** first-frame image for a video, so the tile paints before any bytes load */
  poster?: string;
  /** seconds; shown on the tile and used for the duration chip */
  duration?: number;
  /** intrinsic size, so the tile reserves the right box and never reflows */
  width: number;
  height: number;
  /** short description for assistive technology */
  alt?: string;
  /** for `file` and `audio`: what to call it and how big it is */
  fileName?: string;
  fileSize?: string;
  /** for `audio`: who it is by, shown under the title */
  artist?: string;
}

export type MessageAttachment =
  | { kind: "media"; items: MediaItem[] }
  | { kind: "file"; fileName: string; fileSize: string };

/** The fifteen verbs BRC-218 section 5 fully specifies. */
export type CommandVerb =
  | "pay"
  | "message"
  | "request"
  | "tip"
  | "split"
  | "subscribe"
  | "whois"
  | "attest"
  | "scope"
  | "trolltoll"
  | "delegate"
  | "revoke"
  | "handoff"
  | "sign"
  | "receipt"
  | "refund"
  | "cancel"
  | "standing"
  /** transfer of a real-world asset rather than an amount */
  | "send"
  /**
   * Formerly reserved by BRC-218 section 6. Claimed by section 5.21, which
   * specifies the named-agent case only and leaves dispute resolution out.
   */
  | "escrow"
  /**
   * A secret the transcript is not allowed to keep, per section 5.22. Every
   * other verb's payload is meant to be readable later; this one is meant to
   * stop being readable the moment it has been read once.
   */
  | "once";

/**
 * The five verbs BRC-218 section 6 reserves without specifying. A conforming
 * client MUST report these as unsupported rather than inventing behaviour.
 */
export type ReservedVerb = "bounty" | "poll" | "gate" | "contract";

/**
 * Verbs Nexus defines for itself. `vouch` is not in BRC-218's global set and
 * does not shadow one, so section 8 permits it as an ecosystem-custom command.
 * `renounce` is its opposite, and is likewise ours rather than the spec's.
 */
export type CustomVerb =
  | "vouch"
  | "renounce"
  | "help"
  | "watch"
  | "agent"
  | "roadmap";

export type CommandStatus =
  | "sent"
  | "pending"
  | "failed"
  | "partial"
  | "set"
  | "lifted"
  | "issued"
  | "revoked"
  /**
   * A standing arrangement stopped by its payer. BRC-218 section 5.6 defines
   * how a subscription starts but not how it ends, so this status has no verb
   * behind it yet — see docs/brc-feedback.md.
   */
  | "cancelled"
  | "signed"
  | "resolved"
  | "declined"
  /** a payment sent back against the one it refers to */
  | "refunded"
  /** a request the sender withdrew before it was paid */
  | "withdrawn"
  | "watching"
  /** one side of an escrow committed, waiting for the other */
  | "offered"
  /** both sides committed, waiting on the agent */
  | "awaiting"
  /** the agent holds both sides */
  | "held"
  /** the agent delivered both sides */
  | "released"
  /** the offer window closed with nothing matched */
  | "expired"
  /** a one-time secret nobody has opened yet */
  | "sealed"
  /**
   * A one-time secret the sender burned before it was opened, per §5.18. Not
   * `withdrawn`: a withdrawn request was never owed, where this was genuinely
   * available and is now destroyed, and a reader has to be able to tell a secret
   * that was killed from one that was never live.
   */
  | "burned"
  /**
   * A one-time secret that has been opened. Terminal in both directions: the
   * recipient cannot open it twice and the sender never could, so this status
   * doubles as a read receipt the recipient cannot suppress — BRC-218 §5.22(6).
   */
  | "revealed";

/** One leg of a `/split`, which fails independently per BRC-218 section 5.5. */
export interface CommandLeg {
  personId: string;
  sats: number;
  /** units, when the split was token-denominated */
  units?: number;
  ok: boolean;
  error?: string;
}

/**
 * The structured outcome of a command, rendered as a card in the thread.
 * Amounts are always carried in satoshis; a fiat original is kept alongside so
 * the card can show both, as BRC-218 section 3.4 requires.
 */
export interface CommandCard {
  verb: CommandVerb | CustomVerb;
  status: CommandStatus;
  /** person ids this applied to */
  recipientIds?: string[];
  amountSats?: number;
  fiat?: { currency: string; amount: number };
  /** set when the amount is token-denominated rather than BSV */
  token?: { id: string; symbol: string; units: number };
  /** toll paid on top of the amount, shown separately per section 5.1 */
  tollSats?: number;
  memo?: string;
  /** per-leg outcomes for `/split` */
  legs?: CommandLeg[];
  period?: "day" | "week" | "month";
  /** human duration as typed, e.g. `30d` */
  duration?: string;
  /** BRC-169 section 9.2 scope string, or a `/scope` reachability value */
  scope?: string;
  /** the message a bound command applied to */
  boundMessageId?: string;
  /** the id of the message whose command this one refunds or withdraws */
  refersToMessageId?: string;
  /**
   * The one-time secret this card carries, by reference.
   *
   * Never the secret itself. A card is transcript, and a transcript that holds
   * the plaintext has already broken the only promise `/once` makes. The
   * payload lives in the client's sealed store until it is opened, and the
   * store drops it there and then.
   */
  secretId?: string;
  /**
   * How many documents went into the seal.
   *
   * A property of the envelope rather than of its contents, which is why it is
   * on the card and survives the opening: "a document was sealed here and
   * collected at 14:32" is the part of the record worth keeping. The names and
   * the bytes are not here, and never were.
   */
  sealedFiles?: number;
  /** collectible id, for a transfer or an escrowed asset */
  assetId?: string;
  /** on-chain transaction the transfer settled in */
  txid?: string;
  /** the escrow this card belongs to, so its later states can find it */
  escrowId?: string;
  /** the roadmap feature a /roadmap card points at */
  featureId?: string;
  /** when an escrow offer stops being matchable */
  expiresAt?: string;
  /** the handle holding both sides of an escrow */
  agentId?: string;
  /** delegation certificate serial */
  serial?: string;
  /** BRC-3 signature over the message hash */
  signature?: string;
  /** whether a cumulative cap is genuinely enforced, per BRC-169 9.3.3 */
  capEnforced?: boolean;
  /** caveat or failure detail shown under the card */
  note?: string;
}

/** table: chat_messages — messages within a conversation */
export interface ChatMessage {
  id: string;
  conversationId: string;
  /** person id, or "me" for the signed-in user */
  senderId: string;
  text: string;
  createdAt: string;
  /** only meaningful on the user's own messages */
  status?: MessageStatus;
  attachment?: MessageAttachment;
  /** an in-hub destination referenced by the message */
  link?: { label: string; href: string };
  /**
   * Set when this message is a command outcome rather than chat. Rendered as a
   * structured card. Note that inbound plain text is never parsed for
   * commands — BRC-218 section 2.4 forbids it — so this is only ever produced
   * locally or seeded.
   */
  command?: CommandCard;
  /**
   * Shown to the local user only, and never sent: the client's own reply to a
   * command, in the ecosystem of the chat it was typed in. Slack calls these
   * ephemeral. They are not part of the transcript, so they carry no status and
   * nobody else can see them.
   */
  ephemeral?: boolean;
  /** Renders the command reference rather than `text`. Used by `/help`. */
  help?: boolean;
  /** `/help <verb>`: narrow the reference to one verb. */
  helpVerb?: string;
  /** Renders the standing-authority summary rather than `text`. Used by `/standing`. */
  standing?: boolean;
}

/**
 * Who may join a gated group.
 *
 * Present at all only when the room's access gate is switched on. Each gate is
 * independent and additive: a candidate has to pass every gate that is `on`.
 * The entity lists hold person ids; the token list holds token or collectible
 * ids. An `on` gate with an empty list is configuration in progress and gates
 * nobody, rather than everybody.
 */
/**
 * What a participant may do in a room.
 *
 * Three, deliberately. Every additional rung is a rung somebody has to reason
 * about before they can answer "can they delete my message", and the answer to
 * that question is the only reason the ladder exists.
 */
export type RoomRole = "member" | "mod" | "admin";

/**
 * How a room turns a gate into a role.
 *
 * Roles are **derived, never granted**. Nobody is made a mod; they hold a Rare,
 * or 21.8 BSV, or a vouch from a named handle. The consequence is deliberate:
 * sell the item and the role goes with it, on the same evaluation as the gate
 * itself. A list of appointed moderators is the administrator-shaped thing that
 * gates exist to replace, and it fails the same way.
 *
 * A role map is only ever a mapping of a gate's own vocabulary onto the ladder,
 * which is why there is one shape per gate type rather than one list of people.
 */
export interface RoomRoles {
  on: boolean;
  /**
   * Rarity band → role, for a non-fungible contract.
   *
   * Read as a threshold and not as a set: "Rare is a mod" means Rare and
   * anything above it. A rarer item never buys you less, which is the only
   * reading a holder will guess at, and the alternative silently demotes the
   * Legendary holder standing next to the Rare.
   */
  rarity?: Partial<Record<RoomRole, string>>;
  /**
   * Minimum holding → role, for a fungible token, keyed by token id.
   *
   * Same ladder, expressed in the only vocabulary a currency has. Thresholds
   * MUST rise with the role or the map contradicts itself.
   */
  minimums?: Record<string, Partial<Record<RoomRole, number>>>;
  /**
   * Blocks remaining on a lock → role.
   *
   * The one ladder that cannot be bought outright. A band or a balance is for
   * sale at a price; a lock is for sale only at the cost of not being able to
   * move what you bought, for as long as the room asks. Unlike a share of
   * supply it does not cap the population — any number of people can lock for
   * a year — so it measures commitment rather than scarcity.
   */
  locks?: Partial<Record<RoomRole, number>>;
  /**
   * Whether the handles named by a vouch or renounce gate are admins.
   *
   * A room that gates on Darren's word has already said whose judgement runs
   * it. Making that explicit rather than assumed keeps it switchable, because
   * a room may want his vouch as a door without handing him the room.
   */
  entitiesAreAdmins?: boolean;
}

export interface GroupGates {
  /**
   * Members must hold one of these tokens or collectibles.
   *
   * `minimums` applies only to fungible ones, keyed by token id: holding a
   * collectible is a yes-or-no fact, but holding a currency is a quantity, and
   * a door that opens on a single satoshi is not a door. Absent means any
   * non-zero holding passes.
   */
  token: {
    on: boolean;
    ids: string[];
    minimums?: Record<string, number>;
    /**
     * A recurring charge for staying in, keyed by token id.
     *
     * Distinct from the minimum, which is a threshold you either clear or do
     * not. A fee is a payment out, so it needs somewhere to go — a room that
     * charges rent without naming the landlord is a room nobody should agree
     * to. Only offered where a minimum is set: charging to hold nothing is a
     * subscription wearing a gate's clothes.
     */
    fees?: Record<string, { perDay: number; toId?: string }>;
  };
  /**
   * Members must hold value they have locked out of their own reach.
   *
   * A holding gate asks what somebody has; this asks what they have given up
   * the ability to move. The difference is that a holding can be borrowed for
   * the moment of the check and a lock cannot — you cannot rent something you
   * must leave immobilised for a month.
   *
   * `minBlocks` is a rolling requirement, not a date: the lock must still have
   * that many blocks left to run. A fixed height would expire for the whole
   * room on one day and empty it at once, where a rolling one is a commitment
   * that has to be re-earned.
   *
   * Nobody takes custody. The lock is to the holder's own key and returns to
   * them when it runs out, which is what makes this specifiable at all —
   * there is no counterparty, no refund path, and nothing to arrange when the
   * room ends.
   */
  timelock: {
    on: boolean;
    /** the asset that must be locked; a currency, since a lock is an amount */
    assetId?: string;
    amount?: number;
    /** blocks the lock must still have left to run */
    minBlocks?: number;
  };
  /** members must be vouched for by one of these entities */
  vouch: { on: boolean; entityIds: string[] };
  /** anyone renounced by one of these entities cannot join */
  renounce: { on: boolean; entityIds: string[] };
}

/**
 * table: chat_threads — a conversation, either a 1:1 DM (`personId`) or a
 * group (`group`). Exactly one of the two is set.
 */
export interface ChatThread {
  id: string;
  /** set for a 1:1 conversation */
  personId?: string;
  /** set for a group conversation */
  group?: {
    title: string;
    memberIds: string[];
    /** the ecosystem this group lives on — drives the tag on the row */
    ecosystem: EcosystemId;
    /**
     * A picture the room chose for itself. Where one is set it replaces the
     * mosaic of members: a room that has picked an emblem is telling you what
     * it is, which its membership list is not.
     */
    icon?: string;
    /** who may join, when the room's access gate is on */
    gates?: GroupGates;
    /** how the gate's own vocabulary maps onto the role ladder */
    roles?: RoomRoles;
    /**
     * Who holds the room.
     *
     * Custody, not qualification. The holder is an admin whatever the gate
     * says and is exempt from the gate entirely — without that, a room can
     * lock out its own administrator by naming a hostile attestor, or by
     * being founded by somebody holding a Common. It is one identity rather
     * than a list, it is transferable, and a client MUST show it plainly so
     * that it reads as custody rather than as a backdoor.
     */
    holderId?: string;
    /** set once an admin closes the room; nothing new is accepted after */
    closed?: { byId: string; at: string };
  };
  createdAt: string;
}

/** table: courses — items in the learn app */
export interface Course {
  id: string;
  title: string;
  provider: string;
  lessonsTotal: number;
  lessonsCompleted: number;
  level: "beginner" | "intermediate" | "advanced";
  thumbnail: { from: string; to: string };
  createdAt: string;
}

/** table: market_listings — items in the market app */
export interface MarketListing {
  id: string;
  title: string;
  collection: string;
  /** minting/marketplace application the ordinal originates from */
  application: string;
  priceSatoshis: number;
  seller: string;
  kind: "ordinal" | "token" | "domain";
  /** whether the ordinal is currently listed for sale */
  listed: boolean;
  /** highlighted as part of a featured collection */
  featured: boolean;
  likes: number;
  comments: number;
  /** glyph shown centered when no artwork image is available */
  glyph: string;
  /** local artwork path under /public; falls back to gradient + glyph */
  image?: string;
  thumbnail: { from: string; to: string };
  createdAt: string;
}

/** table: vault_items — encrypted items in the vault app */
export interface VaultItem {
  id: string;
  /**
   * The workspace whose vault this is in.
   *
   * A vault holds seeds, keys and papers, which are the most workspace-shaped
   * things a person owns — the whole argument for separating work from home is
   * that they do not share a key. The column header names the workspace, and
   * that name has to be true of what is under it.
   */
  spaceId: string;
  label: string;
  kind: "seed-backup" | "key" | "credential" | "file";
  lastAccessedAt: string;
  sizeBytes: number | null;
  createdAt: string;
}

/** table: connections — sites/apps connected to your identity (Connect app) */
export interface Connection {
  id: string;
  name: string;
  /**
   * The shelf it sits on, from the store's own set.
   *
   * The same `StoreCategory` the App Store filters by rather than a second
   * vocabulary: a site you connected and an app you installed are the same kind
   * of thing seen from two screens, and two lists of categories would disagree
   * within a week of either being edited.
   */
  category: StoreCategory;
  origin: string;
  favicon: string;
  faviconColor: string;
  permissions: string[];
  lastUsedAt: string;
  createdAt: string;
}

/** table: output_baskets — wallet output baskets (Baskets developer app) */
export interface OutputBasket {
  id: string;
  name: string;
  description: string;
  outputCount: number;
  satoshis: number;
  protocol: string;
  createdAt: string;
}

/** a BSV payment attached to an email */
export interface MailPayment {
  amountSatoshis: number;
  direction: "received" | "sent";
  memo: string;
}

/** table: mail_messages — emails in the Mail app */
export interface MailMessage {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: string;
  read: boolean;
  tags: string[];
  /** set when the message carries an attached BSV payment */
  payment?: MailPayment;
}

/** table: proposals — governance items in the vote app */
export interface Proposal {
  id: string;
  title: string;
  summary: string;
  status: "open" | "closed";
  votesFor: number;
  votesAgainst: number;
  closesAt: string;
  createdAt: string;
}
