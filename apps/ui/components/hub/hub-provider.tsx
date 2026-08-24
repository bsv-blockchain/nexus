"use client";

import { storageKeys } from "@/lib/config";
import {
  getBrowserTabs,
  getDefaultInstalledAppSlugs,
  getDefaultSpace,
  getEssentialAppSlugs,
  getFavorites,
  getHubApp,
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
  type RoadmapSort,
  type RoadmapStatus,
  type SpaceProfile,
} from "@/lib/data";
import { pruneHandlesTo, useSettings } from "@/lib/settings-store";
import {
  nextWorkspaceName,
  pickUnused,
  WORKSPACE_ICONS,
} from "@/lib/data/workspace-defaults";
import { pruneWalletsTo } from "@/lib/wallets-store";
import { isVisibleInPhase, usePhase } from "@/lib/phase";
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
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type AppSlug = HubApp["slug"];
export type LibraryTab = "spaces" | "downloads" | "apps";
/** What the main canvas shows, independent of which rail panel is open. */
export type MainViewKind =
  | "app"
  | "store"
  | "profiles"
  | "settings"
  | "timeline";

/**
 * A page this space has been on, as the command bar needs it.
 *
 * A snapshot rather than a reference to a tab: the tab it came from may be
 * closed by the time anybody reads this, which is exactly the case the list
 * exists to serve. Carries its own favicon for the same reason.
 */
export interface RecentSite {
  url: string;
  title: string;
  favicon: string;
  faviconColor: string;
  /** true when it got here by being closed rather than merely visited */
  closed: boolean;
}

/**
 * The settings categories, in the narrow column.
 *
 * A union rather than free strings so the sidebar and the content area cannot
 * drift apart: adding a category is one edit and the compiler finds the panel
 * that has to exist for it.
 */
export type SettingsCategory =
  | "general"
  | "profiles"
  | "security"
  | "privacy"
  | "permissions"
  | "autofill"
  | "browsing"
  | "shortcuts"
  | "appearance"
  | "about"
  /** live builds only — keys, network and backup; see settings-wallet.tsx */
  | "wallet";

/**
 * A rail slot holds a `RailRef` — a built-in app or a site the user connected.
 *
 * Both types are re-exported from here because the rail's consumers already
 * import them from the provider; the definitions themselves live in
 * `lib/rail/layout` so the pure module can be tested without React.
 *
 * The two kinds stay distinct in the type on purpose. `app` is a screen
 * compiled into this binary; `site` is somebody else's website, connected with
 * an origin-scoped grant against this profile's wallet. Collapsing them into
 * one stringly-typed id would erase exactly the boundary the permission model
 * rests on — see docs/SPEC-design-catchup.md §1.
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
  /** the amount to open the sheet on, where the caller already knows it */
  units?: number;
  /**
   * The share this payment would settle, when it is one.
   *
   * Carried through rather than settled by the caller, because a share is paid
   * when the money leaves — not when somebody presses a button that opens a
   * sheet they can still cancel. The wallet marks it on `onSend`.
   */
  settles?: { splitId: string; personId: string };
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
    | "release"
    /** an app's onboarding, `id` being its slug */
    | "onboarding"
    /** the licence this software is granted under */
    | "licence"
    /** terms of use and privacy, as two tabs of one pane */
    | "legal"
    /** one roadmap feature, `id` being its slug */
    | "feature"
    /** what each profile has downloaded */
    | "downloads"
    /** every site that has a permission or a connection */
    | "sites"
    /** which language pages are asked for */
    | "languages"
    /** what to wipe, and the button that wipes it */
    | "clear-data"
    /** the form for a new payment link; `id` is unused */
    | "new-payment-link"
    /** the form for raising a split; `id` is unused */
    | "new-split";
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
export type IdentitySection = "handles" | "keys" | "retired" | "certificates";
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

/**
 * Which canvas the address bar is asking for, when it is not an app.
 *
 * Apps and Profiles are places, and a place you cannot link to is a place you
 * cannot send anybody. `app` is kept alongside rather than cleared, so a reload
 * on Profiles still knows which app the rail should return you to.
 */
/** How many pages a space remembers for the command bar. */
const RECENT_LIMIT = 12;

const VIEW_PARAM = "view";
/** The second app, when two are open side by side. */
const SPLIT_PARAM = "split";
const VIEWS: Record<string, MainViewKind> = {
  apps: "store",
  profiles: "profiles",
  settings: "settings",
  timeline: "timeline",
  /* The launcher's old address. Timeline took the slot the wall of app tiles
     used to hold, so a link somebody already has still lands somewhere true —
     it just rewrites itself to ?view=timeline on arrival. */
  feed: "timeline",
};
const VIEW_SLUGS: Partial<Record<MainViewKind, string>> = {
  store: "apps",
  profiles: "profiles",
  settings: "settings",
  timeline: "timeline",
};

function urlAppSlug(): string | null {
  return new URLSearchParams(window.location.search).get(APP_PARAM);
}

function urlView(): string | null {
  return new URLSearchParams(window.location.search).get(VIEW_PARAM);
}

function urlSplit(): string | null {
  return new URLSearchParams(window.location.search).get(SPLIT_PARAM);
}

/**
 * Reflect the second pane in the address bar.
 *
 * A split is a place, the same way Apps and Profiles are: two apps side by side
 * is a working arrangement worth sending somebody, and one that should survive
 * a reload rather than quietly collapsing to one app.
 */
function writeSplitToUrl(slug: AppSlug | "" | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (slug === null) url.searchParams.delete(SPLIT_PARAM);
  else url.searchParams.set(SPLIT_PARAM, slug);
  window.history.replaceState(window.history.state, "", url);
}

/** Reflect the open app in the address bar so the page can be shared. */
function writeAppToUrl(slug: AppSlug | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  // Nothing to say: every rail click and every in-browser navigation reaches
  // here, and rewriting history with the value it already holds is noise.
  if ((url.searchParams.get(APP_PARAM) ?? null) === slug) return;
  if (slug) url.searchParams.set(APP_PARAM, slug);
  else url.searchParams.delete(APP_PARAM);
  // Replace rather than push: the rail is not navigation, and every app switch
  // adding a history entry would make the back button useless.
  window.history.replaceState(window.history.state, "", url);
}

/** Same for the canvas; "app" is the absence of a view rather than a value. */
function writeViewToUrl(view: MainViewKind): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const slug = VIEW_SLUGS[view];
  if (slug) url.searchParams.set(VIEW_PARAM, slug);
  else url.searchParams.delete(VIEW_PARAM);
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
          }
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

/** A built-in app as a ref, which is how the rail talks about everything. */
function appRef(slug: AppSlug): RailRef {
  return { kind: "app", slug };
}

