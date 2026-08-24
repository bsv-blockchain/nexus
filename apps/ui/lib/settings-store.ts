"use client";

/**
 * Everything Settings can change, in one place.
 *
 * Same module-store shape as {@link file://./command-effects.ts}: a value read
 * through `useSyncExternalStore` and a server snapshot that matches the
 * prerender.
 *
 * It is written to `localStorage`, because a preference that forgets itself on
 * every reload is not a preference. That does mean the store now remembers
 * answers this build cannot act on — a camera set to "block" is a note, not a
 * policy, since nothing here holds a camera. Better a note that survives than
 * a switch that lies about being a switch by resetting itself.
 *
 * The point of keeping it in one store rather than in each panel's `useState` is
 * that several of these are read outside the panel that sets them. Developer
 * tools open a panel in Browse; the permission defaults decide what a site
 * prompt says. A setting whose only reader is the switch that sets it is not a
 * setting, it is a light.
 */

import { setTimelineListed } from "@/lib/data";
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
/** Where the open tabs are drawn. */
export type TabLayout = "horizontal" | "vertical";

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
  /**
   * Whether tabs run across the top of the page or down the library column.
   *
   * A layout rather than a preference about ornament: horizontal moves the open
   * tabs OUT of the sidebar and into a strip above the viewport, so the two
   * modes must never both draw the list — a tab in two places is two tabs as
   * far as anybody clicking is concerned. Spaces, folders and bookmarks stay in
   * the column either way; only the tab list moves.
   */
  tabLayout: TabLayout;
  /**
   * Whether Browse is a pinned button rather than one of your apps.
   *
   * On, it leaves the app section of the rail and sits under Workspaces with
   * the other things that are part of the client rather than installed into
   * it — which is what browsing actually is here. Off, it is an app like any
   * other and appears wherever it is connected.
   *
   * The two are exclusive on purpose: Browse in the pinned block AND in the
   * app list is one thing with two doors, and the second door teaches that
   * they are different places.
   */
  browseAsButton: boolean;
  /**
   * Whether Workspaces has a button at the top of the rail.
   *
   * Off by default, which is not the same as saying workspaces are hidden. The
   * list of them is already in the column beside the rail, every one of them
   * carries its own menu, and the desktop shell now names them along its top
   * strip. A rail button on top of all that is a fourth door onto a room most
   * people only visit to add a second workspace.
   *
   * Kept as a setting rather than removed, because somebody who lives in four
   * workspaces at once wants it exactly where it was.
   */
  workspacesInRail: boolean;
  /**
   * Whether the Timeline is an app rather than only the home screen.
   *
   * Off by default, which is the shape it has always had: a view with no icon,
   * reached from Workspaces and from Home. On, it becomes a listing like any
   * other — a tile on the rail, a card in the store, a row in a workspace's
   * connections — and therefore something that can be disconnected. Which is
   * the point: the screen you land on should be a choice, and it cannot be one
   * while the only way to it is a view nothing can remove.
   *
   * @see lib/data/index.ts `setTimelineListed` — how the catalogue learns
   */
  timelineAsApp: boolean;

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
   * and Personal wearing the same name defeats having both. That is also why
   * it is exclusive: a handle is one identity, and two profiles answering to it
   * is the exact thing the separation exists to prevent.
   *
   * A profile missing from this map has no handle rather than falling back to
   * the first one held. Falling back meant a profile made a second ago arrived
   * already wearing somebody's name, which is both untrue and the one state
   * exclusivity cannot survive — every new profile would collide with the
   * oldest one.
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
  // Horizontal is the shipping default: a strip above the page is what a person
  // arriving from another browser expects to find, and the column is then free
  // to be a library rather than a tab list with bookmarks underneath it.
  tabLayout: "horizontal",
  // On by default: browsing is what this client is, not an app you added.
  browseAsButton: true,
  // Off by default. See the field above for why a button nobody asked for is
  // not the same thing as a feature nobody can reach.
  workspacesInRail: false,
  // See the field above. Off is the behaviour every install has had until now.
  timelineAsApp: false,

  autofillAddresses: true,
  autofillCards: false,
  preferKeySignIn: true,
  offerToSavePasswords: false,

  revokedConnections: [],
  archivedPaymentLinks: [],
  keymap: {},
  handles: ["crumbs", "breadcrumbs"],
  /* The shipped profiles wear one each. A prototype where both answer to the
     same name demonstrates nothing about why a profile has a handle, and with
     the fallback gone something has to say what they start as. Space ids are
     written out rather than derived, the same way wallets-store seeds its two —
     see lib/data/spaces.ts. */
  activeHandle: { "space-my-hub": "crumbs", "space-work": "breadcrumbs" },
  listedForSale: {},
  avatar: null,
  previousHandle: null,
  linked: {},

  devTools: false,
  overlayInspector: false,
  unsignedRepos: false,

  updateChannel: "stable",
};

