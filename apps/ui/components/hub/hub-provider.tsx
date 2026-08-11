"use client";

import { storageKeys } from "@/lib/config";
import {
  getBrowserTabs,
  getDefaultSpace,
  getFavorites,
  getHubApps,
  getIdentityKeys,
  getSpaceItems,
  getSpaces,
  conversationNotes,
  type BrowserTab,
  type Favorite,
  type GroupGates,
  type RoomRoles,
  type HubApp,
  type IdentityKey,
  type PageId,
  type Space,
  type SpaceItem,
  type SpaceProfile,
} from "@/lib/data";
import {
  reconcileRail,
  sameRef,
  type RailEntry,
  type RailRef,
} from "@/lib/rail/layout";
import {
  addPinnedSite,
  parsePinnedSites,
  removePinnedSite,
  renamePinnedSite,
  type PinnedSite,
} from "@/lib/rail/sites";
import { buildTab, sameUrl } from "@/lib/tabs";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type AppSlug = HubApp["slug"];
export type LibraryTab = "spaces" | "downloads" | "apps";
/**
 * What the main canvas shows, independent of which rail panel is open.
 *
 * `sites` is the Web3 Apps surface — the sites the user pinned. It was `store`,
 * and the name went with the screen: nothing is distributed here, so there is
 * nothing for a store id to describe.
 */
export type MainViewKind = "app" | "sites" | "profiles" | "settings";

/**
 * The settings categories, in the narrow column.
 *
 * A union rather than free strings so the sidebar and the content area cannot
 * drift apart: adding a category is one edit and the compiler finds the panel
 * that has to exist for it.
 */
export type SettingsCategory =
  | "general"
  | "privacy"
  | "browsing"
  | "appearance"
  | "about"
  /** live builds only — keys, network and backup; see settings-wallet.tsx */
  | "wallet";

/**
 * A rail slot holds a `RailRef` — a builtin app or a site the user pinned.
 *
 * Both types are re-exported from here because the rail's consumers already
 * import them from the provider; the definitions themselves live in
 * `lib/rail/layout` so the pure module can be tested without React.
 */
export type { RailEntry, RailRef } from "@/lib/rail/layout";

/** Drop target when grouping rail entries. */
export type RailTarget =
  | { kind: "ref"; ref: RailRef }
  | { kind: "group"; id: string };

/** Per-app context state — the sidebar column is contextual to the app. */
export type MailTab = "all" | "unread" | "paid";
export type VoteStatus = "all" | "open" | "closed";
export type WalletFilter = "all" | "incoming" | "outgoing" | "pending";
/**
 * A transfer the user has asked to start. Held in hub state rather than the
 * wallet app because the contextual sidebar's docked buttons live outside it.
 */
export interface WalletIntent {
  kind: "send" | "receive" | "exchange";
  tokenId?: string;
  personId?: string;
}

/**
 * A reference panel opened beside the active app.
 *
 * Hub state rather than app state, and part of the layout rather than an
 * overlay: it takes width from the app column instead of covering it, so the
 * conversation you opened it from stays readable next to it. Any app can open
 * one, which is why it is keyed by kind rather than being the Messages
 * identity card with a general-sounding name.
 */
/** Starred rises to the top; muted stays put; archived and deleted leave. */
export type ConversationFlag = "starred" | "muted" | "archived" | "deleted";

export interface DetailPane {
  /**
   * `person` shows an identity card, `conversation` its settings, and
   * `vouches` only who stands behind a handle — the one question worth
   * answering on its own, since it is the part of an identity that is an
   * opinion rather than arithmetic.
   */
  kind:
    | "person"
    | "conversation"
    | "vouches"
    | "new"
    /** every release, newest first */
    | "releases"
    /** one release, `id` being its version */
    | "release";
  /** MessagePerson id, or conversation id, per `kind` */
  id: string;
}

/** Wallet canvas sections, driven by the sidebar on desktop and tabs on mobile. */
export type WalletSection =
  | "cash"
  | "collectibles"
  | "activity"
  | "links"
  | "contacts"
  | "splits";
export type IdentitySection = "keys" | "retired" | "certificates";
export type AttestationFilter = "all" | "issued" | "received";
export interface MarketFilters {
  query: string;
  nameSort: "none" | "az" | "za";
  application: string;
  collection: string;
  chrono: "recent" | "oldest_activity" | "newest" | "oldest";
  sale: "all" | "price_high" | "price_low" | "not_listed";
}
export const DEFAULT_MARKET_FILTERS: MarketFilters = {
  query: "",
  nameSort: "none",
  application: "all",
  collection: "all",
  chrono: "recent",
  sale: "all",
};

/**
 * Which app the address bar is asking for.
 *
 * Read through `useSyncExternalStore` rather than during render, because the
 * page is prerendered: the server has no location, so it renders the default
 * and the client swaps in the requested app on hydration without a mismatch.
 */
const APP_PARAM = "app";

