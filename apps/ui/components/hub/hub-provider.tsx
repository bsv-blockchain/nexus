"use client";

import { storageKeys } from "@/lib/config";
import {
  getBrowserTabs,
  getDefaultInstalledAppSlugs,
  getDefaultSpace,
  getEssentialAppSlugs,
  getFavorites,
  getHubApps,
  getIdentityKeys,
  isEssentialApp,
  getSpaceItems,
  getSpaces,
  conversationNotes,
  type BrowserTab,
  type CollectionId,
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
import { buildTab } from "@/lib/tabs";
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
/** What the main canvas shows, independent of which rail panel is open. */
export type MainViewKind = "app" | "store" | "profiles" | "settings";

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
  | "about";

/** A rail slot: a single app or a folder-style group of apps. */
export type RailEntry =
  | { type: "app"; slug: AppSlug }
  | {
      type: "group";
      id: string;
      name: string;
      apps: AppSlug[];
      /** optional folder tint (hex); falls back to the surface color */
      color?: string;
    };

/** Drop target when grouping apps in the rail. */
export type RailTarget =
  | { kind: "app"; slug: AppSlug }
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
export type AppPromptMode = "install" | "uninstall";
export type AppPrompt =
  | { kind: "app"; slug: AppSlug; mode: AppPromptMode }
  | { kind: "collection"; id: CollectionId; mode: AppPromptMode };
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
function writeAppToUrl(slug: AppSlug | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set(APP_PARAM, slug);
  else url.searchParams.delete(APP_PARAM);
  // Replace rather than push: the rail is not navigation, and every app switch
  // adding a history entry would make the back button useless.
  window.history.replaceState(window.history.state, "", url);
}

function newGroupId(): string {
  return `group-${Date.now()}-${Math.floor(Date.now() % 1000)}`;
}

function withoutApp(entries: RailEntry[], slug: AppSlug): RailEntry[] {
  return entries
    .map((entry) =>
      entry.type === "app"
        ? entry
        : { ...entry, apps: entry.apps.filter((s) => s !== slug) },
    )
    .filter((entry) => !(entry.type === "app" && entry.slug === slug));
}

/** Collapse 1-app groups to single apps and drop empty groups. */
function normalizeGroups(entries: RailEntry[]): RailEntry[] {
  return entries.flatMap((entry) => {
    if (entry.type === "app") return [entry];
    if (entry.apps.length === 0) return [];
    if (entry.apps.length === 1)
      return [{ type: "app", slug: entry.apps[0]! } as RailEntry];
    return [entry];
  });
}

/** Reconcile a stored rail layout against the currently installed apps. */
function reconcileRail(
  layout: RailEntry[],
  installed: AppSlug[],
): RailEntry[] {
  const installedSet = new Set(installed);
  const seen = new Set<AppSlug>();
  const out: RailEntry[] = [];
  for (const entry of layout) {
    if (entry.type === "app") {
      if (installedSet.has(entry.slug) && !seen.has(entry.slug)) {
        seen.add(entry.slug);
        out.push(entry);
      }
      continue;
    }
    const apps = entry.apps.filter(
      (slug) => installedSet.has(slug) && !seen.has(slug),
    );
    apps.forEach((slug) => seen.add(slug));
    if (apps.length >= 2) out.push({ ...entry, apps });
    else if (apps.length === 1) out.push({ type: "app", slug: apps[0]! });
  }
  for (const slug of installed) {
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push({ type: "app", slug });
    }
  }
  return out;
}

interface HubState {
  installedApps: AppSlug[];
  installApp: (slug: AppSlug) => void;
  uninstallApp: (slug: AppSlug) => void;
  isInstalled: (slug: AppSlug) => boolean;
  /** install or remove several apps at once (collection toggles) */
  bulkSetInstalled: (slugs: AppSlug[], installed: boolean) => void;

  /** rail layout: single apps + folder groups, reconciled to installed apps */
  railEntries: RailEntry[];
  groupApps: (dragSlug: AppSlug, target: RailTarget) => void;
  ungroupApp: (slug: AppSlug) => void;
  reorderRailApp: (
    dragSlug: AppSlug,
    targetSlug: AppSlug,
    position: "before" | "after",
  ) => void;
  presetGroup: (name: string, slugs: AppSlug[]) => void;
  renameGroup: (id: string, name: string) => void;
  setGroupColor: (id: string, color: string) => void;