/**
 * Where it is kept, and which shape is kept there.
 *
 * Versioned so that a rename or a retyped field is a discarded blob rather than
 * a crash on somebody's next launch: an unrecognised version is dropped and the
 * defaults stand. Bump it when a field changes meaning, not when one is added —
 * added fields are handled by `restore` merging over the defaults.
 */
const STORE_KEY = "nexus.settings";
const STORE_VERSION = 1;

/**
 * Saved settings, laid over the defaults.
 *
 * The two permission maps are merged key by key rather than replaced, so a
 * capability added after somebody last saved arrives with its default instead
 * of as `undefined` — which every reader of those maps would then have to guard
 * against forever.
 */
function restore(saved: Partial<SettingsState>): SettingsState {
  return {
    ...INITIAL,
    ...saved,
    capabilities: { ...INITIAL.capabilities, ...(saved.capabilities ?? {}) },
    walletCapabilities: {
      ...INITIAL.walletCapabilities,
      ...(saved.walletCapabilities ?? {}),
    },
    /* Merged for the same reason the permission maps are: absence used to mean
       "the first handle" and now means "none", so a blob saved before the
       seeded profiles were written down would leave them nameless. What
       somebody actually chose still wins. */
    activeHandle: { ...INITIAL.activeHandle, ...(saved.activeHandle ?? {}) },
  };
}

function load(): SettingsState {
  /* Undefined during the prerender, which is the whole reason
     `getSettingsServerSnapshot` exists — see the note on it below. */
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw) as {
      v?: number;
      state?: Partial<SettingsState>;
    };
    if (saved.v !== STORE_VERSION || !saved.state) return INITIAL;
    return restore(saved.state);
  } catch {
    /* Corrupt, or storage that refuses to be read. The defaults are always a
       valid answer, and a settings store that throws takes the app with it. */
    return INITIAL;
  }
}

function write(value: SettingsState): boolean {
  try {
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ v: STORE_VERSION, state: value }),
    );
    return true;
  } catch {
    return false;
  }
}

function save(): void {
  if (typeof window === "undefined") return;
  if (write(state)) return;
  /*
   * One retry without the avatar.
   *
   * It is the only field here that can be megabytes — a data URL rather than a
   * reference — so it is also the only one that can push the whole blob past
   * the quota. Dropping it costs a picture; not retrying would silently stop
   * saving every other setting for as long as that picture is set, which is the
   * kind of failure nobody would connect back to uploading an avatar.
   */
  write({ ...state, avatar: null });
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Coalesced, because some of these are dragged rather than clicked.
 *
 * A zoom stepper held down emits on every frame, and serialising the whole
 * store sixty times a second to record a number that is still moving is work
 * for nothing. The flush below is what makes the delay safe.
 */
function scheduleSave(): void {
  if (typeof window === "undefined") return;
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 150);
}

