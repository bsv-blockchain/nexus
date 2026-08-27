/**
 * Every section of Settings, so it can be searched instead of hunted for.
 *
 * Settings is eleven categories and about forty-five sections, and the way
 * somebody finds one today is by opening categories until the right words
 * appear. That works when you already know which category a thing lives in,
 * which is the one thing a person looking for a setting does not know.
 *
 * The titles here are the same `content` strings the sections themselves
 * render, not copies of them — so renaming a heading renames its search result
 * and the two can never disagree. What this file does own is which sections
 * exist per category, and that is checked rather than trusted: `Group` warns in
 * development when it renders a heading this list has not heard of, so a
 * section added without an entry here says so instead of quietly becoming
 * unfindable.
 *
 * @see components/apps/settings/blocks.tsx for the check
 * @see components/apps/settings/settings-search.tsx for the search itself
 */

import type { SettingsCategory } from "@/components/hub/hub-provider";
import { content, shortcutGroups } from "@/lib/data";

export interface SettingsSection {
  category: SettingsCategory;
  title: string;
  hint?: string;
  /**
   * Only rendered on a phone, so only searchable there.
   *
   * The device list is the phone's half of pairing — the desktop shows a code
   * instead — and a result that opens a category and then has nothing to scroll
   * to is a search claiming it found something it did not.
   */
  phoneOnly?: boolean;
  /**
   * Words somebody would type that the heading does not contain.
   *
   * Sections are indexed by their title and hint, which covers most of them —
   * but the thing people search for is often a control inside one. "swap" is
   * the name of a switch in a section called Receiving, and a search that
   * returns nothing for it is the exact failure this feature exists to
   * prevent. Only where there is a real gap: a keyword list that restates the
   * title is noise, and every entry is one more thing to keep true.
   */
  keywords?: string[];
}

const settings = content.settings;
const mobile = content.mobileBrowser.settings;

/**
 * Sections per category, in the order the panels render them.
 *
 * Wallet is absent on purpose: it is the live build's own panel, its headings
 * are literals rather than content strings, and it never appears in the same
 * build as the categories below it.
 */
const BY_CATEGORY: Partial<Record<SettingsCategory, SettingsSection[]>> = {
  general: [
    {
      category: "general",
      title: settings.sync.thisDevice,
      phoneOnly: true,
      keywords: ["device", "sync", "linked", "session", "sign out"],
    },
    {
      category: "general",
      title: settings.sync.otherDevices,
      phoneOnly: true,
      keywords: ["device", "session", "sign out", "log out", "linked"],
    },
    { category: "general", title: mobile.startupTitle },
    { category: "general", title: settings.general.searchTitle },
    { category: "general", title: settings.general.linksTitle },
    { category: "general", title: settings.general.deviceTitle },
  ],
  profiles: [
    {
      category: "profiles",
      title: content.profilesPanel.identityTitle,
      hint: content.profilesPanel.identityHint,
    },
    {
      category: "profiles",
      title: content.profilesPanel.whereTitle,
      hint: content.profilesPanel.whereHint,
    },
    {
      category: "profiles",
      title: content.profilesPanel.contactTitle,
      hint: content.profilesPanel.contactHint,
    },
    {
      category: "profiles",
      title: content.profilesPanel.useTitle,
      hint: content.profilesPanel.useHint,
    },
  ],
  security: [
    {
      category: "security",
      title: content.security.passphrase.title,
      hint: content.security.passphrase.body,
    },
    {
      category: "security",
      title: content.security.keys.title,
      hint: content.security.keys.body,
    },
    {
      category: "security",
      title: content.security.otp.title,
      hint: content.security.otp.body,
    },
    {
      category: "security",
      title: content.security.phones.title,
      hint: content.security.phones.body,
    },
    {
      category: "security",
      title: content.security.autoConnectTitle,
      hint: content.security.autoConnectHint,
      keywords: ["connect", "metanet", "brc-100", "sites", "wallet"],
    },
    {
      category: "security",
      title: content.security.exempt.title,
      hint: content.security.exempt.body,
    },
  ],
  privacy: [
    {
      category: "privacy",
      title: settings.privacy.reachTitle,
      hint: settings.privacy.reachHint,
      keywords: ["dm", "messages", "strangers", "contacts", "block"],
    },
    {
      category: "privacy",
      title: settings.privacy.feeTitle,
      hint: settings.privacy.feeHint,
    },
    {
      category: "privacy",
      title: settings.privacy.tollTitle,
      hint: settings.privacy.tollHint,
    },
    {
      category: "privacy",
      title: settings.privacy.chainTitle,
      hint: settings.privacy.chainHint,
    },
    { category: "privacy", title: settings.privacy.trackingTitle },
    { category: "privacy", title: settings.privacy.quitTitle },
    { category: "privacy", title: settings.privacy.dataTitle },
  ],
  payments: [
    {
      category: "payments",
      title: settings.payments.receivingTitle,
      hint: settings.payments.receivingHint,
      keywords: ["swap", "auto-swap", "convert", "exchange", "bsv", "bitcoin"],
    },
    {
      category: "payments",
      title: settings.payments.spendingTitle,
      hint: settings.payments.spendingHint,
      keywords: [
        "one-click",
        "cap",
        "limit",
        "sats",
        "pay",
        "confirm",
        "swap",
        "auto-swap",
        "web3",
        "top up",
      ],
    },
  ],
  permissions: [
    {
      category: "permissions",
      title: settings.permissions.pageTitle,
      hint: settings.permissions.pageHint,
    },
    {
      category: "permissions",
      title: settings.permissions.walletTitle,
      hint: settings.permissions.walletHint,
    },
    {
      category: "permissions",
      title: settings.permissions.exceptionsTitle,
      hint: settings.permissions.exceptionsHint,
    },
  ],
  autofill: [
    {
      category: "autofill",
      title: settings.autofill.keyTitle,
      hint: settings.autofill.keyHint,
    },
    { category: "autofill", title: settings.autofill.fillTitle },
  ],
  browsing: [
    { category: "browsing", title: settings.browsing.browseTitle },
    { category: "browsing", title: settings.browsing.sitesTitle },
    { category: "browsing", title: settings.browsing.tabsTitle },
    { category: "browsing", title: settings.browsing.filesTitle },
    { category: "browsing", title: settings.browsing.readingTitle },
  ],
  appearance: [
    {
      category: "appearance",
      title: settings.appearance.homeTitle,
      hint: settings.appearance.homeHint,
    },
    {
      category: "appearance",
      title: settings.appearance.railTitle,
      hint: settings.appearance.railHint,
    },
    {
      category: "appearance",
      title: settings.onboarding.title,
      hint: settings.onboarding.hint,
    },
    {
      category: "appearance",
      title: settings.appearance.devTitle,
      hint: settings.appearance.devHint,
    },
    {
      category: "appearance",
      title: settings.appearance.themeTitle,
      hint: settings.appearance.themeHint,
      keywords: ["dark", "light", "mode", "colour", "color", "accent"],
    },
    {
      category: "appearance",
      title: settings.appearance.brandTitle,
      hint: settings.appearance.brandHint,
    },
  ],
  /*
   * Read from the same table the panel renders, rather than listed again.
   *
   * Shortcuts is the one category whose sections are data — one group per area
   * of the app — so a hand-written copy here would be a second list to keep in
   * step with a first that already exists.
   */
  shortcuts: shortcutGroups.map((group) => ({
    category: "shortcuts" as const,
    title: group.title,
  })),
  about: [{ category: "about", title: settings.about.versionTitle }],
};

