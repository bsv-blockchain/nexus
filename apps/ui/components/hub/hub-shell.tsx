"use client";

import { CommandPalette } from "@/components/hub/command-palette";
import { DownloadsPanel } from "@/components/hub/downloads-panel";
import { HubProvider, useHub } from "@/components/hub/hub-provider";
import { IconRail } from "@/components/hub/icon-rail";
import { MainView } from "@/components/hub/main-view";
import { MobileBrowser } from "@/components/hub/mobile-browser";
import { MobileSheet } from "@/components/hub/mobile-sheet";
import { ShareModal } from "@/components/hub/share-modal";
import { SpacesPanel } from "@/components/hub/spaces-panel";
import { SettingsSidebar } from "@/components/apps/settings-app";
import { CustomThemeProvider } from "@/components/hub/theme-provider";
import { WalletGate } from "@/components/hub/wallet-gate";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

const slideEase = [0.4, 0, 0.2, 1] as const;

function LibraryPanel(): ReactNode {
  const { libraryTab, mainView } = useHub();
  // Settings takes the panel as well as the canvas: the categories are the only
  // way to move around it, so they have to be where every other app's list is.
  if (mainView === "settings") return <SettingsSidebar />;
  /*
   * Web3 Apps has no panel column of its own. It used to get the collections
   * list, which was the store's filter — persona bundles that switched several
   * apps on at once. With nothing to install there is nothing to filter, and the
   * pinned-sites list is the whole surface, so the panel keeps showing profiles.
   */
  // Profiles <-> Downloads crossfade: the outgoing pane staggers out, then the
  // incoming pane staggers in (and the reverse when closing Downloads).
  return (
    <div className="h-full">
      <AnimatePresence mode="wait" initial={false}>
        {libraryTab === "downloads" ? (
          <DownloadsPanel key="downloads" />
        ) : (
          <SpacesPanel key="spaces" />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The rail is always shown on the left. Expanding slides the wider panel
 * column in beside it; collapsing hides it, leaving icons only.
 */
function DesktopSidebar(): ReactNode {
  const { railCollapsed } = useHub();
  // Clip only while the width animation runs; once settled, let popovers
  // (e.g. the browser-settings menu) overflow past the panel edge.
  const [clip, setClip] = useState(true);

  return (
    <div className="flex h-full pl-2">
      <IconRail />
      <AnimatePresence initial={false}>
        {!railCollapsed && (
          <motion.div
            key="panel"
            className={`flex flex-col py-3 pr-2 ${
              clip ? "overflow-hidden" : "overflow-visible"
            }`}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 296, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: slideEase }}
            onAnimationStart={() => setClip(true)}
            onAnimationComplete={() => setClip(false)}
          >
            <div className="min-h-0 w-72 flex-1">
              <LibraryPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Shell(): ReactNode {
  const { toggleRail } = useHub();
  // Pushes the mobile canvas back behind the matte while a browser sheet is open.
  const [pageDimmed, setPageDimmed] = useState(false);

  // ⌘\ collapses/expands the rail's panel column.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggleRail();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleRail]);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:block">
          <DesktopSidebar />
        </div>

        <div
          data-dimmed={pageDimmed}
          className="flex min-w-0 flex-1 origin-bottom p-2 transition-transform duration-300 ease-out data-[dimmed=true]:max-md:scale-[0.93] md:py-2 md:pr-2 md:pl-0"
        >
          <MainView />
        </div>
      </div>

      <MobileBrowser onDimChange={setPageDimmed} />
      <MobileSheet />
      <CommandPalette />
      <ShareModal />
      <WalletGate />
    </div>
  );
}

export function HubShell(): ReactNode {
  return (
    <HubProvider>
      <CustomThemeProvider>
        <Shell />
      </CustomThemeProvider>
    </HubProvider>
  );
}
