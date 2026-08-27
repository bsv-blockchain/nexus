/**
 * Suggesting a handle nobody has taken.
 *
 * Pure, and separate from the screen that uses it, for the same reason the rail
 * model is: this is the part with rules, and rules are worth testing without a
 * browser.
 *
 * A kind adjective and an animal — `cozycritter`, `sunnyotter` — and a number
 * only where the plain pair is gone. The number is the last resort rather than
 * the default because `sunnyotter` is a name and `sunnyotter7` is a username,
 * and the first one is what somebody will want to say out loud.
 *
 * WHAT "TAKEN" MEANS HERE. Nothing in this build can answer whether a handle is
 * free — there is no registry to ask. The taken set is a fixture, which is why
 * every surface that uses it is behind DEMO_SURFACES: a shipped binary telling
 * somebody a name is available would be inventing the one fact this codebase
 * cares most about not inventing. See docs/PROMOTING-DEMO-SURFACES.md for the
 * path from here, which begins with a service that answers.
 */

/** Warm, harmless, and none of them a claim about the person. */
const ADJECTIVES = [
  "cozy",
  "sunny",
  "brave",
  "gentle",
  "merry",
  "quiet",
  "clever",
  "kindly",
  "lucky",
  "swift",
  "amber",
  "honest",
] as const;

/** Short, spellable, and recognisable read aloud. */
const ANIMALS = [
  "critter",
  "otter",
  "badger",
  "heron",
  "marten",
  "puffin",
  "sparrow",
  "tapir",
  "wombat",
  "lynx",
  "gecko",
  "finch",
] as const;

/** Every plain pair, in a stable order. */
function pairs(): string[] {
  const out: string[] = [];
  for (const adjective of ADJECTIVES) {
    for (const animal of ANIMALS) out.push(`${adjective}${animal}`);
  }
  return out;
}

/**
 * A handle not in `taken`.
 *
 * `pick` chooses where in the list to start — pass `Math.random()` from a
 * client, or a fixed number from a test. Walking on from that point rather than
 * re-rolling means this always terminates and never suggests the same name
 * twice in a row by chance.
 *
 * Every plain pair exhausted, it appends the smallest number that frees one,
 * counting from 2: `cozycritter` then `cozycritter2`, never `cozycritter1`,
 * because the first of something is not numbered.
 */
export function suggestHandle(taken: readonly string[], pick = 0.5): string {
  const all = pairs();
  const used = new Set(taken.map((entry) => entry.toLowerCase()));
  const start = Math.floor(Math.min(0.999999, Math.max(0, pick)) * all.length);

  for (let step = 0; step < all.length; step += 1) {
    const candidate = all[(start + step) % all.length]!;
    if (!used.has(candidate)) return candidate;
  }

  for (let suffix = 2; ; suffix += 1) {
    for (let step = 0; step < all.length; step += 1) {
      const candidate = `${all[(start + step) % all.length]!}${suffix}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}

/** Lower-case letters and digits, 3–20 — what the pairs above already are. */
const SHAPE = /^[a-z0-9]{3,20}$/;

export type HandleVerdict = "ok" | "taken" | "malformed" | "empty";

/**
 * Whether a typed handle could be claimed, as far as this build can tell.
 *
 * "As far as this build can tell" is the whole caveat: `taken` is a fixture.
 * The caller is responsible for only asking where that is honest.
 */
export function checkHandle(
  value: string,
  taken: readonly string[]
): HandleVerdict {
  const handle = value.trim().toLowerCase();
  if (handle.length === 0) return "empty";
  if (!SHAPE.test(handle)) return "malformed";
  return taken.some((entry) => entry.toLowerCase() === handle) ? "taken" : "ok";
}
