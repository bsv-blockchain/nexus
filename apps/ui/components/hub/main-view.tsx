"use client";

import { AttestationsApp } from "@/components/apps/attestations-app";
import { BasketsApp } from "@/components/apps/baskets-app";
import { BrowserApp } from "@/components/apps/browser-app";
import { ConnectApp } from "@/components/apps/connect-app";
import { IdentityApp } from "@/components/apps/identity-app";
import { LearnApp } from "@/components/apps/learn-app";
import { MailApp } from "@/components/apps/mail-app";
import { MessagesApp } from "@/components/apps/messages-app";
import { RoadmapApp } from "@/components/apps/roadmap-app";
import { MarketApp } from "@/components/apps/market-app";
import { PublisherApp } from "@/components/apps/publisher-app";
import { SignerApp } from "@/components/apps/signer-app";
import { TxViewerApp } from "@/components/apps/tx-viewer-app";
import { VaultApp } from "@/components/apps/vault-app";
import { VoteApp } from "@/components/apps/vote-app";
import { WalletApp } from "@/components/apps/wallet-app";
import { WebAppView } from "@/components/apps/web-app";
import { AppTile } from "@/components/hub/app-icon";
import { hasContextSidebar } from "@/components/hub/app-context-sidebar";
import { SettingsApp } from "@/components/apps/settings-app";
import { AppStore } from "@/components/hub/app-store";
import { DetailPane } from "@/components/hub/detail-pane";
import { GettingStartedPage } from "@/components/hub/getting-started-page";
import { ProfilesManager } from "@/components/hub/profiles-manager";
import { AppMenu, SplitPaneHeader } from "@/components/hub/app-menu";
import { SplitPicker } from "@/components/hub/split-picker";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import {
  content,
  getAppOnboarding,
  getHubApp,
  getHubApps,
  type HubApp,
  type NativeAppSlug,
} from "@/lib/data";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

// Apps that render their own header/chrome, so MainView shouldn't add one.
const selfChromedApps = new Set<AppSlug>([
  "signer",
  "publisher",
  "messages",
  "mail",
  "market",
  "wallet",
]);

/**
 * Signature apps — the ones Nexus ships itself. They're designed against the
 * token palette, so they inherit the user's active theme instead of resetting
 * to the base light/dark one. Third-party apps added later stay on
 * `theme-reset`, which keeps their styling predictable and sandboxed.
 */
const signatureApps = new Set<AppSlug>([
  "browser",
  "connect",
  "wallet",
  "signer",
  "publisher",
  "tx-viewer",
  "messages",
  "mail",
  "learn",
  "market",
  "vault",
  "vote",
  "baskets",
  "identity",
  "attestations",
  "roadmap",
]);

/*
 * Every app we ship, and nothing else.
 *
 * Keyed by `NativeAppSlug` rather than by every slug in the store, so the
 * compiler still refuses a native app with no view while never asking for one
 * behind a website. Web listings render through `WebAppView` below.
 */
const appViews: Record<NativeAppSlug, () => ReactNode> = {
  browser: BrowserApp,
  connect: ConnectApp,
  wallet: WalletApp,
  signer: SignerApp,
  publisher: PublisherApp,
  "tx-viewer": TxViewerApp,
  messages: MessagesApp,
  mail: MailApp,
  learn: LearnApp,
  market: MarketApp,
  vault: VaultApp,
  vote: VoteApp,
  baskets: BasketsApp,
  identity: IdentityApp,
  attestations: AttestationsApp,
  roadmap: RoadmapApp,
};

/** Whether anything can draw this app — a view we ship, or a site to frame. */
function hasView(slug: AppSlug): boolean {
  return slug in appViews || Boolean(getHubApp(slug)?.web);
}

/**
 * Whatever draws a given app, whether we wrote it or not.
 *
 * One component for both kinds, so the canvas and the split pane ask the same
 * question and cannot disagree about what an app is. Declared here rather than
 * returned from a lookup: a component built during render is a new type every
 * render, and the app inside it would lose its state on every keystroke
 * elsewhere on the page.
 */
function AppBody({ slug }: { slug: AppSlug }): ReactNode {
  const View = slug in appViews ? appViews[slug as NativeAppSlug] : undefined;
  if (View) return <View />;
  const app = getHubApp(slug);
  return app?.web ? <WebAppView app={app} /> : null;
}

