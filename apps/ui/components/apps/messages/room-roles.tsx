"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  content,
  getMessagePerson,
  getToken,
  type GroupGates,
  type RoomRole,
  type RoomRoles,
} from "@/lib/data";
import { blocksAsTime } from "@/lib/gates";
import {
  ROLE_LADDER,
  bandCeiling,
  fungibleTokenIds,
  ladderTokenIds,
  rarityLadder,
} from "@/lib/roles";
import { ChevronRight, Crown, Shield, User } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Rarest role first, because that is the order a room is configured in. */
const EDIT_ORDER: RoomRole[] = ["admin", "mod", "member"];

/** The same terms the gate offers: a month, a quarter, half a year, a year. */
const LOCK_TERMS = [4_320, 13_140, 26_280, 52_560];

export function roleIcon(role: RoomRole): ReactNode {
  if (role === "admin") return <Crown className="size-3.5" aria-hidden="true" />;
  if (role === "mod") return <Shield className="size-3.5" aria-hidden="true" />;
  return <User className="size-3.5" aria-hidden="true" />;
}

/** The badge shown beside a name, in a roster or a thread. */
export function RoleBadge({
  role,
  byCustody,
  flat,
}: {
  role: RoomRole;
  /** true when the role comes from holding the room rather than the gate */
  byCustody?: boolean;
  /** true in an ungated room, where every participant holds the same role */
  flat?: boolean;
}): ReactNode {
  const copy = content.messages.group.roles;
  if (role === "member") return null;
  /* A badge distinguishes. In a flat room there is nothing to distinguish, so
     an Admin chip beside all six names is noise wearing a hierarchy's
     clothes — except on the holder, whose position is real. */
  if (flat && !byCustody) return null;
  return (
    <span
      title={byCustody ? copy.byCustody : copy.derived}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        role === "admin"
          ? "bg-accent/15 text-accent"
          : "bg-foreground/10 text-muted-foreground"
      }`}
    >
      {roleIcon(role)}
      {copy.names[role]}
    </span>
  );
}

/**
 * The role editor.
 *
 * A sibling of the access gate rather than a child of the token gate, because
 * roles are not a token feature: a room gated on a vouch has a role question
 * too, and burying the answer inside one gate's panel makes it invisible in
 * every other configuration. What the section *offers* depends on which gates
 * are on — that is the dependency, and it is one of content rather than of
 * place.
 */
export function RoomRolesEditor({
  gates,
  roles,
  onChange,
  warning,
  readOnly,
}: {
  gates: GroupGates | null;
  roles: RoomRoles | null;
  onChange: (next: RoomRoles | null) => void;
  /** why the current configuration would leave the room unmanageable */
  warning?: string | undefined;
  /** true for anyone but the room's holder, per BRC-190 §2.4.1 */
  readOnly?: boolean | undefined;
}): ReactNode {
  const copy = content.messages.group.roles;
  const [open, setOpen] = useState(roles !== null);

  const ladderIds = ladderTokenIds(gates ?? undefined);
  const fungibleIds = fungibleTokenIds(gates ?? undefined);
  const named = [
    ...(gates?.vouch.on ? gates.vouch.entityIds : []),
    ...(gates?.renounce.on ? gates.renounce.entityIds : []),
  ];

  /* With no gate there is nothing to read a role off, and a role editor that
     offers nothing is a control that looks broken. */
  const available =
    (gates?.token.on && (ladderIds.length > 0 || fungibleIds.length > 0)) ||
    Boolean(gates?.timelock.on) ||
    named.length > 0;

  const patch = (next: Partial<RoomRoles>): void => {
    onChange({ on: true, ...roles, ...next });
  };

  return (
    <div className="border-border mt-4 rounded-xl border">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{copy.title}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs text-pretty">
            {available ? copy.hint : copy.needsGate}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={roles?.on ?? false}
          aria-label={copy.title}
          disabled={!available || readOnly}
          onClick={() => {
            const on = !(roles?.on ?? false);
            onChange(on ? { on: true } : null);
            setOpen(on);
          }}
          className={`focus-ring relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            roles?.on ? "bg-accent" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
              roles?.on ? "left-5" : "left-1"
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? copy.hideSettings : copy.showSettings}
          className="focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded-md p-0.5"
        >
          <ChevronRight
            className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {open && roles?.on && (
        <div className="border-border space-y-4 border-t p-3">
          {warning && (
            <p className="bg-warning/10 text-warning rounded-lg px-2.5 py-2 text-[11px] text-pretty">
              {warning}
            </p>
          )}

          {/* Rarity bands, for a contract that publishes them. */}
          {ladderIds.map((tokenId) => {
            const ladder = rarityLadder(tokenId) ?? [];
            return (
              <div key={tokenId}>
                <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
                  {copy.byRarity}
                </p>
                <div className="space-y-1.5">
                  {EDIT_ORDER.map((role) => (
                    <label
                      key={role}
                      className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium">
                        {roleIcon(role)}
                        {copy.names[role]}
                      </span>
                      <select
                        value={roles.rarity?.[role] ?? ""}
                        onChange={(event) =>
                          patch({
                            rarity: {
                              ...roles.rarity,
                              [role]: event.target.value || undefined,
                            },
                          })
                        }
                        aria-label={`${copy.names[role]} ${copy.byRarity}`}
                        className="focus-ring border-border h-8 rounded-md border bg-transparent px-2 text-sm outline-none"
                      >
                        <option value="">{copy.unassigned}</option>
                        {ladder.map((band) => {
                          /* The population of a band is the ceiling on the
                             role, and a room picking between Rare and Epic is
                             picking between two ceilings it cannot otherwise
                             see. BRC-190 §8.5.4. */
                          const ceiling = bandCeiling(tokenId, band);
                          return (
                            <option key={band} value={band}>
                              {band}
                              {ceiling !== undefined
                                ? ` — ${copy.upTo} ${ceiling.toLocaleString()}`
                                : ""}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="text-muted-foreground mt-1.5 text-[11px] text-pretty">
                  {copy.rarityHint}
                </p>
              </div>
            );
          })}

          {/* Amounts, for a currency. */}
          {fungibleIds.map((tokenId) => {
            const token = getToken(tokenId);
            if (!token) return null;
            const thresholds = roles.minimums?.[tokenId] ?? {};
            return (
              <div key={tokenId}>
                <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
                  {copy.byAmount} · {token.symbol}
                </p>
                <div className="space-y-1.5">
                  {EDIT_ORDER.map((role) => (
                    <label
                      key={role}
                      className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium">
                        {roleIcon(role)}
                        {copy.names[role]}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={thresholds[role] ?? ""}
                        placeholder={copy.unassigned}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const next = { ...thresholds };
                          if (raw === "") delete next[role];
                          else next[role] = Number(raw);
                          patch({
                            minimums: { ...roles.minimums, [tokenId]: next },
                          });
                        }}
                        aria-label={`${copy.names[role]} ${copy.byAmount} ${token.symbol}`}
                        className="focus-ring border-border h-8 w-24 rounded-md border bg-transparent px-2 text-right text-sm outline-none"
                      />
                      <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                        {token.symbol}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {/*
            Commitment in time. The other ladders read what somebody has; this
            one reads how long they have agreed not to touch it, which is the
            one rung that cannot be bought outright.
          */}
          {gates?.timelock.on && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
                {copy.byLock}
              </p>
              <div className="space-y-1.5">
                {EDIT_ORDER.map((role) => (
                  <label
                    key={role}
                    className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium">
                      {roleIcon(role)}
                      {copy.names[role]}
                    </span>
                    <select
                      value={roles.locks?.[role] ?? ""}
                      onChange={(event) =>
                        patch({
                          locks: {
                            ...roles.locks,
                            [role]: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          },
                        })
                      }
                      aria-label={`${copy.names[role]} ${copy.byLock}`}
                      className="focus-ring border-border h-8 rounded-md border bg-transparent px-2 text-sm outline-none"
                    >
                      <option value="">{copy.unassigned}</option>
                      {LOCK_TERMS.map((blocks) => (
                        <option key={blocks} value={blocks}>
                          {blocksAsTime(blocks)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground mt-1.5 text-[11px] text-pretty">
                {copy.lockLadderHint}
              </p>
            </div>
          )}

          {/* The handles a vouch or renounce gate already names. */}
          {named.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
                {copy.byEntity}
              </p>
              <label className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    {copy.entitiesAreAdmins}
                  </span>
                  <span className="text-muted-foreground block text-[11px] text-pretty">
                    {copy.entitiesHint}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={roles.entitiesAreAdmins ?? false}
                  aria-label={copy.entitiesAreAdmins}
                  onClick={() =>
                    patch({ entitiesAreAdmins: !roles.entitiesAreAdmins })
                  }
                  className={`focus-ring relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                    roles.entitiesAreAdmins ? "bg-accent" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
                      roles.entitiesAreAdmins ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </label>
              {roles.entitiesAreAdmins && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {named.map((id) => {
                    const person = getMessagePerson(id);
                    if (!person) return null;
                    return (
                      <li
                        key={id}
                        className="bg-surface inline-flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1"
                      >
                        <MemberAvatar person={person} size={16} />
                        <Handle
                          person={person}
                          size={9}
                          className="text-[11px] font-medium"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* What each rung can actually do, since nothing else says it. */}
          <div className="border-border border-t pt-3">
            <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
              {copy.canDo}
            </p>
            <ul className="space-y-1">
              {[...ROLE_LADDER].reverse().map((role) => (
                <li key={role} className="flex gap-2 text-[11px]">
                  <span className="flex w-16 shrink-0 items-center gap-1 font-semibold">
                    {roleIcon(role)}
                    {copy.names[role]}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 text-pretty">
                    {copy.powers[role]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