function subscribeToUrl(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function urlAppSlug(): string | null {
  return new URLSearchParams(window.location.search).get(APP_PARAM);
}

/** Reflect the open app in the address bar so the page can be shared. */
function writeAppToUrl(slug: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  // Nothing to say: every rail click and every in-browser navigation reaches
  // here, and rewriting history with the value it already holds is noise.
  if (url.searchParams.get(APP_PARAM) === slug) return;
  if (slug) url.searchParams.set(APP_PARAM, slug);
  else url.searchParams.delete(APP_PARAM);
  // Replace rather than push: the rail is not navigation, and every app switch
  // adding a history entry would make the back button useless.
  window.history.replaceState(window.history.state, "", url);
}

function newGroupId(): string {
  return `group-${Date.now()}-${Math.floor(Date.now() % 1000)}`;
}

function withoutRef(entries: RailEntry[], ref: RailRef): RailEntry[] {
  return entries
    .map((entry) =>
      entry.type === "single"
        ? entry
        : {
            ...entry,
            members: entry.members.filter((member) => !sameRef(member, ref)),
          },
    )
    .filter((entry) => !(entry.type === "single" && sameRef(entry.ref, ref)));
}

/** Collapse 1-member groups to single slots and drop empty groups. */
function normalizeGroups(entries: RailEntry[]): RailEntry[] {
  return entries.flatMap((entry) => {
    if (entry.type === "single") return [entry];
    if (entry.members.length === 0) return [];
    if (entry.members.length === 1)
      return [{ type: "single", ref: entry.members[0]! } as RailEntry];
    return [entry];
  });
}

interface HubState {
  /**
   * The apps compiled into this build. Not user state: nothing removes them, so
   * non-removability is a property of the list rather than a flag on a row.
   */
  builtinApps: AppSlug[];
  /** the sites the user pinned to the rail — Nexus ships none */
  pinnedSites: PinnedSite[];
  /** returns the pinned site (existing or new), or null if the URL is unusable */
  pinSite: (url: string, title?: string) => PinnedSite | null;
  unpinSite: (id: string) => void;
  renameSite: (id: string, title: string) => void;

  /** rail layout: single slots + folder groups, reconciled to what exists */
  railEntries: RailEntry[];
  groupRefs: (dragRef: RailRef, target: RailTarget) => void;
  ungroupRef: (ref: RailRef) => void;
  reorderRailRef: (
    dragRef: RailRef,
    targetRef: RailRef,
    position: "before" | "after",
  ) => void;
  renameGroup: (id: string, name: string) => void;
  setGroupColor: (id: string, color: string) => void;

  /**
   * What the rail shows as open: a builtin app or a pinned site.
   *
   * Reading it always yields a ref — the fallback chain ends at Browser, and a
   * ref naming something that has gone (an unpinned site, an app this build
   * does not carry) is replaced rather than held. Passing `null` to the setter
   * is how you say "back to that fallback"; it is not a state you can read.
   */
  activeRef: RailRef;
  setActiveRef: (ref: RailRef | null) => void;
  /**
   * Kept, and derived from `activeRef`, so the files that only care about
   * "which app is open" need no change. A site being open reads as no app being
   * open, which is exactly right — the canvas is a website at that point.
   */
  activeApp: AppSlug | null;
  openApp: (slug: AppSlug) => void;

  libraryTab: LibraryTab;
  setLibraryTab: (tab: LibraryTab) => void;

  /** what the main canvas shows (decoupled from the open rail panel) */
  mainView: MainViewKind;
  setMainView: (view: MainViewKind) => void;
  settingsCategory: SettingsCategory;
  setSettingsCategory: (category: SettingsCategory) => void;
  /** open the settings surface, taking over both the panel and the canvas */
  openSettings: () => void;
  /** collapse the rail to icons-only (hides the wider panel column) */
  railCollapsed: boolean;
  toggleRail: () => void;

  /** per-app context selections (contextual sidebar column) */
  mailFolder: string;
  setMailFolder: (folder: string) => void;
  mailTab: MailTab;
  setMailTab: (tab: MailTab) => void;
  messageThread: string | null;
  setMessageThread: (id: string | null) => void;
  /**
   * A message the open thread should scroll to and mark, set by whatever sent
   * the reader there — the saved list, for now. Cleared by the thread once it
   * has done it, so returning to the conversation later lands where you left it
   * rather than jumping back to an old message.
   */
  messageFocus: string | null;
  openMessageAt: (conversationId: string, messageId: string) => void;
  clearMessageFocus: () => void;
  /** show only conversations with unread messages */
  messagesUnreadOnly: boolean;
  setMessagesUnreadOnly: (only: boolean) => void;
  /** bumped when a conversation is created, so lists re-read the data layer */
  conversationsVersion: number;
  bumpConversations: () => void;
  /** the new-conversation sheet, opened from the sidebar header */
  newConversationOpen: boolean;
  openNewConversation: () => void;
  closeNewConversation: () => void;
  vaultKind: string;
  setVaultKind: (kind: string) => void;
  learnCourse: string | null;
  setLearnCourse: (id: string | null) => void;
  voteStatus: VoteStatus;
  setVoteStatus: (status: VoteStatus) => void;
  exploreQuery: string;
  setExploreQuery: (query: string) => void;
  exploreKind: string;
  setExploreKind: (kind: string) => void;
  marketFilters: MarketFilters;
  setMarketFilters: (filters: MarketFilters) => void;
  walletFilter: WalletFilter;
  walletSection: WalletSection;
  setWalletSection: (section: WalletSection) => void;
  walletIntent: WalletIntent | null;
  setWalletIntent: (intent: WalletIntent | null) => void;
  /** reference panel docked beside the app canvas, for any app */
  detailPane: DetailPane | null;
  openDetailPane: (pane: DetailPane) => void;
  closeDetailPane: () => void;
  /**
   * Conversation edits, by conversation id.
   *
   * Hub state rather than thread state because the settings pane lives beside
   * the app, not inside it: with the draft held in the thread, the pane and the
   * header it renames would be reading two different values.
   */
  conversationTitles: Record<string, string>;
  renameConversation: (conversationId: string, title: string) => void;
  conversationMembers: Record<string, string[]>;
  setConversationMembers: (conversationId: string, ids: string[]) => void;
  /**
   * A room's picture, edited in its settings.
   *
   * `null` means the seeded icon was removed, which is why this is not just
   * "absent". Without the distinction a room could never go back to its
   * member mosaic once it had been given an emblem.
   */
  conversationIcons: Record<string, string | null>;
  setConversationIcon: (conversationId: string, icon: string | null) => void;
  /**
   * A room's access gates, edited in its settings.
   *
   * `null` means the gate was switched off after being on (seeded or edited),
   * which is why absence is not enough — a room could otherwise never be
   * un-gated once its seed said it was gated.
   */
  conversationGates: Record<string, GroupGates | null>;
  setConversationGates: (
    conversationId: string,
    gates: GroupGates | null,
  ) => void;
  /** Role maps per conversation, edited in the same pane as the gates. */
  conversationRoles: Record<string, RoomRoles | null>;
  setConversationRoles: (
    conversationId: string,
    roles: RoomRoles | null,
  ) => void;
  /**
   * Private notes per conversation, as editor HTML.
   *
   * Held here rather than in the thread because the tab bar has to know whether
   * a note has anything in it, and a note that lost its content every time you
   * looked at another conversation would not be a note.
   */
  /**
   * A line to drop into the Messages composer, with a nonce so choosing the
   * same action twice re-seeds rather than silently doing nothing.
   *
   * Hub state because the identity pane renders beside the app rather than
   * inside it: a Pay button in the pane has to reach a composer it is not a
   * parent of.
   */
  composerSeed: { text: string; nonce: number } | null;
  seedComposer: (text: string) => void;
  conversationNotes: Record<string, string>;
  setConversationNote: (conversationId: string, html: string) => void;
  /**
   * Per-conversation flags the user sets from the thread's overflow menu.
   *
   * One record rather than a set per flag: they are all "how this user filed
   * this conversation", they are all read together by the list, and four
   * parallel collections is four chances for them to disagree.
   */
  conversationFlags: Record<string, Partial<Record<ConversationFlag, boolean>>>;
  setConversationFlag: (
    conversationId: string,
    flag: ConversationFlag,
    on: boolean,
  ) => void;
  setWalletFilter: (filter: WalletFilter) => void;
  connectSelected: string | null;
  setConnectSelected: (id: string | null) => void;
  basketSelected: string | null;
  setBasketSelected: (id: string | null) => void;
  signSection: string;
  setSignSection: (section: string) => void;
  identitySection: IdentitySection;
  setIdentitySection: (section: IdentitySection) => void;
  attestationFilter: AttestationFilter;
  setAttestationFilter: (filter: AttestationFilter) => void;
  /*
   * There was an install/uninstall permission sheet here, opened with a slug and
   * a mode. Pinning a site grants it nothing, so there is no longer a moment at
   * which it could fire; the consent it collected belongs at first request,
   * keyed on origin, which is the spend-authorization path that already exists.
   */
  /** show the Web3 Apps surface — the sites the user pinned */
  openWeb3Apps: () => void;
  openProfilesManager: () => void;

  activeSpaceId: string;
  setActiveSpaceId: (id: string) => void;

  /** identity badges (keys) — session state seeded from lib/data */
  identityKeys: IdentityKey[];
  createIdentityKey: () => void;
  setPrimaryIdentityKey: (id: string) => void;
  retireIdentityKey: (id: string) => void;
  restoreIdentityKey: (id: string) => void;
  renameIdentityKey: (id: string, label: string) => void;

  /** spaces + their folder/easel items — session state seeded from lib/data */
  spaces: Space[];
  spaceItemsBySpace: Record<string, SpaceItem[]>;
  renameSpace: (id: string, name: string) => void;
  setSpaceEmoji: (id: string, emoji: string) => void;
  setSpaceThemeColor: (id: string, color: string) => void;
  setSpaceProfile: (id: string, profile: SpaceProfile) => void;
  reorderSpace: (id: string, direction: "up" | "down") => void;
  moveSpace: (
    dragId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
  createSpace: () => void;
  deleteSpace: (id: string) => void;
  addSpaceFolder: (spaceId: string) => void;
  addLiveFolder: (spaceId: string, title: string, icon: string) => void;

  /** expanded folder ids + toggle */
  expandedFolders: string[];
  toggleFolder: (id: string) => void;

  /** internal page shown in the main view (Getting Started, …) or null */
  activePage: PageId | null;
  openPage: (id: PageId) => void;

  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  /** referral code shown in the share modal, refreshed each time it opens */
  shareCode: string;
  openShare: () => void;

  /** open tabs per space — session state seeded from lib/data rows */
  tabsBySpace: Record<string, BrowserTab[]>;
  activeTabId: string | null;
  activeTab: BrowserTab | null;
  openTab: (tabId: string) => void;
  createTab: (input: string) => void;
  /** `ref` is what the rail shows as open afterwards; defaults to Browser */
  openLinkInBrowser: (spaceId: string, url: string, ref?: RailRef) => void;
  closeTab: (tabId: string) => void;
  clearTabs: (spaceId: string) => void;
  navigateActiveTab: (input: string) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;

  favorites: Favorite[];
  addFavoriteFromTab: (tabId: string) => void;
  removeFavorite: (favoriteId: string) => void;
  /** true while a tab is being dragged (drives the favorites drop target) */
  tabDragging: boolean;
  setTabDragging: (dragging: boolean) => void;

  mobileSheetOpen: boolean;
  setMobileSheetOpen: (open: boolean) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

const HubContext = createContext<HubState | null>(null);

/**
 * Pinned sites live in localStorage (per-user client state until a real user
 * table exists) and are exposed through useSyncExternalStore so SSR renders an
 * empty rail and the client re-syncs after hydration.
 */
const PINNED_SITES_EVENT = "nexus:pinned-sites";

/**
 * Sites the user pinned. Nexus ships none — every icon on the rail beyond the
 * builtin apps got there because somebody chose it. BSV Browser reached the
 * same position: shared/constants.ts's defaultBookmarks is an empty array with
 * its ten entries commented out rather than deleted.
 */
const NO_SITES: PinnedSite[] = [];

let sitesRaw: string | null = null;
let sitesSnapshot: PinnedSite[] = NO_SITES;
/**
 * Whether storage has ever refused a write.
 *
 * Once it has, reads stop consulting it: `getItem` can still answer, with the
 * value from before the refused write, and letting that answer win would make a
 * pin disappear the instant it was made — private mode is exactly this case.
 */
let sitesStored = true;

function getPinnedSitesSnapshot(): PinnedSite[] {
  if (!sitesStored) return sitesSnapshot;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKeys.pinnedSites);
  } catch {
    // storage unavailable (private mode) — keep whatever is in memory
    return sitesSnapshot;
  }
  if (raw !== sitesRaw) {
    sitesRaw = raw;
    sitesSnapshot = (raw ? parsePinnedSites(raw) : null) ?? NO_SITES;
  }
  return sitesSnapshot;
}

function getPinnedSitesServerSnapshot(): PinnedSite[] {
  return NO_SITES;
}

function subscribeToPinnedSites(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(PINNED_SITES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PINNED_SITES_EVENT, onChange);
  };
}

