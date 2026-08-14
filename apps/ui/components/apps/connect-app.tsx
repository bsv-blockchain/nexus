"use client";

import { toggleConnection, useSettings } from "@/lib/settings-store";
import { Favicon } from "@/components/hub/favicon";
import { useHub } from "@/components/hub/hub-provider";
import { content, getConnections } from "@/lib/data";
import { Link2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConnectApp(): ReactNode {
  const { connectSelected } = useHub();
  const connections = getConnections();
  const copy = content.connect;
  const settings = useSettings();
  /*
   * An explicit selection wins, revoked or not — that is the one path left to
   * this pane's Reconnect button. Only the FALLBACK skips revoked sites, because
   * the sidebar stopped listing them: defaulting to one would put a site on
   * screen that the list beside it says is not there, and the comment on the
   * button below is right that these two views must not disagree.
   */
  const conn =
    connections.find((c) => c.id === connectSelected) ??
    connections.find((c) => !settings.revokedConnections.includes(c.id)) ??
    connections[0] ??
    null;
  const revoked = conn ? settings.revokedConnections.includes(conn.id) : false;

  if (!conn) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {copy.empty}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-surface p-6">
          <div className="flex items-start gap-3">
            <Favicon
              url={conn.origin}
              letter={conn.favicon}
              color={conn.faviconColor}
              size={40}
              rounded="rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{conn.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {conn.origin.replace(/^https?:\/\//, "")}
              </p>
            </div>
            {/* Writes to the same list Site settings reads, so the two views
                cannot disagree about who is connected. It had no handler at
                all before: the button existed and disconnected nothing. */}
            <button
              type="button"
              onClick={() => toggleConnection(conn.id)}
              className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                revoked
                  ? "bg-accent text-accent-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground hover:bg-negative/15 hover:text-negative"
              }`}
            >
              {revoked ? copy.reconnect : copy.disconnect}
            </button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link2 className="size-3.5" aria-hidden="true" />
            {copy.lastUsed} {formatDate(conn.lastUsedAt)}
          </p>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">{copy.permissionsLabel}</h3>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
              {conn.permissions.map((permission) => (
                <li
                  key={permission}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm"
                >
                  <ShieldCheck
                    className="size-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span className="flex-1">{permission}</span>
                  <span className="text-xs font-medium text-positive">
                    {content.browserSettings.allowed}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