/**
 * A ref's slug, if this build actually carries an app by that name.
 *
 * The rail model stores a plain string so `lib/rail/layout` can stay free of
 * the data layer and be tested under bare Node. Everywhere the string has to
 * become an app — the address bar, the canvas — it is checked against the
 * catalog first, which is also what makes a stale layout harmless.
 */
function asAppSlug(slug: string): AppSlug | null {
  return KNOWN_SLUGS.has(slug) ? (slug as AppSlug) : null;
}

interface HubState {
  /** the active profile's apps */
  installedApps: AppSlug[];
  /** any profile's apps, for surfaces that show more than one */
  installedFor: (spaceId: string) => AppSlug[];
  installApp: (slug: AppSlug, spaceId?: string) => void;
  uninstallApp: (slug: AppSlug, spaceId?: string) => void;
  isInstalled: (slug: AppSlug) => boolean;
  /** install or remove several apps at once (collection toggles) */
  bulkSetInstalled: (slugs: AppSlug[], installed: boolean) => void;

  /**
   * The sites the user connected. A listing whose `web` field is set connects
   * as one of these rather than as an app slot: it stays on somebody else's
   * server, and the grant it carries is scoped to an origin.
   */
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
    position: "before" | "after"
  ) => void;
  presetGroup: (name: string, refs: RailRef[]) => void;
  /**
   * Lay the rail out from scratch, for the workspace this is called in.
   *
   * The first run's presets need to place folders *and* the loose tiles around
   * them in one decided order. `presetGroup` appends, so building a rail out of
   * four calls to it would put every folder after the apps that are supposed to
   * sit above them. This takes the whole arrangement at once.
   */
  applyRailPlan: (entries: RailEntry[]) => void;
  renameGroup: (id: string, name: string) => void;
  setGroupColor: (id: string, color: string) => void;

  /** Apps surface collection filter */
  appsCollection: CollectionId;
  setAppsCollection: (id: CollectionId) => void;

  /**
   * What the rail shows as open: a built-in app or a connected site.
   *
   * Reading it always yields a ref — the fallback chain ends at Browser, and a
   * ref naming something that has gone (a disconnected site, an app this build
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
  /**
   * The app in the second pane, or null when one app has the canvas.
   *
   * Only ever set on a desktop layout and only while an app is showing — the
   * store and the profiles manager are already multi-column screens, and a
   * split inside one of those is a third set of columns nobody asked for.
   */
  /**
   * `null` is closed, `""` is open with nothing chosen yet, a slug is open on
   * that app. Three states because opening the pane and filling it are two
   * separate acts — the pane has to be able to exist while it asks.
   */
  splitApp: AppSlug | "" | null;
  setSplitApp: (slug: AppSlug | "" | null) => void;

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
  /** Roadmap: which column the board is filtered to, "all" for every column */
  roadmapStatus: RoadmapStatus | "all";
  setRoadmapStatus: (status: RoadmapStatus | "all") => void;
  roadmapSort: RoadmapSort;
  setRoadmapSort: (sort: RoadmapSort) => void;
  roadmapQuery: string;
  setRoadmapQuery: (query: string) => void;
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
    gates: GroupGates | null
  ) => void;
  /** Role maps per conversation, edited in the same pane as the gates. */
  conversationRoles: Record<string, RoomRoles | null>;
  setConversationRoles: (
    conversationId: string,
    roles: RoomRoles | null
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
    on: boolean
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

  /** identifiers (keys) — session state seeded from lib/data */
  identityKeys: IdentityKey[];
  createIdentityKey: () => void;
  setPrimaryIdentityKey: (id: string) => void;
  retireIdentityKey: (id: string) => void;
  restoreIdentityKey: (id: string) => void;
  renameIdentityKey: (id: string, label: string) => void;

  /** spaces + their folder/easel items — session state seeded from lib/data */
  spaces: Space[];
  spaceItemsBySpace: Record<string, SpaceItem[]>;
  /**
   * Move a bookmark or a folder to another profile.
   *
   * A folder takes its children with it — dragging "Reading" and leaving its
   * eleven links behind in the profile you dragged it out of is not what
   * anybody means by moving a folder.
   *
   * `index` is the position among the target's top-level items, so a drop
   * between two rows lands between them rather than at the end.
   */
  moveItemToSpace: (
    itemId: string,
    fromSpaceId: string,
    toSpaceId: string,
    index: number
  ) => void;
  renameSpace: (id: string, name: string) => void;
  setSpaceEmoji: (id: string, emoji: string) => void;
  setSpaceThemeColor: (id: string, color: string) => void;
  setSpaceProfile: (id: string, profile: SpaceProfile) => void;
  reorderSpace: (id: string, direction: "up" | "down") => void;
  moveSpace: (
    dragId: string,
    targetId: string,
    position: "before" | "after"
  ) => void;
  /** returns the new workspace's id, so a caller can finish dressing it */
  createSpace: () => string;
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
  /** Move an open tab to another profile, at a position in its list. */
  /**
   * Reorder a tab WITHIN its own space.
   *
   * Separate from moveTabToSpace, which returns early when the two spaces match:
   * moving between columns and reordering inside one are the same gesture to a
   * person and different operations to the data — the cross-space path removes
   * from one list and inserts into another, and doing that to a single list
   * drops the tab before it works out where to put it back.
   */
  reorderTab: (spaceId: string, tabId: string, index: number) => void;
  /**
   * Pages this space has been on lately, most recent first.
   *
   * Fed by navigation and by closing a tab, so it answers both "where was I"
   * and "bring that back" from one list. Per space because a workspace is the
   * unit of separation here: Work's history has no business surfacing in a
   * Personal command bar.
   */
  recentBySpace: Record<string, RecentSite[]>;
  moveTabToSpace: (
    tabId: string,
    fromSpaceId: string,
    toSpaceId: string,
    index: number
  ) => void;
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
let snapshotMap: Record<string, AppSlug[]> = { "*": defaultInstalled };

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

/**
 * Which apps each profile has connected.
 *
 * Per profile rather than per Nexus, because that is what a profile is for: the
 * point of keeping Work apart from Personal is that they are not carrying the
 * same things, and an app list shared by both made the profile a paint job over
 * one installation.
 *
 * The stored shape used to be a flat array. One that is still an array is read
 * as what every profile had, so nobody loses their apps to the change.
 */
function parseByProfile(raw: string | null): Record<string, AppSlug[]> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return null;
    if (!parsed || typeof parsed !== "object") return null;
    const out: Record<string, AppSlug[]> = {};
    for (const [spaceId, slugs] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (!Array.isArray(slugs)) continue;
      out[spaceId] = withEssentials(slugs as AppSlug[]);
    }
    return out;
  } catch {
    return null;
  }
}

