"use client";

import { AppTile, SiteTile } from "@/components/hub/app-icon";
import { Favicon } from "@/components/hub/favicon";
import { MobileAppSheet } from "@/components/hub/mobile-app-sheet";
import { hasContextSidebar } from "@/components/hub/app-context-sidebar";
import { GroupSettingsDialog } from "@/components/hub/group-settings-dialog";
import { getEssentialAppSlugs } from "@/lib/data";
import { OriginChip } from "@/components/hub/origin-chip";
import { SpaceIcon } from "@/components/hub/space-icon";
import { homeView } from "@/lib/home-view";
import { requestNewWorkspace } from "@/lib/workspace-request";
import { useScrollDirection } from "@/lib/scroll-direction";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { openSearch } from "@/lib/timeline-store";
import {
  useHub,
  type AppSlug,
  type RailEntry,
  type RailRef,
} from "@/components/hub/hub-provider";
import {
  content,
  getHubApp,
  getHubApps,
  getMockPage,
  type BrowserTab,
  type HubApp,
} from "@/lib/data";
import { refKey } from "@/lib/rail/layout";
import type { PinnedSite } from "@/lib/rail/sites";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { HelpSheet } from "@/components/hub/help-circle";
import { content as allContent } from "@/lib/data";
import { isPinnableUrl, shortNameFor } from "@/lib/rail/origin";
import { useSettings } from "@/lib/settings-store";
import { useHostOverlay } from "@/lib/wallet-data";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Folder,
  Gift,
  Globe,
  House,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Link2,
  Mic,
  Monitor,
  Pin,
  Plus,
  RotateCw,
  Search,
  Settings,
  Share,
  SquarePlus,
  TextSearch,
  Type,
  type LucideIcon,
  VenetianMask,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { normalizeUrl } from "@/lib/tabs";

const spring = { type: "spring", damping: 32, stiffness: 340 } as const;

/** Pointer travel that turns a tap on the tab switcher into a scrub, in px. */
const TAP_SLOP = 8;

/**
 * A URL with the parts nobody reads removed.
 *
 * The scheme and a trailing slash are noise in a pill that has room for about
 * forty characters, and dropping them buys back eight of them without dropping
 * anything that identifies the page.
 */
function bareUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

/** A small faux "web page" thumbnail used in the bottom-bar tab stack. */
function PageThumb({
  tab,
  className = "",
}: {
  tab: BrowserTab;
  className?: string;
}): ReactNode {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[7px] bg-white ring-1 ring-black/10 dark:bg-neutral-100 ${className}`}
    >
      <div
        className="flex h-1.5 items-center gap-0.5 px-1"
        style={{ backgroundColor: tab.faviconColor }}
      />
      <div className="flex-1 space-y-0.5 p-1">
        <div className="h-0.5 w-3/4 rounded-full bg-neutral-300" />
        <div className="h-0.5 w-full rounded-full bg-neutral-200" />
        <div className="h-0.5 w-2/3 rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

/** Two stacked, rotated tab previews that open the tab switcher. */
function TabStack({
  tabs,
  onOpen,
}: {
  tabs: BrowserTab[];
  onOpen: () => void;
}): ReactNode {
  const recent = tabs.slice(-2);
  const front = recent[recent.length - 1];
  const back = recent.length > 1 ? recent[0] : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={content.mobileBrowser.openTabs}
      className="focus-ring relative size-11 shrink-0 rounded-xl"
    >
      {back && (
        <PageThumb
          tab={back}
          className="absolute inset-0 size-9 -rotate-12 shadow-md"
        />
      )}
      {front ? (
        <PageThumb
          tab={front}
          className="absolute inset-0 top-0.5 left-1 size-9 rotate-6 shadow-lg"
        />
      ) : (
        <span className="bg-surface-raised text-muted-foreground ring-border absolute inset-0 flex items-center justify-center rounded-lg text-[10px] font-semibold ring-1">
          0
        </span>
      )}
    </button>
  );
}

/**
 * Floating bottom bar: app-rail · new-tab pill · tab stack + page-options.
 *
 * `site` strips it back to the app-like bar a pinned site opens with. The
 * new-tab pill is a URL bar (it opens the address sheet) and the tab stack is a
 * tab strip, and the spec says a site has neither; both go.
 *
 * What stays is the rail button and page-options, for two different reasons.
 * The rail is the only way off a site on this form factor — there is no window
 * chrome behind it and no tab strip to fall back to — so removing the whole bar
 * would strand the user on the page. Page-options stays because Back, Forward,
 * Copy link and Share have nowhere else to live here, and because it is chrome
 * the user asks for rather than chrome the site opens with: the same bargain a
 * standalone PWA makes with the platform's own overflow menu.
 *
 * And `origin` fills the cell the address pill vacated. A site has no address
 * bar anywhere, so something has to name the origin; it used to be a row above
 * the page, which cost page height on the one form factor with none to spare.
 * Here it costs nothing — the middle cell was already being held open as
 * `aria-hidden` filler to stop the side buttons drifting.
 */
function BottomBar({
  tabs,
  site,
  origin,
  onRail,
  onSwitcher,
  onAddress,
  onDetails,
  detailsLabel,
  timeline = false,
}: {
  tabs: BrowserTab[];
  site: boolean;
  /** The active site's origin chip, or null when the canvas is not a site. */
  origin: ReactNode;
  onRail: () => void;
  onSwitcher: () => void;
  onAddress: () => void;
  onDetails: () => void;
  /**
   * The Timeline has the canvas.
   *
   * The centre control is "what does this button open next" rather than a fixed
   * new-tab: on a timeline the useful next thing is search, and a plus that
   * opened a browser tab from a feed would be answering a question nobody asked
   * there.
   */
  timeline?: boolean;
  /** what the chevron is about, which is the page or the app it is over */
  detailsLabel: string;
}): ReactNode {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={spring}
      // The browse pane measures this bar to decide where the native webview stops.
      // A native layer paints ABOVE this document, so anything it overlaps is gone,
      // not merely dimmed — the tab rect has to end exactly where this bar begins.
      data-nexus-browse-bar=""
      /*
       * Equal thirds while browsing, so the new-tab pill sits dead centre between
       * a one-button left and a two-button right. For a site the middle column
       * takes the slack instead: it holds a hostname that must not be elided, and
       * a third of a phone is not enough for one. Safe there and not while
       * browsing, because a site's two side controls are the same width as each
       * other, so "the slack" is still centred.
       */
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 grid items-center border-t border-black/5 bg-white/70 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-neutral-900/60 ${
        site ? "grid-cols-[auto_minmax(0,1fr)_auto] gap-3" : "grid-cols-3"
      }`}
    >
      <button
        type="button"
        onClick={onRail}
        aria-label={content.mobileBrowser.appRail}
        className="focus-ring bg-surface-raised/95 ring-border pointer-events-auto flex size-11 items-center justify-center justify-self-start rounded-full shadow-lg ring-1 backdrop-blur transition-transform active:scale-95"
      >
        <LayoutGrid className="text-foreground size-5" aria-hidden="true" />
      </button>
      {/* Never a missing cell: this is a three-column grid, and a dropped child
          would let the right-hand group slide into the middle — moving the two
          buttons a site DOES keep out from under the thumb that already knows
          where they are. For a site the cell now carries the origin chip; the
          `aria-hidden` span is only the fallback for a site whose tab has gone. */}
      {site ? (
        (origin ?? <span aria-hidden="true" />)
      ) : (
        <button
          type="button"
          onClick={timeline ? openSearch : onAddress}
          aria-label={
            timeline
              ? content.timeline.rail.search
              : content.mobileBrowser.newTab
          }
          className="focus-ring bg-surface-raised/95 ring-border pointer-events-auto flex h-11 w-28 items-center justify-center justify-self-center rounded-full shadow-lg ring-1 backdrop-blur transition-transform active:scale-95"
        >
          {timeline ? (
            <Search className="text-foreground size-5" aria-hidden="true" />
          ) : (
            <Plus className="text-foreground size-5" aria-hidden="true" />
          )}
        </button>
      )}
      <div className="pointer-events-auto flex items-center gap-3 justify-self-end">
        {!site && <TabStack tabs={tabs} onOpen={onSwitcher} />}
        <button
          type="button"
          onClick={onDetails}
          aria-label={detailsLabel}
          className="focus-ring bg-surface-raised/95 ring-border flex size-11 items-center justify-center rounded-full shadow-lg ring-1 backdrop-blur transition-transform active:scale-95"
        >
          <ChevronUp className="text-foreground size-5" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * What the bottom bar shrinks to once you start reading.
 *
 * A bar with five targets is worth its height when somebody is navigating and
 * is in the way when they are reading, which is most of the time. So it leaves
 * on the way down and this takes its place: one line saying where you are, at
 * a size that answers the question the bar was answering incidentally and
 * nothing else.
 *
 * It is a button rather than a label because a thing that replaced your
 * navigation has to be able to give it back — scrolling up works too, but that
 * is a gesture somebody has to guess at, and this is the one that is visible.
 *
 * Browse gets the tab it is on rather than the word "Browse": a browser's
 * answer to "where am I" is the page, and the mod name is the one thing on
 * screen already.
 */
