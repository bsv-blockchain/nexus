/**
 * Presentation helpers for the Messages app.
 *
 * Formatting is deliberately deterministic — derived from the ISO string in UTC
 * with no dependency on the current time or the runtime locale — so the server
 * and client render identical output and hydration stays stable.
 */
import { getUsdPerBsv } from "@/lib/exchange-rate";
import { vouchesFor } from "@/lib/command-effects";
import { getEcosystem, type MessagePerson } from "@/lib/data";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Clock time like "09:20" for a message bubble. */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Short date like "27 Jul" for a conversation-list preview. */
export function formatMessageDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/**
 * A date with its year, for anything outside the current one.
 *
 * `formatMessageDate` drops the year because a transcript is all recent. A
 * registration date is the opposite case: the year is the entire point, and
 * "2 Nov" for something four years old is worse than useless.
 */
export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export type Presence = "online" | "away" | "offline";

/**
 * Deterministic presence for a person id — the prototype has no real presence,
 * and a hash keeps it stable across renders so it never causes hydration drift.
 */
export function presenceFor(id: string): Presence {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100;
  }
  if (hash < 55) return "online";
  if (hash < 78) return "away";
  return "offline";
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Last seen today",
  away: "Last seen this week",
  offline: "Last seen a long time ago",
};

/** Presence dot colour. Tokens where we have them, fixed hues otherwise. */
export const PRESENCE_COLOR: Record<Presence, string> = {
  online: "bg-positive",
  away: "bg-warning",
  offline: "bg-muted-foreground",
};

/**
 * Where a person's profile lives. Nexus identities are shown in-app; federated
 * identities open their own ecosystem's profile page in Browse.
 */
export function profileTarget(
  person: MessagePerson
): { kind: "in-app" } | { kind: "web"; url: string } {
  if (person.ecosystem === "nexus" || !person.profileUrl) {
    return { kind: "in-app" };
  }
  return { kind: "web", url: person.profileUrl };
}

/**
 * A person's handle in BRC-169 form. The ecosystem suffix is omitted for the
 * local ecosystem, which section 2.2 defines as shorthand for "mine".
 */
export function handleOf(
  person: MessagePerson,
  { qualified = false }: { qualified?: boolean } = {}
): string {
  const eco = getEcosystem(person.ecosystem);
  if (eco?.local && !qualified) return `@${person.handle}`;
  return `@${person.handle}@${qualified ? (eco?.domain ?? person.ecosystem) : (eco?.alias ?? person.ecosystem)}`;
}

/**
 * The named alternative to a numeric handle. `@23@treechat` and
 * `@thoth@treechat` address the same identity; both are shown on the profile
 * card so neither form is a surprise.
 */
export function namedHandleOf(person: MessagePerson): string | null {
  if (!person.username) return null;
  const eco = getEcosystem(person.ecosystem);
  if (eco?.local) return `@${person.username}`;
  return `@${person.username}@${eco?.alias ?? person.ecosystem}`;
}

/** Every handle form that should match this person in search and autocomplete. */
export function handleAliases(person: MessagePerson): string[] {
  const eco = getEcosystem(person.ecosystem);
  const alias = eco?.alias ?? person.ecosystem;
  const forms = [
    `@${person.handle}`,
    `@${person.handle}@${alias}`,
    `@${person.handle}@${eco?.domain ?? alias}`,
  ];
  if (person.username) {
    forms.push(`@${person.username}`, `@${person.username}@${alias}`);
  }
  return forms;
}

/**
 * BRC-169 section 2.3 confusability skeleton: lowercase, drop punctuation, and
 * fold the character sets that are visually indistinguishable in ASCII. Two
 * handles sharing a skeleton are a spoofing risk worth warning about.
 */
export function confusabilitySkeleton(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/[._-]/g, "")
    .replace(/[0o]/g, "o")
    .replace(/[1li]/g, "l")
    .replace(/[5s]/g, "s")
    .replace(/[2z]/g, "z");
}

/**
 * Everything `/whois` must display, per BRC-218 section 5.7: the attested
 * identity without transacting. Values are derived deterministically from the
 * person's id so the prototype renders stably, and anything the ecosystem host
 * supplies without attestation is flagged so it can be labelled unverified.
 */
export interface Whois {
  handle: string;
  qualifiedHandle: string;
  namedHandle: string | null;
  domain: string;
  identityKey: string;
  messagebox: string;
  certificate: "valid" | "unverified" | "revoked";
  /** how long ago the revocation check ran — never claimed as instantaneous */
  revocationCheckedAgo: string;
  inAddressBook: boolean;
  keyChanged: boolean;
  attestations: number;
  /** public reputation added by peers from their identity keys */
  vouches: number;
  tollSats: number | null;
  /** host-supplied and unattested: display name and avatar */
  unverifiedAttributes: string[];
}

