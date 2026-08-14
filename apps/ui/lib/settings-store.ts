"use client";

/**
 * Everything Settings can change, in one place.
 *
 * Same module-store shape as {@link file://./command-effects.ts}: a value read
 * through `useSyncExternalStore`, a server snapshot that matches the prerender,
 * and no persistence. Nothing here is written to disk — a prototype that
 * remembers you blocked a camera would be claiming to have a camera policy.
 *
 * The point of keeping it in one store rather than in each panel's `useState` is
 * that several of these are read outside the panel that sets them. Developer
 * tools open a panel in Browse; the permission defaults decide what a site
 * prompt says. A setting whose only reader is the switch that sets it is not a
 * setting, it is a light.
 */

import { useSyncExternalStore } from "react";

/** What a capability does when a page asks for it. */
export type Permission = "ask" | "allow" | "block";

/** Capabilities a page can ask the browser for. */
export type CapabilityId =
  | "camera"
  | "microphone"
  | "location"
  | "notifications"
  | "clipboard"
  | "downloads"
  | "midi";

/** Capabilities a page can ask the *wallet* for, which are the sharper ones. */
export type WalletCapabilityId =
  | "spend"
  | "identity"
  | "baskets"
  | "certificates";

export type StartupBehaviour = "new-tab" | "continue" | "home";
export type CookiePolicy = "allow" | "third-party" | "block";
export type ClearOnQuit = "nothing" | "history" | "everything";
/** Where a link from another app opens. */
export type OpenLinksIn = "nexus" | "native";
/** How long a tab sits untouched before it is filed away. */
export type ArchiveAfter = 0 | 1 | 7 | 30;

export interface SettingsState {
  /* ---- Permissions ---------------------------------------------------- */
  capabilities: Record<CapabilityId, Permission>;
  walletCapabilities: Record<WalletCapabilityId, Permission>;
  /** per-capability spend ceiling in satoshis, when `spend` is not blocked */
  spendCapSats: number;
  /**
   * Whether small paying actions go through without a confirmation.
   *
   * Sits with the wallet capabilities rather than with the browser ones because
   * it is the same question they are: what a page may do to your money without
   * stopping to ask. The spend cap is what keeps it honest — one-click pay
   * inside a ceiling is a convenience, and without one it is a blank cheque.
   */
  oneClickPay: boolean;
  /** origins allowed or blocked regardless of the default, by capability */
  exceptions: { origin: string; capability: CapabilityId; value: Permission }[];

  /* ---- General -------------------------------------------------------- */
  startup: StartupBehaviour;
  searchEngineId: string;
  restoreProfile: boolean;
  /** BCP-47 tag of the language pages are asked for */
  language: string;
  openLinksIn: OpenLinksIn;
  /** whether Nexus has been made the system's default browser */
  defaultBrowser: boolean;
  /** which of the alternate app icons is in use */
  appIcon: string;
  /** whether tapping the address bar raises the keyboard straight away */
  autoKeyboard: boolean;

  /* ---- Privacy -------------------------------------------------------- */
  cookies: CookiePolicy;
  blockTrackers: boolean;
  clearOnQuit: ClearOnQuit;
  sendDoNotTrack: boolean;

  /* ---- Browsing ------------------------------------------------------- */
  /** page zoom as a percentage */
  zoom: number;
  /** base font size in px */
  fontSize: number;
  openPdfsInNexus: boolean;
  translateOffer: boolean;
  /** days a tab may sit untouched before archiving; 0 never archives */
  archiveAfter: ArchiveAfter;

  /* ---- Autofill ------------------------------------------------------- */
  autofillAddresses: boolean;
  autofillCards: boolean;
  /** sign in with the identity key rather than storing a password */
  preferKeySignIn: boolean;
  offerToSavePasswords: boolean;

  /* ---- Developer ------------------------------------------------------ */
  devTools: boolean;
  overlayInspector: boolean;
  unsignedRepos: boolean;

  /* ---- Connections ---------------------------------------------------- */
  /**
   * Connection ids whose access has been withdrawn.
   *
   * Held here rather than in the Connect app so that Connect and the site list
   * cannot disagree about who is connected. Revoking is one act with two places
   * that show it, which is the whole reason the site list is derived rather
   * than kept as a second inventory.
   */
  revokedConnections: string[];

  /**
   * Payment links the holder has put away, by id.
   *
   * Archiving is not closing. A link's `status` is what the link itself is doing
   * — open, closed, expired — and belongs to the link; this is a note about
   * whether its owner wants to look at it, and belongs here. A closed link with
   * takings worth remembering stays out of the archive; an open one nobody used
   * can go in.
   */
  archivedPaymentLinks: string[];

