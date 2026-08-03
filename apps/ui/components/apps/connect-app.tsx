"use client";

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
  const conn =
    connections.find((c) => c.id === connectSelected) ?? connections[0] ?? null;
  const copy = content.connect;

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
            <button
              type="button"
              className="focus-ring shrink-0 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-negative/15 hover:text-negative"
            >
              {copy.disconnect}
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