function ContextPill({
  onExpand,
  tabs,
}: {
  onExpand: () => void;
  tabs: BrowserTab[];
}): ReactNode {
  const { activeApp, activeTabId } = useHub();
  const tab = tabs.find((entry) => entry.id === activeTabId) ?? null;
  const app = activeApp ? getHubApp(activeApp) : undefined;
  const onBrowser = activeApp === "browser" && Boolean(tab);

  return (
    <motion.div
      initial={{ y: 64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 64, opacity: 0 }}
      transition={spring}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label={content.mobileBrowser.showBar}
        className="focus-ring bg-surface-raised/95 ring-border pointer-events-auto flex max-w-[80%] items-center gap-2 rounded-full py-2 pr-4 pl-2 shadow-lg ring-1 backdrop-blur transition-transform active:scale-95"
      >
        {onBrowser && tab ? (
          <>
            <Favicon
              url={tab.url}
              letter={tab.favicon}
              color={tab.faviconColor}
              size={22}
              rounded="rounded-md"
            />
            <span className="text-foreground min-w-0 truncate text-[13px] font-medium">
              {bareUrl(tab.url)}
            </span>
          </>
        ) : (
          <>
            {app ? (
              <AppTile app={app} size={22} />
            ) : (
              <LayoutGrid className="size-5.5" aria-hidden="true" />
            )}
            <span className="text-foreground min-w-0 truncate text-[13px] font-medium">
              {app?.name ?? content.library.apps.title}
            </span>
          </>
        )}
      </button>
    </motion.div>
  );
}

/** Dark matte + upward-sliding sheet shell shared by the page-options and address sheets. */
function SheetShell({
  onClose,
  children,
  dark = false,
}: {
  onClose: () => void;
  children: ReactNode;
  dark?: boolean;
}): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <motion.button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={spring}
        className={`relative rounded-t-[28px] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl ${
          dark
            ? "bg-neutral-900 text-neutral-100"
            : "bg-surface-raised text-foreground"
        }`}
      >
        <div
          className={`mx-auto mb-3 h-1 w-9 rounded-full ${
            dark ? "bg-white/20" : "bg-border"
          }`}
          aria-hidden="true"
        />
        {children}
      </motion.div>
    </div>
  );
}

