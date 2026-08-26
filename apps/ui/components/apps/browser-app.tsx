"use client";

import { Inspector } from "@/components/hub/inspector";
import { TumbleBar } from "@/components/apps/browser/tumble-bar";
import { internalPage } from "@/lib/tabs";
import { ExtensionsPage } from "@/components/apps/extensions-page";
import { TumbleUponPage } from "@/components/apps/tumbleupon-page";
import { grantConnection, originOf } from "@/lib/connections-store";
import { useSettings } from "@/lib/settings-store";
import { sameUrl } from "@/lib/tabs";
import { activeWalletFor, useWallets } from "@/lib/wallets-store";
import { useHub } from "@/components/hub/hub-provider";
import { OriginChip } from "@/components/hub/origin-chip";
import {
  getExtensions,
  getHubApps,
  getMockPage,
  type BrowserTab,
  type MockPage,
} from "@/lib/data";
import { forgetShellTab, noteShellTab } from "@/lib/wallet-reach";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const INTERNAL_SEARCH_HOST = "search.nexus.example";

/**
 * NEXUS SHELL INTEGRATION (spike).
 *
 * When this UI runs inside a Nexus shell (Electron on desktop, Expo/RN on mobile)
 * `window.nexusHost` exists, and a real site is rendered by a NATIVE webview layer
 * positioned over this pane rather than by an iframe. That removes the limitation
 * SiteFrame documents below: X-Frame-Options / CSP frame-ancestors cannot blank a
 * native webview, and the wallet substrate can be injected at document-start, which
 * an iframe can never allow.
 *
 * This component owns nothing but a measured rectangle. Everything else — tab
 * lifecycle, navigation, injection — belongs to the shell.
 */
type NexusHost = {
  tabs: {
    create: (url: string, opts?: Record<string, unknown>) => Promise<{ id: string }>;
    destroy: (id: string) => Promise<unknown>;
    setActive: (id: string) => Promise<unknown>;
    setBounds: (
      id: string,
      rect: { x: number; y: number; width: number; height: number },
    ) => Promise<unknown>;
  };
};

function getHost(): NexusHost | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { nexusHost?: NexusHost }).nexusHost ?? null;
}

/** A site rendered by the shell's native webview, glued to this element's rect. */
/**
 * On mobile the chrome's browse bar is `fixed` and floats OVER the browse pane, which is
 * full-bleed by design. A native webview paints ABOVE the WebView holding this document,
 * so whatever the tab rect covers is not dimmed — it is gone. An iframe can sit under
 * translucent chrome; a native layer cannot.
 *
 * So the rect stops exactly where that bar starts, and the bar is MEASURED rather than
 * assumed: it carries `data-nexus-browse-bar`, its height varies with the device's
 * safe-area inset, and a hardcoded guess is wrong on every device it was not tuned on.
 * The constant below is only the fallback for the frame before the bar has mounted.
 *
 * Nothing is reserved at the top: the shell already insets this whole document below the
 * notch, so chrome-y 0 is the first safe pixel. Exactly one layer may own the safe area,
 * and it is the shell — see apps/mobile/App.tsx, where the tab layer is offset by
 * POSITION so its coordinate space and this document's share an origin.
 */
const MOBILE_BREAKPOINT = 768;
const BROWSE_BAR_FALLBACK = 100;

/** Height of the floating browse bar, or the fallback when it has not mounted yet. */
function browseBarHeight(): number {
  const bar = document.querySelector("[data-nexus-browse-bar]");
  const h = bar?.getBoundingClientRect().height ?? 0;
  return h > 0 ? Math.ceil(h) : BROWSE_BAR_FALLBACK;
}

/*
 * There used to be an `originChipBottom()` here, measuring a row above the page
 * so the native rect could start below it. Gone with the row: on narrow the
 * origin chip now lives in the bottom bar's middle cell (see OriginChip's
 * `placement`), which the bar's own measurement already covers. The row it
 * replaced cost a third of an inch of page on every phone, and the bar was
 * holding that cell open for a site regardless.
 *
 * Wide layouts keep the row and need no measurement: the pane's own rect is
 * below it already.
 */

