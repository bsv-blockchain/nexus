"use client";

import { AppTile } from "@/components/hub/app-icon";
import { Favicon } from "@/components/hub/favicon";
import {
  useHub,
  type AppSlug,
  type RailEntry,
} from "@/components/hub/hub-provider";
import { content, getHubApp, getMockPage, type BrowserTab } from "@/lib/data";
import { useHostOverlay } from "@/lib/wallet-data";
import {
  AlignLeft,
  AppWindow,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  Folder,
  Gift,
  Globe,
  Keyboard,
  Languages,
  Layers,
  LayoutGrid,
  Link2,
  Mic,
  Monitor,
  MonitorSmartphone,
  Palette,
  Pin,
  Plus,
  RotateCw,
  Search,
  Settings,
  Share,
  Smartphone,
  TextSearch,
  Trash2,
  Type,
  VenetianMask,
  X,
  type LucideIcon,
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

/** A small faux "web page" thumbnail used in the bottom-bar tab stack. */
function PageThumb({ tab, className = "" }: { tab: BrowserTab; className?: string }): ReactNode {
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
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface-raised text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
          0
        </span>
      )}
    </button>
  );
}

/** Floating bottom bar: app-rail · new-tab pill · tab stack + page-options. */
function BottomBar({
  tabs,
  onRail,
  onSwitcher,
  onAddress,
  onDetails,
}: {
  tabs: BrowserTab[];
  onRail: () => void;
  onSwitcher: () => void;
  onAddress: () => void;
  onDetails: () => void;
}): ReactNode {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={spring}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 items-center border-t border-black/5 bg-white/70 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-neutral-900/60"
    >
      <button
        type="button"
        onClick={onRail}
        aria-label={content.mobileBrowser.appRail}
        className="focus-ring pointer-events-auto flex size-11 items-center justify-center justify-self-start rounded-full bg-surface-raised/95 shadow-lg ring-1 ring-border backdrop-blur transition-transform active:scale-95"
      >
        <LayoutGrid className="size-5 text-foreground" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onAddress}
        aria-label={content.mobileBrowser.newTab}
        className="focus-ring pointer-events-auto flex h-11 w-28 items-center justify-center justify-self-center rounded-full bg-surface-raised/95 shadow-lg ring-1 ring-border backdrop-blur transition-transform active:scale-95"
      >
        <Plus className="size-5 text-foreground" aria-hidden="true" />
      </button>
      <div className="pointer-events-auto flex items-center gap-3 justify-self-end">
        <TabStack tabs={tabs} onOpen={onSwitcher} />
        <button
          type="button"
          onClick={onDetails}
          aria-label={content.mobileBrowser.urlDetails}
          className="focus-ring flex size-11 items-center justify-center rounded-full bg-surface-raised/95 shadow-lg ring-1 ring-border backdrop-blur transition-transform active:scale-95"
        >
          <ChevronUp className="size-5 text-foreground" aria-hidden="true" />
        </button>
      </div>
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
}: {
  onClose: () => void;
  onOpenAddress: () => void;
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

  const actions: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    { label: copy.actions.findOnPage, icon: TextSearch, onClick: onClose },
    {
      label: copy.actions.summarize,
      icon: AlignLeft,
      onClick: () => toast.info("Summarize is coming soon"),
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
      <div className="flex items-center gap-1 rounded-full bg-surface px-2 py-1.5 ring-1 ring-border">
        <button
          type="button"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={goBack}
          className="focus-ring rounded-full p-1.5 text-muted-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={goForward}
          className="focus-ring rounded-full p-1.5 text-muted-foreground disabled:opacity-30"
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
          className="focus-ring rounded-full p-1.5 text-muted-foreground"
        >
          <Link2 className="size-4.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Reload"
          onClick={() => activeTab && navigateActiveTab(activeTab.url)}
          className="focus-ring rounded-full p-1.5 text-muted-foreground"
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
            <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-surface ring-1 ring-border">
              <action.icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[11px] text-muted-foreground">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => toast.info("Display options coming soon")}
          className="focus-ring flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-sm font-medium ring-1 ring-border"
        >
          <Type className="size-5 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1 text-left">{copy.displayOptions}</span>
          <ChevronRight
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => toast.info("Site settings coming soon")}
          className="focus-ring flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-sm font-medium ring-1 ring-border"
        >
          <Settings className="size-5 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1 text-left">{copy.siteSettings}</span>
        </button>
      </div>
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
          className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
        />
        {incognito && (
          <span className="text-sm text-muted-foreground">
            {copy.incognito}
          </span>
        )}
        <button
          type="button"
          aria-label="Voice search"
          className="focus-ring shrink-0 rounded-full p-1 text-muted-foreground"
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
              className="size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-lg font-semibold">{copy.incognitoTitle}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {copy.incognitoHint}
            </p>
          </div>
        ) : tabs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {copy.noTabs}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
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
  const scale = useTransform(offset, (o) => 1 - Math.min(Math.abs(o) * 0.14, 0.55));
  const opacity = useTransform(offset, (o) => 1 - Math.min(Math.abs(o) * 0.32, 0.85));
  const rotateY = useTransform(offset, (o) => Math.max(-32, Math.min(32, -o * 16)));
  const zIndex = useTransform(offset, (o) => 100 - Math.round(Math.abs(o) * 10));
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
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
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
  onSettings: () => void;
  onHub: () => void;
  onClose: () => void;
}): ReactNode {
  const startIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTabId),
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
      className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
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
        <div className="absolute inset-0 flex items-center justify-center">
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
            <p className="text-sm text-muted-foreground">
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
            className="absolute inset-0 z-[200]"
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
      <div className="grid grid-cols-3 items-center px-8 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onHub}
          aria-label={content.mobileBrowser.hub}
          className="focus-ring flex size-12 items-center justify-center justify-self-start rounded-full bg-surface-raised text-muted-foreground ring-1 ring-border"
        >
          <Monitor className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNewTab}
          aria-label={content.mobileBrowser.newTab}
          className="focus-ring flex h-12 w-20 items-center justify-center justify-self-center rounded-full bg-surface-raised shadow-md ring-1 ring-border transition-transform active:scale-95"
        >
          <Plus className="size-6 text-foreground" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onSettings}
          aria-label={content.mobileBrowser.settings.title}
          className="focus-ring flex size-12 items-center justify-center justify-self-end rounded-full bg-surface-raised text-muted-foreground ring-1 ring-border"
        >
          <Settings className="size-5" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close tab switcher"
        className="focus-ring absolute top-4 right-4 rounded-full p-2 text-muted-foreground"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

