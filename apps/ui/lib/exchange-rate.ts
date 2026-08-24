"use client";

/**
 * What a bitcoin is worth in dollars, from the chain's own explorer.
 *
 * Every fiat figure in the app used to multiply by a number written into
 * lib/data/wallet.ts, and that number was 52.4 while the market was near 17 —
 * so a balance somebody could read off their own wallet was wrong by a factor
 * of three. A price is not fixture data; it is the one thing on those screens
 * that has to be true today rather than true when the file was written.
 *
 * WhatsOnChain because the rest of the app already points at it — block heights
 * in the Timeline, the explorer in the rail — and because it answers with
 * `access-control-allow-origin: *`, so this can be a plain fetch from the
 * renderer rather than a round trip through the shell.
 *
 * @see https://docs.whatsonchain.com/exchange-rate
 */

import { useSyncExternalStore } from "react";

const ENDPOINT = "https://api.whatsonchain.com/v1/bsv/main/exchangerate";

/**
 * The same rate, a day at a time.
 *
 * Answers one closing price per day for whatever window is asked for, which is
 * what the sparkline beside a balance is meant to be drawing. Before this it
 * drew `Math.sin` — a repeatable wobble seeded from the token's id — so every
 * asset had the same shape and bitcoin's line said nothing about bitcoin.
 */
const HISTORY_ENDPOINT = `${ENDPOINT}/historical`;

/** How much of it to draw. Daily closes, so this is a month. */
const HISTORY_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What to use before the first answer arrives, and if none ever does.
 *
 * A number, not zero: every balance on screen is a multiplication, and zero
 * turns a wallet with money in it into "$0.00", which reads as a bug rather
 * than as "not known yet". Wrong by a little beats wrong by everything.
 *
 * Kept roughly current by hand. It is the floor, not the answer.
 */
export const FALLBACK_USD_PER_BSV = 17;

/** How long an answer is trusted before another is asked for. */
const REFRESH_MS = 5 * 60 * 1000;

let rate = FALLBACK_USD_PER_BSV;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Asks, at most once at a time and at most once per refresh window.
 *
 * Deliberately silent on failure. This runs behind a balance somebody is
 * looking at; an offline laptop should show the last known number, not a toast
 * about an exchange rate nobody asked for.
 */
function refresh(): void {
  if (typeof window === "undefined") return;
  if (inflight) return;
  if (Date.now() - fetchedAt < REFRESH_MS) return;
  inflight = fetch(ENDPOINT)
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { rate?: unknown } | null) => {
      const next = Number(body?.rate);
      /* Guarded rather than trusted: a malformed answer that parsed to NaN
         would propagate into every balance as "$NaN". */
      if (!Number.isFinite(next) || next <= 0) return;
      fetchedAt = Date.now();
      if (next === rate) return;
      rate = next;
      emit();
    })
    .catch(() => {
      /* Offline, blocked, or the endpoint is having a day. The fallback stands
         and the next reader tries again. */
    })
    .finally(() => {
      inflight = null;
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  refresh();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return rate;
}

/** The prerender has no network, so it renders the fallback and hydrates. */
function getServerSnapshot(): number {
  return FALLBACK_USD_PER_BSV;
}

/**
 * Dollars per bitcoin, live.
 *
 * Subscribing is what triggers the fetch, so a screen that shows no money
 * never asks. Every subscriber shares one request and one number.
 */
export function useUsdPerBsv(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * The same number outside React, for the handful of places that compute a
 * figure in an event handler rather than while rendering.
 */
export function getUsdPerBsv(): number {
  refresh();
  return rate;
}

/* ------------------------------------------------------------ the series */

/** One daily close: the moment, in seconds, and what a bitcoin cost at it. */
export interface BsvClose {
  time: number;
  rate: number;
}

/**
 * Kept apart from the rate above, with its own subscribers.
 *
 * Subscribing is what asks, so a screen showing a balance and no chart fetches
 * one thing rather than two. The two answers also age differently: a price is
 * stale in minutes, a set of daily closes gains a point once a day.
 */
const EMPTY_HISTORY: readonly BsvClose[] = [];

let history: readonly BsvClose[] = EMPTY_HISTORY;
let historyAt = 0;
let historyInflight: Promise<void> | null = null;
const historyListeners = new Set<() => void>();

const HISTORY_REFRESH_MS = 30 * 60 * 1000;

function refreshHistory(): void {
  if (typeof window === "undefined") return;
  if (historyInflight) return;
  if (Date.now() - historyAt < HISTORY_REFRESH_MS) return;
  const to = Math.floor(Date.now() / 1000);
  /* A day wider than what is drawn, because the window is cut by wall clock
     and the closes land at midnight UTC — asking for exactly thirty days
     returns twenty-nine of them for most of any given day. */
  const from = to - (HISTORY_DAYS + 1) * (DAY_MS / 1000);
  historyInflight = fetch(`${HISTORY_ENDPOINT}?from=${from}&to=${to}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((body: unknown) => {
      if (!Array.isArray(body)) return;
      const next = (body as { rate?: unknown; time?: unknown }[])
        .map((point) => ({
          rate: Number(point?.rate),
          time: Number(point?.time),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.rate) &&
            point.rate > 0 &&
            Number.isFinite(point.time)
        )
        .slice(-HISTORY_DAYS);
      /* Two points is the least that can be a line. One would draw a flat
         stroke across the box, which reads as a month that did not move. */
      if (next.length < 2) return;
      historyAt = Date.now();
      history = next;
      for (const listener of historyListeners) listener();
    })
    .catch(() => {
      /* Same as the rate: the sparkline falls back to its own wobble and the
         next reader tries again. */
    })
    .finally(() => {
      historyInflight = null;
    });
}

function subscribeHistory(listener: () => void): () => void {
  historyListeners.add(listener);
  refreshHistory();
  return () => {
    historyListeners.delete(listener);
  };
}

function getHistory(): readonly BsvClose[] {
  return history;
}

function getServerHistory(): readonly BsvClose[] {
  return EMPTY_HISTORY;
}

/**
 * A month of daily closing prices for bitcoin, oldest first.
 *
 * Empty until the first answer arrives, and empty for good if none does —
 * callers draw something else rather than an empty box.
 */
export function useBsvHistory(): readonly BsvClose[] {
  return useSyncExternalStore(subscribeHistory, getHistory, getServerHistory);
}

/** The same series outside React. */
export function getBsvHistory(): readonly BsvClose[] {
  refreshHistory();
  return history;
}

/** Just the prices, for a drawing that has no use for the dates. */
export function getBsvRates(): number[] {
  return getBsvHistory().map((point) => point.rate);
}

/**
 * How far bitcoin has moved since the last close, in percent.
 *
 * Measured against the most recent daily close rather than against the price
 * exactly twenty-four hours ago, because a daily close is the finest thing the
 * explorer answers with. That makes this today's move — which is what the
 * label beside it now says, rather than claiming a 24-hour window this cannot
 * actually measure.
 *
 * Null while there is no history, which is not the same as a day that did not
 * move: the caller falls back to what it had rather than printing 0.00%.
 */
export function getBsvChange(): number | null {
  const series = getBsvHistory();
  const previous = series[series.length - 1]?.rate;
  if (previous === undefined || previous <= 0) return null;
  return ((getUsdPerBsv() - previous) / previous) * 100;
}

/** Satoshis as dollars, at the live rate. */
export function usdForSatoshis(satoshis: number, usdPerBsv: number): number {
  return (satoshis / 100_000_000) * usdPerBsv;
}
