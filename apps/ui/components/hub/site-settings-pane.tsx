"use client";

import { Favicon } from "@/components/hub/favicon";
import { content, getConnections } from "@/lib/data";
import {
  removeException,
  setException,
  toggleConnection,
  useSettings,
  type CapabilityId,
  type Permission,
} from "@/lib/settings-store";
import { ChevronDown, Link2Off, RotateCcw, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

const copy = content.settings.sites;
const perms = content.settings.permissions;

const CAPS: CapabilityId[] = [
  "camera",
  "microphone",
  "location",
  "notifications",
  "clipboard",
  "downloads",
  "midi",
];

const VALUES: { id: Permission; label: string }[] = [
  { id: "ask", label: perms.capAsk },
  { id: "allow", label: perms.capAllow },
  { id: "block", label: perms.capBlock },
];

function host(origin: string): string {
  return origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

interface Site {
  origin: string;
  name: string;
  connectionId?: string;
  walletPermissions: string[];
  overrides: { capability: CapabilityId; value: Permission }[];
}

/**
 * One site, and everything it has been given.
 *
 * Expanding shows all seven capabilities rather than only the overridden ones,
 * because "what can this site do" is answered by the whole set and not by the
 * two somebody happened to change. Where a row is following the global default
 * it says so, keeping the difference between "allowed" and "allowed because
 * everything is" visible.
 */
function SiteRow({ site, revoked }: { site: Site; revoked: boolean }): ReactNode {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const overridden = new Map(
    site.overrides.map((entry) => [entry.capability, entry.value]),
  );

  return (
    <li className="border-border/60 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 px-4 py-2.5 text-left"
      >
        <Favicon
          url={`https://${host(site.origin)}`}
          letter={site.name.slice(0, 1).toUpperCase()}
          color="#6b6580"
          size={22}
          rounded="rounded"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{site.name}</span>
          <span className="text-muted-foreground block truncate text-[11px]">
            {host(site.origin)}
            {overridden.size > 0 && ` · ${overridden.size} ${copy.changed}`}
            {revoked && ` · ${copy.revoked}`}
          </span>
        </span>
        <ChevronDown
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="px-4 pb-3">
          {site.walletPermissions.length > 0 && (
            <div className="border-border bg-surface mb-2 rounded-lg border p-2.5">
              <p className="text-[11px] font-semibold">{copy.walletTitle}</p>
              <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
                {site.walletPermissions.join(" · ")}
              </p>
              {/* Revoking, not deleting. The grant can come back, and a control
                  that only offers the irreversible half of a decision is one
                  people avoid using at all. */}
              <button
                type="button"
                onClick={() =>
                  site.connectionId && toggleConnection(site.connectionId)
                }
                className={`focus-ring mt-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  revoked
                    ? "bg-muted hover:bg-surface-hover"
                    : "text-negative hover:bg-negative/10"
                }`}
              >
                {revoked ? (
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                ) : (
                  <Link2Off className="size-3.5" aria-hidden="true" />
                )}
                {revoked ? copy.restore : copy.revoke}
              </button>
            </div>
          )}

          <ul className="space-y-1">
            {CAPS.map((capability) => {
              const override = overridden.get(capability);
              const effective = override ?? settings.capabilities[capability];
              return (
                <li key={capability} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px]">
                    {perms.capabilities[capability]}
                    {!override && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {copy.byDefault}
                      </span>
                    )}
                  </span>
                  <span className="bg-surface ring-border/60 flex shrink-0 gap-0.5 rounded-md p-0.5 ring-1">
                    {VALUES.map((value) => (
                      <button
                        key={value.id}
                        type="button"
                        aria-pressed={effective === value.id}
                        aria-label={`${perms.capabilities[capability]}: ${value.label}`}
                        onClick={() => {
                          /* Picking the global default clears the override
                             rather than storing one that says the same thing —
                             the exceptions list should hold only exceptions. */
                          if (value.id === settings.capabilities[capability]) {
                            removeException(site.origin, capability);
                          } else {
                            setException(site.origin, capability, value.id);
                          }
                        }}
                        className={`focus-ring rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                          effective === value.id
                            ? "bg-accent/20 text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {value.label}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

/**
 * Every site that has anything.
 *
 * Derived, never stored. The rows come from two lists that already exist — the
 * permission exceptions in Settings and the connections in Connect — so there
 * is no third inventory to fall out of step with them. Revoking here is the
 * same act as disconnecting there, because it writes to the same place.
 *
 * A site can arrive from either side. Something you granted the camera to but
 * never connected a wallet to belongs on this list exactly as much as something
 * that has your identity and no exceptions.
 */
export function SiteSettingsPane(): ReactNode {
  const settings = useSettings();
  const [query, setQuery] = useState("");

  const byHost = new Map<string, Site>();
  for (const conn of getConnections()) {
    byHost.set(host(conn.origin), {
      origin: conn.origin,
      name: conn.name,
      connectionId: conn.id,
      walletPermissions: conn.permissions,
      overrides: [],
    });
  }
  for (const entry of settings.exceptions) {
    const key = host(entry.origin);
    const existing = byHost.get(key);
    if (existing) {
      existing.overrides.push({
        capability: entry.capability,
        value: entry.value,
      });
      continue;
    }
    byHost.set(key, {
      origin: entry.origin,
      name: key,
      walletPermissions: [],
      overrides: [{ capability: entry.capability, value: entry.value }],
    });
  }

  const needle = query.trim().toLowerCase();
  const sites = [...byHost.values()]
    .filter(
      (site) =>
        !needle ||
        site.name.toLowerCase().includes(needle) ||
        site.origin.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="border-border/60 border-b p-3">
        <div className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3 py-2">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {sites.length === 0 ? (
        <p className="text-muted-foreground p-4 text-xs">{copy.empty}</p>
      ) : (
        <ul>
          {sites.map((site) => (
            <SiteRow
              key={site.origin}
              site={site}
              revoked={
                site.connectionId
                  ? settings.revokedConnections.includes(site.connectionId)
                  : false
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
