/**
 * `@`-mention and `/`-command autocomplete for the composer.
 *
 * Ranking is recency-first: the people you have most recently exchanged
 * messages with come up before the rest of the directory, so the empty-query
 * state is a useful shortlist rather than an alphabetical dump.
 *
 * BRC-218 section 4.4 constrains autocomplete: it MUST NOT substitute a
 * recipient the user did not select, and a completed recipient MUST stay
 * visible and editable. So this module only ever *proposes* — the caller
 * inserts the exact handle of an explicitly chosen person.
 */
import {
  getChatMessages,
  getChatThreads,
  getEcosystem,
  getMessagePeople,
  getMessagePerson,
  type MessagePerson,
} from "@/lib/data";
import { handleAliases } from "@/lib/messages";

/** An active `@` or `/` token under the caret. */
export interface ActiveToken {
  kind: "mention" | "command";
  /** text after the sigil, may be empty */
  query: string;
  /** index of the sigil in the input */
  start: number;
  /** index one past the end of the token */
  end: number;
}

/**
 * Find the mention or command token the caret sits inside.
 *
 * A mention triggers on `@` at a word boundary. A command triggers only on a
 * leading `/`, since a slash mid-line is ordinary text, and never on `//`,
 * which section 2.1 defines as an escaped literal slash.
 */
export function activeToken(
  value: string,
  caret: number,
): ActiveToken | null {
  const upto = value.slice(0, caret);

  /*
   * The word being typed, found from the last whitespace rather than the last
   * `@`. A qualified handle contains two of them — `@kuro@treechat` — so
   * scanning back to the nearest `@` stopped the popover the moment you typed
   * the ecosystem separator, which is exactly when you most want it.
   */
  const wordStart = (() => {
    for (let i = upto.length - 1; i >= 0; i -= 1) {
      if (/[\s(]/.test(upto[i]!)) return i + 1;
    }
    return 0;
  })();

  if (upto[wordStart] === "@") {
    const query = upto.slice(wordStart + 1);
    if (!/\s/.test(query)) {
      return { kind: "mention", query, start: wordStart, end: caret };
    }
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    const firstSpace = upto.indexOf(" ");
    if (firstSpace === -1) {
      return { kind: "command", query: upto.slice(1), start: 0, end: caret };
    }
  }

  return null;
}

/** Person ids ordered by how recently the user exchanged messages with them. */
export function recentContactIds(): string[] {
  const lastSeen = new Map<string, string>();
  for (const thread of getChatThreads()) {
    const messages = getChatMessages(thread.id);
    for (const message of messages) {
      if (message.senderId === "me") continue;
      const at = lastSeen.get(message.senderId);
      if (!at || message.createdAt > at) {
        lastSeen.set(message.senderId, message.createdAt);
      }
    }
  }
  return [...lastSeen.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([id]) => id);
}

/**
 * Mention candidates for a query, across every ecosystem represented in the
 * inbox. An empty query returns the most recently active people — the
 * "prequery" shortlist — and a query matches name, handle, username or any
 * fully-qualified form of the handle.
 */
export function searchMentions(query: string, limit = 8): MessagePerson[] {
  const recentIds = recentContactIds();
  const byRecency = new Map(recentIds.map((id, index) => [id, index]));
  const people = getMessagePeople();

  const needle = query.trim().toLowerCase();
  if (!needle) {
    const recent = recentIds
      .map((id) => getMessagePerson(id))
      .filter((p): p is MessagePerson => Boolean(p) && p!.id !== "me");
    // Top up from the directory if the inbox is thin.
    const rest = people.filter((p) => !byRecency.has(p.id));
    return [...recent, ...rest].slice(0, limit);
  }

  const scored = people
    .map((person) => {
      const name = person.name.toLowerCase();
      const handle = person.handle.toLowerCase();
      const username = person.username?.toLowerCase() ?? "";
      const aliases = handleAliases(person).map((a) => a.toLowerCase());

      let score = -1;
      if (handle === needle || username === needle) score = 0;
      else if (handle.startsWith(needle) || username.startsWith(needle)) score = 1;
      else if (name.toLowerCase().startsWith(needle)) score = 2;
      else if (aliases.some((a) => a.includes(needle))) score = 3;
      else if (name.includes(needle)) score = 4;
      return { person, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      // Break ties by recency, so familiar people surface first.
      const ra = byRecency.get(a.person.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = byRecency.get(b.person.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });

  return scored.slice(0, limit).map((entry) => entry.person);
}

/**
 * Replace the active token with `insert`, leaving a trailing space so the user
 * can keep typing. Returns the new value and where the caret should land.
 */
export function replaceToken(
  value: string,
  token: ActiveToken,
  insert: string,
): { value: string; caret: number } {
  const next = `${value.slice(0, token.start)}${insert} ${value.slice(token.end)}`;
  return { value: next, caret: token.start + insert.length + 1 };
}

/**
 * Every `@…` run in a line, with the person it resolves to.
 *
 * Used to draw a mention as a chip in the composer. Resolution is by the same
 * alias set autocomplete matches on, so a handle typed by hand gets the same
 * treatment as one picked from the list — the chip is a statement that the
 * handle resolves, not a reward for using the popover.
 */
export interface MentionSpan {
  start: number;
  end: number;
  person: MessagePerson;
  /**
   * The handle as it should read on the chip. The local part stays as written —
   * `@thoth` and `@23` are the same identity, and silently redrawing one as
   * the other edits the message — but a foreign identity always carries its
   * `@ecosystem` suffix, whether or not the writer typed it, because a foreign
   * handle without its namespace is only half an address.
   */
  label: string;
}

const MENTION_RE = /@[a-z0-9][a-z0-9._-]*(?:@[a-z0-9][a-z0-9.-]*)?/gi;

export function findMentions(text: string): MentionSpan[] {
  const people = getMessagePeople();
  const spans: MentionSpan[] = [];
  for (const match of text.matchAll(MENTION_RE)) {
    const raw = match[0].toLowerCase();
    const person = people.find((candidate) =>
      handleAliases(candidate).some((alias) => alias.toLowerCase() === raw),
    );
    if (person && match.index !== undefined) {
      const written = match[0].slice(1).split("@")[0] ?? person.handle;
      const eco = getEcosystem(person.ecosystem);
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        person,
        // The local part as written; the suffix normalised to the alias, and
        // present exactly when the identity is foreign.
        label: eco?.local
          ? written
          : `${written}@${eco?.alias ?? person.ecosystem}`,
      });
    }
  }
  return spans;
}
