/**
 * ============================================================================
 * DATA ACCESS LAYER — placeholder for future Postgres queries
 * ============================================================================
 *
 * Components read data ONLY through these accessors, never by importing the
 * row modules directly. Each function mirrors the query it will become
 * (`select * from …`), so swapping in a real database later only touches this
 * file. Functions are synchronous today; when Postgres lands they become
 * async server queries.
 */
import { courses, marketListings, proposals, vaultItems } from "./apps-content";
import { isEmptyContent } from "@/lib/content-mode";
import {
  chatMessages,
  chatThreads,
  currentMessageUser,
  messagePeople,
  nexusBot,
} from "./messages";
import { ecosystems } from "./ecosystems";
import { linkedDevices } from "./devices";
import { browserExtensions } from "./extensions";
import { tumbleConnections, tumbleInbox } from "./tumbleupon";
import { foreignTokens, tokenBalances, tokens } from "./tokens";
import { attributeColors, collectibles } from "./collectibles";
import { paymentLinks, splitBills } from "./wallet-extras";
import { connections, outputBaskets } from "./developer";
import { downloads } from "./downloads";
import { appCollections } from "./collections";
import { defaultRepositories, type AppRepository } from "./repositories";
import { hubApps } from "./hub-apps";
import { identityCertificates, identityKeys } from "./identity";
import { mailMessages } from "./mail";
import { mintTiers, publications } from "./publications";
import { signableDocuments, signEnvelopes, signingKeys } from "./documents";
import {
  browserTabs,
  favorites,
  mockPages,
  spaceItems,
  spaces,
} from "./spaces";
import { chainTransactions } from "./transactions";
import { walletAccounts, walletTransactions } from "./wallet";
import { DEMO_SURFACES, shippedApps } from "../surfaces";
import type {
  BrowserExtension,
  TumbleInboxItem,
  LinkedDevice,
  AppCollection,
  BrowserTab,
  ChainTransaction,
  ChatMessage,
  ChatThread,
  CollectionId,
  Connection,
  Course,
  DownloadItem,
  Ecosystem,
  EcosystemId,
  Favorite,
  HubApp,
  IdentityCertificate,
  IdentityKey,
  MailMessage,
  MarketListing,
  MessagePerson,
  MintTier,
  MockPage,
  OutputBasket,
  Proposal,
  Publication,
  SignableDocument,
  SignEnvelope,
  SigningKey,
  Space,
  Collectible,
  CollectibleBucket,
  PaymentLink,
  SpaceItem,
  SplitBill,
  Token,
  VaultItem,
  WalletAccount,
  WalletTransaction,
} from "./types";

export * from "./types";
export {
  checkHandle,
  handleListings,
  listingFor,
  MAX_HANDLES,
  HANDLE_CHANGE_USD,
  linkedAccounts,
  socialProviders,
  type HandleCheck,
  type HandleListing,
  type LinkedAccount,
  type SocialProvider,
} from "./handles";
export { licence, type LicenceBlock } from "./licence";
export {
  legalDocuments,
  legalUpdated,
  type LegalDocument,
  type LegalSection,
} from "./legal";
export {
  shortcutGroups,
  shortcuts,
  type Shortcut,
  type ShortcutGroup,
} from "./shortcuts";
export {
  getSearchEngine,
  searchEngines,
  type SearchEngine,
} from "./search-engines";
export { media, mediaItems, type MediaKey } from "./media";
export {
  appOnboarding,
  getAppOnboarding,
  type AppOnboarding,
  type OnboardingFeature,
  type OnboardingMedia,
  type OnboardingSlug,
} from "./onboarding";
export { getLanguage, languages, type Language } from "./languages";
export {
  currentRelease,
  getRelease,
  releases,
  type Release,
  type ReleaseFeature,
} from "./releases";
export {
  getRoadmapFeature,
  roadmapFeatures,
  ROADMAP_STATUSES,
  type Complexity,
  type RoadmapComment,
  type RoadmapFeature,
  type RoadmapPledge,
  type RoadmapSort,
  type RoadmapStatus,
} from "./roadmap";
export type { AppRepository } from "./repositories";
export { suggestedRepositories } from "./repositories";
export { storeCategories, type StoreCategoryInfo } from "./categories";
export { content } from "./content";
export {
  RARE_HAT,
  rareHatHolders,
  NAKA_MOTOR,
  nakaMotorHolders,
  CHAIN_TIP,
  lockedStakes,
  bsvHoldings,
} from "./collectibles";
export { conversationNotes } from "./notes";

