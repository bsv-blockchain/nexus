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

/** Whether an app belongs in this build's launcher, rail and store. */
export function shipsApp(slug: HubApp["slug"]): boolean {
  return DEMO_SURFACES || SHIPPED.has(slug);
}

/** Narrow a catalog to what this build ships. */
export function shippedApps<T extends { slug: HubApp["slug"] }>(apps: T[]): T[] {
  return DEMO_SURFACES ? apps : apps.filter((app) => SHIPPED.has(app.slug));
}