function NativeSiteFrame({
  url,
  tabId,
}: {
  url: string;
  /**
   * The chrome's own id for the row this page belongs to.
   *
   * Passed only so a wallet call can be attributed back to a tab: the shell
   * names its native tabs and the chrome names its rows, and this is the one
   * place both ids are in scope. See lib/wallet-reach.
   */
  tabId?: string;
}): ReactNode {
  const boxRef = useRef<HTMLDivElement>(null);
  const tabIdRef = useRef<string | null>(null);

  useEffect(() => {
    const host = getHost();
    if (!host) return;

    let disposed = false;

    const pushBounds = () => {
      const el = boxRef.current;
      const id = tabIdRef.current;
      if (!el || !id) return;
      const r = el.getBoundingClientRect();
      const narrow = window.innerWidth < MOBILE_BREAKPOINT;
      if (narrow) {
        // Full-bleed, deliberately ignoring this element's own rect. The pane sits
        // inside the shell's shared p-2 content container, which is right for every
        // other app and wrong for a browser — a phone should show the page edge to
        // edge. Overriding the rect here keeps that decision local to browsing
        // instead of unpadding a container the whole UI shares.
        //
        // The document already starts below the notch (the shell insets it), so
        // the only thing to avoid is the floating bar at the bottom — which now
        // also carries the origin chip, so there is nothing left at the top to
        // reserve for.
        void host.tabs.setBounds(id, {
          x: 0,
          y: 0,
          width: Math.round(window.innerWidth),
          height: Math.round(Math.max(0, window.innerHeight - browseBarHeight())),
        });
        return;
      }
      // Wide layouts give the browse pane a real content region: its rect is already
      // correct, and the floating bar does not exist there.
      void host.tabs.setBounds(id, {
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    };

    void host.tabs
      .create(url, {})
      .then(({ id }) => {
        // A tab created after unmount would be orphaned above the chrome forever.
        if (disposed) return host.tabs.destroy(id);
        tabIdRef.current = id;
        // Both ids are in scope for the first and only time here.
        if (tabId) noteShellTab(id, tabId);
        return host.tabs.setActive(id).then(pushBounds);
      })
      .catch(() => {
        // Shell refused; nothing to clean up. The pane stays empty rather than
        // throwing inside the chrome.
      });

    const ro = new ResizeObserver(pushBounds);
    if (boxRef.current) ro.observe(boxRef.current);
    // The browse bar mounts and animates independently of this pane, so the first
    // measurement can land before it exists and latch the fallback height. Observe it
    // once it appears — and re-push on the next frame, which covers the case where it
    // mounted between this effect and the tab actually being created.
    // Observing the bar covers the origin chip too, now that the chip is inside
    // it: a long host wraps, the bar grows, and this fires. The chip used to be
    // observed separately because it was a row of its own above the page.
    const bar = document.querySelector("[data-nexus-browse-bar]");
    if (bar) ro.observe(bar);
    const raf = requestAnimationFrame(pushBounds);
    window.addEventListener("resize", pushBounds);
    // Capture phase: any ancestor scrolling moves this pane without resizing it.
    window.addEventListener("scroll", pushBounds, true);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", pushBounds);
      window.removeEventListener("scroll", pushBounds, true);
      const id = tabIdRef.current;
      tabIdRef.current = null;
      if (id) {
        forgetShellTab(id);
        void host.tabs.destroy(id);
      }
    };
  }, [url, tabId]);

  /*
   * `bg-background`, not `bg-canvas`. Nothing of this element is ever meant to be
   * seen — the native layer paints over all of it — so its colour only shows in
   * the moments and slivers where the page does not: before the shell has created
   * the tab, and in whatever sub-pixel the rounded/rounded-off bounds leave
   * uncovered. `--canvas` is #f2f1ef in BOTH themes, so on a dark build those
   * were a near-white flash and a near-white hairline round the page. App chrome
   * is what should be behind app chrome.
   */
  return <div ref={boxRef} className="h-full w-full bg-background" />;
}

/**
 * Hand the workspace's wallet to a metanet site, if that is the standing answer.
 *
 * Here rather than in Browse, because this component is what every site goes
 * through — the ones you type into the address bar and the ones sitting on the
 * rail as apps. One hook covers both, and a second copy in the rail's open path
 * would be a second copy to keep in step.
 *
 * WHAT COUNTS AS METANET-ENABLED. A real client learns this from the handshake:
 * the page loads the substrate and asks for an identity. Nothing in this
 * prototype's fixtures can be asked, so the stand-in is the catalogue — a site
 * that the App Store lists as an app is one somebody has already established
 * speaks BRC-100. That is a narrower rule than the real one and never a wider
 * one, which is the right direction for a rule about granting access.
 *
 * The grant is per workspace, because the wallet is. Opening the same site in
 * Work and in Personal connects two different wallets, which is the entire
 * reason a workspace has one of its own.
 */
function useAutoConnect(url: string, title: string): void {
  const { activeSpaceId } = useHub();
  const settings = useSettings();
  useWallets();
  const walletId = activeWalletFor(activeSpaceId)?.id;
  const auto = settings.autoConnectSites === "auto";

  useEffect(() => {
    if (!auto || !walletId) return;
    const origin = originOf(url);
    /* Matched on the whole URL rather than the origin: a listing is a page, and
       two apps can share a host. `sameUrl` is what SiteTile already uses to
       recognise a pinned listing, so the two agree about what counts. */
    const listed = getHubApps().find(
      (app) => app.web && sameUrl(app.web.url, url),
    );
    if (!listed) return;
    grantConnection({
      origin,
      name: listed.name || title,
      category: listed.categories[0] ?? "other",
      walletId,
      spaceId: activeSpaceId,
      now: new Date().toISOString(),
    });
  }, [auto, walletId, url, title, activeSpaceId]);
}

/**
 * Shell detection has to happen in an effect, not at render: the server render has
 * no window, and reading it during the first client render would desync hydration.
 */
function useHasShell(): boolean {
  const [hasShell, setHasShell] = useState(false);
  useEffect(() => {
    const check = () => setHasShell(!!getHost());
    check();
    window.addEventListener("nexushost:ready", check);
    return () => window.removeEventListener("nexushost:ready", check);
  }, []);
  return hasShell;
}

/** The live site, embedded. Keyed by URL upstream so state resets per page. */
export function SiteFrame({
  url,
  title,
}: {
  url: string;
  title: string;
}): ReactNode {
  const [loaded, setLoaded] = useState(false);
  useAutoConnect(url, title);

  return (
    <div className="relative h-full w-full bg-canvas">
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center text-canvas-foreground"
          aria-hidden="true"
        >
          <Loader2 className="size-6 animate-spin opacity-40" />
        </div>
      )}
      <iframe
        src={url}
        title={title}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className={`h-full w-full border-0 ${loaded ? "" : "opacity-0"}`}
      />
    </div>
  );
}