  /** App Store collection filter */
  appsCollection: CollectionId;
  setAppsCollection: (id: CollectionId) => void;

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
  /** pending install/uninstall permission sheet */
  appPrompt: AppPrompt | null;
  openAppPrompt: (slug: AppSlug, mode: AppPromptMode) => void;
  openCollectionPrompt: (id: CollectionId, mode: AppPromptMode) => void;
  closeAppPrompt: () => void;
  openAppStore: () => void;
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
  openLinkInBrowser: (spaceId: string, url: string) => void;
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
 * Installed apps live in localStorage (per-user client state until a real
 * user table exists) and are exposed through useSyncExternalStore so SSR
 * renders the seed defaults and the client re-syncs after hydration.
 */
const INSTALLED_APPS_EVENT = "nexus:installed-apps";
const essentialInstalled = getEssentialAppSlugs();
const defaultInstalled = withEssentials(getDefaultInstalledAppSlugs());

/** Essential apps are always installed — force them in (handles stale state). */
function withEssentials(apps: AppSlug[]): AppSlug[] {
  const missing = essentialInstalled.filter((slug) => !apps.includes(slug));
  return missing.length ? [...apps, ...missing] : apps;
}

let snapshotRaw: string | null = null;
let snapshotApps: AppSlug[] = defaultInstalled;

/** Slugs that were renamed after shipping, mapped to their current value. */
const RENAMED_SLUGS: Record<string, AppSlug> = { chat: "messages" };

const KNOWN_SLUGS = new Set<string>(getHubApps().map((app) => app.slug));

/**
 * Reads the persisted install list, migrating renamed slugs and dropping any
 * that no longer exist — otherwise a stale entry renders a dead rail icon.
 */
function parseInstalledApps(raw: string): AppSlug[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const migrated = parsed
      .filter((slug): slug is string => typeof slug === "string")
      .map((slug) => RENAMED_SLUGS[slug] ?? slug)
      .filter((slug): slug is AppSlug => KNOWN_SLUGS.has(slug));
    return [...new Set(migrated)];
  } catch {
    return null;
  }
}

function getInstalledAppsSnapshot(): AppSlug[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKeys.installedApps);
  } catch {
    // storage unavailable (private mode) — fall back to defaults
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotApps = raw
      ? withEssentials(parseInstalledApps(raw) ?? defaultInstalled)
      : defaultInstalled;
  }
  return snapshotApps;
}

function getInstalledAppsServerSnapshot(): AppSlug[] {
  return defaultInstalled;
}

function subscribeToInstalledApps(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(INSTALLED_APPS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(INSTALLED_APPS_EVENT, onChange);
  };
}

