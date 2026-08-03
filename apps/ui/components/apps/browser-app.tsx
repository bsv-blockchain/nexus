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
 * On mobile the chrome's pill bar and tab bar are `fixed` and float OVER the browse pane,
 * which is full-bleed by design. A native webview paints above the WebView holding this
 * document, so a full-bleed rect hides those controls completely — the app looks like
 * nothing but the browsed site.
 *
 * An iframe can sit under translucent chrome; a native layer cannot. So on narrow layouts
 * the rect is inset past the bars. Wide layouts have a real content pane and need no
 * inset. Values are deliberately slightly generous: overlapping the controls is a broken
 * app, a few pixels of extra margin is not.
 */
const MOBILE_BREAKPOINT = 768;
const MOBILE_CHROME_INSET = { top: 72, bottom: 100 };

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
      const top = narrow ? MOBILE_CHROME_INSET.top : 0;
      const bottom = narrow ? MOBILE_CHROME_INSET.bottom : 0;
      void host.tabs.setBounds(id, {
        x: Math.round(r.left),
        y: Math.round(r.top + top),
        width: Math.round(r.width),
        height: Math.round(Math.max(0, r.height - top - bottom)),
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
    window.addEventListener("resize", pushBounds);
    // Capture phase: any ancestor scrolling moves this pane without resizing it.
    window.addEventListener("scroll", pushBounds, true);

    return () => {
      disposed = true;
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
