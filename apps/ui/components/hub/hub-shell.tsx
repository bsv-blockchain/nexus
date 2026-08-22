"use client";

import { FirstRun } from "@/components/hub/first-run";
import { PhaseSwitcher } from "@/components/hub/phase-switcher";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { AppCollections } from "@/components/hub/app-collections";
import { AppPermissionSheet } from "@/components/hub/app-permission-sheet";
import { CommandPalette } from "@/components/hub/command-palette";
import { DownloadsPanel } from "@/components/hub/downloads-panel";
import { HubProvider, useHub } from "@/components/hub/hub-provider";
import { ProfilesSidebar } from "@/components/hub/profiles-sidebar";
import { TimelineSidebar } from "@/components/apps/timeline/timeline-sidebar";
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
  if (mainView === "settings") {
    /* The same shell every app's contextual column gets from SpacesPanel.
       Settings was returned bare, so it sat on the app backdrop while every
       other column sat on a surface — the one panel that looked like a
       different product. */
    return (
      <div className="bg-surface flex h-full flex-col rounded-2xl p-3">
        <SettingsSidebar />
      </div>
    );
  }
  /* The Timeline's contextual column, in the slot every app's contextual column
     uses. It is a view rather than an app, so `hasContextSidebar` further down
     never sees it — this is where it gets its width. */
  if (mainView === "timeline") return <TimelineSidebar />;
  if (libraryTab === "apps") return <AppCollections />;
  /* The profiles manager holds every profile now, so this column stops being a
     second copy of the active one and answers what is true across them. */
  if (mainView === "profiles") return <ProfilesSidebar />;
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
      <AppPermissionSheet />
      {/* A control for whoever is running the demo, and it says so — "here is
          what we would ship first" is a conversation, not a feature. A shipped
          binary has one product state, so the chip has nothing to switch and the
          panel behind it lists features nobody in that build can reach. Gated
          here rather than inside the component so that with both flags folded to
          literal false the whole thing leaves the bundle.

          The `dev` half is why it appears in the Electron shell. `dev:wallet`
          sets NEXT_PUBLIC_DEMO_DATA=0, which used to take the chip with it — so
          the one build where you can see a real wallet was the one build with no
          way to switch product state. A packaged binary is a production build
          with the flag off, so it is still absent there, which is the part that
          matters. The panel drops its own Data section when fixtures are
          compiled out; see phase-switcher. */}
      {(DEMO_SURFACES || process.env.NODE_ENV === "development") && (
        <PhaseSwitcher />
      )}
      {/* Demo only. Its last card tells somebody a handle is free, and nothing
          in a live build can know that — lib/handle-suggest says why, and
          PROMOTING-DEMO-SURFACES.md says what would have to exist first.

          The flag folds to a literal false, so this never RENDERS in a shipped
          build, which is the part that matters. It does not leave the bundle:
          the import above is static, so the module is still emitted — measured,
          not assumed, and true of PhaseSwitcher above as well despite what its
          comment says. Dropping it for real means a dynamic import, which is a
          size question rather than an honesty one. */}
      {DEMO_SURFACES && <FirstRun />}
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