/**
 * Persist the list and make it the snapshot.
 *
 * The in-memory snapshot is updated on the success path too, not only when
 * storage throws: writing without it left `sitesRaw` describing the previous
 * value, so the next read had to go back to storage to agree with what was just
 * written. Doing both keeps the two consistent whether or not storage worked.
 */
function writePinnedSites(sites: PinnedSite[]): void {
  const serialized = JSON.stringify(sites);
  try {
    window.localStorage.setItem(storageKeys.pinnedSites, serialized);
    // A refusal can be transient (a quota that later clears), so a write that
    // lands puts reads back on storage — otherwise one bad write costs the page
    // its cross-tab sync for good.
    sitesStored = true;
  } catch {
    // storage unavailable — the in-memory snapshot is the list from here on
    sitesStored = false;
  }
  sitesRaw = serialized;
  sitesSnapshot = sites;
  window.dispatchEvent(new Event(PINNED_SITES_EVENT));
}

/**
 * The apps compiled into this build.
 *
 * Read once at module load, like the catalog it comes from: nothing installs or
 * removes an app any more, so this cannot change while the page is open.
 */
const BUILTIN_APPS: AppSlug[] = getHubApps().map((app) => app.slug);

/** Everything that currently has a rail slot, in catalog-then-pin order. */
function presentRefs(sites: PinnedSite[]): RailRef[] {
  return [
    ...BUILTIN_APPS.map((slug): RailRef => ({ kind: "app", slug })),
    ...sites.map((site): RailRef => ({ kind: "site", id: site.id })),
  ];
}

/**
 * The browser: what every tab is shown in, and what the chrome falls back to
 * when nothing has been chosen. One constant so repeated navigation sets the
 * same object and React can bail out of the render.
 */
const BROWSER_REF: RailRef = { kind: "app", slug: "browser" };

function seedTabsBySpace(): Record<string, BrowserTab[]> {
  return Object.fromEntries(
    getSpaces().map((space) => [space.id, getBrowserTabs(space.id)]),
  );
}

function seedSpaceItemsBySpace(): Record<string, SpaceItem[]> {
  return Object.fromEntries(
    getSpaces().map((space) => [space.id, getSpaceItems(space.id)]),
  );
}

interface TabHistory {
  stack: string[];
  index: number;
}