  /* ---- Shortcuts ------------------------------------------------------ */
  /**
   * Rebound shortcuts, by id. Absent means the one that shipped.
   *
   * Stored as the tokens the keymap uses rather than as a string, so a binding
   * recorded on a Mac still reads as Ctrl on Windows: `mod` is the platform's
   * own command key, decided at render.
   */
  keymap: Record<string, string[]>;

  /* ---- Identity ------------------------------------------------------- */
  /**
   * Every handle you hold, oldest first.
   *
   * A list rather than a single name, because a person is not one identity: the
   * handle you give a client and the one you give a forum are different faces
   * of the same key, and forcing a choice between them is what makes people
   * keep two accounts.
   */
  handles: string[];
  /**
   * Which handle each profile answers to.
   *
   * Per profile rather than global, since that is what profiles are for — Work
   * and Personal wearing the same name defeats having both.
   */
  activeHandle: Record<string, string>;
  /** handles offered for sale, and the asking price in dollars */
  listedForSale: Record<string, number>;
  /** the avatar the share card shows, as a data URL; null falls back */
  avatar: string | null;
  /**
   * The handle just given up, and the moment it stops being yours.
   *
   * A grace window rather than an immediate release. Two things it guards
   * against: a typo you notice a second later, and somebody watching for a
   * good name to come free so they can wear it and be mistaken for you.
   */
  previousHandle: { handle: string; releasesAt: number } | null;
  /** attestation state per linked account id, overriding the seed */
  linked: Record<string, string | null>;

  /* ---- About ---------------------------------------------------------- */
  updateChannel: "stable" | "beta";
}

const INITIAL: SettingsState = {
  /* Ask, not allow. A default of allow is a decision made on somebody's behalf
     about a capability they have not been told exists yet. */
  capabilities: {
    camera: "ask",
    microphone: "ask",
    location: "ask",
    notifications: "ask",
    clipboard: "ask",
    downloads: "allow",
    midi: "block",
  },
  /* Spending asks every time and cannot be defaulted to allow from here — the
     cap is the safety net, and a page that can spend silently up to a ceiling
     is a page that will. */
  walletCapabilities: {
    spend: "ask",
    identity: "ask",
    baskets: "block",
    certificates: "ask",
  },
  spendCapSats: 10_000,
  oneClickPay: true,
  exceptions: [
    { origin: "bsvblockchain.org", capability: "notifications", value: "allow" },
    { origin: "market.example", capability: "clipboard", value: "allow" },
    { origin: "ads.example", capability: "location", value: "block" },
  ],

  startup: "continue",
  searchEngineId: "metasearch",
  restoreProfile: true,
  language: "en-GB",
  openLinksIn: "nexus",
  defaultBrowser: false,
  appIcon: "default",
  autoKeyboard: true,

  cookies: "third-party",
  blockTrackers: true,
  clearOnQuit: "nothing",
  sendDoNotTrack: true,

  zoom: 100,
  fontSize: 16,
  openPdfsInNexus: true,
  translateOffer: true,
  archiveAfter: 7,

  autofillAddresses: true,
  autofillCards: false,
  preferKeySignIn: true,
  offerToSavePasswords: false,

  revokedConnections: [],
  archivedPaymentLinks: [],
  keymap: {},
  handles: ["crumbs", "breadcrumbs"],
  activeHandle: {},
  listedForSale: {},
  avatar: null,
  previousHandle: null,
  linked: {},

  devTools: false,
  overlayInspector: false,
  unsignedRepos: false,

  updateChannel: "stable",
};

let state: SettingsState = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettings(): SettingsState {
  return state;
}

export function getSettingsServerSnapshot(): SettingsState {
  return INITIAL;
}

export function useSettings(): SettingsState {
  return useSyncExternalStore(
    subscribe,
    getSettings,
    getSettingsServerSnapshot,
  );
}

/** One field at a time, typed against the state so a typo will not compile. */
export function setSetting<K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K],
): void {
  state = { ...state, [key]: value };
  emit();
}

export function setCapability(id: CapabilityId, value: Permission): void {
  state = { ...state, capabilities: { ...state.capabilities, [id]: value } };
  emit();
}

export function setWalletCapability(
  id: WalletCapabilityId,
  value: Permission,
): void {
  state = {
    ...state,
    walletCapabilities: { ...state.walletCapabilities, [id]: value },
  };
  emit();
}

