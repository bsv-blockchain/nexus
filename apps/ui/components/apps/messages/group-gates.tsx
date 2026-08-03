"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { CollectibleArt } from "@/components/apps/wallet/collectible-art";
import { TokenMark } from "@/components/apps/wallet/token-mark";
import {
  content,
  getMessagePeople,
  getToken,
  getMessagePerson,
  type GroupGates,
  type MessagePerson,
} from "@/lib/data";
import {
  blocksAsTime,
  emptyGates,
  gateTokenById,
  searchGateTokens,
  type GateToken,
} from "@/lib/gates";

/** Terms a room can pick from: a month, a quarter, half a year, a year. */
const LOCK_TERMS = [4_320, 13_140, 26_280, 52_560];
import {
  ChevronRight,
  DoorClosedLocked,
  HeartCrack,
  HeartHandshake,
  Search,
  Timer,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

/** The toggle used across the settings pane, extracted rather than re-styled. */
function Switch({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
  disabled?: boolean | undefined;
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`focus-ring relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
          checked ? "left-5" : "left-1"
        }`}
      />
    </button>
  );
}

/** A labelled switch row: icon, title, one-line hint, toggle on the right. */
function SwitchRow({
  icon,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  icon?: ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean | undefined;
}): ReactNode {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <span className="text-muted-foreground shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground mt-0.5 block text-xs text-balance">
          {hint}
        </span>
      </span>
      <Switch
        checked={checked}
        label={label}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

/** A removable chip, shared by the token and entity lists. */
function Chip({
  children,
  label,
  onRemove,
}: {
  children: ReactNode;
  label: string;
  onRemove: () => void;
}): ReactNode {
  const copy = content.messages.group.gates;
  return (
    <span className="bg-surface inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pr-1 pl-1.5">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${copy.removeChip} ${label}`}
        className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground grid size-4.5 shrink-0 place-items-center rounded-full"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}

/** Inline search: a field, a short result list, chips for what was picked. */
function InlineSearch<T>({
  placeholder,
  results,
  onQuery,
  query,
  renderResult,
  onPick,
  chips,
  after,
}: {
  placeholder: string;
  query: string;
  onQuery: (next: string) => void;
  results: T[];
  renderResult: (item: T) => ReactNode;
  onPick: (item: T) => void;
  chips: ReactNode;
  /** rendered under the chips, for settings that depend on what was picked */
  after?: ReactNode;
}): ReactNode {
  const copy = content.messages.group.gates;
  return (
    <div>
      <div className="border-border flex items-center gap-2 rounded-lg border px-3">
        <Search
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {query.trim() && (
        <ul className="mt-1.5 space-y-0.5">
          {results.length === 0 && (
            <li className="text-muted-foreground px-1.5 py-1 text-xs">
              {copy.noMatches}
            </li>
          )}
          {results.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => onPick(item)}
                className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left"
              >
                {renderResult(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {chips}
      {after}
    </div>
  );
}

/** A gate token as it appears in results and chips. */
function GateTokenMark({
  item,
  size = 22,
}: {
  item: GateToken;
  size?: number;
}): ReactNode {
  if (item.token) return <TokenMark token={item.token} size={size} />;
  return (
    /* A contract's mark where it has one, its artwork otherwise. */
    <CollectibleArt
      src={item.markUrl ?? item.collectible?.imageUrl ?? ""}
      className="shrink-0 rounded-md object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The access-gate editor: one master switch, three gates behind it.
 *
 * Shared by the New group pane and conversation settings so the two surfaces
 * cannot drift. `gates` is null while the master switch is off — the caller
 * stores nothing for an ungated room rather than a config of falses.
 */
export function GroupGatesEditor({
  gates,
  onChange,
  readOnly,
  excludes,
}: {
  gates: GroupGates | null;
  onChange: (next: GroupGates | null) => void;
  /** true for anyone but the room's holder, per BRC-190 §2.4.1 */
  readOnly?: boolean | undefined;
  /** members the current configuration would put out of the room */
  excludes?: string[] | undefined;
}): ReactNode {
  const copy = content.messages.group.gates;
  // Open when the room already has gates: an existing configuration is
  // something to read, an absent one is something to opt into.
  const [open, setOpen] = useState(gates !== null);
  /*
   * Switching a gate off is the one control here that cannot be undone by
   * doing the opposite. The configuration goes with it — the contract, the
   * named handles, the minimums — and the room it leaves behind is one anybody
   * can read. Every other switch in this pane is a toggle; this one is a
   * decision, so it asks.
   */
  const [confirmOff, setConfirmOff] = useState(false);
  const [tokenQuery, setTokenQuery] = useState("");
  const [vouchQuery, setVouchQuery] = useState("");
  const [renounceQuery, setRenounceQuery] = useState("");

  /**
   * How many of the three are switched on.
   *
   * Counted by the switch rather than by whether each is filled in, so a gate
   * being configured still shows in the total — a heading that reads zero
   * while three sections are open below it is telling a different story than
   * the pane is.
   */
  const activeCount = gates
    ? [
        gates.token.on,
        gates.timelock.on,
        gates.vouch.on,
        gates.renounce.on,
      ].filter(Boolean).length
    : 0;

  /** The picked ids that are currencies, which are the ones with amounts. */
  const fungibleIds = (gates?.token.ids ?? []).filter((id) => getToken(id));

  const patch = (next: Partial<GroupGates>): void => {
    onChange({ ...(gates ?? emptyGates()), ...next });
  };

  const searchPeople = (query: string, exclude: string[]): MessagePerson[] => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return getMessagePeople()
      .filter(
        (person) =>
          !exclude.includes(person.id) &&
          (person.name.toLowerCase().includes(needle) ||
            person.handle.toLowerCase().includes(needle))
      )
      .slice(0, 6);
  };

  const entityChips = (
    ids: string[],
    onRemoveId: (id: string) => void
  ): ReactNode =>
    ids.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ids.map((id) => {
          const person = getMessagePerson(id);
          if (!person) return null;
          return (
            <Chip key={id} label={person.name} onRemove={() => onRemoveId(id)}>
              <MemberAvatar person={person} size={18} />
              <span className="max-w-32 truncate text-xs font-medium">
                {person.name}
              </span>
            </Chip>
          );
        })}
      </div>
    );

  return (
    <div className="border-border rounded-xl border">
      {/*
        A heading rather than a row, because three gates with their own
        searches and chips is a lot of pane to hand someone who has not decided
        they want a gate yet. Collapsed it says whether there is one and how
        many parts it has; that is the whole question most of the time.

        The disclosure and the switch are siblings, not nested: a switch inside
        a summary means every attempt to flip it also opens the section.
      */}
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{copy.master}</span>
              {activeCount > 0 && (
                <span className="bg-surface text-foreground rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                  {activeCount}
                </span>
              )}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs text-balance">
              {copy.masterHint}
            </span>
          </span>
        </button>
        <Switch
          checked={gates !== null}
          label={copy.master}
          disabled={readOnly}
          onChange={(on) => {
            if (!on) {
              setConfirmOff(true);
              return;
            }
            onChange(emptyGates());
            // Turning it on and leaving it shut would hide the thing just
            // asked for.
            setOpen(true);
          }}
        />
        {/* After the switch, where a disclosure marker sits in a row that has
            a control of its own: leading it made the switch look like a second
            thought. */}
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

      {confirmOff && (
        <div className="border-border border-t p-3">
          <p className="text-xs font-semibold">{copy.offTitle}</p>
          <p className="text-muted-foreground mt-1 text-[11px] text-pretty">
            {copy.offBody}
          </p>
          <div className="mt-2.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmOff(false)}
              className="focus-ring border-border hover:bg-surface-hover flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
            >
              {copy.offCancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOff(false);
                setOpen(false);
                onChange(null);
              }}
              className="focus-ring bg-negative flex-1 rounded-full px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
            >
              {copy.offConfirm}
            </button>
          </div>
        </div>
      )}

      {/*
        A change is cheap when it excludes nobody and expensive when it does
        not, which is the whole of BRC-190 §2.5. Saying who it costs, at the
        moment it is being configured, is what makes that legible — a room
        usually discovers the third of its members it just locked out
        afterwards, from them.
      */}
      {gates && open && !confirmOff && excludes && excludes.length > 0 && (
        <p className="border-border bg-warning/10 text-warning border-t px-3 py-2 text-[11px] text-pretty">
          {excludes.length} {copy.wouldExclude} {copy.wouldExcludeHint}
        </p>
      )}

      {gates && open && !confirmOff && (
        <div className="border-border space-y-4 border-t p-3">
          {/* token gate */}
          <div>
            <SwitchRow
              icon={<DoorClosedLocked className="size-4" />}
              label={copy.token}
              hint={copy.tokenHint}
              disabled={readOnly}
            checked={gates.token.on}
              onChange={(on) => patch({ token: { ...gates.token, on } })}
            />
            {gates.token.on && (
              <div className="mt-2.5 pl-7">
                <InlineSearch
                  placeholder={copy.tokenSearch}
                  query={tokenQuery}
                  onQuery={setTokenQuery}
                  results={searchGateTokens(tokenQuery).filter(
                    (item) => !gates.token.ids.includes(item.id)
                  )}
                  renderResult={(item) => (
                    <>
                      <GateTokenMark item={item} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {item.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {item.detail}
                        </span>
                      </span>
                    </>
                  )}
                  onPick={(item) => {
                    patch({
                      token: {
                        ...gates.token,
                        ids: [...gates.token.ids, item.id],
                      },
                    });
                    setTokenQuery("");
                  }}
                  after={
                    /* Only currencies have an amount. A collectible is held or
                       not, and asking for 1.5 of a hat is a question with no
                       answer. */
                    fungibleIds.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {fungibleIds.map((id) => {
                          const token = getToken(id);
                          if (!token) return null;
                          const minimum = gates.token.minimums?.[id] ?? 0;
                          const fee = gates.token.fees?.[id];
                          const patchFee = (
                            next: { perDay: number; toId?: string } | undefined
                          ): void => {
                            const fees = { ...(gates.token.fees ?? {}) };
                            if (next) fees[id] = next;
                            else delete fees[id];
                            patch({ token: { ...gates.token, fees } });
                          };
                          return (
                            <div
                              key={id}
                              className="border-border space-y-1.5 rounded-lg border px-2.5 py-2"
                            >
                              <label className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 text-xs font-medium">
                                  {copy.minimum}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  inputMode="decimal"
                                  value={minimum}
                                  onChange={(event) => {
                                    const raw = Number(event.target.value || 0);
                                    const next = {
                                      ...(gates.token.minimums ?? {}),
                                    };
                                    next[id] = raw;
                                    const fees = {
                                      ...(gates.token.fees ?? {}),
                                    };
                                    // A fee with no threshold behind it charges
                                    // for holding nothing, so it goes when the
                                    // minimum does.
                                    if (raw === 0) delete fees[id];
                                    patch({
                                      token: {
                                        ...gates.token,
                                        minimums: next,
                                        fees,
                                      },
                                    });
                                  }}
                                  aria-label={`${copy.minimum} ${token.symbol}`}
                                  className="focus-ring border-border h-8 w-24 rounded-md border bg-transparent px-2 text-right text-sm outline-none"
                                />
                                <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                                  {token.symbol}
                                </span>
                              </label>

                              {/* A holding threshold is a door; a daily fee is
                                  rent. Offering rent before a threshold exists
                                  would let a room charge for holding nothing,
                                  so this appears only once there is something
                                  to hold. */}
                              {minimum > 0 && (
                                <div className="border-border space-y-1.5 border-t pt-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-xs font-medium">
                                        {copy.fee}
                                      </span>
                                      <span className="text-muted-foreground block text-[11px] text-balance">
                                        {copy.feeHint}
                                      </span>
                                    </span>
                                    <Switch
                                      checked={fee !== undefined}
                                      label={copy.fee}
                                      onChange={(on) =>
                                        patchFee(on ? { perDay: 0 } : undefined)
                                      }
                                    />
                                  </div>
                                  {fee && (
                                    <>
                                      <label className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 text-xs font-medium">
                                          {copy.feeAmount}
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          inputMode="decimal"
                                          value={fee.perDay}
                                          onChange={(event) =>
                                            patchFee({
                                              ...fee,
                                              perDay: Number(
                                                event.target.value || 0
                                              ),
                                            })
                                          }
                                          aria-label={`${copy.feeAmount} ${token.symbol}`}
                                          className="focus-ring border-border h-8 w-24 rounded-md border bg-transparent px-2 text-right text-sm outline-none"
                                        />
                                        <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                                          {token.symbol}
                                        </span>
                                      </label>
                                      {/* Rent with no landlord named is a
                                          charge nobody can refuse or audit. */}
                                      <label className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 text-xs font-medium">
                                          {copy.feeTo}
                                        </span>
                                        <input
                                          type="text"
                                          value={fee.toId ?? ""}
                                          placeholder={copy.feeToPlaceholder}
                                          onChange={(event) =>
                                            patchFee({
                                              ...fee,
                                              toId: event.target.value,
                                            })
                                          }
                                          aria-label={copy.feeTo}
                                          className="focus-ring border-border h-8 w-44 rounded-md border bg-transparent px-2 text-sm outline-none"
                                        />
                                      </label>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  }
                  chips={
                    gates.token.ids.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {gates.token.ids.map((id) => {
                          const item = gateTokenById(id);
                          if (!item) return null;
                          return (
                            <Chip
                              key={id}
                              label={item.name}
                              onRemove={() =>
                                patch({
                                  token: {
                                    ...gates.token,
                                    ids: gates.token.ids.filter(
                                      (existing) => existing !== id
                                    ),
                                  },
                                })
                              }
                            >
                              <GateTokenMark item={item} size={18} />
                              <span className="max-w-32 truncate text-xs font-medium">
                                {item.name}
                              </span>
                            </Chip>
                          );
                        })}
                      </div>
                    )
                  }
                />
              </div>
            )}
          </div>

          {/* vouch gate */}
          <div>
            {/*
              A lock is the one condition that asks for something other than
              possession. Its two fields are the two ways to fail it, which is
              why they are shown together rather than folded into one control.
            */}
            <SwitchRow
              icon={<Timer className="size-4" />}
              label={copy.timelock}
              hint={copy.timelockHint}
              disabled={readOnly}
              checked={gates.timelock.on}
              onChange={(on) =>
                patch({ timelock: { ...gates.timelock, on } })
              }
            />
            {gates.timelock.on && (
              <div className="border-border ml-7 space-y-1.5 rounded-lg border p-2.5">
                <label className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-xs font-medium">
                    {copy.lockAmount}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={readOnly}
                    value={gates.timelock.amount ?? 0}
                    onChange={(event) =>
                      patch({
                        timelock: {
                          ...gates.timelock,
                          assetId: "bsv",
                          amount: Number(event.target.value || 0),
                        },
                      })
                    }
                    aria-label={copy.lockAmount}
                    className="focus-ring border-border h-8 w-24 rounded-md border bg-transparent px-2 text-right text-sm outline-none"
                  />
                  <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                    BSV
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-xs font-medium">
                    {copy.lockFor}
                  </span>
                  <select
                    disabled={readOnly}
                    value={gates.timelock.minBlocks ?? 4320}
                    onChange={(event) =>
                      patch({
                        timelock: {
                          ...gates.timelock,
                          minBlocks: Number(event.target.value),
                        },
                      })
                    }
                    aria-label={copy.lockFor}
                    className="focus-ring border-border h-8 rounded-md border bg-transparent px-2 text-sm outline-none"
                  >
                    {LOCK_TERMS.map((blocks) => (
                      <option key={blocks} value={blocks}>
                        {blocksAsTime(blocks)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-muted-foreground text-[11px] text-pretty">
                  {copy.lockHint}
                </p>
              </div>
            )}

            <SwitchRow
              icon={<HeartHandshake className="size-4" />}
              label={copy.vouch}
              hint={copy.vouchHint}
              disabled={readOnly}
            checked={gates.vouch.on}
              onChange={(on) => patch({ vouch: { ...gates.vouch, on } })}
            />
            {gates.vouch.on && (
              <div className="mt-2.5 pl-7">
                <InlineSearch
                  placeholder={copy.entitySearch}
                  query={vouchQuery}
                  onQuery={setVouchQuery}
                  results={searchPeople(vouchQuery, gates.vouch.entityIds)}
                  renderResult={(person) => (
                    <>
                      <MemberAvatar person={person} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {person.name}
                        </span>
                        <Handle
                          person={person}
                          size={11}
                          className="text-muted-foreground max-w-full truncate text-[11px]"
                        />
                      </span>
                    </>
                  )}
                  onPick={(person) => {
                    patch({
                      vouch: {
                        ...gates.vouch,
                        entityIds: [...gates.vouch.entityIds, person.id],
                      },
                    });
                    setVouchQuery("");
                  }}
                  chips={entityChips(gates.vouch.entityIds, (id) =>
                    patch({
                      vouch: {
                        ...gates.vouch,
                        entityIds: gates.vouch.entityIds.filter(
                          (existing) => existing !== id
                        ),
                      },
                    })
                  )}
                />
              </div>
            )}
          </div>

          {/* renounce gate */}
          <div>
            <SwitchRow
              icon={<HeartCrack className="size-4" />}
              label={copy.renounce}
              hint={copy.renounceHint}
              disabled={readOnly}
            checked={gates.renounce.on}
              onChange={(on) => patch({ renounce: { ...gates.renounce, on } })}
            />
            {gates.renounce.on && (
              <div className="mt-2.5 pl-7">
                <InlineSearch
                  placeholder={copy.entitySearch}
                  query={renounceQuery}
                  onQuery={setRenounceQuery}
                  results={searchPeople(
                    renounceQuery,
                    gates.renounce.entityIds
                  )}
                  renderResult={(person) => (
                    <>
                      <MemberAvatar person={person} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {person.name}
                        </span>
                        <Handle
                          person={person}
                          size={11}
                          className="text-muted-foreground max-w-full truncate text-[11px]"
                        />
                      </span>
                    </>
                  )}
                  onPick={(person) => {
                    patch({
                      renounce: {
                        ...gates.renounce,
                        entityIds: [...gates.renounce.entityIds, person.id],
                      },
                    });
                    setRenounceQuery("");
                  }}
                  chips={entityChips(gates.renounce.entityIds, (id) =>
                    patch({
                      renounce: {
                        ...gates.renounce,
                        entityIds: gates.renounce.entityIds.filter(
                          (existing) => existing !== id
                        ),
                      },
                    })
                  )}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