/** Page-options sheet: address pill + quick actions + display / site settings. */
function UrlDetailsSheet({
  onClose,
  onOpenAddress,
  onOpenHelp,
}: {
  onClose: () => void;
  onOpenAddress: () => void;
  onOpenHelp: () => void;
}): ReactNode {
  const {
    activeTab,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    navigateActiveTab,
    addFavoriteFromTab,
    openShare,
    pinSite,
    pinnedSites,
  } = useHub();
  const copy = content.mobileBrowser;
  const host = activeTab ? hostOf(activeTab.url) : "";

  const copyLink = (): void => {
    if (!activeTab) return;
    try {
      void navigator.clipboard?.writeText(activeTab.url);
    } catch {
      // clipboard unavailable
    }
    toast.success("Link copied", { description: host });
  };

  /*
   * This page, on the rail as an app.
   *
   * The same act the App Store performs when you connect a web listing —
   * pinning the URL — reached from the page itself, which is where somebody
   * who has just found something wants it. It took the slot Summarize held,
   * which raised a "coming soon" toast and nothing else.
   */
  const addToRail = (): void => {
    if (!activeTab) return;
    const settings = content.browserSettings;
    if (!isPinnableUrl(activeTab.url)) {
      toast.error(settings.addToRailRefused);
      return;
    }
    const name = shortNameFor(activeTab.title, activeTab.url);
    const already = pinnedSites.some((site) => site.url === activeTab.url);
    const site = pinSite(activeTab.url, name);
    onClose();
    if (!site) {
      toast.error(settings.addToRailRefused);
      return;
    }
    toast.success(
      already ? settings.addToRailAlready : settings.addToRailDone,
      { description: name }
    );
  };

  /*
   * Find on Page is demo-only.
   *
   * It does nothing: it just closes the sheet, which looks like it worked. It
   * stays in the demo, where the grid of four is the point; a shipping build
   * shows the three that are real rather than four where one answers nothing.
   */
  const actions: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    ...(DEMO_SURFACES
      ? [{ label: copy.actions.findOnPage, icon: TextSearch, onClick: onClose }]
      : []),
    {
      label: content.browserSettings.addToRail,
      icon: SquarePlus,
      onClick: addToRail,
    },
    {
      label: copy.actions.pin,
      icon: Pin,
      onClick: () => {
        if (activeTab) addFavoriteFromTab(activeTab.id);
        onClose();
      },
    },
    {
      label: copy.actions.share,
      icon: Share,
      onClick: () => {
        openShare();
        onClose();
      },
    },
  ];

  return (
    <SheetShell onClose={onClose}>
      {/* Address pill */}
      <div className="bg-surface ring-border flex items-center gap-1 rounded-full px-2 py-1.5 ring-1">
        <button
          type="button"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={goBack}
          className="focus-ring text-muted-foreground rounded-full p-1.5 disabled:opacity-30"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={goForward}
          className="focus-ring text-muted-foreground rounded-full p-1.5 disabled:opacity-30"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenAddress}
          className="focus-ring min-w-0 flex-1 truncate px-2 text-center text-sm font-semibold"
        >
          {host || copy.search}
        </button>
        <button
          type="button"
          aria-label="Copy link"
          onClick={copyLink}
          className="focus-ring text-muted-foreground rounded-full p-1.5"
        >
          <Link2 className="size-4.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Reload"
          onClick={() => activeTab && navigateActiveTab(activeTab.url)}
          className="focus-ring text-muted-foreground rounded-full p-1.5"
        >
          <RotateCw className="size-4.5" aria-hidden="true" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="focus-ring flex flex-col items-center gap-1.5"
          >
            <span className="bg-surface ring-border flex aspect-square w-full items-center justify-center rounded-2xl ring-1">
              <action.icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-muted-foreground text-[11px]">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Help sits outside the demo gate below, because it is the one row here
          that does something: on a phone there is no floating "?" to reach the
          same menu from, so this is the only way to it. */}
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={onOpenHelp}
          className="focus-ring bg-surface ring-border flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ring-1"
        >
          <LifeBuoy
            className="text-muted-foreground size-5"
            aria-hidden="true"
          />
          <span className="flex-1 text-left">{allContent.help.label}</span>
          <ChevronRight
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Rows. Both are demo-only: neither has anything behind it yet, and a row
          whose whole behaviour is a toast is a promise the build cannot keep. */}
      {DEMO_SURFACES ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => toast.info("Display options coming soon")}
            className="focus-ring bg-surface ring-border flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ring-1"
          >
            <Type className="text-muted-foreground size-5" aria-hidden="true" />
            <span className="flex-1 text-left">{copy.displayOptions}</span>
            <ChevronRight
              className="text-muted-foreground size-4"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => toast.info("Site settings coming soon")}
            className="focus-ring bg-surface ring-border flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ring-1"
          >
            <Settings
              className="text-muted-foreground size-5"
              aria-hidden="true"
            />
            <span className="flex-1 text-left">{copy.siteSettings}</span>
          </button>
        </div>
      ) : null}
    </SheetShell>
  );
}

/** A single recent-tab row in the address sheet. */
function RecentRow({
  tab,
  pinned,
  onOpen,
  onTogglePin,
  dark,
}: {
  tab: BrowserTab;
  pinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  dark: boolean;
}): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
      >
        <Favicon
          url={tab.url}
          letter={tab.favicon}
          color={tab.faviconColor}
          size={26}
          rounded="rounded-md"
        />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
          {tab.title}
        </span>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={pinned ? "Unpin" : "Pin"}
        aria-pressed={pinned}
        className={`focus-ring shrink-0 rounded-full p-1.5 ${
          pinned
            ? "text-accent"
            : dark
              ? "text-white/35"
              : "text-muted-foreground/50"
        }`}
      >
        <Pin
          className="size-4"
          aria-hidden="true"
          fill={pinned ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}

