"use client";

import { useSyncExternalStore } from "react";

/**
 * What to call the chain this client talks to.
 *
 * Two names for one thing, and people hold opinions about which is correct, so
 * the reader picks. Modelled on the same switch in Beersy, including the split
 * between the name and its article: "the BSV Blockchain" reads correctly and
 * "the Bitcoin SV" does not, so the article belongs to the name rather than to
 * the sentence around it.
 *
 * Three things this deliberately does not touch:
 *
 * - **The licence.** Its text names the BSV Blockchain in clauses that define
 *   what the grant covers. Rewording a legal instrument to suit a display
 *   preference changes what it says.
 * - **"BSV Association".** That is the name of an organisation, not of a chain,
 *   and it stays the same in both modes.
 * - **The ticker.** A balance of "1.2 BSV" is a unit of account. Renaming the
 *   network does not rename the money.
 */

export type BrandMode = "bsv" | "bitcoinsv";

export interface Brand {
  /** Bare name, for mid-sentence use where no article is wanted. */
  name: string;
  /** The article the name takes, or null where it takes none. */
  article: string | null;
  label: string;
  hint: string;
}

export const BRANDS: Record<BrandMode, Brand> = {
  bsv: {
    name: "BSV Blockchain",
    article: "the",
    label: "BSV Blockchain",
    hint: "The name the association and the network use.",
  },
  bitcoinsv: {
    name: "Bitcoin SV",
    // None. "the Bitcoin SV" is why the article is per mode.
    article: null,
    label: "Bitcoin SV",
    hint: "The name from before the rebrand, still widely used.",
  },
};

export const DEFAULT_BRAND: BrandMode = "bsv";

const STORAGE_KEY = "nexus.brand";

function isBrandMode(value: unknown): value is BrandMode {
  return value === "bsv" || value === "bitcoinsv";
}

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function read(): BrandMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isBrandMode(stored) ? stored : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

export function setBrandMode(mode: BrandMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not remembered, but still applied for this visit.
  }
  for (const listener of listeners) listener();
}

/**
 * The active mode.
 *
 * `DEFAULT_BRAND` on the server and through hydration — not a guess to be
 * corrected, but genuinely what the prerendered HTML says. Returning the stored
 * value here instead would be a hydration mismatch on every page that names the
 * chain.
 */
export function useBrandMode(): BrandMode {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_BRAND);
}

export function useBrand(): Brand {
  return BRANDS[useBrandMode()];
}

/**
 * Swap the chain's name inside a sentence that was written with one of them.
 *
 * For copy that lives in the data tables, where a component cannot be dropped
 * in. Matches the article too, so "on the BSV blockchain" becomes "on Bitcoin
 * SV" rather than "on the Bitcoin SV". Case-insensitive on "blockchain" because
 * the tables use both.
 */
export function withBrand(text: string, mode: BrandMode): string {
  if (mode === "bsv") return text;
  const name = BRANDS[mode].name;
  return text
    .replace(/\bthe BSV [Bb]lockchain\b/g, name)
    .replace(/\bBSV [Bb]lockchain\b/g, name);
}