function getInstalledMapSnapshot(): Record<string, AppSlug[]> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKeys.connectedApps);
  } catch {
    // storage unavailable (private mode) — fall back to defaults
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    const byProfile = parseByProfile(raw);
    if (byProfile) {
      snapshotMap = byProfile;
    } else {
      /* Either nothing stored or the old flat array: every profile starts from
         the same list, and they diverge from there. */
      const flat = raw
        ? withEssentials(parseInstalledApps(raw) ?? defaultInstalled)
        : defaultInstalled;
      snapshotMap = { "*": flat };
    }
  }
  return snapshotMap;
}

/** A profile's list, falling back to the shared starting set. */
function installedFor(
  map: Record<string, AppSlug[]>,
  spaceId: string
): AppSlug[] {
  return map[spaceId] ?? map["*"] ?? defaultInstalled;
}

function getInstalledMapServerSnapshot(): Record<string, AppSlug[]> {
  return SERVER_MAP;
}

const SERVER_MAP: Record<string, AppSlug[]> = { "*": defaultInstalled };

function subscribeToInstalledApps(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(INSTALLED_APPS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(INSTALLED_APPS_EVENT, onChange);
  };
}

function writeInstalledMap(map: Record<string, AppSlug[]>): void {
  const raw = JSON.stringify(map);
  try {
    window.localStorage.setItem(storageKeys.connectedApps, raw);
  } catch {
    // storage unavailable — keep the in-memory snapshot instead
    snapshotRaw = raw;
    snapshotMap = map;
  }
  window.dispatchEvent(new Event(INSTALLED_APPS_EVENT));
}

/**
 * Rewrite one profile's list.
 *
 * Takes the whole map first so a profile that has never been touched inherits
 * the shared set before diverging from it, rather than starting empty.
 */
function writeInstalledFor(spaceId: string, apps: AppSlug[]): void {
  const map = getInstalledMapSnapshot();
  /* Essentials survive every write. They are what other apps rely on, and a
     profile that has lost them is a profile that cannot be paid or identified
     — not a state any control here offers, so not one a write should produce. */
  writeInstalledMap({ ...map, [spaceId]: withEssentials(apps) });
}

/**
 * Connected sites live in localStorage (per-user client state until a real user
 * table exists) and are exposed through useSyncExternalStore so SSR renders an
 * empty rail and the client re-syncs after hydration.
 *
 * Separate from the app map above, and deliberately so. Connecting an app turns
 * a screen already in this binary on; connecting a site records that somebody
 * else's origin may talk to this profile's wallet. Same verb in the UI, two
 * different things being written, and the storage shape says which.
 */
const PINNED_SITES_EVENT = "nexus:pinned-sites";

/**
 * Sites the user connected. Nexus ships none — every icon on the rail beyond
 * the built-in apps got there because somebody chose it. BSV Browser reached
 * the same position: shared/constants.ts's defaultBookmarks is an empty array
 * with its ten entries commented out rather than deleted.
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
 * Everything that currently has a rail slot, in catalog-then-connection order.
 *
 * Apps first because they are the fixed part — a build carries the same set on
 * every device — and sites after, in the order they were connected.
 */
function presentRefs(apps: AppSlug[], sites: PinnedSite[]): RailRef[] {
  return [
    ...apps.map((slug): RailRef => ({ kind: "app", slug })),
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
    getSpaces().map((space) => [space.id, getBrowserTabs(space.id)])
  );
}

function seedSpaceItemsBySpace(): Record<string, SpaceItem[]> {
  return Object.fromEntries(
    getSpaces().map((space) => [space.id, getSpaceItems(space.id)])
  );
}

interface TabHistory {
  stack: string[];
  index: number;
}