/** Address / new-tab sheet: search field, incognito toggle, recent tabs. */
function AddressSheet({
  onClose,
  incognito,
  onToggleIncognito,
}: {
  onClose: () => void;
  incognito: boolean;
  onToggleIncognito: () => void;
}): ReactNode {
  const {
    activeSpaceId,
    tabsBySpace,
    createTab,
    openTab,
    favorites,
    addFavoriteFromTab,
    removeFavorite,
  } = useHub();
  const copy = content.mobileBrowser;
  const spaceTabs = tabsBySpace[activeSpaceId] ?? [];
  const tabs = [...spaceTabs].reverse();
  const favByUrl = new Map(favorites.map((f) => [f.url, f.id]));
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search field as soon as the sheet opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (raw: string): void => {
    const value = raw.trim();
    if (!value) return;
    // Reuse an already-open tab when the domain matches; otherwise open one.
    // Free-text searches all share one host, so they always open fresh.
    const targetHost = hostOf(normalizeUrl(value));
    const isSearch = targetHost === "search.nexus.example";
    const existing = isSearch
      ? undefined
      : spaceTabs.find((tab) => hostOf(tab.url) === targetHost);
    if (existing) openTab(existing.id);
    else createTab(value);
    onClose();
  };

  return (
    <SheetShell onClose={onClose} dark={incognito}>
      <div
        className={`flex items-center gap-2 rounded-2xl px-4 py-3 ring-1 ${
          incognito ? "bg-white/10 ring-white/10" : "bg-surface ring-border"
        }`}
      >
        <input
          ref={inputRef}
          placeholder={copy.search}
          aria-label={copy.search}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit(event.currentTarget.value);
          }}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[17px] outline-none"
        />
        {incognito && (
          <span className="text-muted-foreground text-sm">
            {copy.incognito}
          </span>
        )}
        <button
          type="button"
          aria-label="Voice search"
          className="focus-ring text-muted-foreground shrink-0 rounded-full p-1"
        >
          <Mic className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggleIncognito}
          aria-label={copy.incognito}
          aria-pressed={incognito}
          className={`focus-ring shrink-0 rounded-full p-1 ${
            incognito ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <VenetianMask className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 max-h-[46dvh] overflow-y-auto">
        {incognito ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <VenetianMask
              className="text-muted-foreground size-8"
              aria-hidden="true"
            />
            <p className="text-lg font-semibold">{copy.incognitoTitle}</p>
            <p className="text-muted-foreground max-w-xs text-sm">
              {copy.incognitoHint}
            </p>
          </div>
        ) : tabs.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {copy.noTabs}
          </p>
        ) : (
          <div className="divide-border/60 divide-y">
            {tabs.map((tab) => {
              const favId = favByUrl.get(tab.url);
              return (
                <RecentRow
                  key={tab.id}
                  tab={tab}
                  pinned={favId !== undefined}
                  dark={incognito}
                  onOpen={() => {
                    openTab(tab.id);
                    onClose();
                  }}
                  onTogglePin={() =>
                    favId ? removeFavorite(favId) : addFavoriteFromTab(tab.id)
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </SheetShell>
  );
}

/** One card in the cover-flow tab switcher; transforms follow the shared drag value. */
function SwitcherCard({
  tab,
  index,
  center,
  spacing,
  drag,
  isActive,
}: {
  tab: BrowserTab;
  index: number;
  center: number;
  spacing: number;
  drag: MotionValue<number>;
  isActive: boolean;
}): ReactNode {
  // Effective distance from the centered position, tracking live drag.
  const offset = useTransform(drag, (dx) => index - center - dx / spacing);
  const x = useTransform(offset, (o) => o * spacing);
  const scale = useTransform(
    offset,
    (o) => 1 - Math.min(Math.abs(o) * 0.14, 0.55)
  );
  const opacity = useTransform(
    offset,
    (o) => 1 - Math.min(Math.abs(o) * 0.32, 0.85)
  );
  const rotateY = useTransform(offset, (o) =>
    Math.max(-32, Math.min(32, -o * 16))
  );
  const zIndex = useTransform(
    offset,
    (o) => 100 - Math.round(Math.abs(o) * 10)
  );
  const page = getMockPage(tab.url);

  return (
    // The id is carried on the DOM node because the gesture surface stacked
    // over the deck hit-tests taps against these cards: it has no way to know
    // from React state which card the finger actually landed on, since every
    // card's painted position comes from a live transform.
    <motion.div
      data-tab-id={tab.id}
      style={{ x, scale, opacity, rotateY, zIndex }}
      className="absolute h-[62dvh] w-[76%] max-w-sm origin-center"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white text-neutral-900 shadow-2xl ring-1 ring-black/10">
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ backgroundColor: `${tab.faviconColor}14` }}
        >
          <Favicon
            url={tab.url}
            letter={tab.favicon}
            color={tab.faviconColor}
            size={20}
            rounded="rounded-md"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-500">
            {hostOf(tab.url)}
          </span>
          {isActive && (
            <span
              className="bg-accent size-2 rounded-full"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <h3 className="text-lg font-bold text-balance">
            {page?.heading ?? tab.title}
          </h3>
          {page?.body && (
            <p className="mt-2 line-clamp-6 text-sm leading-relaxed text-neutral-600">
              {page.body}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Full-screen cover-flow tab switcher with its own bottom control bar. */
function TabSwitcher({
  tabs,
  activeTabId,
  onPick,
  onNewTab,
  onSettings,
  onHub,
  onClose,
}: {
  tabs: BrowserTab[];
  activeTabId: string | null;
  onPick: (tabId: string) => void;
  onNewTab: () => void;
  /**
   * Absent where the destination is demo-only, and the button goes with it —
   * the same shape the wallet's docked actions use. A control that opens a
   * screen made entirely of "coming soon" is worse than no control: it spends
   * the user's attention to tell them nothing.
   */
  onSettings?: (() => void) | undefined;
  onHub?: (() => void) | undefined;
  onClose: () => void;
}): ReactNode {
  const startIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTabId)
  );
  const [center, setCenter] = useState(startIndex);
  const drag = useMotionValue(0);
  // Fewer tabs fan out wide; many tabs pack in closer.
  const spacing = Math.max(120, Math.min(240, 720 / Math.max(tabs.length, 1)));
  const activeTitle = tabs[center]?.title ?? "";
  // The deck, not the gesture surface: the surface is elastically translated
  // mid-drag, so only this element gives stable screen coordinates.
  const deckRef = useRef<HTMLDivElement>(null);
  // Whether the current pointer gesture has travelled far enough to be a
  // scrub. motion/react does not swallow the click that follows a drag, so
  // without this the tap handler fires on top of onDragEnd and one scrub both
  // moves the deck and picks a tab.
  const scrubbed = useRef(false);

  const clamp = (i: number): number =>
    Math.max(0, Math.min(tabs.length - 1, i));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-background fixed inset-0 z-50 flex flex-col md:hidden"
    >
      {/* Centered tab title */}
      <div className="flex h-16 items-center justify-center px-10 pt-4">
        {tabs[center] && (
          <div className="flex items-center gap-2 truncate">
            <Favicon
              url={tabs[center].url}
              letter={tabs[center].favicon}
              color={tabs[center].faviconColor}
              size={20}
              rounded="rounded-md"
            />
            <span className="truncate text-[15px] font-semibold">
              {activeTitle}
            </span>
          </div>
        )}
      </div>

      {/* Cover-flow deck */}
      <div
        ref={deckRef}
        className="relative min-h-0 flex-1"
        style={{ perspective: 1200 }}
      >
        {/*
          The deck is a picture, not a control.

          Cards carry a z-index up to 100 so they stack in depth order, which
          put the centred one above the drag surface below — so a swipe started
          on the card it was aimed at hit the card instead, and dragging a
          paragraph is how a browser starts selecting text. Both complaints
          were the same bug. Input belongs to one layer; `select-none` means a
          long press on a headline does nothing rather than something wrong.

          The ref stays on the outer element: the tap-to-scrub hit test measures
          against the deck's own box, and that box is the one with perspective
          on it.
        */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
          {tabs.map((tab, i) => (
            <SwitcherCard
              key={tab.id}
              tab={tab}
              index={i}
              center={center}
              spacing={spacing}
              drag={drag}
              isActive={tab.id === activeTabId}
            />
          ))}
        </div>
        {tabs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">
              {content.mobileBrowser.noTabs}
            </p>
          </div>
        )}
        {/*
         * Drag + tap surface.
         *
         * It stacks ABOVE the cards, not beneath them. SwitcherCard sets a
         * z-index up to 100 and this deck is the stacking context (perspective
         * makes it one), so with this element at `auto` every card painted over
         * it and the 62dvh middle of the screen received no pointer events at
         * all: taps were swallowed and only the thin strips above and below the
         * cards could be dragged. One element owning the whole gesture is why
         * the tap below has to hit-test the cards by hand.
         */}
        {tabs.length > 0 && (
          <motion.div
            className="absolute inset-0 z-200 touch-pan-y select-none"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onPointerDown={() => {
              scrubbed.current = false;
            }}
            onDrag={(_, info) => {
              if (Math.abs(info.offset.x) > TAP_SLOP) scrubbed.current = true;
              drag.set(info.offset.x);
            }}
            onDragEnd={(_, info) => {
              const delta = Math.round(-info.offset.x / spacing);
              setCenter((c) => clamp(c + delta));
              drag.set(0);
            }}
            onClick={(event) => {
              if (scrubbed.current) return;
              // Ask the DOM which card is under the finger rather than deriving
              // it from `center`: the cards are transformed, so where they are
              // painted is the only truthful answer, and it is what makes a tap
              // on a visible off-centre card open that card.
              const card = document
                .elementsFromPoint(event.clientX, event.clientY)
                .map((el) => el.closest("[data-tab-id]"))
                .find((el): el is HTMLElement => el instanceof HTMLElement);
              if (card?.dataset.tabId) {
                onPick(card.dataset.tabId);
                return;
              }
              // Background either side of the deck steps it along. Measured
              // with clientX against the deck's own box — offsetX is relative to
              // this surface, which is still elastically translated when the
              // tap lands, so its thirds are not the screen's thirds.
              const rect = deckRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = event.clientX - rect.left;
              const third = rect.width / 3;
              if (x < third) setCenter((c) => clamp(c - 1));
              else if (x > third * 2) setCenter((c) => clamp(c + 1));
              else {
                const tab = tabs[center];
                if (tab) onPick(tab.id);
              }
            }}
          />
        )}
      </div>

      {/* Bottom control bar */}
      {/* New tab stays centred whether or not it has neighbours — the grid keeps
          its three columns and the empty ones simply render nothing. */}
      <div className="grid grid-cols-3 items-center px-8 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {onHub ? (
          <button
            type="button"
            onClick={onHub}
            aria-label={content.mobileBrowser.hub}
            className="focus-ring bg-surface-raised text-muted-foreground ring-border flex size-12 items-center justify-center justify-self-start rounded-full ring-1"
          >
            <Monitor className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={onNewTab}
          aria-label={content.mobileBrowser.newTab}
          className="focus-ring bg-surface-raised ring-border flex h-12 w-20 items-center justify-center justify-self-center rounded-full shadow-md ring-1 transition-transform active:scale-95"
        >
          <Plus className="text-foreground size-6" aria-hidden="true" />
        </button>
        {onSettings ? (
          <button
            type="button"
            onClick={onSettings}
            aria-label={content.mobileBrowser.settings.title}
            className="focus-ring bg-surface-raised text-muted-foreground ring-border flex size-12 items-center justify-center justify-self-end rounded-full ring-1"
          >
            <Settings className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close tab switcher"
        className="focus-ring text-muted-foreground absolute top-4 right-4 rounded-full p-2"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/** A single icon tile in the mobile rail (system tab or app). */
/** As long as the desktop rail holds a tile before it offers to remove it. */
const LONG_PRESS_MS = 500;

function RailTile({
  icon,
  active,
  onClick,
  onHold,
  onRemove,
  removing,
  label,
  children,
}: {
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
  /** what a long press does, where a long press means anything */
  onHold?: (() => void) | undefined;
  /** the cross's action, once a hold has revealed one */
  onRemove?: (() => void) | undefined;
  removing?: boolean;
  label: string;
  children?: ReactNode;
}): ReactNode {
  const Icon = icon;
  const timer = useRef<number | null>(null);
  const cancel = (): void => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  };
  /* Cleared on unmount as well as on release: the sheet closes on a tap, and a
     timer that outlives the tile it belongs to fires into a dead component. */
  useEffect(() => cancel, []);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        onPointerDown={
          onHold
            ? () => {
                cancel();
                timer.current = window.setTimeout(onHold, LONG_PRESS_MS);
              }
            : undefined
        }
        onPointerUp={onHold ? cancel : undefined}
        onPointerLeave={onHold ? cancel : undefined}
        onPointerCancel={onHold ? cancel : undefined}
        aria-label={label}
        aria-pressed={active}
        className={`focus-ring flex size-14 items-center justify-center rounded-2xl transition-colors ${
          active
            ? "bg-surface-raised ring-border shadow-sm ring-1"
            : "hover:bg-surface-hover"
        }`}
      >
        {Icon ? (
          <Icon
            className={`size-6 ${active ? "text-foreground" : "text-muted-foreground"}`}
            aria-hidden="true"
          />
        ) : (
          children
        )}
      </button>
      {/* The same cross the desktop rail reveals after the same half second,
          in the same corner. A phone has no right-click and no drag that this
          column could tell apart from a scroll, so the hold is the whole of
          its editing vocabulary — which is why it does the one act that
          matters and leaves reordering to a mouse. */}
      <AnimatePresence>
        {removing && onRemove && (
          <motion.button
            type="button"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 24 }}
            onClick={onRemove}
            aria-label={`${content.appStore.railRemove} ${label}`}
            className="focus-ring border-background bg-negative absolute top-0 right-0 z-20 grid size-5 place-items-center rounded-full border-2 text-white shadow-lg"
          >
            <X className="size-3" strokeWidth={3} aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Collapsed app rail for mobile: a slim icon strip that slides in from the
 * left, mirroring the desktop rail (Profiles / Web3 Apps / Downloads + the
 * slots). The live page stays visible to the right, its tile highlighted.
 */
function MobileRail({ onClose }: { onClose: () => void }): ReactNode {
  const {
    railEntries,
    activeRef,
    openApp,
    mainView,
    openProfilesManager,
    openAppStore,
    setMobileSheetOpen,
    openShare,
    pinnedSites,
    spaces,
    activeSpaceId,
    setActiveSpaceId,
    setMainView,
    openLinkInBrowser,
    isInstalled,
    uninstallApp,
    unpinSite,
  } = useHub();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  /*
   * Which tile is wearing a cross, and which group is being renamed.
   *
   * Both are what the desktop rail does with a long press — one act each, the
   * one that fits what was held. A phone cannot drag a tile without the column
   * mistaking it for a scroll, so reordering and folding into a folder stay a
   * mouse's job; removing something you no longer want does not.
   */
  const [removing, setRemoving] = useState<string | null>(null);
  const [groupSettings, setGroupSettings] = useState<{
    id: string;
    name: string;
    color?: string | undefined;
  } | null>(null);

  /* Essential apps refuse to be uninstalled, so they are not offered it. */
  const essential = new Set<string>(getEssentialAppSlugs());
  const removable = (ref: RailRef): boolean =>
    ref.kind !== "app" || !essential.has(ref.slug);
  const removeRef = (ref: RailRef): void => {
    setRemoving(null);
    if (ref.kind === "app") uninstallApp(ref.slug as AppSlug, activeSpaceId);
    else unpinSite(ref.id);
  };
  /*
   * Pinning Browse to the rail is one setting, and this is a rail.
   *
   * `visibleApps` in hub-provider drops Browse from the tiles when the setting
   * is on, because on desktop the rail puts it back as a button. This rail did
   * not, so switching the setting on took Browse off the phone entirely — the
   * one control whose whole job is to move a door was closing it.
   *
   * Workspaces above is deliberately NOT gated the same way. `workspacesInRail`
   * is safe to switch off on desktop because the workspace list is in the
   * column beside the rail either way; on a phone this button is the only way
   * to reach it, and hiding it would take away the room rather than a door.
   */
  const settings = useSettings();
  const browsePinned = settings.browseAsButton && isInstalled("browser");
  /* Home is a question, not a destination — see lib/home-view. */
  const home = homeView(
    settings.homescreen,
    !settings.timelineAsApp || isInstalled("timeline"),
  );

  const systemTabs: {
    id: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    onClick: () => void;
  }[] = [
    /*
     * First, because it is the way back.
     *
     * It lived only in the desktop title bar, which a phone does not have —
     * so until this row existed there was no way to reach whichever homescreen
     * an install uses without going through an app. Top of the column for the
     * same reason it is the leftmost thing in the strip on a desktop.
     */
    {
      id: "home",
      label: content.titleBar.home,
      icon: House,
      active: mainView === "home" || mainView === "timeline",
      onClick: () => {
        onClose();
        setMainView(home);
      },
    },
    {
      id: "spaces",
      label: content.library.spaces.title,
      icon: Layers,
      active: mainView === "profiles",
      onClick: openProfilesManager,
    },
    ...(browsePinned
      ? [
          {
            id: "browse",
            label: content.library.spaces.browse,
            icon: Globe,
            active:
              mainView === "app" &&
              activeRef.kind === "app" &&
              activeRef.slug === "browser",
            onClick: () => {
              onClose();
              openApp("browser");
            },
          },
        ]
      : []),
    {
      id: "apps",
      label: content.library.apps.title,
      icon: LayoutGrid,
      active: mainView === "store",
      onClick: openAppStore,
    },
    {
      id: "downloads",
      label: content.library.downloads.title,
      icon: Download,
      active: false,
      onClick: () => {
        onClose();
        setMobileSheetOpen(true);
      },
    },
  ];

  /*
   * A rail slot holds a ref, and the two kinds resolve against different
   * sources: an app against the catalog compiled into this build, a site against
   * the list the user pinned. `undefined` from either is routine rather than a
   * bug — a stored layout can name an app this build does not carry, or a site
   * another tab has just unpinned — so both lookups fail to a skipped slot.
   *
   * The app half goes through the catalog rather than casting `ref.slug` into
   * `AppSlug`, which is the same reason the desktop rail does: a string off
   * localStorage is not a member of a compiled union just because it is spelled
   * like one.
   */
  const appFor = (slug: string): HubApp | undefined =>
    getHubApps().find((app) => app.slug === slug);
  const siteFor = (id: string): PinnedSite | undefined =>
    pinnedSites.find((site) => site.id === id);

  /**
   * One slot, whichever kind of ref it holds.
   *
   * Both branches close the rail on the way out: picking a slot IS the rail's
   * whole purpose, so it has served it, and leaving it open buries what the user
   * just asked for behind it.
   */
  const refTile = (ref: RailRef): ReactNode => {
    if (ref.kind === "app") {
      const app = appFor(ref.slug);
      if (!app) return null;
      const active = activeRef.kind === "app" && activeRef.slug === app.slug;
      return (
        <RailTile
          key={refKey(ref)}
          label={app.name}
          active={active}
          onClick={() => {
            /* A tile wearing a cross is a tile being edited, so the tap that
               would have opened it puts the cross away instead. Otherwise the
               only way out of edit mode is to open something. */
            if (removing !== null) {
              setRemoving(null);
              return;
            }
            openApp(app.slug);
            onClose();
          }}
          {...(removable(ref)
            ? {
                onHold: () => setRemoving(refKey(ref)),
                onRemove: () => removeRef(ref),
                removing: removing === refKey(ref),
              }
            : {})}
        >
          <AppTile app={app} size={38} className={active ? "" : "grayscale"} />
        </RailTile>
      );
    }
    const site = siteFor(ref.id);
    if (!site) return null;
    const active = activeRef.kind === "site" && activeRef.id === site.id;
    return (
      <RailTile
        key={refKey(ref)}
        label={site.title}
        active={active}
        onHold={() => setRemoving(refKey(ref))}
        onRemove={() => removeRef(ref)}
        removing={removing === refKey(ref)}
        onClick={() => {
          if (removing !== null) {
            setRemoving(null);
            return;
          }
          /* A site is a tab, so it opens through the browser's own path — same
             native tab layer and history as a URL typed into the address bar.
             The ref is an argument because openLinkInBrowser ends by setting the
             active ref, so setting it around the call is overwritten and the
             origin chip never appears. */
          openLinkInBrowser(activeSpaceId, site.url, ref);
          onClose();
        }}
      >
        <SiteTile site={site} size={38} className={active ? "" : "grayscale"} />
      </RailTile>
    );
  };

  /* Held rather than tapped, because a tap already does the other thing a
     folder can do — open it. Same split the desktop rail makes. */
  const groupTimer = useRef<number | null>(null);
  const cancelGroupPress = (): void => {
    if (groupTimer.current === null) return;
    window.clearTimeout(groupTimer.current);
    groupTimer.current = null;
  };

  /** The 2x2 peek inside a collapsed folder — tiles only, no slot chrome. */
  const refThumb = (ref: RailRef): ReactNode => {
    const key = refKey(ref);
    if (ref.kind === "app") {
      const app = appFor(ref.slug);
      return app ? (
        <AppTile key={key} app={app} size={16} />
      ) : (
        <span key={key} />
      );
    }
    const site = siteFor(ref.id);
    return site ? (
      <SiteTile key={key} site={site} size={16} />
    ) : (
      <span key={key} />
    );
  };

  const renderEntry = (entry: RailEntry): ReactNode => {
    if (entry.type === "single") return refTile(entry.ref);
    const expanded = expandedGroup === entry.id;
    const tint = entry.color || undefined;
    return (
      <div key={entry.id} className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => setExpandedGroup(expanded ? null : entry.id)}
          onPointerDown={() => {
            groupTimer.current = window.setTimeout(() => {
              setGroupSettings({
                id: entry.id,
                name: entry.name,
                color: entry.color,
              });
            }, LONG_PRESS_MS);
          }}
          onPointerUp={cancelGroupPress}
          onPointerLeave={cancelGroupPress}
          onPointerCancel={cancelGroupPress}
          aria-label={entry.name}
          aria-expanded={expanded}
          className={`focus-ring flex size-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${
            expanded
              ? "bg-surface-raised ring-border ring-1"
              : "hover:bg-surface-hover"
          }`}
        >
          {expanded ? (
            <Folder
              className="size-6"
              style={tint ? { color: tint } : undefined}
              aria-hidden="true"
            />
          ) : (
            <span
              className={`grid size-11 grid-cols-2 grid-rows-2 gap-0.5 rounded-[22%] p-1 ${
                tint ? "" : "bg-surface"
              }`}
              style={tint ? { backgroundColor: tint } : undefined}
            >
              {entry.members.slice(0, 4).map(refThumb)}
            </span>
          )}
        </button>
        {expanded && (
          <div className="bg-surface flex flex-col items-center gap-1 rounded-2xl p-1">
            {entry.members.map(refTile)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <motion.nav
        aria-label="App rail"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={spring}
        className="border-border bg-background/95 flex h-full w-[84px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl"
      >
        {/*
         * The workspaces, as tiles, at the top.
         *
         * The desktop wears these as tabs across the title bar; a phone has no
         * title bar, and the only route here was Workspaces below — which opens
         * the manager, a screen for EDITING a workspace rather than for
         * stepping into one. Two taps and a horizontal scroll to do the thing
         * the desktop does in one.
         *
         * Marks rather than names: a column 84px wide has room for an icon and
         * not for "Personal", and the manager underneath is where the names
         * are. Same order as the strip, so the two agree about which is first.
         */}
        {spaces.map((space) => {
          const active = space.id === activeSpaceId;
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => {
                /* Already here: the press would otherwise do nothing, which is
                   the same trap the desktop tab avoids by opening the manager. */
                if (active) openProfilesManager();
                else setActiveSpaceId(space.id);
                onClose();
              }}
              aria-label={space.name}
              aria-current={active ? "page" : undefined}
              className={`focus-ring flex size-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                active
                  ? "bg-accent/15 text-foreground ring-accent/40 ring-1"
                  : "text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              <SpaceIcon value={space.emoji} size={18} />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            onClose();
            openProfilesManager();
            requestNewWorkspace();
          }}
          aria-label={content.titleBar.newWorkspace}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
        <div className="bg-border my-2 h-px w-10 shrink-0" aria-hidden="true" />

        {systemTabs.map((tab) => (
          <RailTile
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={tab.active}
            onClick={tab.onClick}
          />
        ))}
        {railEntries.length > 0 && (
          <div
            className="bg-border my-2 h-px w-10 shrink-0"
            aria-hidden="true"
          />
        )}
        {railEntries.map(renderEntry)}
        <button
          type="button"
          onClick={openShare}
          aria-label="Share Nexus"
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground mt-auto flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <Gift className="size-5" aria-hidden="true" />
        </button>
      </motion.nav>
      {/* Keep the live active app visible to the right; tap to dismiss. */}
      <motion.button
        type="button"
        aria-label="Close app rail"
        onClick={() => {
          /* A cross showing means the column is being edited, and tapping off
             a tile is how every phone leaves that state. Only then does the
             same tap close the rail. */
          if (removing !== null) {
            setRemoving(null);
            return;
          }
          onClose();
        }}
        className="flex-1 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Renaming and recolouring a folder, which is what the desktop rail
          opens when one is held. The same dialog, so the two cannot drift. */}
      {groupSettings && (
        <GroupSettingsDialog
          key={groupSettings.id}
          open
          onClose={() => setGroupSettings(null)}
          groupId={groupSettings.id}
          initialName={groupSettings.name}
          initialColor={groupSettings.color}
        />
      )}
    </div>
  );
}

