"use client";

import { BrowserSettingsMenu } from "@/components/hub/browser-settings-menu";
import { Favicon } from "@/components/hub/favicon";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { useHostOverlay } from "@/lib/wallet-data";
import { useSettings } from "@/lib/settings-store";
import { Check, Link2, SlidersHorizontal, Star, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

async function shareUrl(url: string, title: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  } else {
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // clipboard unavailable
    }
  }
}

function copyLinkWithToast(url: string, title: string): void {
  try {
    void navigator.clipboard?.writeText(url);
  } catch {
    // clipboard unavailable
  }
  toast.success("Link copied", {
    description: url.replace(/^https?:\/\//, ""),
    action: {
      label: "Share",
      onClick: () => void shareUrl(url, title),
    },
  });
}

/**
 * Reusable browser chrome: address bar + favorites (bookmarks) + the
 * drag-to-add drop zone. Shared by the focus sidebar and the My Hub column.
 */
/**
 * The URL field, on its own so it can live in either chrome.
 *
 * Vertical tabs keep it in the library column, where BrowserNav has always put
 * it; horizontal tabs move it into the bar beneath the tab strip. One
 * definition rather than two, because two address bars that drift apart are two
 * different browsers.
 */
export function AddressBar(): ReactNode {
  const { activeTab, navigateActiveTab } = useHub();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<{
    top: number;
    left: number;
    right: number;
    bottom: number;
  } | null>(null);
  const activeUrl = activeTab ? activeTab.url.replace(/^https?:\/\//, "") : "";

  /*
   * Tell the shell the chrome is covering itself.
   *
   * The browsed page is a native view stacked ABOVE this document, so it paints
   * straight through anything the chrome opens over it. In the sidebar layout
   * that never showed: the column sits outside the page's rectangle, so the
   * menu had nothing on top of it. With horizontal tabs the address bar is
   * directly above the page, and the menu opened underneath it — present in the
   * DOM, findable by a test, and invisible to anybody actually using the app.
   *
   * `origin-chip` next door has always done this. This is the same call.
   */
  useHostOverlay(settingsOpen);

  /* Back to the link icon on its own. Keyed off the flag rather than a timeout
     kept in a ref, so copying again while the tick is up restarts the clock
     instead of being cut short by the first one's pending reset. */
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="relative flex-1">
      <div className="bg-background hover:bg-muted flex items-center gap-1 rounded-lg px-3 py-2 transition-colors">
        <input
          key={`${activeTab?.id ?? "none"}:${activeUrl}`}
          defaultValue={activeUrl}
          onKeyDown={(event) => {
            const draft = event.currentTarget.value.trim();
            if (event.key === "Enter" && draft) {
              navigateActiveTab(draft);
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.currentTarget.value = activeUrl;
              event.currentTarget.blur();
            }
          }}
          placeholder="Search or Enter URL…"
          aria-label="Address bar"
          className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {/*
          The tick is the confirmation that survives.

          The toast still fires, and is the right answer everywhere else in the
          app — but the browsed page is a native view above this document, so a
          bottom-right toast raised while you are looking at a page is painted
          straight over it. Blanking the page for four seconds to show "Link
          copied" would be a worse trade than the missing message, so the button
          answers for itself instead, in chrome the page cannot cover.
        */}
        <button
          type="button"
          aria-label={copied ? "Link copied" : "Copy link"}
          disabled={!activeTab}
          onClick={() => {
            if (!activeTab) return;
            copyLinkWithToast(activeTab.url, activeTab.title);
            setCopied(true);
          }}
          className={`focus-ring shrink-0 rounded p-1 disabled:opacity-30 ${
            copied
              ? "text-positive"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Link2 className="size-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="Site settings"
          aria-expanded={settingsOpen}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            setSettingsAnchor({
              top: box.top,
              left: box.left,
              right: box.right,
              bottom: box.bottom,
            });
            setSettingsOpen(true);
          }}
          className="focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <BrowserSettingsMenu
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        {...(settingsAnchor ? { anchor: settingsAnchor } : {})}
      />
    </div>
  );
}

export function BrowserNav(): ReactNode {
  const {
    activeTabId,
    favorites,
    addFavoriteFromTab,
    removeFavorite,
    tabDragging,
    tabsBySpace,
    activeSpaceId,
    spaces,
    openTab,
    createTab,
  } = useHub();
  const horizontal = useSettings().tabLayout === "horizontal";
  const [favoritesDragOver, setFavoritesDragOver] = useState(false);
  const [favoritesHintDismissed, setFavoritesHintDismissed] = useState(false);

  const activeSpace =
    spaces.find((space) => space.id === activeSpaceId) ?? spaces[0];
  const tabs = activeSpace ? (tabsBySpace[activeSpace.id] ?? []) : [];
  const spacesCopy = content.library.spaces;
  const showHint =
    tabDragging || (favorites.length === 0 && !favoritesHintDismissed);

  const dropHandlers = {
    onDragOver: (event: React.DragEvent): void => {
      if (event.dataTransfer.types.includes("application/x-nexus-tab")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setFavoritesDragOver(true);
      }
    },
    onDragLeave: (): void => setFavoritesDragOver(false),
    onDrop: (event: React.DragEvent): void => {
      event.preventDefault();
      setFavoritesDragOver(false);
      const tabId = event.dataTransfer.getData("application/x-nexus-tab");
      if (tabId) addFavoriteFromTab(tabId);
    },
  };

  return (
    <>
      {/* Only where this column owns it. With horizontal tabs the bar beneath
          the strip carries it instead, and two address bars is two places to
          type the same thing. */}
      {!horizontal && <AddressBar />}

      {favorites.length > 0 && (
        <div
          className={`mt-3 flex gap-2 rounded-xl ${
            favoritesDragOver ? "ring-accent/60 ring-2" : ""
          }`}
          role="list"
          aria-label="Favorites"
          {...dropHandlers}
        >
          {favorites.map((favorite) => {
            const matchingTab = tabs.find((tab) => tab.url === favorite.url);
            const active = matchingTab && matchingTab.id === activeTabId;
            return (
              <div key={favorite.id} className="group relative flex-1">
                <button
                  type="button"
                  role="listitem"
                  aria-label={favorite.title}
                  aria-current={active ? "page" : undefined}
                  onClick={() =>
                    matchingTab
                      ? openTab(matchingTab.id)
                      : createTab(favorite.url)
                  }
                  className={`focus-ring flex h-12 w-full items-center justify-center rounded-xl transition-colors ${
                    active
                      ? "bg-surface-raised ring-accent/40 shadow-sm ring-1"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <Favicon
                    url={favorite.url}
                    letter={favorite.favicon}
                    color={favorite.faviconColor}
                    size={22}
                    rounded="rounded-md"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeFavorite(favorite.id)}
                  aria-label={`Remove ${favorite.title} from favorites`}
                  className="focus-ring bg-muted text-muted-foreground hover:text-foreground absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full group-focus-within:flex group-hover:flex"
                >
                  <X className="size-2.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence initial={false}>
        {showHint && (
          <motion.div
            key="favorites-dropzone"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className={`relative mt-3 rounded-xl border border-dashed px-3 py-4 text-center transition-colors ${
              favoritesDragOver || tabDragging
                ? "border-accent bg-accent/10"
                : "border-accent/50"
            }`}
            {...dropHandlers}
          >
            {favorites.length === 0 && !tabDragging && (
              <button
                type="button"
                onClick={() => setFavoritesHintDismissed(true)}
                aria-label="Dismiss favorites hint"
                className="focus-ring text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded p-0.5"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
            <Star
              className="text-accent mx-auto size-5"
              aria-hidden="true"
              fill="currentColor"
            />
            <p className="mt-1.5 text-xs font-semibold">
              {spacesCopy.dragHint}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              {spacesCopy.dragSubHint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