function seedHistory(
  tabsBySpace: Record<string, BrowserTab[]>
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

  const installedMap = useSyncExternalStore(
    subscribeToInstalledApps,
    getInstalledMapSnapshot,
    getInstalledMapServerSnapshot
  );
  /* Declared here rather than beside the other space state because what is
     installed now depends on which profile is active, and the phase filter
     below reads the result. */
  const [activeSpaceId, setActiveSpaceId] = useState(defaultSpace.id);
  /* The active profile's list. Every consumer of `installedApps` keeps reading
     one array; which array it is now depends on where you are. */
  const installedApps = installedFor(installedMap, activeSpaceId);
  /* The rail helpers rebuild a layout against what is installed, and they run
     inside setState callbacks where the render's value is already stale. */
  const installedHere = useCallback(
    (): AppSlug[] => installedFor(getInstalledMapSnapshot(), activeSpaceId),
    [activeSpaceId]
  );
  /* Any profile's list, for the manager, which shows several columns at once. */
  const installedForSpace = useCallback(
    (spaceId: string): AppSlug[] => installedFor(installedMap, spaceId),
    [installedMap]
  );

  const pinnedSites = useSyncExternalStore(
    subscribeToPinnedSites,
    getPinnedSitesSnapshot,
    getPinnedSitesServerSnapshot
  );

  // `null` means nothing has been picked in this session yet, so the address
  // bar decides. Any explicit `setActiveRef` takes over from there.
  const [selectedRef, setSelectedRef] = useState<RailRef | null>(null);
  /**
   * The one way to change what the canvas shows, so the address bar cannot
   * drift from it: the rail sets a ref and `?app=` follows. A site clears the
   * parameter — the canvas is a website at that point, and a reload should land
   * on the browser rather than on an app.
   */
  const setActiveRef = useCallback((ref: RailRef | null) => {
    /* `RailRef.slug` is a plain string — lib/rail/layout is dependency-free so
       the Node tests can reach it — so the catalog decides whether it names an
       app this build carries before it reaches the address bar. */
    writeAppToUrl(ref?.kind === "app" ? asAppSlug(ref.slug) : null);
    // Keep the identity when the ref is unchanged, so navigating inside the
    // browser does not re-render every consumer of the context.
    setSelectedRef((current) =>
      current && ref && sameRef(current, ref) ? current : ref
    );
  }, []);

  /**
   * Bring the browser forward because a tab moved.
   *
   * A connected site is already showing in the browser, so it stays the active
   * ref: replacing it would take the origin chip away the moment the page
   * navigated, and the chip is the only thing saying where the user is.
   */
  const focusBrowser = useCallback(() => {
    if (selectedRef?.kind === "site") return;
    setActiveRef(BROWSER_REF);
  }, [selectedRef, setActiveRef]);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("spaces");
  const [appsCollection, setAppsCollection] = useState<CollectionId>("all");
  const [railLayout, setRailLayout] = useState<RailEntry[]>([]);

  /* Apps outside the product state being shown are dropped before the rail is
     reconciled, so a hidden app cannot leave an empty folder or a gap behind
     it. The install list itself is untouched: switching back to Later has to
     restore exactly what was there. */
  const phase = usePhase();
  /*
   * Apps the user connected by hand, which the phase filter does not overrule.
   *
   * The phase switcher exists to show what a Now-shaped Nexus looks like, so it
   * hides apps classified Next or Later. That is right for what ships switched
   * on and wrong the moment somebody goes to the store and connects one: they
   * approved a permission sheet, watched a confirmation, and got nothing in the
   * rail — the app deciding it knew better than the thing they had just asked
   * for. Connecting is a statement about now.
   *
   * Mostly derived rather than stored: anything installed that did not ship
   * installed was chosen. That survives a reload, which a remembered set would
   * not — `installedApps` is persisted and this is not, so a stored-only answer
   * would put the apps in the rail and then lose them on refresh, which is the
   * same bug with a delay on it. The remembered set is still kept for the one
   * case the derivation misses: reconnecting an app that ships by default.
   */
  const shippedInstalled = useMemo(
    () => new Set(getDefaultInstalledAppSlugs()),
    []
  );
  const [askedFor, setAskedFor] = useState<Set<AppSlug>>(() => new Set());
  /*
   * Which apps the rail draws.
   *
   * Browse drops out of this list when it is pinned under Workspaces instead
   * (Settings > Browsing). It has not been uninstalled — every other reader of
   * `installedApps` still sees it, so the App Store and the workspace's
   * connections still know it is connected and can still disconnect it. It has
   * only stopped being one of the tiles, because it is now one of the buttons.
   */
  const browsePinned = useSettings().browseAsButton;
  const visibleApps = useMemo(
    () =>
      installedApps.filter(
        (slug) =>
          (!browsePinned || slug !== "browser") &&
          (!shippedInstalled.has(slug) ||
            askedFor.has(slug) ||
            isVisibleInPhase(slug, phase))
      ),
    [installedApps, phase, askedFor, shippedInstalled, browsePinned]
  );
  /* Always reconciled, never rendered raw: a stored layout can name a site that
     has since been disconnected, an app this profile no longer carries, or a
     group left holding one member. */
  const railEntries = useMemo(
    () => reconcileRail(railLayout, presentRefs(visibleApps, pinnedSites)),
    [railLayout, visibleApps, pinnedSites]
  );
  /* The rail callbacks reconcile against the live present-list, read out here
     rather than inside the updater: an updater has to be pure, and React is
     free to run it more than once. */
  const presentHere = useCallback(
    (): RailRef[] => presentRefs(installedHere(), getPinnedSitesSnapshot()),
    [installedHere]
  );
  // The rail is always shown; collapsing hides the wider panel column.
  const [railCollapsed, setRailCollapsed] = useState(false);
  // What the main canvas shows (app by default; store/profiles open via tabs).
  /* A plain setter, not a wrapped one. Wrapping it to write the URL made it a
     new identity the linter wanted in nine dependency arrays; the URL is a
     consequence of the view rather than of the call, so it is written where the
     view is read. */
  const [requestedView, setMainView] = useState<MainViewKind | null>(null);
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategory>("general");
  const openSettings = useCallback(() => {
    setMainView("settings");
    // The panel has to be open for the categories to be reachable at all.
    setRailCollapsed(false);
  }, []);
  const [identityKeys, setIdentityKeys] =
    useState<IdentityKey[]>(getIdentityKeys);
  const [spaces, setSpaces] = useState<Space[]>(getSpaces);
  /*
   * Hand back what a profile that no longer exists was holding.
   *
   * Only one profile may wear a handle, so a claim that outlives its claimant
   * takes the name with it — greyed out on behalf of somewhere nobody can
   * visit, with no way left to free it. Two ways that happens: a profile is
   * deleted, and a reload, since settings are persisted and profiles are not.
   * Both are the same reconciliation, so it is done here rather than on the
   * delete path, where only the first would be caught.
   *
   * Here because this is the only part of the app that knows which profiles are
   * real; the stores hold assignments and take the list as told.
   */
  useEffect(() => {
    const ids = spaces.map((space) => space.id);
    pruneHandlesTo(ids);
    pruneWalletsTo(ids);
  }, [spaces]);
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
    () => seedHistory(seedTabsBySpace())
  );
  const [recentBySpace, setRecentBySpace] = useState<
    Record<string, RecentSite[]>
  >({});
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => getBrowserTabs(defaultSpace.id)[0]?.id ?? null
  );
  const [favorites, setFavorites] = useState<Favorite[]>(getFavorites);
  const [tabDragging, setTabDragging] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const toggleRail = useCallback(() => setRailCollapsed((value) => !value), []);

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
    []
  );
  const clearMessageFocus = useCallback(() => setMessageFocus(null), []);
  const [messagesUnreadOnly, setMessagesUnreadOnly] = useState(false);
  const [roadmapStatus, setRoadmapStatus] = useState<RoadmapStatus | "all">(
    "all"
  );
  const [roadmapSort, setRoadmapSort] = useState<RoadmapSort>("top-funded");
  const [roadmapQuery, setRoadmapQuery] = useState("");
  const [conversationsVersion, setConversationsVersion] = useState(0);
  const bumpConversations = useCallback(
    () => setConversationsVersion((n) => n + 1),
    []
  );
  const [vaultKind, setVaultKind] = useState<string>("all");
  const [learnCourse, setLearnCourse] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>("all");
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploreKind, setExploreKind] = useState<string>("all");
  const [marketFilters, setMarketFilters] = useState<MarketFilters>(
    DEFAULT_MARKET_FILTERS
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
    []
  );
  const closeNewConversation = useCallback(() => setDetailPane(null), []);
  const openDetailPane = useCallback(
    (pane: DetailPane) => setDetailPane(pane),
    []
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
    []
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
    []
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
    []
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
    []
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
    []
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
    []
  );
  const [notes, setNotes] = useState<Record<string, string>>(conversationNotes);
  const setConversationNote = useCallback(
    (conversationId: string, html: string) =>
      setNotes((current) => ({ ...current, [conversationId]: html })),
    []
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
    []
  );
  const [connectSelected, setConnectSelected] = useState<string | null>(null);
  const [basketSelected, setBasketSelected] = useState<string | null>(null);
  const [signSection, setSignSection] = useState("Envelopes");
  const [identitySection, setIdentitySection] =
    useState<IdentitySection>("handles");
  const [attestationFilter, setAttestationFilter] =
    useState<AttestationFilter>("all");
  const [appPrompt, setAppPrompt] = useState<AppPrompt | null>(null);
  const openAppPrompt = useCallback(
    (slug: AppSlug, mode: AppPromptMode) =>
      setAppPrompt({ kind: "app", slug, mode }),
    []
  );
  const openCollectionPrompt = useCallback(
    (id: CollectionId, mode: AppPromptMode) =>
      setAppPrompt({ kind: "collection", id, mode }),
    []
  );
  const closeAppPrompt = useCallback(() => setAppPrompt(null), []);

  const urlApp = useSyncExternalStore(subscribeToUrl, urlAppSlug, () => null);
  const urlViewSlug = useSyncExternalStore(subscribeToUrl, urlView, () => null);
  const mainView: MainViewKind =
    requestedView ?? (urlViewSlug ? (VIEWS[urlViewSlug] ?? "app") : "app");

  /* Same shape as the view: the address bar wins until something asks. */
  const urlSplitSlug = useSyncExternalStore(
    subscribeToUrl,
    urlSplit,
    () => null
  );
  const [requestedSplit, setRequestedSplit] = useState<AppSlug | "" | null>(
    null
  );
  const [splitTouched, setSplitTouched] = useState(false);
  /* An empty `split=` in the address bar is a pane that was open and waiting,
     which is worth restoring — somebody sharing that link is sharing "look at
     these two side by side", half-finished. */
  const splitApp: AppSlug | "" | null = splitTouched
    ? requestedSplit
    : urlSplitSlug === null
      ? null
      : ((getHubApps().find((app) => app.slug === urlSplitSlug)?.slug ?? "") as
          | AppSlug
          | "");
  const setSplitApp = useCallback((slug: AppSlug | "" | null) => {
    setSplitTouched(true);
    setRequestedSplit(slug);
    writeSplitToUrl(slug);
  }, []);
  /* Only once something in the app has asked for a view. Writing on every
     render meant the first one — before the store had read the address bar —
     deleted the very parameter the page was opened with. */
  useEffect(() => {
    if (requestedView === null) return;
    writeViewToUrl(requestedView);
  }, [requestedView]);
  /* A host that refuses to be framed has no pane to restore, so it is not a
     value this parameter can hold — `openApp` hands those to Browse and never
     writes one. Hand-typed, it falls through to Browse rather than to a frame
     that will come back empty. */
  const fromUrl =
    getHubApps().find((app) => app.slug === urlApp && app.web?.embeds !== false)
      ?.slug ?? null;

  /**
   * What the rail shows as open.
   *
   * A ref naming something that has gone — a site disconnected in another tab,
   * an app this profile no longer carries — is replaced rather than held, so
   * there is no state in which the rail highlights a slot that is not there.
   */
  const activeRef = useMemo<RailRef>(() => {
    if (
      selectedRef?.kind === "site" &&
      !pinnedSites.some((site) => site.id === selectedRef.id)
    ) {
      return BROWSER_REF;
    }
    if (selectedRef) return selectedRef;
    return fromUrl ? appRef(fromUrl) : BROWSER_REF;
  }, [selectedRef, fromUrl, pinnedSites]);

  // An app is only active while this profile has it connected; disconnecting
  // the active app falls back to the empty state without effect-driven cleanup.
  const activeApp = useMemo<AppSlug | null>(() => {
    if (activeRef.kind !== "app") return null;
    const slug = asAppSlug(activeRef.slug);
    return slug && installedApps.includes(slug) ? slug : null;
  }, [activeRef, installedApps]);

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
  /* Everything below writes one profile's list. `activeSpaceId` is in the
     dependency arrays rather than read from a ref: these functions genuinely
     mean something different in a different profile, and pretending otherwise
     is how an app ends up connected to whichever profile you were in last. */
  const installApp = useCallback(
    (slug: AppSlug, spaceId?: string) => {
      const target = spaceId ?? activeSpaceId;
      setAskedFor((current) => new Set(current).add(slug));
      const current = installedFor(getInstalledMapSnapshot(), target);
      if (current.includes(slug)) return;
      writeInstalledFor(target, [...current, slug]);
    },
    [activeSpaceId]
  );

  const uninstallApp = useCallback(
    (slug: AppSlug, spaceId?: string) => {
      if (isEssentialApp(slug)) return; // essential apps can't be removed
      const target = spaceId ?? activeSpaceId;
      writeInstalledFor(
        target,
        installedFor(getInstalledMapSnapshot(), target).filter(
          (app) => app !== slug
        )
      );
    },
    [activeSpaceId]
  );

  /**
   * Whether this profile has the listing connected.
   *
   * Two answers behind one question, because a listing is one of two things. A
   * screen we compiled is connected when the profile's list names it. A website
   * is connected when its URL is on the rail — there is no app slot for it to
   * occupy, and inventing one would mean the same listing had two rail slots
   * and two ways to be half-removed.
   */
  const isInstalled = useCallback(
    (slug: AppSlug) => {
      const web = getHubApp(slug)?.web;
      if (web) return pinnedSites.some((site) => sameUrl(site.url, web.url));
      return installedApps.includes(slug);
    },
    [installedApps, pinnedSites]
  );

  const groupRefs = useCallback(
    (dragRef: RailRef, target: RailTarget) => {
      if (target.kind === "ref" && sameRef(target.ref, dragRef)) return;
      const present = presentHere();
      setRailLayout((prev) => {
        const entries = reconcileRail(prev, present);
        const base = normalizeGroups(withoutRef(entries, dragRef));
        if (target.kind === "group") {
          return base.map((entry) =>
            entry.type === "group" && entry.id === target.id
              ? { ...entry, members: [...entry.members, dragRef] }
              : entry
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
            : entry
        );
      });
    },
    [presentHere]
  );

  const ungroupRef = useCallback(
    (ref: RailRef) => {
      const present = presentHere();
      setRailLayout((prev) => {
        const entries = reconcileRail(prev, present);
        const base = normalizeGroups(withoutRef(entries, ref));
        return [...base, { type: "single", ref }];
      });
    },
    [presentHere]
  );

  // Move a rail slot to just before/after another top-level entry.
  const reorderRailRef = useCallback(
    (dragRef: RailRef, targetRef: RailRef, position: "before" | "after") => {
      if (sameRef(dragRef, targetRef)) return;
      const present = presentHere();
      setRailLayout((prev) => {
        const entries = reconcileRail(prev, present);
        // Pull the dragged slot out of wherever it currently sits.
        const base = normalizeGroups(withoutRef(entries, dragRef));
        const targetIndex = base.findIndex((entry) =>
          entry.type === "single"
            ? sameRef(entry.ref, targetRef)
            : entry.members.some((member) => sameRef(member, targetRef))
        );
        const dragged: RailEntry = { type: "single", ref: dragRef };
        if (targetIndex === -1) return [...base, dragged];
        const insertAt = position === "before" ? targetIndex : targetIndex + 1;
        const next = [...base];
        next.splice(insertAt, 0, dragged);
        return next;
      });
    },
    [presentHere]
  );

  const presetGroup = useCallback(
    (name: string, refs: RailRef[]) => {
      if (refs.length < 2) return;
      const present = presentHere();
      setRailLayout((prev) => {
        const entries = reconcileRail(prev, present);
        let base = entries;
        for (const ref of refs) base = withoutRef(base, ref);
        base = normalizeGroups(base).filter(
          (entry) => !(entry.type === "group" && entry.name === name)
        );
        return [
          ...base,
          { type: "group", id: newGroupId(), name, members: refs },
        ];
      });
    },
    [presentHere]
  );

  const applyRailPlan = useCallback(
    (entries: RailEntry[]) => {
      /* Reconciled rather than trusted: a plan can name an app this profile has
         not got, and `reconcileRail` drops those and appends anything present
         that the plan forgot — so the rail is never left missing a tile for
         something that is actually installed. */
      setRailLayout(reconcileRail(entries, presentHere()));
    },
    [presentHere]
  );

  const renameGroup = useCallback(
    (id: string, name: string) => {
      const present = presentHere();
      setRailLayout((prev) =>
        reconcileRail(prev, present).map((entry) =>
          entry.type === "group" && entry.id === id ? { ...entry, name } : entry
        )
      );
    },
    [presentHere]
  );

  const setGroupColor = useCallback(
    (id: string, color: string) => {
      const present = presentHere();
      setRailLayout((prev) =>
        reconcileRail(prev, present).map((entry) =>
          entry.type === "group" && entry.id === id
            ? { ...entry, color }
            : entry
        )
      );
    },
    [presentHere]
  );

  /*
   * Connecting a site.
   *
   * `addPinnedSite` returns the existing row rather than duplicating it, so a
   * second attempt is not a failure — the caller reveals the row it got back.
   * Null means the input was not a usable URL at all.
   */
  const pinSite = useCallback(
    (url: string, title?: string): PinnedSite | null => {
      const current = getPinnedSitesSnapshot();
      const result = addPinnedSite(current, {
        url,
        ...(title === undefined ? {} : { title }),
        now: new Date().toISOString(),
        id: newId("site"),
      });
      if (!result) return null;
      if (result.sites !== current) writePinnedSites(result.sites);
      return result.site;
    },
    []
  );

  const unpinSite = useCallback((id: string) => {
    writePinnedSites(removePinnedSite(getPinnedSitesSnapshot(), id));
  }, []);

  const renameSite = useCallback((id: string, title: string) => {
    writePinnedSites(renamePinnedSite(getPinnedSitesSnapshot(), id, title));
  }, []);

  const bulkSetInstalled = useCallback(
    (slugs: AppSlug[], installed: boolean) => {
      const current = installedFor(getInstalledMapSnapshot(), activeSpaceId);
      const set = new Set(current);
      if (installed) {
        for (const slug of slugs) set.add(slug);
        setAskedFor((asked) => {
          const next = new Set(asked);
          for (const slug of slugs) next.add(slug);
          return next;
        });
      } else for (const slug of slugs) set.delete(slug);
      // preserve the catalog order for a stable rail
      writeInstalledFor(
        activeSpaceId,
        current
          .filter((entry) => set.has(entry))
          .concat([...set].filter((entry) => !current.includes(entry)))
      );
    },
    [activeSpaceId]
  );

  /*
   * Moving between profiles.
   *
   * Both of these also connect Browse where it is missing: a profile that has
   * been given a bookmark but cannot open one is a profile holding something it
   * has no way to use, and refusing the drop would be refusing the clearer
   * request of the two.
   */
  const ensureBrowser = useCallback((spaceId: string) => {
    const current = installedFor(getInstalledMapSnapshot(), spaceId);
    if (current.includes("browser")) return;
    writeInstalledFor(spaceId, [...current, "browser"]);
    setAskedFor((asked) => new Set(asked).add("browser"));
  }, []);

  const moveItemToSpace = useCallback(
    (itemId: string, fromSpaceId: string, toSpaceId: string, index: number) => {
      if (fromSpaceId === toSpaceId) return;
      ensureBrowser(toSpaceId);
      setSpaceItemsBySpace((current) => {
        const from = current[fromSpaceId] ?? [];
        const moving = from.find((item) => item.id === itemId);
        if (!moving) return current;
        /* The folder and everything under it, so the move is the whole thing. */
        const kin = from.filter((item) => item.parentId === itemId);
        const movingIds = new Set([itemId, ...kin.map((item) => item.id)]);
        const to = current[toSpaceId] ?? [];
        const top = to.filter((item) => !item.parentId);
        const at = Math.max(0, Math.min(index, top.length));
        /* Renumbered against the target's own order rather than carried over,
           since sortOrder means nothing outside the list it came from. */
        const reordered = [
          ...top.slice(0, at),
          { ...moving, spaceId: toSpaceId },
          ...top.slice(at),
        ].map((item, order) => ({ ...item, sortOrder: order }));
        return {
          ...current,
          [fromSpaceId]: from.filter((item) => !movingIds.has(item.id)),
          [toSpaceId]: [
            ...reordered,
            ...to.filter((item) => item.parentId),
            ...kin.map((item) => ({ ...item, spaceId: toSpaceId })),
          ],
        };
      });
    },
    [ensureBrowser]
  );

  const moveTabToSpace = useCallback(
    (tabId: string, fromSpaceId: string, toSpaceId: string, index: number) => {
      if (fromSpaceId === toSpaceId) return;
      ensureBrowser(toSpaceId);
      setTabsBySpace((current) => {
        const from = current[fromSpaceId] ?? [];
        const moving = from.find((tab) => tab.id === tabId);
        if (!moving) return current;
        const to = current[toSpaceId] ?? [];
        const at = Math.max(0, Math.min(index, to.length));
        const next = [
          ...to.slice(0, at),
          { ...moving, spaceId: toSpaceId },
          ...to.slice(at),
        ].map((tab, order) => ({ ...tab, sortOrder: order }));
        return {
          ...current,
          [fromSpaceId]: from.filter((tab) => tab.id !== tabId),
          [toSpaceId]: next,
        };
      });
    },
    [ensureBrowser]
  );

  /**
   * Reorder within one space.
   *
   * `index` is the slot the tab should END UP in, counted against the list with
   * the tab already removed — which is what a drop indicator between two rows
   * means. Computing it the other way round makes a drag one place to the right
   * a no-op, because the tab is still occupying the slot being aimed at.
   */
  const reorderTab = useCallback(
    (spaceId: string, tabId: string, index: number) => {
      setTabsBySpace((current) => {
        const tabs = current[spaceId] ?? [];
        const from = tabs.findIndex((tab) => tab.id === tabId);
        if (from === -1) return current;
        const without = tabs.filter((tab) => tab.id !== tabId);
        const at = Math.max(0, Math.min(index, without.length));
        const next = [
          ...without.slice(0, at),
          tabs[from]!,
          ...without.slice(at),
        ].map((tab, order) => ({ ...tab, sortOrder: order }));
        return { ...current, [spaceId]: next };
      });
    },
    []
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
    [setActiveRef]
  );

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((current) =>
      current.includes(id)
        ? current.filter((folderId) => folderId !== id)
        : [...current, id]
    );
  }, []);

  const openPage = useCallback(
    (id: PageId) => {
      setActivePage(id);
      setActiveRef(BROWSER_REF);
      setMainView("app");
      setMobileSheetOpen(false);
    },
    [setActiveRef]
  );

  /*
   * Open a URL in a new tab and focus it.
   *
   * The tab is built HERE, not inside the updater, for the same reason
   * openLinkInBrowser below builds its own outside: `buildTab` invents a random
   * id, React invokes updaters twice in development, and the id the second run
   * focused was not the id the first run kept. The tab appeared in the list with
   * nothing selected — a browser pane on an empty address bar showing no page,
   * which is what "Open in explorer" did from the wallet.
   *
   * Calling setActiveTabId and setHistoryByTab from inside another setter's
   * updater was the other half of it. An updater has to be pure; these are
   * effects, and they belong out here where they run once.
   */
  /**
   * File a page under a space's recents.
   *
   * Deduped by URL and newest-first, so revisiting a page moves it up rather
   * than filling the list with the same row — a command bar that shows one site
   * five times is a command bar nobody can find anything in. Capped, because
   * this is a shortcut list and not a history archive.
   */
  const rememberRecent = useCallback(
    (spaceId: string, site: RecentSite): void => {
      if (!site.url) return;
      setRecentBySpace((current) => {
        const kept = (current[spaceId] ?? []).filter(
          (entry) => entry.url !== site.url
        );
        return {
          ...current,
          [spaceId]: [site, ...kept].slice(0, RECENT_LIMIT),
        };
      });
    },
    []
  );

  const createTab = useCallback(
    (input: string) => {
      const tabs = tabsBySpace[activeSpaceId] ?? [];
      const tab = buildTab(input, activeSpaceId, tabs.length);
      setTabsBySpace((current) => ({
        ...current,
        [activeSpaceId]: [...(current[activeSpaceId] ?? []), tab],
      }));
      setHistoryByTab((h) => ({
        ...h,
        [tab.id]: { stack: [tab.url], index: 0 },
      }));
      rememberRecent(activeSpaceId, {
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        faviconColor: tab.faviconColor,
        closed: false,
      });
      setActiveTabId(tab.id);
      setActiveRef(BROWSER_REF);
      setActivePage(null);
      setMainView("app");
      setMobileSheetOpen(false);
      setCommandPaletteOpen(false);
    },
    [activeSpaceId, tabsBySpace, setActiveRef, rememberRecent]
  );

  /*
   * Open a link in a specific profile's Browse and focus it.
   *
   * The tab is built here rather than inside the updater, and that is the whole
   * point: `buildTab` invents a random id, React invokes updaters twice in
   * development, and the id the second run focused was not the id the first run
   * kept. The tab appeared in the list and nothing was selected — one click to
   * create it, a second to open it. Built once in the handler, the id every
   * setter sees is the same one.
   */
  const openLinkInBrowser = useCallback(
    (spaceId: string, url: string, ref?: RailRef) => {
      const tabs = tabsBySpace[spaceId] ?? [];
      /* Matched on the canonical URL rather than the string, so opening a
         connected site twice reuses its tab whether the rail passed
         `https://example.com/` or the address bar produced `example.com`. */
      const existing = tabs.find((tab) => sameUrl(tab.url, url));
      const tab = existing ?? buildTab(url, spaceId, tabs.length);
      if (!existing) {
        setTabsBySpace((current) => ({
          ...current,
          [spaceId]: [...(current[spaceId] ?? []), tab],
        }));
        setHistoryByTab((h) => ({
          ...h,
          [tab.id]: { stack: [tab.url], index: 0 },
        }));
      }
      setActiveSpaceId(spaceId);
      setActiveTabId(tab.id);
      setActiveRef(ref ?? BROWSER_REF);
      setActivePage(null);
      setMainView("app");
    },
    [tabsBySpace, setActiveRef]
  );

  /*
   * Defined after `openLinkInBrowser` because it calls it: a listing whose host
   * refuses to be framed opens in Browse instead of in its own pane.
   *
   * Decided here rather than in the pane, because by the time a blocked frame
   * has rendered there is nothing to show and no way to ask why — the refusal
   * is cross-origin and silent. Handing off costs the rail's highlight and buys
   * the address bar, the back button and a page that loads, none of which an
   * app pane has.
   */
  const openApp = useCallback(
    (slug: AppSlug) => {
      const web = getHubApp(slug)?.web;
      if (web && !web.embeds) {
        openLinkInBrowser(activeSpaceId, web.url);
        return;
      }
      setActiveRef(appRef(slug));
      setActivePage(null);
      // Show the app in the canvas and the profile/context panel alongside it.
      setMainView("app");
      setLibraryTab("spaces");
      setMobileSheetOpen(false);
    },
    [activeSpaceId, openLinkInBrowser, setActiveRef]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      /*
       * Filed BEFORE the updater runs, not inside it.
       *
       * `rememberRecent` is a state setter, and a setter called from within
       * another setter's updater makes that updater impure — React is free to
       * re-run or discard it, which it does, and the close then either loses
       * unrelated tabs or silently does nothing. Reading the current list here
       * costs a dependency and keeps the updater a pure function of its input.
       */
      for (const [spaceId, tabs] of Object.entries(tabsBySpace)) {
        const going = tabs.find((tab) => tab.id === tabId);
        if (!going) continue;
        rememberRecent(spaceId, {
          url: going.url,
          title: going.title,
          favicon: going.favicon,
          faviconColor: going.faviconColor,
          closed: true,
        });
      }
      setTabsBySpace((current) => {
        const next: Record<string, BrowserTab[]> = {};
        for (const [spaceId, tabs] of Object.entries(current)) {
          next[spaceId] = tabs.filter((tab) => tab.id !== tabId);
        }
        setActiveTabId((activeId) => {
          if (activeId !== tabId) return activeId;
          // Closing the active tab activates its space's first remaining tab.
          for (const [spaceId, tabs] of Object.entries(current)) {
            if (tabs.some((tab) => tab.id === tabId)) {
              return next[spaceId]?.[0]?.id ?? null;
            }
          }
          return null;
        });
        return next;
      });
    },
    [rememberRecent, tabsBySpace]
  );

  const clearTabs = useCallback((spaceId: string) => {
    setTabsBySpace((current) => {
      setActiveTabId((activeId) =>
        current[spaceId]?.some((tab) => tab.id === activeId) ? null : activeId
      );
      return { ...current, [spaceId]: [] };
    });
  }, []);

  // Replaces the active tab's content and pushes onto its history stack.
  const navigateActiveTab = useCallback(
    (input: string) => {
      if (!activeTabId) {
        createTab(input);
        return;
      }
      // Plain strings rather than one nullable object, matching landedUrl above:
      // a variable only ever assigned inside the updater is narrowed to null by
      // the compiler, which cannot see that the callback runs.
      let landedUrl = "";
      let landedSpace = "";
      let landedTitle = "";
      let landedFavicon = "";
      let landedFaviconColor = "";
      setTabsBySpace((current) => {
        const next: Record<string, BrowserTab[]> = {};
        for (const [spaceId, tabs] of Object.entries(current)) {
          next[spaceId] = tabs.map((tab) => {
            if (tab.id !== activeTabId) return tab;
            const fresh = buildTab(input, spaceId, tab.sortOrder);
            landedUrl = fresh.url;
            // Captured here, recorded after the updater returns — same reason
            // landedUrl is threaded out rather than acted on in place: this
            // function has to stay a pure function of `current`.
            landedSpace = spaceId;
            landedTitle = fresh.title;
            landedFavicon = fresh.favicon;
            landedFaviconColor = fresh.faviconColor;
            return { ...fresh, id: tab.id, createdAt: tab.createdAt };
          });
        }
        return next;
      });
      setHistoryByTab((h) => {
        const entry = h[activeTabId] ?? { stack: [], index: -1 };
        const trimmed = entry.stack.slice(0, entry.index + 1);
        trimmed.push(landedUrl);
        return {
          ...h,
          [activeTabId]: { stack: trimmed, index: trimmed.length - 1 },
        };
      });
      if (landedSpace && landedUrl) {
        rememberRecent(landedSpace, {
          url: landedUrl,
          title: landedTitle,
          favicon: landedFavicon,
          faviconColor: landedFaviconColor,
          closed: false,
        });
      }
      focusBrowser();
    },
    [activeTabId, createTab, focusBrowser, rememberRecent]
  );

  // Moves the active tab along its history without pushing a new entry.
  const stepHistory = useCallback(
    (delta: number) => {
      if (!activeTabId) return;
      setHistoryByTab((h) => {
        const entry = h[activeTabId];
        if (!entry) return h;
        const target = entry.index + delta;
        if (target < 0 || target >= entry.stack.length) return h;
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
        return { ...h, [activeTabId]: { ...entry, index: target } };
      });
      focusBrowser();
    },
    [activeTabId, focusBrowser]
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
    [tabsBySpace]
  );

  const removeFavorite = useCallback((favoriteId: string) => {
    setFavorites((current) =>
      current.filter((favorite) => favorite.id !== favoriteId)
    );
  }, []);

  const renameSpace = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSpaces((current) =>
      current.map((space) =>
        space.id === id ? { ...space, name: trimmed } : space
      )
    );
  }, []);

  const setSpaceEmoji = useCallback((id: string, emoji: string) => {
    setSpaces((current) =>
      current.map((space) => (space.id === id ? { ...space, emoji } : space))
    );
  }, []);

  const setSpaceThemeColor = useCallback((id: string, color: string) => {
    setSpaces((current) =>
      current.map((space) =>
        space.id === id ? { ...space, themeColor: color } : space
      )
    );
  }, []);

  const setSpaceProfile = useCallback((id: string, profile: SpaceProfile) => {
    setSpaces((current) =>
      current.map((space) => (space.id === id ? { ...space, profile } : space))
    );
  }, []);

  const reorderSpace = useCallback((id: string, direction: "up" | "down") => {
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
  }, []);

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
        const insertAt = position === "before" ? targetIndex : targetIndex + 1;
        const next = [...without];
        next.splice(insertAt, 0, dragged);
        return next.map((space, order) => ({ ...space, sortOrder: order }));
      });
    },
    []
  );

  /*
   * Named, marked and (by the caller) coloured, rather than "New Profile".
   *
   * Four workspaces called "New Profile" with the same house on them is four
   * rows nobody can tell apart, and the fix costs nothing to somebody who was
   * going to rename it anyway. Name and mark are decided here because this is
   * where the existing ones are in scope; the colour is not, because the theme
   * store sits INSIDE this provider — see `useCreateWorkspace`, which is what
   * the buttons actually call.
   */
  const createSpace = useCallback(() => {
    const id = newId("space");
    setSpaces((current) => [
      ...current,
      {
        id,
        name: nextWorkspaceName(current.map((space) => space.name)),
        emoji: pickUnused(
          WORKSPACE_ICONS,
          current.map((space) => space.emoji),
        ),
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
    return id;
  }, []);

  const createIdentityKey = useCallback(() => {
    const publicKey = generatePublicKey();
    setIdentityKeys((current) => [
      ...current,
      {
        id: `key-${publicKey.slice(2, 10)}`,
        label: "New Identifier",
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
        key.id === id && !key.primary ? { ...key, retired: true } : key
      )
    );
  }, []);

  const restoreIdentityKey = useCallback((id: string) => {
    setIdentityKeys((current) =>
      current.map((key) => (key.id === id ? { ...key, retired: false } : key))
    );
  }, []);

  const renameIdentityKey = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setIdentityKeys((current) =>
      current.map((key) => (key.id === id ? { ...key, label: trimmed } : key))
    );
  }, []);

  const deleteSpace = useCallback((id: string) => {
    setSpaces((current) => {
      if (current.length <= 1) return current; // never delete the last space
      const remaining = current.filter((space) => space.id !== id);
      setActiveSpaceId((activeId) =>
        activeId === id ? (remaining[0]?.id ?? activeId) : activeId
      );
      return remaining;
    });
    setSpaceItemsBySpace((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
    setTabsBySpace((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

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
        if (
          items.some((item) => item.kind === "live" && item.title === title)
        ) {
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
    []
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
      installedFor: installedForSpace,
      installApp,
      uninstallApp,
      isInstalled,
      bulkSetInstalled,
      pinnedSites,
      pinSite,
      unpinSite,
      renameSite,
      railEntries,
      groupRefs,
      ungroupRef,
      reorderRailRef,
      presetGroup,
      applyRailPlan,
      renameGroup,
      setGroupColor,
      appsCollection,
      setAppsCollection,
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
      splitApp,
      setSplitApp,
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
      moveItemToSpace,
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
      moveTabToSpace,
      reorderTab,
      recentBySpace,
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
      roadmapStatus,
      setRoadmapStatus,
      roadmapSort,
      setRoadmapSort,
      roadmapQuery,
      setRoadmapQuery,
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
      splitApp,
      setSplitApp,
      installedForSpace,
      installApp,
      uninstallApp,
      isInstalled,
      bulkSetInstalled,
      railEntries,
      pinnedSites,
      pinSite,
      unpinSite,
      renameSite,
      groupRefs,
      ungroupRef,
      reorderRailRef,
      presetGroup,
      applyRailPlan,
      renameGroup,
      setGroupColor,
      appsCollection,
      activeRef,
      setActiveRef,
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
      moveItemToSpace,
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
      moveTabToSpace,
      reorderTab,
      recentBySpace,
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
      roadmapStatus,
      setRoadmapStatus,
      roadmapSort,
      setRoadmapSort,
      roadmapQuery,
      setRoadmapQuery,
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
    ]
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