function writeInstalledApps(apps: AppSlug[]): void {
  try {
    window.localStorage.setItem(
      storageKeys.installedApps,
      JSON.stringify(apps),
    );
  } catch {
    // storage unavailable — keep the in-memory snapshot instead
    snapshotRaw = JSON.stringify(apps);
    snapshotApps = apps;
  }
  window.dispatchEvent(new Event(INSTALLED_APPS_EVENT));
}

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

  const installedApps = useSyncExternalStore(
    subscribeToInstalledApps,
    getInstalledAppsSnapshot,
    getInstalledAppsServerSnapshot,
  );

  // `null` means nothing has been picked in this session yet, so the address
  // bar decides. Any explicit `openApp` takes over from there.
  const [requestedApp, setRequestedApp] = useState<AppSlug | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("spaces");
  const [appsCollection, setAppsCollection] = useState<CollectionId>("all");
  const [railLayout, setRailLayout] = useState<RailEntry[]>([]);

  const railEntries = useMemo(
    () => reconcileRail(railLayout, installedApps),
    [railLayout, installedApps],
  );
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
  const [appPrompt, setAppPrompt] = useState<AppPrompt | null>(null);
  const openAppPrompt = useCallback(
    (slug: AppSlug, mode: AppPromptMode) =>
      setAppPrompt({ kind: "app", slug, mode }),
    [],
  );
  const openCollectionPrompt = useCallback(
    (id: CollectionId, mode: AppPromptMode) =>
      setAppPrompt({ kind: "collection", id, mode }),
    [],
  );
  const closeAppPrompt = useCallback(() => setAppPrompt(null), []);

  const urlApp = useSyncExternalStore(subscribeToUrl, urlAppSlug, () => null);
  const fromUrl = getHubApps().find((app) => app.slug === urlApp)?.slug ?? null;

  // An app is only active while it is installed; uninstalling the active app
  // falls back to the empty state without any effect-driven cleanup.
  const wanted = requestedApp ?? fromUrl ?? "browser";
  const activeApp = installedApps.includes(wanted) ? wanted : null;

  const activeTab = useMemo(() => {
    if (!activeTabId) return null;
    for (const tabs of Object.values(tabsBySpace)) {
      const found = tabs.find((tab) => tab.id === activeTabId);
      if (found) return found;
    }
    return null;
  }, [tabsBySpace, activeTabId]);

  // Read the live snapshot (not the render closure) so rapid successive
  // installs/uninstalls never clobber each other.
  const installApp = useCallback((slug: AppSlug) => {
    const current = getInstalledAppsSnapshot();
    if (current.includes(slug)) return;
    writeInstalledApps([...current, slug]);
  }, []);

  const uninstallApp = useCallback((slug: AppSlug) => {
    if (isEssentialApp(slug)) return; // essential apps can't be removed
    writeInstalledApps(
      getInstalledAppsSnapshot().filter((app) => app !== slug),
    );
  }, []);

  const isInstalled = useCallback(
    (slug: AppSlug) => installedApps.includes(slug),
    [installedApps],
  );

  const groupApps = useCallback((dragSlug: AppSlug, target: RailTarget) => {
    if (target.kind === "app" && target.slug === dragSlug) return;
    setRailLayout((prev) => {
      const entries = reconcileRail(prev, getInstalledAppsSnapshot());
      const base = normalizeGroups(withoutApp(entries, dragSlug));
      if (target.kind === "group") {
        return base.map((entry) =>
          entry.type === "group" && entry.id === target.id
            ? { ...entry, apps: [...entry.apps, dragSlug] }
            : entry,
        );
      }
      const count = base.filter((entry) => entry.type === "group").length;
      return base.map((entry) =>
        entry.type === "app" && entry.slug === target.slug
          ? {
              type: "group",
              id: newGroupId(),
              name: `Group ${count + 1}`,
              apps: [entry.slug, dragSlug],
            }
          : entry,
      );
    });
  }, []);

  const ungroupApp = useCallback((slug: AppSlug) => {
    setRailLayout((prev) => {
      const entries = reconcileRail(prev, getInstalledAppsSnapshot());
      const base = normalizeGroups(withoutApp(entries, slug));
      return [...base, { type: "app", slug }];
    });
  }, []);

  // Move a rail app to just before/after another top-level entry.
  const reorderRailApp = useCallback(
    (dragSlug: AppSlug, targetSlug: AppSlug, position: "before" | "after") => {
      if (dragSlug === targetSlug) return;
      setRailLayout((prev) => {
        const entries = reconcileRail(prev, getInstalledAppsSnapshot());
        // Pull the dragged app out of wherever it currently sits.
        const base = normalizeGroups(withoutApp(entries, dragSlug));
        const targetIndex = base.findIndex((entry) =>
          entry.type === "app"
            ? entry.slug === targetSlug
            : entry.apps.includes(targetSlug),
        );
        const dragged: RailEntry = { type: "app", slug: dragSlug };
        if (targetIndex === -1) return [...base, dragged];
        const insertAt = position === "before" ? targetIndex : targetIndex + 1;
        const next = [...base];
        next.splice(insertAt, 0, dragged);
        return next;
      });
    },
    [],
  );

  const presetGroup = useCallback((name: string, slugs: AppSlug[]) => {
    if (slugs.length < 2) return;
    setRailLayout((prev) => {
      const entries = reconcileRail(prev, getInstalledAppsSnapshot());
      let base = entries;
      for (const slug of slugs) base = withoutApp(base, slug);
      base = normalizeGroups(base).filter(
        (entry) => !(entry.type === "group" && entry.name === name),
      );
      return [...base, { type: "group", id: newGroupId(), name, apps: slugs }];
    });
  }, []);

  const renameGroup = useCallback((id: string, name: string) => {
    setRailLayout((prev) => {
      const entries = reconcileRail(prev, getInstalledAppsSnapshot());
      return entries.map((entry) =>
        entry.type === "group" && entry.id === id ? { ...entry, name } : entry,
      );
    });
  }, []);

  const setGroupColor = useCallback((id: string, color: string) => {
    setRailLayout((prev) => {
      const entries = reconcileRail(prev, getInstalledAppsSnapshot());
      return entries.map((entry) =>
        entry.type === "group" && entry.id === id ? { ...entry, color } : entry,
      );
    });
  }, []);

  const bulkSetInstalled = useCallback(
    (slugs: AppSlug[], installed: boolean) => {
      const current = getInstalledAppsSnapshot();
      const set = new Set(current);
      if (installed) for (const slug of slugs) set.add(slug);
      else for (const slug of slugs) set.delete(slug);
      // preserve the catalog order for a stable rail
      writeInstalledApps(current.filter((s) => set.has(s)).concat(
        [...set].filter((s) => !current.includes(s)),
      ));
    },
    [],
  );

  const openApp = useCallback((slug: AppSlug) => {
    setRequestedApp(slug);
    writeAppToUrl(slug);
    setActivePage(null);
    // Show the app in the canvas and the profile/context panel alongside it.
    setMainView("app");
    setLibraryTab("spaces");
    setMobileSheetOpen(false);
  }, []);

  const openTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setRequestedApp("browser");
    writeAppToUrl("browser");
    setActivePage(null);
    setMainView("app");
    setMobileSheetOpen(false);
    setCommandPaletteOpen(false);
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((current) =>
      current.includes(id)
        ? current.filter((folderId) => folderId !== id)
        : [...current, id],
    );
  }, []);

  const openPage = useCallback((id: PageId) => {
    setActivePage(id);
    setRequestedApp("browser");
    setMainView("app");
    setMobileSheetOpen(false);
  }, []);

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
      setRequestedApp("browser");
      // Same as openTab: without this the address bar still names whichever app
      // was open when the tab was created, so reloading the chrome lands back
      // in that app rather than in the browser the new tab belongs to.
      writeAppToUrl("browser");
      setActivePage(null);
      setMainView("app");
      setMobileSheetOpen(false);
      setCommandPaletteOpen(false);
    },
    [activeSpaceId],
  );

  // Open a link in a specific profile's Browse and focus it (Profiles manager).
  const openLinkInBrowser = useCallback(
    (spaceId: string, url: string) => {
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
      const existing = tabs.find((tab) => tab.url === url);
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
      setRequestedApp("browser");
      setActivePage(null);
      setMainView("app");
    },
    [tabsBySpace],
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
      setRequestedApp("browser");
    },
    [activeTabId, createTab],
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
      setRequestedApp("browser");
    },
    [activeTabId, historyByTab],
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

  const openAppStore = useCallback(() => {
    setMainView("store");
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
      installedApps,
      installApp,
      uninstallApp,
      isInstalled,
      bulkSetInstalled,
      railEntries,
      groupApps,
      ungroupApp,
      reorderRailApp,
      presetGroup,
      renameGroup,
      setGroupColor,
      appsCollection,
      setAppsCollection,
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
      openAppStore,
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
      appPrompt,
      openAppPrompt,
      openCollectionPrompt,
      closeAppPrompt,
    }),
    [
      installedApps,
      installApp,
      uninstallApp,
      isInstalled,
      bulkSetInstalled,
      railEntries,
      groupApps,
      ungroupApp,
      reorderRailApp,
      presetGroup,
      renameGroup,
      setGroupColor,
      appsCollection,
      activeApp,
      openApp,
      libraryTab,
      mainView,
      railCollapsed,
      toggleRail,
      openAppStore,
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
      appPrompt,
      openAppPrompt,
      openCollectionPrompt,
      closeAppPrompt,
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
