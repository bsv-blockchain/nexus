/**
 * Which apps a build actually ships.
 *
 * apps/ui is a fork of the design repository, where every app is a prototype drawn
 * against ~9k lines of typed fixtures. Two of them are no longer prototypes: Browser
 * runs real WebViews in the shell's native layer, and Wallet spends real satoshis
 * through @nexus/wallet-core. The other thirteen have no backing service at all —
 * their inboxes, listings, courses and proposals are invented rows in lib/data.
 *
 * Both audiences are legitimate, so neither wins outright:
 *
 *   the shells (iOS, Android, macOS, Windows, Linux) ship only what works, because
 *   an App Store build that shows a stranger an invented $4,812 balance is a lie
 *
 *   the web preview (Vercel) ships everything, because that is the point of it —
 *   design work, customer conversations, partner demos
 *
 * One flag decides, set at build time and never at runtime: a shipped binary must
 * not be able to talk itself back into demo mode.
 */
import type { HubApp } from "./data/types";

/**
 * Whether this build carries the demo surfaces.
 *
 * Written as a literal comparison against process.env so Next's DefinePlugin can
 * fold it to a constant — see DEMO_DATA_COMPILED_IN in ./data-mode, which is the
 * same switch read for the same reason.
 */
export const DEMO_SURFACES = process.env.NEXT_PUBLIC_DEMO_DATA !== "0";

/**
 * Apps backed by something real.
 *
 * The bar for this list is a service that answers: the native tab layer for browser,
 * @nexus/wallet-core for wallet. Adding a slug here without one puts fabricated data
 * back in front of users, which is the exact thing this file exists to prevent.
 */
const SHIPPED: ReadonlySet<string> = new Set(["browser", "wallet"]);

/**
 * A development build narrowed to the surfaces somebody is working on.
 *
 * `NEXT_PUBLIC_SURFACES=wallet,browser` carries those and nothing else. It exists
 * because working on one app inside the whole shell means every change is judged
 * against fifteen screens that are not the one being changed — and because a rail
 * of two icons is the honest picture of what v1 is, which is easy to forget while
 * looking at seventeen.
 *
 * **It can only ever narrow.** It is applied after the build's own set rather
 * than in place of it, so naming a slug the build does not carry gets you
 * nothing: there is no value of this variable that puts a demo surface into a
 * live build. That is the same rule DEMO_SURFACES enforces and the reason this
 * file exists — a switch that can widen is a switch somebody eventually widens.
 *
 * Unset, or empty, means no focus: the build carries its normal set.
 */
const FOCUS = (process.env.NEXT_PUBLIC_SURFACES ?? "")
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);

/**
 * Narrow a catalog to what this build ships.
 *
 * Two filters, applied in order, and the order is the whole point. What the build
 * carries is decided first — every app in a demo build, the SHIPPED set in a live
 * one — and the focus list narrows that. A focus naming an app the build does not
 * carry removes it from nothing, which is exactly what should happen.
 */
export function shippedApps<T extends { slug: HubApp["slug"] }>(apps: T[]): T[] {
  const carried = DEMO_SURFACES
    ? apps
    : apps.filter((app) => SHIPPED.has(app.slug));
  if (!FOCUS.length) return carried;
  return carried.filter((app) => FOCUS.includes(app.slug));
}

/** What a focus build is narrowed to, for a startup line. Empty means no focus. */
export const FOCUSED: readonly string[] = FOCUS;