/*
 * hub_apps
 *
 * Filtered through shippedApps() rather than returned raw. Every list the user can
 * reach — launcher, icon rail, the ?app= URL — resolves through these accessors,
 * so narrowing here narrows all of them at once. In a demo build the filter is the
 * identity function. See lib/surfaces.ts for what "shipped" means.
 */
/**
 * What a surface returns when this session has no history of its own.
 *
 * Read here rather than at each of the eighty-odd call sites, because "empty"
 * has to mean the same thing everywhere or the screens disagree about whether
 * you are a new user. See lib/content-mode for what is emptied and what is not
 * — the short version is that anything that could only exist because you used
 * the app goes, and anything that is simply the world stays.
 */
function whenSeeded<T>(rows: T[]): T[] {
  return isEmptyContent() ? [] : rows;
}

/**
 * Whether the Timeline is in the catalogue at all.
 *
 * Off until somebody asks for it in Preferences. Pushed in rather than read
 * out, because this module is fixtures and reaching into the settings store
 * from here would make every catalogue read depend on a client store — the
 * same shape, and the same reason, as `setBsvPricing` in lib/wallet.
 *
 * @see lib/settings-store.ts `timelineAsApp`, which is what calls this
 */
let timelineListed = false;

export function setTimelineListed(on: boolean): void {
  timelineListed = on;
}

export function getHubApps(): HubApp[] {
  return shippedApps(hubApps).filter(
    (app) => app.slug !== "timeline" || timelineListed,
  );
}
export function getHubApp(slug: HubApp["slug"]): HubApp | undefined {
  return getHubApps().find((app) => app.slug === slug);
}
/** Apps a fresh profile starts connected to. */
export function getDefaultInstalledAppSlugs(): HubApp["slug"][] {
  return getHubApps()
    .filter((app) => app.defaultInstalled)
    .map((app) => app.slug);
}
/** Always-on apps that can't be disconnected (identity, pay & get paid). */
export function getEssentialAppSlugs(): HubApp["slug"][] {
  return getHubApps()
    .filter((app) => app.essential)
    .map((app) => app.slug);
}
/** Apps in the "system" folder (browse, connected apps). */
export function getSystemAppSlugs(): HubApp["slug"][] {
  return getHubApps()
    .filter((app) => app.category === "system")
    .map((app) => app.slug);
}
export function isEssentialApp(slug: HubApp["slug"]): boolean {
  return getHubApps().some(
    (app) => app.slug === slug && app.essential === true
  );
}

/*
 * app_repositories — the sources the Apps surface groups listings under.
 *
 * A source is who serves an app, not a channel we operate: for a built-in app
 * that is Nexus itself, and for a web app it is whoever runs the origin. See
 * docs/SPEC-design-catchup.md §1.
 */
export function getDefaultRepositories(): AppRepository[] {
  return defaultRepositories;
}

/* app_collections */
export function getAppCollections(): AppCollection[] {
  return appCollections;
}
/** App slugs a collection connects — "all" expands to every app this build has. */
export function getCollectionAppSlugs(id: CollectionId): HubApp["slug"][] {
  const shipped = new Set(getHubApps().map((app) => app.slug));
  if (id === "all") return [...shipped];
  return (appCollections.find((c) => c.id === id)?.apps ?? []).filter((slug) =>
    shipped.has(slug)
  );
}

/* identity */
export function getIdentityKeys(): IdentityKey[] {
  return identityKeys;
}
export function getIdentityCertificates(): IdentityCertificate[] {
  return identityCertificates;
}

/* connections (Connect app) + output_baskets (Baskets app) */
export function getConnections(): Connection[] {
  return whenSeeded(connections);
}
export function getOutputBaskets(): OutputBasket[] {
  return whenSeeded(outputBaskets);
}

