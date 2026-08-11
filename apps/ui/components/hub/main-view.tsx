"use client";

import { AttestationsApp } from "@/components/apps/attestations-app";
import { BasketsApp } from "@/components/apps/baskets-app";
import { BrowserApp } from "@/components/apps/browser-app";
import { ConnectApp } from "@/components/apps/connect-app";
import { IdentityApp } from "@/components/apps/identity-app";
import { LearnApp } from "@/components/apps/learn-app";
import { MailApp } from "@/components/apps/mail-app";
import { MessagesApp } from "@/components/apps/messages-app";
import { MarketApp } from "@/components/apps/market-app";
import { PublisherApp } from "@/components/apps/publisher-app";
import { SignerApp } from "@/components/apps/signer-app";
import { TxViewerApp } from "@/components/apps/tx-viewer-app";
import { VaultApp } from "@/components/apps/vault-app";
import { VoteApp } from "@/components/apps/vote-app";
import { WalletApp } from "@/components/apps/wallet-app";
import { AppTile } from "@/components/hub/app-icon";
import { SettingsApp } from "@/components/apps/settings-app";
import { Web3Apps } from "@/components/apps/web3-apps";
import { DetailPane } from "@/components/hub/detail-pane";
import { GettingStartedPage } from "@/components/hub/getting-started-page";
import { ProfilesManager } from "@/components/hub/profiles-manager";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import { content, getHubApp, getHubApps, type HubApp } from "@/lib/data";
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
]);

const appViews: Record<AppSlug, () => ReactNode> = {
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
};

function LauncherTile({
  app,
  onOpen,
  hint,
}: {
  app: HubApp;
  onOpen: () => void;
  hint: string;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group focus-ring flex flex-col items-center gap-2 rounded-2xl p-2"
    >
      <span className="flex size-18 items-center justify-center rounded-3xl bg-surface-raised shadow-sm ring-1 ring-border/60 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:ring-accent/50">
        <AppTile app={app} size={44} />
      </span>
      <span className="text-sm font-semibold">{app.shortName}</span>
      <span className="-mt-1 h-4 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {hint}
      </span>
    </button>
  );
}

/**
 * The launcher, shown when the active ref names no app this build carries.
 *
 * One grid, holding every app compiled in. There is no second grid of apps to
 * add: nothing here is installable, so the "more apps" section had nothing left
 * to point at once the store went. Sites are absent on purpose — a pinned site
 * is reached from the rail or from Web3 Apps, and putting them here would make
 * this screen a directory.
 */
function EmptyState(): ReactNode {
  const { openApp } = useHub();

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-6 sm:p-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-2xl font-bold text-balance">
          Welcome to {content.brand.name}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-balance text-muted-foreground">
          {content.brand.description}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
          {getHubApps().map((app) => (
            <LauncherTile
              key={app.slug}
              app={app}
              hint={app.tagline}
              onOpen={() => openApp(app.slug)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Active-app content: optional header + the app view (or empty state). */
function AppCanvas(): ReactNode {
  const { activeApp, activeRef } = useHub();
  const app = activeApp ? getHubApp(activeApp) : undefined;
  /* A pinned site reads as no app being open — the canvas is a website at that
     point — so it has to be routed to the browser explicitly. Without this a
     tapped site lands on the launcher, which is where the rail's whole reason
     for carrying sites quietly stops working. */
  const View = activeApp
    ? appViews[activeApp]
    : activeRef.kind === "site"
      ? BrowserApp
      : undefined;
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
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3">
          <AppTile app={app} size={24} />
          <h1 className="text-sm font-semibold">{app.name}</h1>
        </header>
      )}
      {/* The app and its reference pane share the row, so opening the pane
          narrows the app rather than covering it. */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1">
          {View ? <View /> : <EmptyState />}
        </div>
        <DetailPane />
      </div>
    </div>
  );
}

/** The right-hand canvas: Getting Started, Web3 Apps, Profiles manager, or the active app. */
export function MainView(): ReactNode {
  // `activeApp` and `activeRef` went with the background switch below: which app is
  // behind this shell no longer changes what colour it is.
  const { activePage, mainView } = useHub();
  const showSites = mainView === "sites";
  const showSettings = mainView === "settings";
  const showProfiles = mainView === "profiles";

  /*
   * THIS SHELL IS ALWAYS `bg-background`.
   *
   * It used to switch to `bg-canvas` when the app behind it was the browser, on
   * the theory that the canvas is a web page and a web page is white. Two things
   * were wrong with that. `--canvas` is #f2f1ef in the DARK theme as well as the
   * light one, and every page renderer in browser-app.tsx already paints its own
   * `bg-canvas` — so the switch never coloured a page, only the chrome around one:
   * the origin chip's row and the corners `rounded-xl overflow-hidden` clips. On a
   * dark build that was a near-white band and outline framing a dark page.
   *
   * It also needed a guard per surface that is NOT a page (Settings had one, with
   * a comment about rendering dark text on a white sheet), and every new surface
   * would have needed its own. One background, no exceptions, no guards.
   */

  // Profiles manager: profile columns on the left, the active app on the right.
  if (showProfiles) {
    return (
      <div className="flex h-full min-w-0 flex-1 gap-2">
        <div className="h-full max-w-[62%] shrink-0 overflow-x-auto">
          <ProfilesManager />
        </div>
        <main
          id="main-content"
          className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        >
          <AppCanvas />
        </main>
      </div>
    );
  }

  return (
    <main
      id="main-content"
      className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
    >
      {showSettings ? (
        /* Settings and its reference pane share the row, the same way an app and
           its pane do — the What's new pane is opened from here. */
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1">
            <SettingsApp />
          </div>
          <DetailPane />
        </div>
      ) : activePage === "getting-started" ? (
        <div className="min-h-0 flex-1">
          <GettingStartedPage />
        </div>
      ) : showSites ? (
        <div className="min-h-0 flex-1">
          <Web3Apps />
        </div>
      ) : (
        <AppCanvas />
      )}
    </main>
  );
}