/**
 * A page rendered from seeded content rather than embedded. Used for hosts that
 * refuse to be framed, where an iframe would leave the canvas blank.
 */
function LocalPage({ page }: { page: MockPage }): ReactNode {
  return (
    <div className="h-full overflow-y-auto bg-canvas px-10 py-24 text-canvas-foreground sm:px-24">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          {page.heading}
        </h1>
        <p className="mt-4 leading-relaxed text-pretty">{page.body}</p>
        <a
          href={page.linkHref}
          className="focus-ring mt-8 inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          {page.linkText}
        </a>
      </div>
    </div>
  );
}

/** Placeholder results page for the internal search fallback. */
function SearchPage({ url }: { url: string }): ReactNode {
  let query = "";
  try {
    query = new URL(url).searchParams.get("q") ?? "";
  } catch {
    // leave query empty
  }

  return (
    <div className="h-full overflow-y-auto bg-canvas px-10 py-24 text-canvas-foreground sm:px-24">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Search{query ? `: ${query}` : ""}
        </h1>
        <p className="mt-4 leading-relaxed">
          Search results are a placeholder for now — they arrive when Nexus
          ships with its embedded engine.
        </p>
      </div>
    </div>
  );
}

/** The page itself, by whichever of the four routes this build can show it. */
function BrowserCanvas({
  tab,
  hasShell,
}: {
  tab: BrowserTab;
  hasShell: boolean;
}): ReactNode {
  if (tab.url.includes(INTERNAL_SEARCH_HOST)) {
    return <SearchPage url={tab.url} />;
  }

  /* Served by the browser, so it never reaches the native layer — same route
     the search page takes. See INTERNAL_PAGES in lib/tabs. */
  if (tab.url === "nexus://extensions") {
    return <ExtensionsPage />;
  }

  if (tab.url === "nexus://tumbleupon") {
    return <TumbleUponPage />;
  }

  // Inside a shell every real URL goes to the native layer — the mock/localOnly
  // fallbacks exist only because the web build cannot embed un-frameable hosts.
  if (hasShell) {
    return <NativeSiteFrame key={tab.url} url={tab.url} tabId={tab.id} />;
  }

  const page = getMockPage(tab.url);
  if (page?.localOnly) {
    return <LocalPage page={page} />;
  }

  return <SiteFrame key={tab.url} url={tab.url} title={tab.title} />;
}

