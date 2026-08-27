"use client";

/**
 * Which bank cards this wallet can draw on.
 *
 * The fixture says what was already connected; this says what you have done
 * since. Two lists rather than one, for the reason the extensions store gives:
 * a card you added and a card you removed are different acts, and a single
 * array of "current" cards would make removing the seeded one indistinguishable
 * from never having had it.
 *
 * Nothing here is a card number. The sheet that collects one hands back four
 * digits and a network and forgets the rest before this store is ever told —
 * see components/apps/settings/card-sheet.tsx, which is the only place a full
 * number exists and only for as long as somebody is typing it.
 *
 * @see lib/data/cards.ts for the seeded card
 */

import { useSyncExternalStore } from "react";
import { getFundingCards, type FundingCard } from "@/lib/data";

const KEY = "nexus.cards";

interface State {
  added: FundingCard[];
  removed: string[];
}

const EMPTY: State = { added: [], removed: [] };

let state: State = EMPTY;
const listeners = new Set<() => void>();
/* Rebuilt on write, not per render: `useSyncExternalStore` compares by
   reference, so a fresh array per call would spin. */
let cards: FundingCard[] = getFundingCards();

function rebuild(): void {
  /* Newest first, which for the seeded card and anything added in this session
     is the same as "added last". A list of payment methods is read top-down
     when you are looking for the one you just connected. */
  cards = [
    ...state.added,
    ...getFundingCards().filter((card) => !state.removed.includes(card.id)),
  ];
}

function emit(): void {
  rebuild();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* Private mode. Forgetting a prototype's card is survivable. */
    }
  }
  for (const listener of listeners) listener();
}

/** Applied after the first paint — the same hydration rule everything here uses. */
export function hydrateCards(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    state = { ...EMPTY, ...(JSON.parse(raw) as Partial<State>) };
    rebuild();
    for (const listener of listeners) listener();
  } catch {
    /* Written by an older shape. */
  }
}

const SERVER = getFundingCards();

export function useCards(): FundingCard[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => cards,
    () => SERVER,
  );
}

export function addCard(card: FundingCard): void {
  state = { ...state, added: [card, ...state.added] };
  emit();
}

/**
 * Forget a card.
 *
 * Both lists, because a card can be in either: one added this session is
 * dropped outright, and a seeded one is remembered as removed so it does not
 * come back on the next paint.
 */
export function removeCard(id: string): void {
  state = {
    added: state.added.filter((card) => card.id !== id),
    removed: state.removed.includes(id) ? state.removed : [...state.removed, id],
  };
  emit();
}
