"use client";

import { FirstRun } from "@/components/hub/first-run";
import {
  getContentMode,
  getContentModeServerSnapshot,
  hydrateContentMode,
  subscribeContentMode,
} from "@/lib/content-mode";
import { useFirstRunSeen } from "@/lib/first-run";
import { PhaseSwitcher } from "@/components/hub/phase-switcher";
import { HelpCircle } from "@/components/hub/help-circle";
import { GuidedTour } from "@/components/hub/guided-tour";
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
import { TitleBar } from "@/components/hub/title-bar";
import { FocusSidebar } from "@/components/apps/home/focus-sidebar";
import { SpacesPanel } from "@/components/hub/spaces-panel";
import { SettingsSidebar } from "@/components/apps/settings-app";
import { CustomThemeProvider } from "@/components/hub/theme-provider";
import { useSettings } from "@/lib/settings-store";
import { WalletGate } from "@/components/hub/wallet-gate";
import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const slideEase = [0.4, 0, 0.2, 1] as const;

function LibraryPanel(): ReactNode {
  const { libraryTab, mainView, isInstalled } = useHub();
  const settings = useSettings();
  /* See MainView, which decides the canvas from the same two facts. */
  const timelineHere = !settings.timelineAsApp || isInstalled("timeline");
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
  /* The Timeline's own column, but only while there is a Timeline. Once the
     app has been disconnected the canvas is the home dashboard, and a column of
     feed filters beside it would be filtering a feed that is not there. Home
     has no column of its own — its list, note and timer are in the pane on the
     right — so it falls back to the workspace's, like every other view. */
  if (mainView === "timeline" && timelineHere) return <TimelineSidebar />;
  /* Its own, and not filters: there is nothing on Focus to narrow. See the note
     on the component for what a contextual column says instead. */
  if (mainView === "home") return <FocusSidebar />;
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
  const box = useRef<HTMLDivElement>(null);

  /*
   * Publishes its own width as `--sidebar-width`.
   *
   * The Workspaces columns scroll underneath this column, so they need to know
   * how much of their left edge is covered — and that number is not a constant:
   * it is the rail plus a panel that animates between 0 and 296, and it is 0
   * below the `md` breakpoint where this whole column is display:none. Measured
   * rather than recomputed, so the collapse animation carries the columns with
   * it instead of jumping when it lands.
   */
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty(
        "--sidebar-width",
        `${node.getBoundingClientRect().width}px`
      );
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--sidebar-width");
    };
  }, []);

  return (
    /* Opaque and above the canvas, because something scrolls under it now.
       `bg-background` is what was showing through before, so this changes
       nothing to look at — it just stops the columns showing through the gap
       between the rail and the panel. */
    <div ref={box} className="bg-background relative z-20 flex h-full pl-2">
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
  const firstRunSeen = useFirstRunSeen();
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
      {/* Nothing at all outside the desktop shell. */}
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <div className="hidden md:block">
          <DesktopSidebar />
        </div>

        {/* Flush to the window, not floating in it. The canvas used to sit
            inset with the workspace's own gradient showing round all four
            edges, which framed every screen in a colour that was about the
            workspace rather than about what was on it — and cost a strip of
            room on all sides of the one region that is never wide enough. */}
        <div
          data-dimmed={pageDimmed}
          className="flex min-w-0 flex-1 origin-bottom transition-transform duration-300 ease-out data-[dimmed=true]:max-md:scale-[0.93]"
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
      {/* Not demo-gated, unlike the chip beside it: help is the one thing a
          shipped build needs most. Held back until the welcome is done, so it
          does not sit over the first run competing for the same attention. */}
      {firstRunSeen && <HelpCircle />}
      <GuidedTour />
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
  /*
   * Adopt the stored content mode, once, after the first paint.
   *
   * Subscribed as well as triggered: the mode is read inside the data
   * accessors, which are plain functions that eighty-odd components call during
   * render and none of them subscribe to. Holding it here means the one state
   * change re-renders the whole shell and every accessor is asked again — which
   * is what makes the correction arrive without a reload.
   *
   * See lib/content-mode for why both sides have to start empty.
   */
  useSyncExternalStore(
    subscribeContentMode,
    getContentMode,
    getContentModeServerSnapshot,
  );
  useEffect(hydrateContentMode, []);

  return (
    <HubProvider>
      <CustomThemeProvider>
        <Shell />
      </CustomThemeProvider>
    </HubProvider>
  );
}