function seedHistory(
  tabsBySpace: Record<string, BrowserTab[]>,
): Record<string, TabHistory> {
  const history: Record<string, TabHistory> = {};
  for (const tabs of Object.values(tabsBySpace)) {
    for (const tab of tabs) history[tab.id] = { stack: [tab.url], index: 0 };
  }
  return history;
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const HEX = "0123456789abcdef";
/** Placeholder compressed-pubkey hex (called from event handlers only). */
function generatePublicKey(): string {
  let hex = Math.random() < 0.5 ? "02" : "03";
  for (let i = 0; i < 64; i += 1) hex += HEX[Math.floor(Math.random() * 16)];
  return hex;
}

export function HubProvider({ children }: { children: ReactNode }): ReactNode {
  const defaultSpace = getDefaultSpace();

  const pinnedSites = useSyncExternalStore(
    subscribeToPinnedSites,
    getPinnedSitesSnapshot,
    getPinnedSitesServerSnapshot,
  );

  // `null` means nothing has been picked in this session yet, so the address
  // bar decides. Any explicit `setActiveRef` takes over from there.
  const [selectedRef, setSelectedRef] = useState<RailRef | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("spaces");
  const [railLayout, setRailLayout] = useState<RailEntry[]>([]);

  // Always reconciled, never rendered raw: a stored layout can name a site that
  // has since been unpinned, and a group can be left holding one member.
  const railEntries = useMemo(
    () => reconcileRail(railLayout, presentRefs(pinnedSites)),
    [railLayout, pinnedSites],
  );

  /**
   * The one way to change what the canvas shows, so the address bar cannot
   * drift from it: the rail sets a ref and `?app=` follows. A site clears the
   * parameter — the canvas is a website at that point, and a reload should land
   * on the browser rather than on an app.
   */
  const setActiveRef = useCallback((ref: RailRef | null) => {
    writeAppToUrl(ref?.kind === "app" ? ref.slug : null);
    // Keep the identity when the ref is unchanged, so navigating inside the
    // browser does not re-render every consumer of the context.
    setSelectedRef((current) =>
      current && ref && sameRef(current, ref) ? current : ref,
    );
  }, []);

  /**
   * Bring the browser forward because a tab moved.
   *
   * A pinned site is already showing in the browser, so it stays the active
   * ref: replacing it would take the origin chip away the moment the page
   * navigated, and the chip is the only thing saying where the user is.
   */
  const focusBrowser = useCallback(() => {
    if (selectedRef?.kind === "site") return;
    setActiveRef(BROWSER_REF);
  }, [selectedRef, setActiveRef]);
  // The rail is always shown; collapsing hides the wider panel column.
  const [railCollapsed, setRailCollapsed] = useState(false);
  // What the main canvas shows (app by default; store/profiles open via tabs).
  const [mainView, setMainView] = useState<MainViewKind>("app");
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategory>("general");
  const openSettings = useCallback(() => {
    setMainView("settings");
    // The panel has to be open for the categories to be reachable at all.
    setRailCollapsed(false);
  }, []);
  const [activeSpaceId, setActiveSpaceId] = useState(defaultSpace.id);
  const [identityKeys, setIdentityKeys] =
    useState<IdentityKey[]>(getIdentityKeys);
  const [spaces, setSpaces] = useState<Space[]>(getSpaces);
  const [spaceItemsBySpace, setSpaceItemsBySpace] = useState<
    Record<string, SpaceItem[]>
  >(seedSpaceItemsBySpace);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCode, setShareCode] = useState("nexus1");
  const [expandedFolders, setExpandedFolders] = useState<string[]>([
    "item-basics",
  ]);
  const [activePage, setActivePage] = useState<PageId | null>(null);
  const [tabsBySpace, setTabsBySpace] =
    useState<Record<string, BrowserTab[]>>(seedTabsBySpace);
  const [historyByTab, setHistoryByTab] = useState<Record<string, TabHistory>>(
    () => seedHistory(seedTabsBySpace()),
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => getBrowserTabs(defaultSpace.id)[0]?.id ?? null,
  );
  const [favorites, setFavorites] = useState<Favorite[]>(getFavorites);
  const [tabDragging, setTabDragging] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const toggleRail = useCallback(
    () => setRailCollapsed((value) => !value),
    [],
  );

  // Per-app context selections, driving the contextual sidebar column.
  const [mailFolder, setMailFolder] = useState("Inbox");
  const [mailTab, setMailTab] = useState<MailTab>("all");
  const [messageThread, setMessageThread] = useState<string | null>(null);
  const [messageFocus, setMessageFocus] = useState<string | null>(null);
  const openMessageAt = useCallback(
    (conversationId: string, messageId: string) => {
      setMessageThread(conversationId);
      setMessageFocus(messageId);
    },
    [],
  );
  const clearMessageFocus = useCallback(() => setMessageFocus(null), []);
  const [messagesUnreadOnly, setMessagesUnreadOnly] = useState(false);
  const [conversationsVersion, setConversationsVersion] = useState(0);
  const bumpConversations = useCallback(
    () => setConversationsVersion((n) => n + 1),
    [],
  );
  const [vaultKind, setVaultKind] = useState<string>("all");
  const [learnCourse, setLearnCourse] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>("all");
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploreKind, setExploreKind] = useState<string>("all");
  const [marketFilters, setMarketFilters] = useState<MarketFilters>(
    DEFAULT_MARKET_FILTERS,
  );
  const [walletFilter, setWalletFilter] = useState<WalletFilter>("all");
  const [walletSection, setWalletSection] = useState<WalletSection>("cash");
  const [walletIntent, setWalletIntent] = useState<WalletIntent | null>(null);
  const [detailPane, setDetailPane] = useState<DetailPane | null>(null);
  /*
   * Starting a conversation is the fourth thing the reference pane shows.
   *
   * Behind the same door as the others rather than a flag of its own: two
   * panes open at once would take width from the app twice, and there is only
   * one place a pane goes.
   */
  const newConversationOpen = detailPane?.kind === "new";
  const openNewConversation = useCallback(
    () => setDetailPane({ kind: "new", id: "" }),
    [],
  );
  const closeNewConversation = useCallback(() => setDetailPane(null), []);
  const openDetailPane = useCallback(
    (pane: DetailPane) => setDetailPane(pane),
    [],
  );
  const closeDetailPane = useCallback(() => setDetailPane(null), []);
  const [conversationTitles, setConversationTitles] = useState<
    Record<string, string>
  >({});
  const renameConversation = useCallback(
    (conversationId: string, title: string) =>
      setConversationTitles((current) => ({
        ...current,
        [conversationId]: title,
      })),
    [],
  );
  const [conversationMembers, setConversationMembersState] = useState<
    Record<string, string[]>
  >({});
  const setConversationMembers = useCallback(
    (conversationId: string, ids: string[]) =>
      setConversationMembersState((current) => ({
        ...current,
        [conversationId]: ids,
      })),
    [],
  );
  const [conversationIcons, setConversationIconsState] = useState<
    Record<string, string | null>
  >({});
  const setConversationIcon = useCallback(
    (conversationId: string, icon: string | null) =>
      setConversationIconsState((current) => ({
        ...current,
        [conversationId]: icon,
      })),
    [],
  );
  const [conversationGates, setConversationGatesState] = useState<
    Record<string, GroupGates | null>
  >({});
  const setConversationGates = useCallback(
    (conversationId: string, gates: GroupGates | null) =>
      setConversationGatesState((current) => ({
        ...current,
        [conversationId]: gates,
      })),
    [],
  );
  const [conversationRoles, setConversationRolesState] = useState<
    Record<string, RoomRoles | null>
  >({});
  const setConversationRoles = useCallback(
    (conversationId: string, roles: RoomRoles | null) =>
      setConversationRolesState((current) => ({
        ...current,
        [conversationId]: roles,
      })),
    [],
  );
  const [composerSeed, setComposerSeed] = useState<{
    text: string;
    nonce: number;
  } | null>(null);
  const seedComposer = useCallback(
    (text: string) =>
      setComposerSeed((current) => ({
        text: `${text} `,
        nonce: (current?.nonce ?? 0) + 1,
      })),
    [],
  );
  const [notes, setNotes] = useState<Record<string, string>>(conversationNotes);
  const setConversationNote = useCallback(
    (conversationId: string, html: string) =>
      setNotes((current) => ({ ...current, [conversationId]: html })),
    [],
  );
  const [flags, setFlags] = useState<
    Record<string, Partial<Record<ConversationFlag, boolean>>>
  >({});
  const setConversationFlag = useCallback(
    (conversationId: string, flag: ConversationFlag, on: boolean) =>
      setFlags((current) => ({
        ...current,
        [conversationId]: { ...current[conversationId], [flag]: on },
      })),
    [],
  );
  const [connectSelected, setConnectSelected] = useState<string | null>(null);
  const [basketSelected, setBasketSelected] = useState<string | null>(null);
  const [signSection, setSignSection] = useState("Envelopes");
  const [identitySection, setIdentitySection] =
    useState<IdentitySection>("keys");
  const [attestationFilter, setAttestationFilter] =
    useState<AttestationFilter>("all");
  const urlApp = useSyncExternalStore(subscribeToUrl, urlAppSlug, () => null);
  const fromUrl = getHubApps().find((app) => app.slug === urlApp)?.slug ?? null;

  // Nothing picked in this session means the address bar decides, and failing
  // that the browser — the fallback the hub has always had, as a ref.
  const activeRef = useMemo<RailRef>(() => {
    // A pinned site can vanish from under the selection: another tab unpinned
    // it, and the `storage` listener brought the shorter list here. Validate
    // the site half of the ref the way activeApp validates the app half, or the
    // origin chip is left looking up an id nothing answers to.
    const selected =
      selectedRef?.kind === "site" &&
      !pinnedSites.some((site) => site.id === selectedRef.id)
        ? null
        : selectedRef;
    return selected ?? (fromUrl ? { kind: "app", slug: fromUrl } : BROWSER_REF);
  }, [selectedRef, fromUrl, pinnedSites]);

  // An app is only active while this build carries it, so a ref naming an app
  // that is not in the catalog reads as no app open — what the install check
  // used to do for an app that had been removed.
  const activeApp = useMemo<AppSlug | null>(() => {
    if (activeRef.kind !== "app") return null;
    return BUILTIN_APPS.find((slug) => slug === activeRef.slug) ?? null;
  }, [activeRef]);

  const activeTab = useMemo(() => {
    if (!activeTabId) return null;
    for (const tabs of Object.values(tabsBySpace)) {
      const found = tabs.find((tab) => tab.id === activeTabId);
      if (found) return found;
    }
    return null;
  }, [tabsBySpace, activeTabId]);

  /*
   * The pin API reads the live snapshot rather than the render closure, so two
   * pins in quick succession cannot clobber each other. `now` and `id` are
   * supplied here: lib/rail/sites is pure and never reaches for the clock.
   */
  const pinSite = useCallback(
    (url: string, title?: string): PinnedSite | null => {
      const result = addPinnedSite(getPinnedSitesSnapshot(), {
        url,
        // exactOptionalPropertyTypes: an optional property is present or
        // absent, never explicitly undefined.
        ...(title === undefined ? {} : { title }),
        now: new Date().toISOString(),
        // newId, not crypto.randomUUID: the latter is undefined outside a
        // secure context, and http://<lan-ip>:3000 from a phone is exactly how
        // pinning gets tested.
        id: newId("s"),
      });
      if (!result) return null;
      writePinnedSites(result.sites);
      return result.site;
    },
    [],
  );

  const unpinSite = useCallback((id: string) => {
    writePinnedSites(removePinnedSite(getPinnedSitesSnapshot(), id));
    // Unpinning what is open falls back to the default, the same way removing
    // an app used to — no effect-driven cleanup.
    setSelectedRef((current) =>
      current && current.kind === "site" && current.id === id ? null : current,
    );
  }, []);

  const renameSite = useCallback((id: string, title: string) => {
    writePinnedSites(renamePinnedSite(getPinnedSitesSnapshot(), id, title));
  }, []);

  /*
   * The rail callbacks reconcile against the live present-list, read out here
   * rather than inside the updater: an updater has to be pure, and React is
   * free to run it more than once.
   */
  const groupRefs = useCallback((dragRef: RailRef, target: RailTarget) => {
    if (target.kind === "ref" && sameRef(target.ref, dragRef)) return;
    const present = presentRefs(getPinnedSitesSnapshot());
    setRailLayout((prev) => {
      const entries = reconcileRail(prev, present);
      const base = normalizeGroups(withoutRef(entries, dragRef));
      if (target.kind === "group") {
        return base.map((entry) =>
          entry.type === "group" && entry.id === target.id
            ? { ...entry, members: [...entry.members, dragRef] }
            : entry,
        );
      }
      const count = base.filter((entry) => entry.type === "group").length;
      return base.map((entry) =>
        entry.type === "single" && sameRef(entry.ref, target.ref)
          ? {
              type: "group",
              id: newGroupId(),
              name: `Group ${count + 1}`,
              members: [entry.ref, dragRef],
            }
          : entry,
      );
    });
  }, []);

  const ungroupRef = useCallback((ref: RailRef) => {
    const present = presentRefs(getPinnedSitesSnapshot());
    setRailLayout((prev) => {
      const entries = reconcileRail(prev, present);
      const base = normalizeGroups(withoutRef(entries, ref));
      return [...base, { type: "single", ref }];
    });
  }, []);

  // Move a rail slot to just before/after another top-level entry.
  const reorderRailRef = useCallback(
    (dragRef: RailRef, targetRef: RailRef, position: "before" | "after") => {
      if (sameRef(dragRef, targetRef)) return;
      const present = presentRefs(getPinnedSitesSnapshot());
      setRailLayout((prev) => {
        const entries = reconcileRail(prev, present);
        // Pull the dragged slot out of wherever it currently sits.
        const base = normalizeGroups(withoutRef(entries, dragRef));
        const targetIndex = base.findIndex((entry) =>
          entry.type === "single"
            ? sameRef(entry.ref, targetRef)
            : entry.members.some((member) => sameRef(member, targetRef)),
        );
        const dragged: RailEntry = { type: "single", ref: dragRef };
        if (targetIndex === -1) return [...base, dragged];
        const insertAt = position === "before" ? targetIndex : targetIndex + 1;
        const next = [...base];
        next.splice(insertAt, 0, dragged);
        return next;
      });
    },
    [],
  );

  const renameGroup = useCallback((id: string, name: string) => {
    const present = presentRefs(getPinnedSitesSnapshot());
    setRailLayout((prev) =>
      reconcileRail(prev, present).map((entry) =>
        entry.type === "group" && entry.id === id ? { ...entry, name } : entry,
      ),
    );
  }, []);

  const setGroupColor = useCallback((id: string, color: string) => {
    const present = presentRefs(getPinnedSitesSnapshot());
    setRailLayout((prev) =>
      reconcileRail(prev, present).map((entry) =>
        entry.type === "group" && entry.id === id ? { ...entry, color } : entry,
      ),
    );
  }, []);

  const openApp = useCallback(
    (slug: AppSlug) => {
      setActiveRef({ kind: "app", slug });
      setActivePage(null);
      // Show the app in the canvas and the profile/context panel alongside it.
      setMainView("app");
      setLibraryTab("spaces");
      setMobileSheetOpen(false);
    },
    [setActiveRef],
  );

  const openTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      setActiveRef(BROWSER_REF);
      setActivePage(null);
      setMainView("app");
      setMobileSheetOpen(false);
      setCommandPaletteOpen(false);
    },
    [setActiveRef],
  );

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((current) =>
      current.includes(id)
        ? current.filter((folderId) => folderId !== id)
        : [...current, id],
    );
  }, []);

  const openPage = useCallback(
    (id: PageId) => {
      setActivePage(id);
      setActiveRef(BROWSER_REF);
      setMainView("app");
      setMobileSheetOpen(false);
    },
    [setActiveRef],
  );

  const createTab = useCallback(
    (input: string) => {
      /*
       * The tab is built BEFORE the state update, not inside it.
       *
       * setActiveTabId and setHistoryByTab used to be called from inside the
       * setTabsBySpace updater. An updater must be pure — React is free to run it
       * more than once — so the activation could be discarded, and the new tab
       * would be added but never focused. That is exactly what a link opened from
       * outside the browser hit: the tab appeared in the switcher while the pane
       * kept showing the previous one.
       *
       * `sortOrder` is assigned inside the updater instead, where the current tab
       * list is actually known.
       */
      const tab = buildTab(input, activeSpaceId, 0);
      setTabsBySpace((current) => {
        const tabs = current[activeSpaceId] ?? [];
        return { ...current, [activeSpaceId]: [...tabs, { ...tab, sortOrder: tabs.length }] };
      });
      setActiveTabId(tab.id);
      setHistoryByTab((h) => ({ ...h, [tab.id]: { stack: [tab.url], index: 0 } }));
      // Same as openTab: setActiveRef also names the browser in the address
      // bar, so reloading the chrome lands in the browser the new tab belongs
      // to rather than in whichever app was open when it was created.
      setActiveRef(BROWSER_REF);
      setActivePage(null);
      setMainView("app");
      setMobileSheetOpen(false);
      setCommandPaletteOpen(false);
    },
    [activeSpaceId, setActiveRef],
  );

  /**
   * Open a link in a specific profile's Browse and focus it.
   *
   * `ref` is what the rail should show as open once the tab is up, and it is a
   * parameter rather than something the caller sets afterwards because setting
   * it afterwards is a rule nobody can see: minting the tab is how a pinned
   * site comes on screen, so a `setActiveRef(siteRef)` before the call would be
   * overwritten here and the origin chip would never appear. Defaulting to the
   * browser keeps every existing caller — the Profiles manager, the command
   * palette — exactly as it was.
   */
  const openLinkInBrowser = useCallback(
    (spaceId: string, url: string, ref: RailRef = BROWSER_REF) => {
      /*
       * Reuse-or-build is decided out here, then written.
       *
       * Deciding it inside the setTabsBySpace updater meant the focus and
       * history writes happened inside it too. Updaters have to be pure — React
       * may run them twice — so those writes could be discarded and the link
       * would land in a tab nothing ever focused, or a rerun would mint a
       * second tab id for the same URL.
       */
      const tabs = tabsBySpace[spaceId] ?? [];
      // sameUrl, not ===: a pinned site's url is `new URL(...).href` and a tab
      // typed into the address bar is not, so the two spellings of one site
      // differ by a trailing slash and the reuse check used to miss.
      const existing = tabs.find((tab) => sameUrl(tab.url, url));
      if (existing) {
        setActiveTabId(existing.id);
      } else {
        const tab = buildTab(url, spaceId, tabs.length);
        setTabsBySpace((current) => ({
          ...current,
          [spaceId]: [...(current[spaceId] ?? []), tab],
        }));
        setHistoryByTab((h) => ({
          ...h,
          [tab.id]: { stack: [tab.url], index: 0 },
        }));
        setActiveTabId(tab.id);
      }
      setActiveSpaceId(spaceId);
      setActiveRef(ref);
      setActivePage(null);
      setMainView("app");
    },
    [tabsBySpace, setActiveRef],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      // The replacement is chosen from the list as it stands, before either
      // write. Choosing it inside the setTabsBySpace updater made that updater
      // impure, so a rerun could drop the focus change and leave the chrome
      // pointing at a tab that had just been removed.
      if (activeTabId === tabId) {
        // Closing the active tab activates its space's first remaining tab.
        const owner = Object.values(tabsBySpace).find((tabs) =>
          tabs.some((tab) => tab.id === tabId),
        );
        setActiveTabId(owner?.find((tab) => tab.id !== tabId)?.id ?? null);
      }
      setTabsBySpace((current) => {
        const next: Record<string, BrowserTab[]> = {};
        for (const [spaceId, tabs] of Object.entries(current)) {
          next[spaceId] = tabs.filter((tab) => tab.id !== tabId);
        }
        return next;
      });
    },
    [tabsBySpace, activeTabId],
  );

  const clearTabs = useCallback(
    (spaceId: string) => {
      // Same shape as closeTab: work out whether the focused tab is among the
      // ones about to go, so neither write sits inside the other's updater.
      const clearingActive = (tabsBySpace[spaceId] ?? []).some(
        (tab) => tab.id === activeTabId,
      );
      if (clearingActive) setActiveTabId(null);
      setTabsBySpace((current) => ({ ...current, [spaceId]: [] }));
    },
    [tabsBySpace, activeTabId],
  );

  // Replaces the active tab's content and pushes onto its history stack.
  const navigateActiveTab = useCallback(
    (input: string) => {
      if (!activeTabId) {
        createTab(input);
        return;
      }
      let landedUrl = "";
      setTabsBySpace((current) => {
        const next: Record<string, BrowserTab[]> = {};
        for (const [spaceId, tabs] of Object.entries(current)) {
          next[spaceId] = tabs.map((tab) => {
            if (tab.id !== activeTabId) return tab;
            const fresh = buildTab(input, spaceId, tab.sortOrder);
            landedUrl = fresh.url;
            return { ...fresh, id: tab.id, createdAt: tab.createdAt };
          });
        }
        return next;
      });
      setHistoryByTab((h) => {
        const entry = h[activeTabId] ?? { stack: [], index: -1 };
        const trimmed = entry.stack.slice(0, entry.index + 1);
        trimmed.push(landedUrl);
        return { ...h, [activeTabId]: { stack: trimmed, index: trimmed.length - 1 } };
      });
      focusBrowser();
    },
    [activeTabId, createTab, focusBrowser],
  );

  // Moves the active tab along its history without pushing a new entry.
  const stepHistory = useCallback(
    (delta: number) => {
      if (!activeTabId) return;
      // Resolve the destination from the history in hand. The tab rewrite below
      // used to live inside the setHistoryByTab updater, where React was free
      // to run it twice or throw it away — a Back press that moved the index
      // but not the page.
      const entry = historyByTab[activeTabId];
      if (!entry) return;
      const target = entry.index + delta;
      if (target < 0 || target >= entry.stack.length) return;
      const url = entry.stack[target]!;
      setTabsBySpace((current) => {
        const next: Record<string, BrowserTab[]> = {};
        for (const [spaceId, tabs] of Object.entries(current)) {
          next[spaceId] = tabs.map((tab) => {
            if (tab.id !== activeTabId) return tab;
            const fresh = buildTab(url, spaceId, tab.sortOrder);
            return { ...fresh, id: tab.id, createdAt: tab.createdAt };
          });
        }
        return next;
      });
      setHistoryByTab((h) => {
        const live = h[activeTabId];
        return live ? { ...h, [activeTabId]: { ...live, index: target } } : h;
      });
      focusBrowser();
    },
    [activeTabId, historyByTab, focusBrowser],
  );

  const goBack = useCallback(() => stepHistory(-1), [stepHistory]);
  const goForward = useCallback(() => stepHistory(1), [stepHistory]);

  const activeHistory = activeTabId ? historyByTab[activeTabId] : undefined;
  const canGoBack = (activeHistory?.index ?? 0) > 0;
  const canGoForward = activeHistory
    ? activeHistory.index < activeHistory.stack.length - 1
    : false;

  const addFavoriteFromTab = useCallback(
    (tabId: string) => {
      const tab = Object.values(tabsBySpace)
        .flat()
        .find((candidate) => candidate.id === tabId);
      if (!tab) return;
      setFavorites((current) => {
        if (current.some((favorite) => favorite.url === tab.url))
          return current;
        return [
          ...current,
          {
            id: `fav-${tab.id}`,
            title: tab.title,
            url: tab.url,
            favicon: tab.favicon,
            faviconColor: tab.faviconColor,
            sortOrder: current.length,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    },
    [tabsBySpace],
  );

  const removeFavorite = useCallback((favoriteId: string) => {
    setFavorites((current) =>
      current.filter((favorite) => favorite.id !== favoriteId),
    );
  }, []);

  const renameSpace = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSpaces((current) =>
      current.map((space) =>
        space.id === id ? { ...space, name: trimmed } : space,
      ),
    );
  }, []);

  const setSpaceEmoji = useCallback((id: string, emoji: string) => {
    setSpaces((current) =>
      current.map((space) =>
        space.id === id ? { ...space, emoji } : space,
      ),
    );
  }, []);

  const setSpaceThemeColor = useCallback((id: string, color: string) => {
    setSpaces((current) =>
      current.map((space) =>
        space.id === id ? { ...space, themeColor: color } : space,
      ),
    );
  }, []);

  const setSpaceProfile = useCallback((id: string, profile: SpaceProfile) => {
    setSpaces((current) =>
      current.map((space) =>
        space.id === id ? { ...space, profile } : space,
      ),
    );
  }, []);

  const reorderSpace = useCallback(
    (id: string, direction: "up" | "down") => {
      setSpaces((current) => {
        const index = current.findIndex((space) => space.id === id);
        if (index === -1) return current;
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= current.length) return current;
        const next = [...current];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved!);
        return next.map((space, order) => ({ ...space, sortOrder: order }));
      });
    },
    [],
  );

  // Drag-reorder: drop a profile just before/after another (Profiles manager).
  const moveSpace = useCallback(
    (dragId: string, targetId: string, position: "before" | "after") => {
      if (dragId === targetId) return;
      setSpaces((current) => {
        const dragged = current.find((space) => space.id === dragId);
        if (!dragged) return current;
        const without = current.filter((space) => space.id !== dragId);
        const targetIndex = without.findIndex((space) => space.id === targetId);
        if (targetIndex === -1) return current;
        const insertAt =
          position === "before" ? targetIndex : targetIndex + 1;
        const next = [...without];
        next.splice(insertAt, 0, dragged);
        return next.map((space, order) => ({ ...space, sortOrder: order }));
      });
    },
    [],
  );

  const createSpace = useCallback(() => {
    const id = newId("space");
    setSpaces((current) => [
      ...current,
      {
        id,
        name: "New Profile",
        emoji: "lucide:House",
        sortOrder: current.length,
        createdAt: new Date().toISOString(),
      },
    ]);
    // Seed empty item/tab buckets so panels render immediately.
    setSpaceItemsBySpace((current) => ({ ...current, [id]: [] }));
    setTabsBySpace((current) => ({ ...current, [id]: [] }));
    // Navigate into the fresh profile and surface it in the sidebar.
    setActiveSpaceId(id);
    setActivePage(null);
    setLibraryTab("spaces");
    // Surface the new profile in the manager.
    setMainView("profiles");
  }, []);

  const createIdentityKey = useCallback(() => {
    const publicKey = generatePublicKey();
    setIdentityKeys((current) => [
      ...current,
      {
        id: `key-${publicKey.slice(2, 10)}`,
        label: "New Identity Badge",
        publicKey,
        primary: false,
      },
    ]);
  }, []);

  const setPrimaryIdentityKey = useCallback((id: string) => {
    setIdentityKeys((current) => {
      const target = current.find((key) => key.id === id);
      if (!target || target.retired) return current; // retired can't be primary
      return current.map((key) => ({ ...key, primary: key.id === id }));
    });
  }, []);

  const retireIdentityKey = useCallback((id: string) => {
    setIdentityKeys((current) =>
      current.map((key) =>
        key.id === id && !key.primary ? { ...key, retired: true } : key,
      ),
    );
  }, []);

  const restoreIdentityKey = useCallback((id: string) => {
    setIdentityKeys((current) =>
      current.map((key) =>
        key.id === id ? { ...key, retired: false } : key,
      ),
    );
  }, []);

  const renameIdentityKey = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setIdentityKeys((current) =>
      current.map((key) =>
        key.id === id ? { ...key, label: trimmed } : key,
      ),
    );
  }, []);

  const deleteSpace = useCallback(
    (id: string) => {
      if (spaces.length <= 1) return; // never delete the last space
      const remaining = spaces.filter((space) => space.id !== id);
      if (remaining.length === spaces.length) return; // unknown id: nothing to drop
      // Both writes happen out here. Picking the fallback profile from inside
      // the setSpaces updater made it impure, and a discarded rerun left the
      // hub pointing at a profile that no longer existed — every panel keyed by
      // activeSpaceId then reads an empty bucket.
      if (activeSpaceId === id) {
        setActiveSpaceId(remaining[0]?.id ?? activeSpaceId);
      }
      setSpaces(remaining);
      setSpaceItemsBySpace((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setTabsBySpace((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
    },
    [spaces, activeSpaceId],
  );

  const addSpaceFolder = useCallback((spaceId: string) => {
    setSpaceItemsBySpace((current) => {
      const items = current[spaceId] ?? [];
      const folder: SpaceItem = {
        id: newId("item"),
        spaceId,
        kind: "folder",
        title: "New Folder",
        icon: "Folder",
        iconColor: "#4353ff",
        sortOrder: items.length,
        createdAt: new Date().toISOString(),
      };
      return { ...current, [spaceId]: [...items, folder] };
    });
  }, []);

  const addLiveFolder = useCallback(
    (spaceId: string, title: string, icon: string) => {
      setSpaceItemsBySpace((current) => {
        const items = current[spaceId] ?? [];
        if (items.some((item) => item.kind === "live" && item.title === title)) {
          return current;
        }
        const live: SpaceItem = {
          id: newId("live"),
          spaceId,
          kind: "live",
          title,
          icon,
          iconColor: "#16a34a",
          sortOrder: items.length,
          createdAt: new Date().toISOString(),
        };
        return { ...current, [spaceId]: [...items, live] };
      });
    },
    [],
  );

  // Generated in the click handler (not during render) to stay pure.
  const openShare = useCallback(() => {
    setShareCode(Math.random().toString(36).slice(2, 8));
    setShareOpen(true);
  }, []);

  const openWeb3Apps = useCallback(() => {
    setMainView("sites");
    setLibraryTab("apps");
    setActivePage(null);
  }, []);
  const openProfilesManager = useCallback(() => {
    setMainView("profiles");
    setLibraryTab("spaces");
    setActivePage(null);
  }, []);

  const value = useMemo<HubState>(
    () => ({
      builtinApps: BUILTIN_APPS,
      pinnedSites,
      pinSite,
      unpinSite,
      renameSite,
      railEntries,
      groupRefs,
      ungroupRef,
      reorderRailRef,
      renameGroup,
      setGroupColor,
      activeRef,
      setActiveRef,
      activeApp,
      openApp,
      libraryTab,
      setLibraryTab,
      mainView,
      settingsCategory,
      setSettingsCategory,
      openSettings,
      setMainView,
      railCollapsed,
      toggleRail,
      openWeb3Apps,
      openProfilesManager,
      activeSpaceId,
      setActiveSpaceId,
      identityKeys,
      createIdentityKey,
      setPrimaryIdentityKey,
      retireIdentityKey,
      restoreIdentityKey,
      renameIdentityKey,
      spaces,
      spaceItemsBySpace,
      renameSpace,
      setSpaceEmoji,
      setSpaceThemeColor,
      setSpaceProfile,
      reorderSpace,
      moveSpace,
      createSpace,
      deleteSpace,
      addSpaceFolder,
      addLiveFolder,
      expandedFolders,
      toggleFolder,
      activePage,
      openPage,
      shareOpen,
      setShareOpen,
      shareCode,
      openShare,
      tabsBySpace,
      activeTabId,
      activeTab,
      openTab,
      createTab,
      openLinkInBrowser,
      closeTab,
      clearTabs,
      navigateActiveTab,
      goBack,
      goForward,
      canGoBack,
      canGoForward,
      favorites,
      addFavoriteFromTab,
      removeFavorite,
      tabDragging,
      setTabDragging,
      mobileSheetOpen,
      setMobileSheetOpen,
      commandPaletteOpen,
      setCommandPaletteOpen,
      mailFolder,
      setMailFolder,
      mailTab,
      setMailTab,
      messageThread,
      setMessageThread,
      messageFocus,
      openMessageAt,
      clearMessageFocus,
      messagesUnreadOnly,
      setMessagesUnreadOnly,
      conversationsVersion,
      bumpConversations,
      newConversationOpen,
      openNewConversation,
      closeNewConversation,
      vaultKind,
      setVaultKind,
      learnCourse,
      setLearnCourse,
      voteStatus,
      setVoteStatus,
      exploreQuery,
      setExploreQuery,
      exploreKind,
      setExploreKind,
      marketFilters,
      setMarketFilters,
      walletFilter,
      setWalletFilter,
      walletSection,
      setWalletSection,
      walletIntent,
      detailPane,
      openDetailPane,
      closeDetailPane,
      conversationTitles,
      renameConversation,
      composerSeed,
      seedComposer,
      conversationNotes: notes,
      setConversationNote,
      conversationFlags: flags,
      setConversationFlag,
      conversationMembers,
      setConversationMembers,
      conversationIcons,
      setConversationIcon,
      conversationGates,
      setConversationGates,
      conversationRoles,
      setConversationRoles,
      setWalletIntent,
      connectSelected,
      setConnectSelected,
      basketSelected,
      setBasketSelected,
      signSection,
      setSignSection,
      identitySection,
      setIdentitySection,
      attestationFilter,
      setAttestationFilter,
    }),
    [
      pinnedSites,
      pinSite,
      unpinSite,
      renameSite,
      railEntries,
      groupRefs,
      ungroupRef,
      reorderRailRef,
      renameGroup,
      setGroupColor,
      activeRef,
      setActiveRef,
      activeApp,
      openApp,
      libraryTab,
      mainView,
      railCollapsed,
      toggleRail,
      openWeb3Apps,
      openProfilesManager,
      activeSpaceId,
      identityKeys,
      createIdentityKey,
      setPrimaryIdentityKey,
      retireIdentityKey,
      restoreIdentityKey,
      renameIdentityKey,
      spaces,
      spaceItemsBySpace,
      renameSpace,
      setSpaceEmoji,
      setSpaceThemeColor,
      setSpaceProfile,
      reorderSpace,
      moveSpace,
      createSpace,
      deleteSpace,
      addSpaceFolder,
      addLiveFolder,
      expandedFolders,
      toggleFolder,
      activePage,
      openPage,
      shareOpen,
      shareCode,
      openShare,
      tabsBySpace,
      activeTabId,
      activeTab,
      openTab,
      createTab,
      openLinkInBrowser,
      closeTab,
      clearTabs,
      navigateActiveTab,
      goBack,
      goForward,
      canGoBack,
      canGoForward,
      favorites,
      addFavoriteFromTab,
      removeFavorite,
      tabDragging,
      mobileSheetOpen,
      commandPaletteOpen,
      mailFolder,
      mailTab,
      messagesUnreadOnly,
      setMessagesUnreadOnly,
      conversationsVersion,
      bumpConversations,
      newConversationOpen,
      openNewConversation,
      closeNewConversation,
      messageThread,
      messageFocus,
      openMessageAt,
      clearMessageFocus,
      settingsCategory,
      openSettings,
      vaultKind,
      learnCourse,
      voteStatus,
      exploreQuery,
      exploreKind,
      marketFilters,
      walletFilter,
      walletSection,
      walletIntent,
      detailPane,
      openDetailPane,
      closeDetailPane,
      conversationTitles,
      renameConversation,
      composerSeed,
      seedComposer,
      notes,
      setConversationNote,
      flags,
      setConversationFlag,
      conversationMembers,
      setConversationMembers,
      conversationIcons,
      setConversationIcon,
      conversationGates,
      setConversationGates,
      conversationRoles,
      setConversationRoles,
      connectSelected,
      basketSelected,
      signSection,
      identitySection,
      attestationFilter,
    ],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub(): HubState {
  const context = useContext(HubContext);
  if (!context) {
    throw new Error("useHub must be used within a HubProvider");
  }
  return context;
}
