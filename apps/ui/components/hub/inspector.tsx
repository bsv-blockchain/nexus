"use client";

import { content } from "@/lib/data";
import { setSetting, useSettings } from "@/lib/settings-store";
import { ChevronDown, X } from "lucide-react";
import { useState, type ReactNode } from "react";

const copy = content.inspector;

type Tab = "console" | "network" | "lookups";

/**
 * What a page did, in three views.
 *
 * Seeded rather than instrumented. There is no engine under this browser, so the
 * honest thing is a panel whose contents plainly describe the mock page it is
 * docked under — not a live console pretending to have executed something. The
 * shapes are real: a console line has a level and a source, a request has a
 * method and a status, a BRC lookup has a topic and an overlay that answered.
 *
 * The Lookups tab is the one no other browser has, and the reason this panel is
 * worth building at all: it is the only place you can watch what a page asks the
 * overlay network for, and which overlay answered.
 */
const CONSOLE: {
  level: "log" | "warn" | "error";
  text: string;
  source: string;
}[] = [
  { level: "log", text: "wallet.isAuthenticated() → true", source: "brc-100.js:24" },
  {
    level: "log",
    text: "requesting identity certificate for @crumbs",
    source: "connect.js:88",
  },
  {
    level: "warn",
    text: "getPublicKey called without a protocol identifier; defaulting to the page origin",
    source: "brc-42.js:112",
  },
  {
    level: "error",
    text: "Uncaught (in promise) SpendDeclined: over the per-page cap",
    source: "checkout.js:301",
  },
  { level: "log", text: "listOutputs({ basket: 'tickets' }) → 3", source: "app.js:57" },
];

const NETWORK: {
  method: string;
  path: string;
  status: number;
  ms: number;
  size: string;
}[] = [
  { method: "GET", path: "/", status: 200, ms: 128, size: "14.2 kB" },
  { method: "GET", path: "/_next/static/chunk.js", status: 200, ms: 41, size: "82.7 kB" },
  { method: "POST", path: "/api/wallet/authenticate", status: 200, ms: 216, size: "412 B" },
  { method: "POST", path: "/api/wallet/createAction", status: 402, ms: 88, size: "196 B" },
  { method: "GET", path: "/favicon.ico", status: 304, ms: 12, size: "0 B" },
];

const LOOKUPS: {
  topic: string;
  overlay: string;
  outputs: number;
  ms: number;
}[] = [
  { topic: "tm_identity", overlay: "overlay.bsvb.tech", outputs: 1, ms: 94 },
  { topic: "tm_certificates", overlay: "overlay.bsvb.tech", outputs: 4, ms: 141 },
  { topic: "ls_tickets", overlay: "overlay.market.example", outputs: 3, ms: 203 },
  { topic: "tm_did", overlay: "overlay.treechat.example", outputs: 0, ms: 77 },
];

const TABS: { id: Tab; label: string }[] = [
  { id: "console", label: copy.console },
  { id: "network", label: copy.network },
  { id: "lookups", label: copy.lookups },
];

const LEVEL_TONE: Record<string, string> = {
  log: "text-muted-foreground",
  warn: "text-warning",
  error: "text-negative",
};

/** Green under 300, amber under 400, red beyond — the usual reading. */
function statusTone(status: number): string {
  if (status >= 400) return "text-negative";
  if (status >= 300) return "text-warning";
  return "text-positive";
}

/**
 * The developer panel, docked under the page.
 *
 * Under rather than beside, because a page being inspected still has to be
 * readable at its own width — a panel that takes a third of the horizontal space
 * reflows the thing you are trying to look at.
 */
export function Inspector(): ReactNode {
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>("console");
  const [collapsed, setCollapsed] = useState(false);
  if (!settings.devTools) return null;

  return (
    <section
      aria-label={copy.title}
      className="border-border bg-surface flex shrink-0 flex-col border-t"
      style={{ height: collapsed ? undefined : 220 }}
    >
      <header className="border-border/60 flex items-center gap-1 border-b px-2 py-1">
        {TABS.map((entry) => {
          const active = entry.id === tab && !collapsed;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setTab(entry.id);
                setCollapsed(false);
              }}
              className={`focus-ring rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "bg-accent/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
        <span className="flex-1" />
        {/* Seeded, and it says so. A console that looks live and is not would
            teach somebody to trust the next thing it shows them. */}
        <span className="text-muted-foreground mr-1 hidden text-[10px] sm:inline">
          {copy.mock}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={copy.collapse}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-md p-1"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {/* Closing the panel switches the setting off, rather than hiding a
            thing that is still on. One state, one control. */}
        <button
          type="button"
          onClick={() => setSetting("devTools", false)}
          aria-label={copy.close}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-md p-1"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </header>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px]">
          {tab === "console" &&
            CONSOLE.map((line, index) => (
              <div
                key={index}
                className="border-border/40 flex items-start gap-2 border-b px-3 py-1.5"
              >
                <span className={`min-w-0 flex-1 ${LEVEL_TONE[line.level]}`}>
                  {line.text}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {line.source}
                </span>
              </div>
            ))}

          {tab === "network" &&
            NETWORK.map((request, index) => (
              <div
                key={index}
                className="border-border/40 flex items-center gap-3 border-b px-3 py-1.5"
              >
                <span className="text-muted-foreground w-10 shrink-0">
                  {request.method}
                </span>
                <span className="min-w-0 flex-1 truncate">{request.path}</span>
                <span className={`w-8 shrink-0 ${statusTone(request.status)}`}>
                  {request.status}
                </span>
                <span className="text-muted-foreground w-14 shrink-0 text-right tabular-nums">
                  {request.ms} ms
                </span>
                <span className="text-muted-foreground w-16 shrink-0 text-right tabular-nums">
                  {request.size}
                </span>
              </div>
            ))}

          {tab === "lookups" &&
            (settings.overlayInspector ? (
              LOOKUPS.map((lookup, index) => (
                <div
                  key={index}
                  className="border-border/40 flex items-center gap-3 border-b px-3 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate">{lookup.topic}</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate">
                    {lookup.overlay}
                  </span>
                  <span
                    className={`w-20 shrink-0 text-right tabular-nums ${
                      lookup.outputs === 0
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {lookup.outputs} {copy.outputs}
                  </span>
                  <span className="text-muted-foreground w-14 shrink-0 text-right tabular-nums">
                    {lookup.ms} ms
                  </span>
                </div>
              ))
            ) : (
              /* The tab exists either way, and says which switch fills it.
                 A tab that is simply missing teaches nothing. */
              <p className="text-muted-foreground p-3 font-sans text-[11px] text-pretty">
                {copy.lookupsOff}
              </p>
            ))}
        </div>
      )}
    </section>
  );
}