/** Deterministic hex string of `length` chars, seeded from `seed`. */
function fakeHex(seed: string, length: number): string {
  let hash = 2166136261;
  let out = "";
  for (let i = 0; out.length < length; i += 1) {
    const char = seed.charCodeAt(i % seed.length) + i;
    hash = (hash ^ char) * 16777619;
    out += (hash >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

export function whoisFor(person: MessagePerson): Whois {
  const eco = getEcosystem(person.ecosystem);
  const domain = eco?.domain ?? person.ecosystem;
  // Compressed secp256k1 keys start 02 or 03.
  const key = `0${2 + (person.id.length % 2)}${fakeHex(person.id, 64)}`;
  const ages = ["12 seconds ago", "under a minute ago", "2 minutes ago"];
  return {
    handle: handleOf(person),
    qualifiedHandle: handleOf(person, { qualified: true }),
    namedHandle: namedHandleOf(person),
    domain,
    identityKey: key,
    messagebox: `${person.handle}@messagebox.${domain}`,
    certificate: person.keyChanged ? "unverified" : "valid",
    revocationCheckedAgo: ages[person.id.length % ages.length]!,
    inAddressBook: true,
    keyChanged: Boolean(person.keyChanged),
    attestations: person.attestations ?? 0,
    vouches: vouchesFor(person.id).length,
    tollSats: person.tollSats ?? null,
    unverifiedAttributes: ["display name", "avatar"],
  };
}

/**
 * Mock oracle rate. BRC-218 section 3.3 requires fiat be converted at send
 * time through BRC-169's oracle interface, subject to a staleness bound. The
 * prototype has no oracle, so this stands in as a fixed, disclosed rate —
 * never a silently cached one, which section 3.5 forbids.
 */
/**
 * The date this prototype treats as today.
 *
 * Fixed rather than `new Date()`: relative ages are rendered on the server and
 * again on the client, and a real clock makes those two disagree. It also keeps
 * the seeded conversations, which end on the 30th, reading as recent.
 */
export const MOCK_TODAY = "2026-07-31T12:00:00.000Z";

/**
 * A coarse age, as "4 years 3 months ago".
 *
 * Deliberately coarse: for a registration date the year and month is the whole
 * signal, and a precise day count invites the reader to do arithmetic that tells
 * them nothing.
 */
export function ageFrom(
  iso: string,
  copy: {
    year: string;
    years: string;
    month: string;
    months: string;
    ago: string;
    today: string;
  }
): string {
  const then = new Date(iso);
  const now = new Date(MOCK_TODAY);
  let months =
    (now.getUTCFullYear() - then.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - then.getUTCMonth());
  if (now.getUTCDate() < then.getUTCDate()) months -= 1;
  if (months <= 0) return copy.today;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? copy.year : copy.years}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? copy.month : copy.months}`);
  return `${parts.join(" ")} ${copy.ago}`;
}

const SATS_PER_BSV = 100_000_000;

/**
 * Convert a fiat amount to satoshis, at the rate the chain is actually trading
 * at rather than a number written into this file.
 *
 * It used to be a `MOCK_USD_PER_BSV = 72.5` const, quoted to the reader in the
 * command sheet as the rate they were being charged at — which made a wrong
 * number worse by printing it. See lib/exchange-rate.
 */
export function fiatToSats(amount: number, currency = "USD"): number | null {
  // Only USD is quoted; anything else must be rejected rather than guessed.
  if (currency !== "USD") return null;
  return Math.round((amount / getUsdPerBsv()) * SATS_PER_BSV);
}

/** "3,007,000 sats" — grouped for readability at a glance. */
export function formatSats(sats: number): string {
  return `${sats.toLocaleString("en-US")} sat${sats === 1 ? "" : "s"}`;
}

/** "$2.18" / "CHF 5.00" */
export function formatFiat(amount: number, currency = "USD"): string {
  const value = amount.toFixed(2);
  return currency === "USD" ? `$${value}` : `${currency} ${value}`;
}

/** First name, for placeholders and group bubbles. */
export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** "Rhea, Tomás and Amara, and you" — the subline under a group title. */
export function groupSubline(members: MessagePerson[]): string {
  const names = members.map((member) => firstName(member.name));
  if (names.length === 0) return "Just you";
  if (names.length === 1) return `${names[0]} and you`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}, and you`;
}
