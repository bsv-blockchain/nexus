"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  getEffects,
  getEffectsServerSnapshot,
  setToll,
  subscribeEffects,
} from "@/lib/command-effects";
import { content, getMessagePeople, getMessagePerson } from "@/lib/data";
import { SatsAmount } from "@/components/apps/settings/blocks";
import { formatSats } from "@/lib/messages";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const copy = content.settings.privacy;

/** Shortcuts, not the range — the field beside them takes anything. */
const AMOUNTS = [218, 2180];

/**
 * Who pays to reach you, individually.
 *
 * The general toll is a wall; this is a list of names, and a list is the only
 * honest way to show it. A row saying "2 people" tells you a number and hides
 * the thing you would want to check — which two, and how much — and the answer
 * changes whether you would leave it in place.
 *
 * Removing is inline and immediate, with no confirmation. Lifting a toll makes
 * somebody reachable again, which is the recoverable direction: if it was a
 * mistake, setting it back costs one click.
 */
export function PerSenderTolls(): ReactNode {
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState(AMOUNTS[0]!);

  const rules = effects.tolls.filter((rule) => rule.personId);
  const charged = new Set(rules.map((rule) => rule.personId));

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? getMessagePeople()
        .filter((person) => !charged.has(person.id))
        .filter(
          (person) =>
            person.name.toLowerCase().includes(needle) ||
            person.handle.toLowerCase().includes(needle) ||
            (person.username ?? "").toLowerCase().includes(needle),
        )
        .slice(0, 5)
    : [];

  const add = (personId: string, name: string): void => {
    setToll(personId, amount);
    setQuery("");
    setAdding(false);
    toast.success(`${name} ${copy.tollPerSenderSet}`, {
      description: formatSats(amount),
    });
  };

  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {copy.tollPerSender}{" "}
          {rules.length > 0 && (
            <span className="text-muted-foreground tabular-nums">
              {rules.length}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          aria-expanded={adding}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -mr-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {copy.tollPerSenderAdd}
        </button>
      </div>
      <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
        {copy.tollPerSenderHint}
      </p>

      {adding && (
        <div className="border-border bg-surface mt-2 rounded-lg border p-2">
          {/* The amount is chosen before the person, because it is the part
              somebody has an opinion about; picking a name then commits it. */}
          <SatsAmount
            label={copy.tollPerSenderAdd}
            value={amount}
            presets={AMOUNTS}
            onPick={setAmount}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <Search
              className="text-muted-foreground size-3.5 shrink-0"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.tollPerSenderSearch}
              aria-label={copy.tollPerSenderSearch}
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
          {matches.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {matches.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => add(person.id, person.name)}
                    className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left"
                  >
                    <MemberAvatar person={person} size={20} />
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {person.name}
                    </span>
                    <Handle
                      person={person}
                      size={10}
                      className="text-muted-foreground shrink-0 text-[10px]"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-[11px]">
          {copy.tollPerSenderNone}
        </p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {rules.map((rule) => {
            const person = getMessagePerson(rule.personId!);
            if (!person) return null;
            return (
              <li
                key={rule.personId}
                className="bg-surface flex items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <MemberAvatar person={person} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {person.name}
                  </span>
                  <Handle
                    person={person}
                    size={10}
                    className="text-muted-foreground block max-w-full truncate text-[10px]"
                  />
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums">
                  {formatSats(rule.sats)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setToll(rule.personId, null);
                    toast.success(
                      `${person.name} ${copy.tollPerSenderRemoved}`,
                    );
                  }}
                  aria-label={`${copy.tollPerSenderRemove} ${person.name}`}
                  title={copy.tollPerSenderRemove}
                  className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md p-1"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