/** The Nexus brand mark (blue squircle + white lines), sticker-style. */
function NexusMark(): ReactNode {
  return (
    <span className="relative flex size-16 items-center justify-center rounded-[22%] bg-[#0066FF] shadow-lg ring-4 ring-white dark:ring-white/15">
      <svg
        viewBox="0 0 32 32"
        className="size-9"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 12h16M8 16h16M8 20h12"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

const syncContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { delayChildren: 0.12, staggerChildren: 0.09 },
  },
} as const;
const syncItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
} as const;

/** Full-screen "Sync with Nexus Desktop" onboarding, staggered fade-in. */
function SyncScreen({ onClose }: { onClose: () => void }): ReactNode {
  const copy = content.mobileBrowser.sync;
  return (
    <motion.div
      variants={syncContainer}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex flex-col items-center overflow-hidden bg-[#eef1fb] px-8 md:hidden dark:bg-[#0b0e1a]"
    >
      {/* Soft color wash — pink glow top-right, cool base. */}
      <div
        className="pointer-events-none absolute -top-24 -right-16 size-96 rounded-full bg-[#ff8aa0]/45 blur-3xl dark:bg-[#ff6b8a]/20"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-[#b9c4ff]/50 blur-3xl dark:bg-[#4353ff]/20"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="focus-ring text-foreground/70 absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-10 rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="size-6" aria-hidden="true" />
      </button>

      <div className="flex-1" aria-hidden="true" />

      <motion.div variants={syncItem}>
        <NexusMark />
      </motion.div>
      <motion.h1
        variants={syncItem}
        className="text-accent mt-6 text-center text-4xl font-extrabold tracking-tight text-balance"
      >
        {copy.title}
      </motion.h1>
      <motion.p
        variants={syncItem}
        className="text-foreground/70 mt-4 max-w-xs text-center text-lg text-balance"
      >
        {copy.subtitle}
      </motion.p>

      <div className="flex-[1.4]" aria-hidden="true" />

      <motion.button
        variants={syncItem}
        type="button"
        onClick={() => toast.info("Sign in with Nexus: coming soon")}
        className="focus-ring bg-accent text-accent-foreground w-full max-w-md rounded-2xl py-4 text-center text-base font-bold shadow-lg transition-transform active:scale-[0.98]"
      >
        {copy.signIn}
      </motion.button>
      <motion.button
        variants={syncItem}
        type="button"
        onClick={onClose}
        className="focus-ring bg-accent/12 text-accent mt-3 mb-[max(1.5rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-2xl py-4 text-center text-base font-bold transition-transform active:scale-[0.98]"
      >
        {copy.noAccount}
      </motion.button>
    </motion.div>
  );
}

type Sheet =
  | "none"
  | "rail"
  | "details"
  /* The open app's contextual column. The chevron opens this instead of the
     page sheet whenever the canvas is an app rather than a page — see
     mobile-app-sheet for why that is the same question. */
  | "context"
  | "address"
  | "switcher"
  | "sync"
  /* Owned here rather than inside the details sheet: opening it has to CLOSE
     that one, and a sheet cannot outlive the component that renders it. */
  | "help";

/**
 * Arc-style mobile browser chrome: a floating bottom bar plus the page-options,
 * address/new-tab, tab-switcher and settings surfaces it opens. Mobile only.
 */
export function MobileBrowser({
  onDimChange,
}: {
  onDimChange: (dimmed: boolean) => void;
}): ReactNode {
  const {
    activeSpaceId,
    tabsBySpace,
    activeTabId,
    openTab,
    activeApp,
    activeRef,
    activeTab,
    mainView,
    activePage,
    openSettings,
    setActiveRef,
    unpinSite,
  } = useHub();
  const [sheet, setSheet] = useState<Sheet>("none");
  const [incognito, setIncognito] = useState(false);
  const tabs = tabsBySpace[activeSpaceId] ?? [];
  /* Only while the bar is the thing on screen. A sheet scrolling its own body
     is not the canvas moving, and hiding a bar that is already covered would
     only show it again, from underneath, on the way back. */
  /* Never on desktop. This component renders at every width and is merely
     hidden by CSS above `md`, so without the guard every desktop scroll would
     be re-rendering mobile chrome nobody can see. */
  const isDesktop = useIsDesktop();
  const { hidden, reveal } = useScrollDirection(!isDesktop && sheet === "none");
  const onTimeline = mainView === "timeline";

  /*
   * What the CANVAS is showing, not what the ref names.
   *
   * `openWeb3Apps` changes only `mainView`, `libraryTab` and `activePage` — it
   * leaves a pinned site as the active ref. Gating the bar on the ref alone
   * meant tapping Web3 Apps from a site left the bookmark list wearing a site's
   * stripped-down bar: no way to open a tab, no switcher. Settings, the Profiles
   * manager and Getting Started all reach the same state. This is the predicate
   * `MainView` already uses to decide the canvas is a browser page.
   */
  const siteCanvas =
    activeRef.kind === "site" && mainView === "app" && !activePage;

  /*
   * The origin chip, for the bar's middle cell. Built here rather than inside
   * BottomBar because the bar is presentational and this needs four things off
   * the hub — and because the same component, with `placement="canvas"`, is what
   * BrowserApp renders on wide layouts. One chip, two placements.
   *
   * `activeTab.url`, never the pinned row's url: a site that has navigated is at
   * a different origin than the one it was pinned at, and the whole point of this
   * element is saying which one you are actually talking to. Null when there is
   * no tab yet, so the cell falls back to filler instead of naming nothing.
   */
  const originChip =
    siteCanvas && activeTab && activeRef.kind === "site" ? (
      <OriginChip
        url={activeTab.url}
        placement="bar"
        onOpenInBrowser={() => setActiveRef({ kind: "app", slug: "browser" })}
        onRemove={() => unpinSite(activeRef.id)}
      />
    ) : null;

  /*
   * What the chevron asks about, which is whatever the canvas is showing.
   *
   * For a page that is the page's own options — the address, back and forward,
   * copy the link, add it to the rail. For an app the same sheet was talking
   * about a page that is not on screen, while the app's own list was
   * unreachable below `md`. So the answer follows the canvas, and so does the
   * label on the button.
   */
  const chevronOpens: Sheet =
    !siteCanvas && hasContextSidebar(activeApp) ? "context" : "details";

  // Push the page back behind the matte while a bottom sheet is open.
  useEffect(() => {
    onDimChange(sheet === "details" || sheet === "address");
  }, [sheet, onDimChange]);

  /*
   * The dim above is a CSS transform on this document — which does nothing to the
   * browsed page, because on mobile that page is a NATIVE view stacked above this
   * document entirely. Every one of these sheets would open underneath it. So the
   * shell is told to take the tab layer down for as long as any sheet is open.
   */
  useHostOverlay(sheet !== "none");

  const close = (): void => setSheet("none");

  return (
    <>
      {/*
        One or the other, never both and never neither. Sharing an
        `AnimatePresence` means the pill is arriving while the bar is still
        leaving, which is what makes it read as one thing changing size rather
        than two things taking turns.
      */}
      <AnimatePresence initial={false}>
        {sheet === "none" &&
          /*
           * The pill answers "where am I" for somebody reading a page. On the
           * Timeline the column itself says that on every row, so the pill was
           * a second answer to a question already answered — and it took the
           * search button away with it the moment anybody scrolled.
           */
          (hidden && !onTimeline ? (
            <ContextPill key="pill" tabs={tabs} onExpand={reveal} />
          ) : (
            <BottomBar
              key="bar"
              tabs={tabs}
              site={siteCanvas}
              origin={originChip}
              onRail={() => setSheet("rail")}
              onSwitcher={() => setSheet("switcher")}
              onAddress={() => {
                setIncognito(false);
                setSheet("address");
              }}
              /*
               * The chevron asks "what else is there about this".
               *
               * For a page that has always been the page's own options — the
               * address, back and forward, copy the link, add it to the rail.
               * For an app it was the same sheet talking about a page that is
               * not on screen, while the app's own list was unreachable. So
               * the answer follows the canvas.
               */
              onDetails={() => setSheet(chevronOpens)}
              detailsLabel={
                chevronOpens === "context"
                  ? content.mobileBrowser.appOptions.replace(
                      "{app}",
                      (activeApp ? getHubApp(activeApp)?.name : "") ?? "",
                    )
                  : content.mobileBrowser.urlDetails
              }
              timeline={onTimeline}
            />
          ))}
      </AnimatePresence>

      <AnimatePresence>
        {sheet === "rail" && <MobileRail key="rail" onClose={close} />}
        {sheet === "context" && activeApp && (
          <MobileAppSheet key="context" slug={activeApp} onClose={close} />
        )}
        {sheet === "details" && (
          <UrlDetailsSheet
            key="details"
            onClose={close}
            onOpenAddress={() => {
              setIncognito(false);
              setSheet("address");
            }}
            onOpenHelp={() => setSheet("help")}
          />
        )}
        {sheet === "help" && <HelpSheet key="help" open onClose={close} />}
        {sheet === "address" && (
          <AddressSheet
            key="address"
            onClose={close}
            incognito={incognito}
            onToggleIncognito={() => setIncognito((v) => !v)}
          />
        )}
        {sheet === "switcher" && (
          <TabSwitcher
            key="switcher"
            tabs={tabs}
            activeTabId={activeTabId}
            onPick={(id) => {
              openTab(id);
              close();
            }}
            onNewTab={() => {
              setIncognito(false);
              setSheet("address");
            }}
            /*
             * Settings is not demo-only any more, and the note that used to sit
             * here was describing a component that no longer exists: a sheet of
             * twelve "coming soon" rows and one working toggle. What it opens
             * now is the desktop's own panels, drilled into one at a time — the
             * wallet's keys and BRC-157 backup among them, which is the last
             * thing a shipped phone build should be missing. Hoisted to the
             * shell so that every route into Settings lands on it; this only
             * asks.
             *
             * SyncScreen stays gated. Its one action is a "Sign in with Nexus"
             * that signs in to nothing.
             */
            onSettings={openSettings}
            onHub={DEMO_SURFACES ? () => setSheet("sync") : undefined}
            onClose={close}
          />
        )}
        {/* Gated at the render too, not only at the button above. With
            DEMO_SURFACES folded to a literal false the branch is dead code and
            the component leaves the bundle, so "is it reachable" stops depending
            on nobody adding a second route to it later. */}
        {DEMO_SURFACES && sheet === "sync" && (
          <SyncScreen key="sync" onClose={close} />
        )}
      </AnimatePresence>
    </>
  );
}