function SettingRow({
  icon: Icon,
  tone,
  label,
  value,
  toggle,
  toggled,
  chevron,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value?: string;
  toggle?: boolean;
  toggled?: boolean;
  chevron?: boolean;
  onClick?: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: tone }}
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {toggle && (
        <span
          className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${
            toggled ? "bg-green-500" : "bg-muted"
          }`}
          aria-hidden="true"
        >
          <span
            className={`size-5 rounded-full bg-white shadow transition-transform ${
              toggled ? "translate-x-4" : ""
            }`}
          />
        </span>
      )}
      {chevron && (
        <ChevronRight
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/** Full-screen browser settings sheet. */
function SettingsSheet({ onClose }: { onClose: () => void }): ReactNode {
  const s = content.mobileBrowser.settings;
  const [autoKeyboard, setAutoKeyboard] = useState(true);
  const notify = (label: string) => () => toast.info(`${label}: coming soon`);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={spring}
      className="fixed inset-0 z-60 flex flex-col bg-background md:hidden"
    >
      <header className="flex items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="w-12" aria-hidden="true" />
        <h2 className="flex-1 text-center text-base font-bold">{s.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring w-12 text-right text-[15px] font-semibold text-accent"
        >
          {s.done}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-10">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={notify(s.downloads)}
            className="focus-ring flex items-center justify-center gap-2 rounded-2xl bg-surface-raised py-3 text-sm font-medium ring-1 ring-border"
          >
            {s.downloads}
          </button>
          <button
            type="button"
            onClick={notify(s.archive)}
            className="focus-ring flex items-center justify-center gap-2 rounded-2xl bg-surface-raised py-3 text-sm font-medium ring-1 ring-border"
          >
            {s.archive}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-border">
          <SettingRow
            icon={Globe}
            tone="#111827"
            label={s.globalSiteSettings}
            chevron
            onClick={notify(s.globalSiteSettings)}
          />
        </div>

        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-border">
          <SettingRow
            icon={AppWindow}
            tone="#4353ff"
            label={s.setDefault}
            chevron
            onClick={notify(s.setDefault)}
          />
          <SettingRow
            icon={Palette}
            tone="#2563eb"
            label={s.changeIcon}
            chevron
            onClick={notify(s.changeIcon)}
          />
          <SettingRow
            icon={Smartphone}
            tone="#9333ea"
            label={s.addToHome}
            chevron
            onClick={notify(s.addToHome)}
          />
        </div>

        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-border">
          <SettingRow
            icon={Search}
            tone="#2563eb"
            label={s.searchEngine}
            value={s.searchEngineValue}
            chevron
            onClick={notify(s.searchEngine)}
          />
          <SettingRow
            icon={Languages}
            tone="#16a34a"
            label={s.languages}
            chevron
            onClick={notify(s.languages)}
          />
        </div>

        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-border">
          <SettingRow
            icon={Keyboard}
            tone="#eab308"
            label={s.autoKeyboard}
            toggle
            toggled={autoKeyboard}
            onClick={() => setAutoKeyboard((v) => !v)}
          />
          <SettingRow
            icon={Archive}
            tone="#a855f7"
            label={s.archiveInactive}
            value={s.archiveInactiveValue}
            onClick={notify(s.archiveInactive)}
          />
          <SettingRow
            icon={ExternalLink}
            tone="#3b82f6"
            label={s.openLinksIn}
            value={s.openLinksInValue}
            onClick={notify(s.openLinksIn)}
          />
          <SettingRow
            icon={Trash2}
            tone="#ef4444"
            label={s.clearData}
            onClick={notify(s.clearData)}
          />
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-border">
          <SettingRow
            icon={MonitorSmartphone}
            tone="#6366f1"
            label={s.syncDesktop}
            chevron
            onClick={notify(s.syncDesktop)}
          />
        </div>
      </div>
    </motion.div>
  );
}

/** A single icon tile in the mobile rail (system tab or app). */
function RailTile({
  icon,
  active,
  onClick,
  label,
  children,
}: {
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
  label: string;
  children?: ReactNode;
}): ReactNode {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`focus-ring flex size-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${
        active
          ? "bg-surface-raised shadow-sm ring-1 ring-border"
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
  );
}

/**
 * Collapsed app rail for mobile: a slim icon strip that slides in from the
 * left, mirroring the desktop rail (Profiles / Apps / Downloads + installed
 * apps). The live active app stays visible to the right, its tile highlighted.
 */
function MobileRail({ onClose }: { onClose: () => void }): ReactNode {
  const {
    railEntries,
    activeApp,
    openApp,
    mainView,
    openProfilesManager,
    openAppStore,
    setMobileSheetOpen,
    openShare,
  } = useHub();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const systemTabs: {
    id: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    onClick: () => void;
  }[] = [
    {
      id: "spaces",
      label: content.library.spaces.title,
      icon: Layers,
      active: mainView === "profiles",
      onClick: openProfilesManager,
    },
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

  const appTile = (slug: AppSlug): ReactNode => {
    const app = getHubApp(slug);
    if (!app) return null;
    const active = activeApp === slug;
    return (
      <RailTile
        key={slug}
        label={app.name}
        active={active}
        onClick={() => {
          openApp(slug);
          // Picking an app IS the rail's whole purpose, so it has served it. Leaving
          // it open buries the app the user just asked for behind it.
          onClose();
        }}
      >
        <AppTile
          app={app}
          size={38}
          className={active ? "" : "grayscale"}
        />
      </RailTile>
    );
  };

  const renderEntry = (entry: RailEntry): ReactNode => {
    if (entry.type === "app") return appTile(entry.slug);
    const expanded = expandedGroup === entry.id;
    const tint = entry.color || undefined;
    return (
      <div key={entry.id} className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => setExpandedGroup(expanded ? null : entry.id)}
          aria-label={entry.name}
          aria-expanded={expanded}
          className={`focus-ring flex size-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${
            expanded ? "bg-surface-raised ring-1 ring-border" : "hover:bg-surface-hover"
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
              {entry.apps.slice(0, 4).map((slug) => {
                const app = getHubApp(slug);
                return app ? (
                  <AppTile key={slug} app={app} size={16} />
                ) : (
                  <span key={slug} />
                );
              })}
            </span>
          )}
        </button>
        {expanded && (
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-1">
            {entry.apps.map((slug) => appTile(slug))}
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
        className="flex h-full w-[84px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-background/95 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl"
      >
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
          <div className="my-2 h-px w-10 shrink-0 bg-border" aria-hidden="true" />
        )}
        {railEntries.map(renderEntry)}
        <button
          type="button"
          onClick={openShare}
          aria-label="Share Nexus"
          className="focus-ring mt-auto flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <Gift className="size-5" aria-hidden="true" />
        </button>
      </motion.nav>
      {/* Keep the live active app visible to the right; tap to dismiss. */}
      <motion.button
        type="button"
        aria-label="Close app rail"
        onClick={onClose}
        className="flex-1 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
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
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
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
        className="focus-ring absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-10 rounded-full p-2 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="size-6" aria-hidden="true" />
      </button>

      <div className="flex-1" aria-hidden="true" />

      <motion.div variants={syncItem}>
        <NexusMark />
      </motion.div>
      <motion.h1
        variants={syncItem}
        className="mt-6 text-center text-4xl font-extrabold tracking-tight text-balance text-accent"
      >
        {copy.title}
      </motion.h1>
      <motion.p
        variants={syncItem}
        className="mt-4 max-w-xs text-center text-lg text-balance text-foreground/70"
      >
        {copy.subtitle}
      </motion.p>

      <div className="flex-[1.4]" aria-hidden="true" />

      <motion.button
        variants={syncItem}
        type="button"
        onClick={() => toast.info("Sign in with Nexus: coming soon")}
        className="focus-ring w-full max-w-md rounded-2xl bg-accent py-4 text-center text-base font-bold text-accent-foreground shadow-lg transition-transform active:scale-[0.98]"
      >
        {copy.signIn}
      </motion.button>
      <motion.button
        variants={syncItem}
        type="button"
        onClick={onClose}
        className="focus-ring mt-3 mb-[max(1.5rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-2xl bg-accent/12 py-4 text-center text-base font-bold text-accent transition-transform active:scale-[0.98]"
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
  | "address"
  | "switcher"
  | "settings"
  | "sync";

/**
 * Arc-style mobile browser chrome: a floating bottom bar plus the page-options,
 * address/new-tab, tab-switcher and settings surfaces it opens. Mobile only.
 */
export function MobileBrowser({
  onDimChange,
}: {
  onDimChange: (dimmed: boolean) => void;
}): ReactNode {
  const { activeSpaceId, tabsBySpace, activeTabId, openTab } = useHub();
  const [sheet, setSheet] = useState<Sheet>("none");
  const [incognito, setIncognito] = useState(false);
  const tabs = tabsBySpace[activeSpaceId] ?? [];

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
      <AnimatePresence>
        {sheet === "none" && (
          <BottomBar
            key="bar"
            tabs={tabs}
            onRail={() => setSheet("rail")}
            onSwitcher={() => setSheet("switcher")}
            onAddress={() => {
              setIncognito(false);
              setSheet("address");
            }}
            onDetails={() => setSheet("details")}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet === "rail" && <MobileRail key="rail" onClose={close} />}
        {sheet === "details" && (
          <UrlDetailsSheet
            key="details"
            onClose={close}
            onOpenAddress={() => {
              setIncognito(false);
              setSheet("address");
            }}
          />
        )}
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
            onSettings={() => setSheet("settings")}
            onHub={() => setSheet("sync")}
            onClose={close}
          />
        )}
        {sheet === "settings" && (
          <SettingsSheet key="settings" onClose={() => setSheet("switcher")} />
        )}
        {sheet === "sync" && <SyncScreen key="sync" onClose={close} />}
      </AnimatePresence>
    </>
  );
}