if (typeof window !== "undefined") {
  /* `pagehide` rather than `beforeunload`: it fires on the paths that one
     misses, including a tab being frozen on mobile, and it does not block the
     unload. Without it, a setting changed in the last 150ms of a session is a
     setting that was never really changed. */
  window.addEventListener("pagehide", () => {
    if (saveTimer === null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    save();
  });
}

let state: SettingsState = load();
/* Once at module load, for the value that came back from storage. `emit` covers
   every change after this, but nothing has emitted yet. */
setTimelineListed(state.timelineAsApp);
const listeners = new Set<() => void>();

/**
 * Notify, and remember.
 *
 * Saving lives here rather than in each setter because every mutation in this
 * file already ends by calling it, and there are two dozen of them. A setter
 * added later gets persistence by doing the one thing it has to do anyway.
 */
function emit(): void {
  scheduleSave();
  /* The catalogue is a plain function with no way to subscribe, so it is told
     rather than asked. Here rather than in the setter, so a value restored from
     storage lands as well as one somebody just changed. */
  setTimelineListed(state.timelineAsApp);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettings(): SettingsState {
  return state;
}

/**
 * What the prerender saw, which is never what storage holds.
 *
 * React renders the hydration pass from this and then re-reads `getSettings`,
 * so restored settings arrive one render later instead of tearing the HTML.
 * Returning the live state here would make the server's markup and the client's
 * first paint disagree for anybody who has ever changed a setting.
 */
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

/** The handle a profile answers to, or "" where it has none yet. */
export function activeHandleFor(spaceId: string): string {
  return state.activeHandle[spaceId] ?? "";
}

/**
 * The profile already wearing a handle, if it is not this one.
 *
 * The question every caller actually asks — "would taking this cost somebody
 * else theirs?" — and the answer both controls need to say so out loud, since
 * "Work has it" is what turns connecting a handle from a switch into a
 * decision. Taking it is allowed; taking it silently is not.
 */
export function handleHeldElsewhere(
  handle: string,
  spaceId: string,
): string | undefined {
  return Object.entries(state.activeHandle).find(
    ([entry, worn]) => entry !== spaceId && worn === handle,
  )?.[0];
}

/**
 * The map with one handle worn by one profile and nobody else.
 *
 * The exclusivity rule, in the one place both ways of connecting a handle go
 * through. Enforced by the store rather than by whichever view happens to be
 * rendering, because an invariant kept in the views lasts until somebody adds
 * a third view.
 */
function wearing(handle: string, spaceId: string): Record<string, string> {
  const next = { ...state.activeHandle };
  for (const [entry, worn] of Object.entries(next)) {
    if (worn === handle) delete next[entry];
  }
  next[spaceId] = handle;
  return next;
}

/** Adds a handle to the portfolio and points the given profile at it. */
export function addHandle(handle: string, spaceId: string): void {
  const next = handle.trim().toLowerCase().replace(/^@/, "");
  state = {
    ...state,
    handles: state.handles.includes(next)
      ? state.handles
      : [...state.handles, next],
    activeHandle: wearing(next, spaceId),
  };
  emit();
}

/**
 * Takes a profile's handle off it, leaving it with none.
 *
 * The other half of `setHandleFor`. A handle is the name a profile answers to,
 * and there has to be a way back to answering to nothing — otherwise the only
 * route out of a handle you did not mean to connect is to connect a different
 * one, which is not the same thing.
 */
export function clearHandleFor(spaceId: string): void {
  if (!(spaceId in state.activeHandle)) return;
  const { [spaceId]: _gone, ...rest } = state.activeHandle;
  state = { ...state, activeHandle: rest };
  emit();
}

/**
 * Forgets the handles of profiles that no longer exist.
 *
 * Settings survive a reload and profiles do not, so a profile made in one
 * session leaves its handle claimed by an id nothing answers to any more — and
 * because the claim is exclusive, that handle would be locked out of every
 * profile forever, greyed with the name of nowhere. Reconciled by the one part
 * of the app that knows which profiles are real; see hub-provider.
 */
export function pruneHandlesTo(liveSpaceIds: string[]): void {
  const live = new Set(liveSpaceIds);
  const stale = Object.keys(state.activeHandle).filter((id) => !live.has(id));
  if (stale.length === 0) return;
  const activeHandle = { ...state.activeHandle };
  for (const id of stale) delete activeHandle[id];
  state = { ...state, activeHandle };
  emit();
}

/**
 * Points a profile at a handle already held, taking it off whoever had it.
 *
 * Always a move, never a copy: a handle is one identity, so connecting it
 * somewhere is the same act as disconnecting it from where it was. The profile
 * it came from is left with none rather than handed the next name along — see
 * the note on `activeHandle` for why that is the safer of the two.
 *
 * It moves without asking because it is not the thing that asks. The two
 * controls that call it — the profile column's picker and Identity's handle
 * list — put the consequence in front of somebody first, since "@crumbs is on
 * Work" is only a surprise if you find out afterwards.
 */
export function setHandleFor(spaceId: string, handle: string): void {
  state = { ...state, activeHandle: wearing(handle, spaceId) };
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
  /* Left with no handle rather than handed the next one along. Moving them all
     to `handles[0]` was how one release could put three profiles on one name,
     and it also decided on somebody's behalf which identity a profile should
     wear next — which is the one choice this control has no business making. */
  for (const [spaceId, active] of Object.entries(activeHandle)) {
    if (active === handle) delete activeHandle[spaceId];
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