/** Flat, because search wants one list and grouping is the result's job. */
export const SETTINGS_SECTIONS: SettingsSection[] = Object.values(
  BY_CATEGORY,
).flat();

/*
 * Two sections with the same heading are one section as far as this file is
 * concerned.
 *
 * The anchor is derived from the words, so a repeated heading means both
 * results scroll to whichever renders first — and the second is unreachable
 * without anybody noticing, because it looks findable in the list. It happened
 * the first time within a day: the device card's "This device" landed in the
 * same category as General's own "This device", and search offered the same row
 * twice. Development only, like the missing-section warning it sits beside.
 */
if (process.env.NODE_ENV !== "production") {
  const seen = new Set<string>();
  for (const section of SETTINGS_SECTIONS) {
    const key = sectionSlug(section.title);
    if (seen.has(key)) {
      console.warn(
        `Two Settings sections are titled "${section.title}". They share an anchor, so search can only ever reach the first.`,
      );
    }
    seen.add(key);
  }
}

/**
 * A heading's anchor id.
 *
 * From the words rather than a hand-assigned key: the title is already the
 * thing that identifies a section to a person, and a second identifier is a
 * second thing to keep in step.
 */
export function sectionSlug(title: string): string {
  return `settings-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

/** Whether this list knows about a heading — the staleness check's question. */
export function sectionIsIndexed(title: string): boolean {
  return SETTINGS_SECTIONS.some((section) => section.title === title);
}

/** Sections and categories matching a query, best-looking matches first. */
export function searchSettings(
  query: string,
  categories: { id: SettingsCategory; label: string; hint: string }[],
  /** false on a phone, which is the only place the device sections render */
  isDesktop = true,
): { categories: typeof categories; sections: SettingsSection[] } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { categories, sections: [] };

  const live = new Set(categories.map((entry) => entry.id));
  const labelOf = new Map(categories.map((entry) => [entry.id, entry.label]));

  const matchedCategories = categories.filter(
    (entry) =>
      entry.label.toLowerCase().includes(needle) ||
      entry.hint.toLowerCase().includes(needle),
  );

  /* Only sections of categories this build actually offers — a result that
     opens a category the shell filtered out is a dead end. */
  const matchedSections = SETTINGS_SECTIONS.filter(
    (section) =>
      live.has(section.category) &&
      !(section.phoneOnly && isDesktop) &&
      (section.title.toLowerCase().includes(needle) ||
        section.hint?.toLowerCase().includes(needle) ||
        section.keywords?.some((word) => word.includes(needle)) ||
        labelOf.get(section.category)?.toLowerCase().includes(needle)),
  );

  return { categories: matchedCategories, sections: matchedSections };
}
