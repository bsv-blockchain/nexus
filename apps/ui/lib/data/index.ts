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
import {
  courses,
  marketListings,
  proposals,
  vaultItems,
} from "./apps-content";
import {
  chatMessages,
  chatThreads,
  currentMessageUser,
  messagePeople,
  nexusBot,
} from "./messages";
import { ecosystems } from "./ecosystems";
import { tokenBalances, tokens } from "./tokens";
import { attributeColors, collectibles } from "./collectibles";
import { paymentLinks, splitBills } from "./wallet-extras";
import { connections, outputBaskets } from "./developer";
import { downloads } from "./downloads";
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
  BrowserTab,
  ChainTransaction,
  ChatMessage,
  ChatThread,
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
export { media, mediaItems, type MediaKey } from "./media";
export {
  currentRelease,
  getRelease,
  releases,
  type Release,
  type ReleaseFeature,
} from "./releases";
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
export function getHubApps(): HubApp[] {
  return shippedApps(hubApps);
}
export function getHubApp(slug: HubApp["slug"]): HubApp | undefined {
  return getHubApps().find((app) => app.slug === slug);
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
  return connections;
}
export function getOutputBaskets(): OutputBasket[] {
  return outputBaskets;
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
export function getDownloads(): DownloadItem[] {
  return [...downloads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* wallet */
export function getWalletAccount(): WalletAccount {
  const account = walletAccounts[0];
  if (!account) throw new Error("No accounts seeded in lib/data/wallet.ts");
  return account;
}
export function getWalletTransactions(accountId: string): WalletTransaction[] {
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
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function getSignEnvelopes(): SignEnvelope[] {
  return [...signEnvelopes].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

/* publications */
export function getPublications(): Publication[] {
  return [...publications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function getMintTiers(): MintTier[] {
  return mintTiers;
}

/* transactions */
export function getChainTransactions(): ChainTransaction[] {
  return [...chainTransactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function getChainTransaction(
  txid: string,
): ChainTransaction | undefined {
  return chainTransactions.find((tx) => tx.txid === txid);
}

/* mail */
export function getMailMessages(): MailMessage[] {
  return [...mailMessages].sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
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

/* tokens */
export function getTokens(): Token[] {
  return tokens;
}
export function getToken(id: string): Token | undefined {
  return tokens.find((t) => t.id === id);
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
export function getTokenBalances(): { token: Token; units: number }[] {
  return tokenBalances
    .map(({ tokenId, units }) => {
      const token = getToken(tokenId);
      return token ? { token, units } : null;
    })
    .filter((row): row is { token: Token; units: number } => Boolean(row));
}

/* collectibles */
export function getCollectibles(): Collectible[] {
  return collectibles;
}
export function getCollectiblesIn(bucket: CollectibleBucket): Collectible[] {
  return collectibles.filter((item) => item.bucket === bucket);
}
export function getCollectible(id: string): Collectible | undefined {
  return collectibles.find((item) => item.id === id);
}
/** Tint for an attribute key, so a Seat and a Valid Through read differently. */
export function getAttributeColor(key: string): string | undefined {
  return attributeColors[key];
}

/* payment_links + split_bills */
export function getPaymentLinks(): PaymentLink[] {
  return [...paymentLinks].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function getPaymentLink(code: string): PaymentLink | undefined {
  return paymentLinks.find((link) => link.code === code);
}
export function getSplitBills(): SplitBill[] {
  return [...splitBills].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Wallet contacts are the same people you message — one directory, so a handle
 * you have paid is a handle you can message and vice versa. Ordered by how
 * recently you exchanged messages, with favourites being the most recent.
 */
export function getWalletContacts(): MessagePerson[] {
  const order = new Map<string, number>();
  const threads = chatThreads;
  for (const thread of threads) {
    for (const message of chatMessages.filter(
      (m) => m.conversationId === thread.id && m.senderId !== "me",
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
  return [...chatThreads, ...sessionThreads];
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
  personId: string,
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
      thread.personId === personId ||
      thread.group?.memberIds.includes(personId),
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
    b.createdAt.localeCompare(a.createdAt),
  );
}

/* vault */
export function getVaultItems(): VaultItem[] {
  return [...vaultItems].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* vote */
export function getProposals(): Proposal[] {
  return [...proposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