function LauncherTile({
  app,
  onOpen,
  hint,
  hintAccent = false,
}: {
  app: HubApp;
  onOpen: () => void;
  hint: string;
  hintAccent?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group focus-ring flex flex-col items-center gap-2 rounded-2xl p-2"
    >
      <span className="bg-surface-raised ring-border/60 group-hover:ring-accent/50 flex size-18 items-center justify-center rounded-3xl shadow-sm ring-1 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <AppTile app={app} size={44} />
      </span>
      <span className="text-sm font-semibold">{app.shortName}</span>
      <span
        className={`-mt-1 h-4 text-xs opacity-0 transition-opacity group-hover:opacity-100 ${
          hintAccent ? "text-accent font-semibold" : "text-muted-foreground"
        }`}
      >
        {hint}
      </span>
    </button>
  );
}

function EmptyState(): ReactNode {
  const { isInstalled, openApp, openAppPrompt } = useHub();
  const all = getHubApps();
  const installed = all.filter((app) => isInstalled(app.slug));
  const available = all.filter((app) => !isInstalled(app.slug));

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-6 sm:p-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-2xl font-bold text-balance">
          Welcome to {content.brand.name}
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-center text-sm text-balance">
          {content.brand.description}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
          {installed.map((app) => (
            <LauncherTile
              key={app.slug}
              app={app}
              hint={app.tagline}
              onOpen={() => openApp(app.slug)}
            />
          ))}
        </div>

        {available.length > 0 && (
          <>
            <h2 className="text-muted-foreground mt-10 mb-3 px-1 text-xs font-semibold tracking-wide uppercase">
              {content.appStore.moreApps}
            </h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
              {available.map((app) => (
                <LauncherTile
                  key={app.slug}
                  app={app}
                  hint={content.appStore.installHint}
                  hintAccent
                  onOpen={() => openAppPrompt(app.slug, "install")}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Active-app content: optional header + the app view (or empty state). */
function AppCanvas(): ReactNode {
  const { activeApp, activeRef, openDetailPane } = useHub();
  const app = activeApp ? getHubApp(activeApp) : undefined;
  /* A connected site reads as no app being open — the canvas is a website at
     that point — so it is routed to the browser explicitly. Without this a
     tapped site lands on the launcher, which is where the rail's whole reason
     for carrying sites quietly stops working. */
  const onSite = activeRef.kind === "site";
  const drawable = activeApp !== null && hasView(activeApp);
  // Signature apps inherit the active theme; anything else opts out of it
  // (theme-reset restores the base light/dark palette). The launcher/empty
  // state is always themed.
  const resetTheme = Boolean(activeApp) && !signatureApps.has(activeApp!);
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${
        activeApp ? "bg-background" : ""
      } ${resetTheme ? "theme-reset" : ""}`}
    >
      {app && app.slug !== "browser" && !selfChromedApps.has(app.slug) && (
        <header className="border-border flex shrink-0 items-center gap-2 border-b px-5 py-3">
          <AppTile app={app} size={24} />
          <h1 className="min-w-0 flex-1 text-sm font-semibold">{app.name}</h1>
          {/* Offered where something has been written for this app *and* its
              column does not already carry the button. Two ways into one pane,
              a few hundred pixels apart, teaches that they are different
              panes. The column's bar wins because every app has one; this
              header only exists for apps without their own chrome. */}
          {getAppOnboarding(app.slug) && !hasContextSidebar(app.slug) && (
            <button
              type="button"
              onClick={() =>
                openDetailPane({ kind: "onboarding", id: app.slug })
              }
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {content.onboarding.button}
            </button>
          )}
          {/* Same corner in every app. "What can I do with this thing" should
              have one answer everywhere rather than being wherever each app
              happened to put it. */}
          <AppMenu slug={app.slug} />
        </header>
      )}
      {/* The app and its reference pane share the row, so opening the pane
          narrows the app rather than covering it. */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1">
          {drawable ? (
            <AppBody slug={activeApp} />
          ) : onSite ? (
            <BrowserApp />
          ) : (
            <EmptyState />
          )}
        </div>
        <DetailPane />
      </div>
    </div>
  );
}

/**
 * The second pane's body: whichever app it has been pointed at.
 *
 * Deliberately not `AppCanvas`, which reads the active app and would show the
 * same thing twice. Signature apps keep the theme here as they do on the left.
 */
function SplitCanvas(): ReactNode {
  const { splitApp } = useHub();
  /* Empty means the pane is asking, and it asks here rather than from a menu
     in its header — the room is already free, and the choice deserves it. */
  if (!splitApp) return <SplitPicker />;
  if (!hasView(splitApp)) return null;
  const resetTheme = !signatureApps.has(splitApp);
  return (
    <div
      className={`bg-background flex h-full min-h-0 flex-col ${
        resetTheme ? "theme-reset" : ""
      }`}
    >
      <AppBody slug={splitApp} />
    </div>
  );
}

/** The right-hand canvas: Getting Started, app store, Profiles manager, or the active app. */
export function MainView(): ReactNode {
  const { activeApp, activePage, mainView, splitApp } = useHub();
  const isDesktop = useIsDesktop();
  const showStore = mainView === "store";
  /* Settings paints on the app background, never the browser page's. Without
     this it inherits `bg-canvas` whenever Browse happens to be the app behind
     it, and renders dark-theme text on a white sheet. */
  const showSettings = mainView === "settings";
  const showProfiles = mainView === "profiles";
  const canvasIsBrowser = activeApp === "browser" && !activePage;

  /*
   * Profiles manager: profile columns on the left, the active app on the right —
   * except when that app is Browse.
   *
   * A live page beside the profile columns puts two browsers on screen at once,
   * and the profile columns are themselves lists of tabs. Which set the one
   * loaded page belonged to was a question the layout could not answer, and the
   * rail answered it wrongly by lighting Profiles and Browse together.
   *
   * So Browse steps aside here and the columns take the width. Every other app
   * keeps its half: opening Profiles next to Messages is a comparison, opening
   * it next to a web page is a duplicate.
   */
  if (showProfiles) {
    /* The columns, and whatever pane they open. Removing the app canvas from
       this view took the pane slot with it, so the help button had nowhere to
       render into and looked broken. */
    return (
      <div className="flex h-full min-w-0 flex-1">
        <div className="h-full min-w-0 flex-1 overflow-x-auto">
          <ProfilesManager />
        </div>
        <DetailPane />
      </div>
    );
  }

  /*
   * Two apps, side by side, and never more.
   *
   * Only while an app is showing: the store and the profiles manager are
   * already multi-column screens, and a split inside one of those is a third
   * set of columns nobody asked for. Only on a desktop layout, because below it
   * a split is two half-width apps, which is neither of them.
   */
  if (
    splitApp !== null &&
    !showStore &&
    !showSettings &&
    !showProfiles &&
    isDesktop
  ) {
    return (
      <div className="flex h-full min-w-0 flex-1 gap-2">
        <main
          id="main-content"
          className={`border-border flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-xl ${
            canvasIsBrowser ? "bg-canvas" : "bg-background"
          }`}
        >
          <AppCanvas />
        </main>
        <section
          aria-label={content.appMenu.pickApp}
          className="border-border bg-background flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-xl"
        >
          <SplitPaneHeader />
          <div className="min-h-0 flex-1">
            <SplitCanvas />
          </div>
        </section>
      </div>
    );
  }

  return (
    <main
      id="main-content"
      className={`border-border flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-xl ${
        !showStore && !showSettings && canvasIsBrowser
          ? "bg-canvas"
          : "bg-background"
      }`}
    >
      {showSettings ? (
        /* Settings and its reference pane share the row, the same way an app and
           its pane do — the What's new pane is opened from here. */
        <div className="flex min-h-0 flex-1">
          {/* A flex column, not a plain box. Settings' own scroller asks for
              `flex-1 min-h-0`, which does nothing inside a non-flex parent — so
              it sized to its content, grew past the height it was given, and got
              clipped by the shell instead of scrolling. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SettingsApp />
          </div>
          <DetailPane />
        </div>
      ) : activePage === "getting-started" ? (
        <div className="min-h-0 flex-1">
          <GettingStartedPage />
        </div>
      ) : showStore ? (
        /* Same row Settings uses: the store, then whatever pane is open beside
           it. Without this the Mods guide had a button and nowhere to render —
           the store was the one canvas in the shell with no pane slot. */
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AppStore />
          </div>
          <DetailPane />
        </div>
      ) : (
        <AppCanvas />
      )}
    </main>
  );
}