/** Sets a per-origin override, replacing any existing one for that capability. */
export function setException(
  origin: string,
  capability: CapabilityId,
  value: Permission,
): void {
  const others = state.exceptions.filter(
    (entry) => !(entry.origin === origin && entry.capability === capability),
  );
  state = { ...state, exceptions: [...others, { origin, capability, value }] };
  emit();
}

/** Withdraws or restores a site's access. Reversible: revoking is not deleting. */
export function toggleConnection(id: string): void {
  const revoked = state.revokedConnections.includes(id);
  state = {
    ...state,
    revokedConnections: revoked
      ? state.revokedConnections.filter((entry) => entry !== id)
      : [...state.revokedConnections, id],
  };
  emit();
}

/** Puts a payment link away, or takes it back out. Reversible, like revoking. */
export function toggleArchivedPaymentLink(id: string): void {
  const archived = state.archivedPaymentLinks.includes(id);
  state = {
    ...state,
    archivedPaymentLinks: archived
      ? state.archivedPaymentLinks.filter((entry) => entry !== id)
      : [...state.archivedPaymentLinks, id],
  };
  emit();
}

/** Rebinds a shortcut. Passing null restores the one that shipped. */
export function setShortcut(id: string, keys: string[] | null): void {
  const next = { ...state.keymap };
  if (keys === null) delete next[id];
  else next[id] = keys;
  state = { ...state, keymap: next };
  emit();
}

/** How long a surrendered handle is held before anybody else can take it. */
export const HANDLE_GRACE_MS = 60_000;

/** The handle a profile answers to, falling back to the first one held. */
export function activeHandleFor(spaceId: string): string {
  return state.activeHandle[spaceId] ?? state.handles[0] ?? "";
}

/** Adds a handle to the portfolio and points the given profile at it. */
export function addHandle(handle: string, spaceId: string): void {
  const next = handle.trim().toLowerCase().replace(/^@/, "");
  if (state.handles.includes(next)) {
    state = { ...state, activeHandle: { ...state.activeHandle, [spaceId]: next } };
    emit();
    return;
  }
  state = {
    ...state,
    handles: [...state.handles, next],
    activeHandle: { ...state.activeHandle, [spaceId]: next },
  };
  emit();
}

/** Points a profile at a handle already held. */
export function setHandleFor(spaceId: string, handle: string): void {
  state = { ...state, activeHandle: { ...state.activeHandle, [spaceId]: handle } };
  emit();
}

/**
 * Gives a handle up, into its grace window.
 *
 * Refuses the last one. A key with no name is reachable by nobody, and an
 * interface that lets somebody do that by accident is one that will.
 */
export function releaseHandleFrom(handle: string, now: number): void {
  if (state.handles.length <= 1) return;
  const handles = state.handles.filter((entry) => entry !== handle);
  const activeHandle = { ...state.activeHandle };
  for (const [spaceId, active] of Object.entries(activeHandle)) {
    if (active === handle) activeHandle[spaceId] = handles[0]!;
  }
  const listed = { ...state.listedForSale };
  delete listed[handle];
  state = {
    ...state,
    handles,
    activeHandle,
    listedForSale: listed,
    previousHandle: { handle, releasesAt: now + HANDLE_GRACE_MS },
  };
  emit();
}

/** Offers a handle for sale, or withdraws the offer when price is null. */
export function listHandle(handle: string, priceUsd: number | null): void {
  const listed = { ...state.listedForSale };
  if (priceUsd === null) delete listed[handle];
  else listed[handle] = priceUsd;
  state = { ...state, listedForSale: listed };
  emit();
}

/** Takes a surrendered handle back, free, while the window is still open. */
export function reclaimHandle(now: number): void {
  const previous = state.previousHandle;
  if (!previous || previous.releasesAt <= now) return;
  state = {
    ...state,
    handles: [...state.handles, previous.handle],
    previousHandle: null,
  };
  emit();
}

/** Lets the window lapse, so the name is genuinely gone. */
export function releaseHandle(): void {
  state = { ...state, previousHandle: null };
  emit();
}

/** Links or unlinks a social account. */
export function setLinked(id: string, attestedAt: string | null): void {
  state = { ...state, linked: { ...state.linked, [id]: attestedAt } };
  emit();
}

/** Drops a per-origin exception, returning that origin to the default. */
export function removeException(origin: string, capability: CapabilityId): void {
  state = {
    ...state,
    exceptions: state.exceptions.filter(
      (entry) => !(entry.origin === origin && entry.capability === capability),
    ),
  };
  emit();
}
