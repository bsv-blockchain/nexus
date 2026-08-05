"use client";

import { useHub } from "@/components/hub/hub-provider";
import { getMockPage, type MockPage } from "@/lib/data";
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

function NativeSiteFrame({ url }: { url: string }): ReactNode {
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
        // The document already starts below the notch (the shell insets it), so the
        // only thing to avoid is the floating bar at the bottom.
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
      if (id) void host.tabs.destroy(id);
    };
  }, [url]);

  return <div ref={boxRef} className="h-full w-full bg-canvas" />;
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
function SiteFrame({ url, title }: { url: string; title: string }): ReactNode {
  const [loaded, setLoaded] = useState(false);

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

/** Renders the active tab's site in the canvas viewport. */
export function BrowserApp(): ReactNode {
  const { activeTab } = useHub();
  const hasShell = useHasShell();

  if (!activeTab) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas text-canvas-foreground">
        <p className="text-sm opacity-60">
          Open a tab from the sidebar, or press ⌘T.
        </p>
      </div>
    );
  }

  if (activeTab.url.includes(INTERNAL_SEARCH_HOST)) {
    return <SearchPage url={activeTab.url} />;
  }

  // Inside a shell every real URL goes to the native layer — the mock/localOnly
  // fallbacks exist only because the web build cannot embed un-frameable hosts.
  if (hasShell) {
    return <NativeSiteFrame key={activeTab.url} url={activeTab.url} />;
  }

  const page = getMockPage(activeTab.url);
  if (page?.localOnly) {
    return <LocalPage page={page} />;
  }

  return (
    <SiteFrame
      key={activeTab.url}
      url={activeTab.url}
      title={activeTab.title}
    />
  );
}