/* spaces */
export function getSpaces(): Space[] {
  return [...spaces].sort((a, b) => a.sortOrder - b.sortOrder);
}
export function getDefaultSpace(): Space {
  const space = getSpaces()[0];
  if (!space) throw new Error("No spaces seeded in lib/data/spaces.ts");
  return space;
}
export function getSpaceItems(spaceId: string): SpaceItem[] {
  return spaceItems
    .filter((item) => item.spaceId === spaceId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
/**
 * Tabs a space opens with.
 *
 * Seeded ones are staging for screenshots — a fresh install has never visited
 * fractional.farm — so a shipping build starts on an empty space instead. The
 * bookmarks in spaceItems are left alone: those are real destinations, and a
 * browser shipping with no way to reach anything is worse than one with two.
 */
export function getBrowserTabs(spaceId: string): BrowserTab[] {
  if (!DEMO_SURFACES) return [];
  return browserTabs
    .filter((tab) => tab.spaceId === spaceId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
/**
 * A federated member's profile, rendered from their identity rather than
 * hand-written. Every ecosystem in the prototype is a placeholder domain, so
 * embedding the live site would leave the canvas blank — `localOnly` renders
 * the seeded content instead.
 */
function profilePageFor(person: MessagePerson): MockPage | undefined {
  if (!person.profileUrl) return undefined;
  const eco = getEcosystem(person.ecosystem);
  const parts = [person.role, person.organization, person.city].filter(Boolean);
  return {
    id: `page-profile-${person.id}`,
    url: person.profileUrl,
    heading: `${person.name} · ${eco?.name ?? person.ecosystem}`,
    body: `${parts.join(" · ")}.\n\n${person.bio}`,
    linkText: `Connect on ${eco?.name ?? person.ecosystem}`,
    linkHref: "#",
    localOnly: true,
  };
}

/**
 * Seeded page content, rendered in place of the real site.
 *
 * The whole point of it is that a browser with no native tab layer — the web
 * preview — still has something to show. A shipping build always has that layer,
 * so returning nothing here sends every URL where it belongs and guarantees no
 * user is ever shown a written-in-advance version of a real page.
 */
export function getMockPage(url: string): MockPage | undefined {
  if (!DEMO_SURFACES) return undefined;
  const seeded = mockPages.find((page) => page.url === url);
  if (seeded) return seeded;
  const person = messagePeople.find((p) => p.profileUrl === url);
  return person ? profilePageFor(person) : undefined;
}
export function getFavorites(): Favorite[] {
  return [...favorites].sort((a, b) => a.sortOrder - b.sortOrder);
}

/* downloads */
export function getDownloads(spaceId?: string): DownloadItem[] {
  return downloads
    .filter((item) => !spaceId || item.spaceId === spaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* wallet */
export function getWalletAccounts(): WalletAccount[] {
  /*
   * One wallet, empty, rather than none.
   *
   * A person who installed this an hour ago HAS a wallet — the shell makes one
   * — they just have not been paid yet. Returning nothing would put every
   * screen into "no wallet connected", which is a different and much rarer
   * state, and would take the switcher, the handle row and the pay flow with
   * it. So the four seeded accounts become the one you would actually have,
   * with nothing in it.
   */
  if (isEmptyContent()) {
    const first = walletAccounts[0];
    return first ? [{ ...first, locked: false, balanceSatoshis: 0 }] : [];
  }
  return walletAccounts;
}
/** The everyday wallet, for the surfaces that predate there being several. */
export function getWalletAccount(): WalletAccount {
  const account = walletAccounts[0];
  if (!account) throw new Error("No accounts seeded in lib/data/wallet.ts");
  return account;
}
export function getWalletTransactions(accountId: string): WalletTransaction[] {
  if (isEmptyContent()) return [];
  return walletTransactions
    .filter((tx) => tx.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* signing */
export function getSigningKeys(): SigningKey[] {
  return signingKeys;
}
export function getSignableDocuments(): SignableDocument[] {
  return [...signableDocuments].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
export function getSignEnvelopes(): SignEnvelope[] {
  return [...signEnvelopes].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/* publications */
export function getPublications(): Publication[] {
  return [...publications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
export function getMintTiers(): MintTier[] {
  return mintTiers;
}

/* transactions */
export function getChainTransactions(): ChainTransaction[] {
  return [...whenSeeded(chainTransactions)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
export function getChainTransaction(
  txid: string
): ChainTransaction | undefined {
  return chainTransactions.find((tx) => tx.txid === txid);
}

/* mail */
export function getMailMessages(): MailMessage[] {
  if (isEmptyContent()) return [];
  return [...mailMessages].sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt)
  );
}

/* ecosystems */
export function getEcosystems(): Ecosystem[] {
  return ecosystems;
}
export function getEcosystem(id: EcosystemId): Ecosystem | undefined {
  return ecosystems.find((eco) => eco.id === id);
}
/** The ecosystem the signed-in user's own handle belongs to. */
export function getLocalEcosystem(): Ecosystem {
  const local = ecosystems.find((eco) => eco.local);
  if (!local) throw new Error("No local ecosystem in lib/data/ecosystems.ts");
  return local;
}

/* tumbleupon */
/** The people you tumble with, as the app knows them. @see lib/data/tumbleupon */
export function getTumbleConnections(): MessagePerson[] {
  return tumbleConnections
    .map((id) => messagePeople.find((person) => person.handle === id))
    .filter((person): person is MessagePerson => Boolean(person));
}

/** What is waiting in the TumbleUpon inbox, newest first. */
export function getTumbleInbox(): TumbleInboxItem[] {
  return [...tumbleInbox].sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/**
 * Everything Tumble! can land on.
 *
 * The store's catalogue minus the Essentials, which are the apps every setup
 * already has — being sent to a wallet you are already signed into is not
 * discovery. Web apps only: there is nothing to open for an app with no
 * address.
 */
export function getTumbleCatalogue(): HubApp[] {
  return getHubApps().filter((app) => !app.essential && app.web);
}

/* extensions */
/**
 * The extensions this browser carries.
 *
 * Not gated on the empty content mode: an extension is part of the browser's
 * own setup rather than something seeded into a workspace, and a browser that
 * forgot its blocker when you emptied the fixtures would be a browser that had
 * uninstalled something.
 */
export function getExtensions(): BrowserExtension[] {
  return browserExtensions;
}

/* devices */
/**
 * Where this identity is signed in, the current device first.
 *
 * Not gated on the empty content mode: a wallet with no money is still signed
 * in somewhere, and a device list that empties when the fixtures do would be
 * claiming you had been logged out.
 */
export function getLinkedDevices(): LinkedDevice[] {
  return [...linkedDevices].sort((a, b) => Number(b.current) - Number(a.current));
}

/* tokens */
/**
 * The assets this wallet supports on chains that are not BSV.
 *
 * Exported rather than hidden behind a getter because it is a catalogue, not a
 * holding — what the wallet can hold, whether or not it does. `getTokenBalances`
 * is the one that answers what is actually there, and it is gated on the empty
 * content mode; this is not, because a wallet with no money still supports
 * ether.
 */
export { foreignTokens } from "./tokens";

/**
 * The tokens this wallet can act on: issue, request, gate, split.
 *
 * BSV-native only. A coin that arrived by swap sits on somebody else's chain,
 * so it can be held and shown and swapped back, but it cannot be the currency
 * of a payment link or a token gate — those are BSV transactions. Callers that
 * want the whole hand, foreign coins included, want `getTokenBalances`.
 */
export function getTokens(): Token[] {
  return tokens;
}
/**
 * Look up a token by id, wherever it lives.
 *
 * Both tables, because a balance row naming `doge` is a real holding and a
 * lookup that returned nothing for it would drop the row on the floor — the
 * quiet kind of bug where money simply is not there.
 */
export function getToken(id: string): Token | undefined {
  return tokens.find((t) => t.id === id) ?? foreignTokens.find((t) => t.id === id);
}
/** BSV — the base currency and the default for a bare amount. */
export function getBaseToken(): Token {
  const base = tokens.find((t) => t.base);
  if (!base) throw new Error("No base token in lib/data/tokens.ts");
  return base;
}
/** Match a typed symbol, case-insensitively. */
export function getTokenBySymbol(symbol: string): Token | undefined {
  const needle = symbol.trim().toLowerCase();
  return tokens.find((t) => t.symbol.toLowerCase() === needle);
}
/**
 * What one wallet holds, or every wallet's holding of each token summed.
 *
 * Summed, not concatenated. Four wallets each holding BSV is four rows in the
 * table and one asset in the hand, so the unscoped answer has to add them up —
 * a list with the same token in it four times is not a holding, it is the
 * table, and every reader of it would have to do this itself. React noticed
 * first, because four rows keyed by token id are four children with one key.
 */
export function getTokenBalances(
  accountId?: string,
): { token: Token; units: number }[] {
  if (isEmptyContent()) return [];
  const rows = tokenBalances.filter(
    (row) => accountId === undefined || row.accountId === accountId,
  );
  const summed = new Map<string, number>();
  for (const row of rows) {
    summed.set(row.tokenId, (summed.get(row.tokenId) ?? 0) + row.units);
  }
  return [...summed]
    .map(([tokenId, units]) => {
      const token = getToken(tokenId);
      return token ? { token, units } : null;
    })
    /* Unordered on purpose. `holdings()` in lib/wallet.ts sorts by real value
       with BSV pinned first, and it is the one that knows bitcoin's market
       price — a second sort here would order the same list by the fallback
       rate and disagree with the first as soon as the market moved. */
    .filter((row): row is { token: Token; units: number } => Boolean(row));
}

/* collectibles */
/**
 * What one wallet holds, or everything when no wallet is named.
 *
 * Every reader in the Wallet app passes an account, because a wallet you have
 * selected showing another wallet's items is the bug this argument exists to
 * prevent. It stays optional for the readers that are genuinely about the whole
 * holding — a share card, a search — rather than about one key.
 */
export function getCollectibles(accountId?: string): Collectible[] {
  if (isEmptyContent()) return [];
  return accountId === undefined
    ? collectibles
    : collectibles.filter((item) => item.accountId === accountId);
}
export function getCollectiblesIn(
  bucket: CollectibleBucket,
  accountId?: string,
): Collectible[] {
  return getCollectibles(accountId).filter((item) => item.bucket === bucket);
}
export function getCollectible(id: string): Collectible | undefined {
  return collectibles.find((item) => item.id === id);
}
/** Tint for an attribute key, so a Seat and a Valid Through read differently. */
export function getAttributeColor(key: string): string | undefined {
  return attributeColors[key];
}

/* payment_links + split_bills */
/** Links that pay into one wallet, newest first. */
export function getPaymentLinks(accountId?: string): PaymentLink[] {
  if (isEmptyContent()) return [];
  return [...paymentLinks]
    .filter((link) => accountId === undefined || link.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getPaymentLink(code: string): PaymentLink | undefined {
  return paymentLinks.find((link) => link.code === code);
}
/** Splits settling through one wallet, newest first. */
export function getSplitBills(accountId?: string): SplitBill[] {
  if (isEmptyContent()) return [];
  return [...splitBills]
    .filter((bill) => accountId === undefined || bill.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Wallet contacts are the same people you message — one directory, so a handle
 * you have paid is a handle you can message and vice versa. Ordered by how
 * recently you exchanged messages, with favourites being the most recent.
 */
export function getWalletContacts(accountId?: string): MessagePerson[] {
  /* No address book. The people themselves still exist — the Timeline is full
     of them — but "who have I paid" is a fact about having paid somebody. */
  if (isEmptyContent()) return [];
  /*
   * Narrowed to the people this wallet has actually moved money with.
   *
   * Derived from the ledger rather than stored: a contact list is a fact about
   * what a key has done, and a second table saying who a wallet "knows" would
   * be free to disagree with the transactions that are the evidence. A wallet
   * with no payments to a handle shows the directory unfiltered, because an
   * empty Contacts tab teaches nothing about what the tab is for.
   */
  if (accountId !== undefined) {
    const handles = new Set(
      walletTransactions
        .filter((tx) => tx.accountId === accountId)
        .map((tx) => tx.counterparty.replace(/^@/, "").toLowerCase()),
    );
    const paid = messagePeople.filter((person) =>
      handles.has(person.handle.toLowerCase()),
    );
    if (paid.length > 0) return paid;
  }
  const order = new Map<string, number>();
  const threads = chatThreads;
  for (const thread of threads) {
    for (const message of chatMessages.filter(
      (m) => m.conversationId === thread.id && m.senderId !== "me"
    )) {
      const seen = order.get(message.senderId);
      const at = new Date(message.createdAt).getTime();
      if (seen === undefined || at > seen) order.set(message.senderId, at);
    }
  }
  return [...messagePeople].sort((a, b) => {
    const ra = order.get(a.id) ?? 0;
    const rb = order.get(b.id) ?? 0;
    if (ra !== rb) return rb - ra;
    return a.name.localeCompare(b.name);
  });
}

/* messages */
export function getCurrentMessageUser(): MessagePerson {
  return currentMessageUser;
}
export function getMessagePeople(): MessagePerson[] {
  return messagePeople;
}
export function getMessagePerson(id: string): MessagePerson | undefined {
  if (id === currentMessageUser.id) return currentMessageUser;
  if (id === nexusBot.id) return nexusBot;
  return messagePeople.find((person) => person.id === id);
}
export function getChatMessages(conversationId: string): ChatMessage[] {
  return chatMessages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
/** Timestamp of a conversation's newest message, for sorting the list. */
function lastMessageAt(conversationId: string): string {
  const messages = getChatMessages(conversationId);
  return messages[messages.length - 1]?.createdAt ?? "";
}
/**
 * Conversations started in this session.
 *
 * A module-level list rather than React state because the lookups below are
 * plain functions called from a dozen places; threading a store through all of
 * them to support "new chat" would be a worse trade than one mutable array in
 * the data layer, which is where the seeded threads already live.
 */
const sessionThreads: ChatThread[] = [];

export function addChatThread(thread: ChatThread): void {
  sessionThreads.push(thread);
}

function allThreads(): ChatThread[] {
  /* Seeded threads go; ones started this session stay. A conversation you
     opened a minute ago is not somebody else's history, and watching it vanish
     because the mode says "new user" would be the switch eating your work. */
  return [...whenSeeded(chatThreads), ...sessionThreads];
}

/** Every conversation, newest activity first. */
export function getChatThreads(): ChatThread[] {
  return allThreads().sort((a, b) => {
    // A conversation with nothing in it yet is the one you just started, so it
    // sorts by its own creation time rather than falling to the bottom.
    const at = lastMessageAt(a.id) || a.createdAt;
    const bt = lastMessageAt(b.id) || b.createdAt;
    return bt.localeCompare(at);
  });
}
export function getChatThread(id: string): ChatThread | undefined {
  return allThreads().find((thread) => thread.id === id);
}
/** The 1:1 conversation with a person, if one exists. */
export function getChatThreadForPerson(
  personId: string
): ChatThread | undefined {
  return allThreads().find((thread) => thread.personId === personId);
}
/**
 * Conversations this person takes part in, newest activity first.
 *
 * Both their DM and any group they share with the user, since "where have we
 * spoken" is the question the profile pane is answering.
 */
export function getThreadsWithPerson(personId: string): ChatThread[] {
  return getChatThreads().filter(
    (thread) =>
      thread.personId === personId || thread.group?.memberIds.includes(personId)
  );
}

/**
 * Trailing messages from anyone other than the user — a rough "unread" count,
 * which is what drives both the list badge and the rail activity dot.
 */
export function getUnreadCount(conversationId: string): number {
  const messages = getChatMessages(conversationId);
  let unread = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]!.senderId === "me") break;
    unread += 1;
  }
  return unread;
}

/* learn */
export function getCourses(): Course[] {
  return [...courses].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* market */
export function getMarketListings(): MarketListing[] {
  return [...marketListings].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/* vault */
/**
 * What one workspace keeps locked up, or everything when none is named.
 *
 * Scoped, because the column header names the workspace and a header that
 * names one vault over another's contents is worse than no header at all. A
 * workspace made after this fixture was written has an empty vault, which is
 * the honest answer — nothing has been put in it yet.
 */
export function getVaultItems(spaceId?: string): VaultItem[] {
  if (isEmptyContent()) return [];
  return vaultItems
    .filter((item) => spaceId === undefined || item.spaceId === spaceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* vote */
export function getProposals(): Proposal[] {
  return [...proposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