/** Renders the active tab's site in the canvas viewport. */
/**
 * The page, with the developer panel under it when it is switched on.
 *
 * Wrapped here rather than inside each of the three page kinds, so the panel
 * appears under a real site, a local profile page and the search results alike —
 * one place to dock it, and no page that quietly lacks it.
 */
export function BrowserApp(): ReactNode {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <BrowserPage />
      </div>
      <Inspector />
    </div>
  );
}

function BrowserPage(): ReactNode {
  const { activeTab, activeRef, setActiveRef, unpinSite, navigateActiveTab } =
    useHub();
  /* The toolbar follows the extension's own switch, so turning TumbleUpon off
     in the manager is what takes the bar away — otherwise that switch would be
     a control with nothing behind it. */
  const tumbleOn = getExtensions().some(
    (entry) => entry.id === "tumbleupon" && entry.enabled,
  );
  const hasShell = useHasShell();

  if (!activeTab) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">
          Open a tab from the sidebar, or press ⌘T.
        </p>
      </div>
    );
  }

  /*
   * ONE root, whichever the active ref is, and the chip conditional INSIDE it.
   *
   * Returning `<div>` for a site and `<BrowserCanvas>` otherwise looked
   * equivalent and was not: React reconciles by element type, so switching
   * between them unmounted the subtree, and NativeSiteFrame's cleanup fired
   * `tabs.destroy` before anything created a replacement. The chip's own two
   * actions — Open in Browser, Remove from rail — each reloaded the page they
   * were acting on and lost whatever the user had typed into it, as did tapping
   * a rail site whose tab was already open.
   *
   * The chip is a `&&` in a fixed-shape children list rather than a spliced-in
   * element, so BrowserCanvas keeps the same child position whether or not the
   * chip is there. A `null` slot still holds its place; a shifted index would
   * remount for the same reason.
   *
   * A site gets the chip because it is app-like — no address bar anywhere on the
   * canvas, so nothing else names the origin. It is handed `activeTab.url`,
   * never the pinned row's url; see OriginChip for what that does and does not
   * currently buy.
   *
   * WIDE LAYOUTS ONLY, and the responsive rule lives inside OriginChip rather
   * than here — `placement="canvas"` carries its own `hidden md:flex`. On narrow
   * the chip is in the bottom bar's middle cell (MobileBrowser), because a row
   * above the page spent page height on the one form factor that has none to
   * spare. Still rendered on both, so the conditional below keeps a constant
   * shape and BrowserCanvas keeps its child position — see the remount above.
   */
  const siteId = activeRef.kind === "site" ? activeRef.id : null;
  return (
    /*
     * `bg-background`: this is the FRAME, not the page.
     *
     * Every one of the four page renderers paints its own `bg-canvas`, so the only
     * pixels this colour reaches are the ones around the page — the origin chip's
     * row, and the corners the parent's `rounded-xl overflow-hidden` clips. With
     * `bg-canvas` here those read as a near-white band and a near-white outline
     * wrapped round a dark page, because `--canvas` is #f2f1ef in the dark theme
     * too. The chip is chrome; it belongs on the app's own surface.
     */
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {siteId !== null && (
        <OriginChip
          url={activeTab.url}
          onOpenInBrowser={() => setActiveRef({ kind: "app", slug: "browser" })}
          onRemove={() => unpinSite(siteId)}
        />
      )}
      {/*
        The extension's toolbar, above the page it is about.

        Only over real pages: the browser's own screens are not sites you can
        like, share or tumble away from, and a discovery bar over the extensions
        manager is a bar offering to send somebody a settings screen.
      */}
      {tumbleOn && !internalPage(activeTab.url) && (
        <TumbleBar
          url={activeTab.url}
          onNavigate={(url) => navigateActiveTab(url)}
        />
      )}
      <div className="min-h-0 flex-1">
        <BrowserCanvas tab={activeTab} hasShell={hasShell} />
      </div>
    </div>
  );
}
