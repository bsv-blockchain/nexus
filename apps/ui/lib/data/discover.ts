/**
 * The words on Discover that no app carries on its own — the hero, the three
 * quicklink cards, and which real category backs each of the three full pages
 * (Work, Create, Develop). Everything else on the page — which apps, their
 * names, their descriptions, their ratings — is read live off the catalogue
 * in lib/data/hub-apps.ts, because a second copy of an app's own facts is a
 * second copy that goes stale.
 *
 * @see components/hub/discover-page.tsx
 */

import type { AppCategory, HubAppSlug } from "./types";

/**
 * The big card at the top: an eyebrow, a headline, a hint, and — later — a
 * clip. `art` is a still for now; the reference plays a loop behind a pause
 * button, which is a real thing to build once there is a real clip to play,
 * not a placeholder worth faking with motion.
 */
export const discoverHero = {
  eyebrow: "OUR FAVOURITES",
  title: "The web, with a wallet already in it",
  hint: "Every app here speaks the same key. Connect one and the rest already know who you are.",
};

/**
 * The three small cards under the hero, each pointing at a handful of apps
 * by slug — the same overlapping-circle stack the collapsed App Store
 * folders already draw (see CategoryFolder), at hero scale.
 */
export const discoverQuicklinks: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  appSlugs: HubAppSlug[];
}[] = [
  {
    id: "get-paid",
    eyebrow: "GET PAID",
    title: "Everything you need to get paid",
    subtitle: "Payments, splits and a wallet that never asks which chain.",
    appSlugs: ["wallet", "connect", "vault"],
  },
  {
    id: "productive",
    eyebrow: "GET PRODUCTIVE",
    title: "Get more out of your workspace",
    subtitle: "Calendars, documents and notes that settle on chain.",
    appSlugs: ["clndr", "scribe", "vault", "roadmap"],
  },
  {
    id: "life-hack",
    eyebrow: "LIFE HACK",
    title: "Follow the chain, not the noise",
    subtitle: "Explore is the fastest way to see what actually happened.",
    appSlugs: ["tx-viewer", "bsv-radar", "attestations"],
  },
];

/**
 * The three full pages the sidebar's Work / Create / Develop entries open,
 * and the preview row each one gets on Discover's own front page.
 *
 * Backed by a real `AppCategory` rather than a hand-picked list of slugs, so
 * an app added to the catalogue under `media` turns up under Create without
 * this file needing to hear about it. `label` is the short word the sidebar
 * nav and the full page's own heading use; `sectionTitle` is the longer,
 * editorial line the reference gives the front-page teaser row ("Work
 * Smarter", not "Work") — the same split the reference itself draws between
 * a sidebar entry and the headline over its preview.
 */
export const discoverCategoryPages: {
  id: "work" | "create" | "develop";
  label: string;
  sectionTitle: string;
  hint: string;
  category: AppCategory;
}[] = [
  {
    id: "work",
    label: "Work",
    sectionTitle: "Work Smarter",
    hint: "Productivity, scheduling and the everyday admin of running something.",
    category: "productivity",
  },
  {
    id: "create",
    label: "Create",
    sectionTitle: "Be Creative",
    hint: "Publish, design and put something into the world.",
    category: "media",
  },
  {
    id: "develop",
    label: "Develop",
    sectionTitle: "Developer Corner",
    hint: "Look under the hood, prove what happened, and build on top of it.",
    category: "developer",
  },
];

/**
 * A human name for each `AppCategory` — the Categories grid's row labels and
 * the story page's "what kind of app is this" line both read the same map,
 * so the two never drift into calling the same category two different
 * things.
 */
export const categoryLabel: Record<AppCategory, string> = {
  core: "Essentials",
  system: "Web",
  productivity: "Productivity",
  media: "Media & publishing",
  developer: "Developer",
  finance: "Finance",
  identity: "Identity & security",
  social: "Social",
  learning: "Learning",
  gaming: "Games",
  marketplace: "Marketplaces",
};

/**
 * The eyebrow an editorial card wears, chosen by the app's own category —
 * the one thing about "what kind of spotlight is this" that does not need a
 * human to write it per app. A future admin page can override any one app's
 * eyebrow directly; until it exists, this is the honest default.
 */
export const spotlightEyebrow: Partial<Record<AppCategory, string>> = {
  productivity: "GET PRODUCTIVE",
  media: "APPS WE LOVE",
  developer: "DEVELOPER SPOTLIGHT",
  social: "STAY CONNECTED",
  gaming: "GAMES WE LOVE",
  finance: "OUR FAVOURITES",
  marketplace: "OUR FAVOURITES",
  learning: "GET STARTED",
  identity: "OUR FAVOURITES",
};
