/**
 * What a workspace is called, wears and is coloured, when nobody has said.
 *
 * A new workspace used to arrive as "New Profile" with a house on it and no
 * theme — which is fine for the first one and useless for the fourth, because
 * four of them are then four identical rows and the only way to tell them apart
 * is to remember the order you made them in. Three things say which is which at
 * a glance, and none of them is worth asking somebody for up front: a name, a
 * mark, and a colour.
 *
 * Everything here is picked to be DIFFERENT from what is already in use rather
 * than merely random — see `pickUnused`. Random alone gives you two "Bright
 * Workspace"es in green on the second try, which is the problem this is meant
 * to solve.
 */

import { SPACE_ICON_GROUPS, LUCIDE_PREFIX } from "@/components/hub/space-icon";

/** A colour scheme offered to a workspace that has not chosen one. */
export interface StandardTheme {
  id: string;
  /** what it is called in the picker, once there is one */
  name: string;
  /** gradient stops, in the same shape a custom theme uses */
  colors: string[];
}

/**
 * Ten schemes, spread round the wheel.
 *
 * Hues at roughly 15, 40, 80, 150, 178, 200, 235, 265, 320 and 350 degrees:
 * far enough apart that two workspaces never read as the same colour at the
 * 2px an underline gets, and covering warm, green, cool and pink so the set
 * does not lean anywhere.
 *
 * Each is a two-stop gradient rather than a flat colour, because that is what
 * the chrome renders and a solid would make these ten look like a different
 * kind of theme from a hand-made one. Every stop is a mid-luminance chroma —
 * `derivePalette` corrects text and accent tokens for contrast, and it has
 * least room to work with when the stops are very light or very dark.
 */
export const STANDARD_THEMES: StandardTheme[] = [
  { id: "ember", name: "Ember", colors: ["#c9331a", "#e06a1f"] },
  { id: "amber", name: "Amber", colors: ["#f0a500", "#ffd35c"] },
  { id: "lime", name: "Lime", colors: ["#8ecb2f", "#d4e84a"] },
  { id: "moss", name: "Moss", colors: ["#14784e", "#2fa06b"] },
  { id: "teal", name: "Teal", colors: ["#0a6f6c", "#12a5a5"] },
  { id: "azure", name: "Azure", colors: ["#0369a1", "#0ea5e9"] },
  { id: "indigo", name: "Indigo", colors: ["#4353ff", "#7b6bff"] },
  { id: "violet", name: "Violet", colors: ["#8b5cf6", "#c084fc"] },
  { id: "magenta", name: "Magenta", colors: ["#d946a6", "#ff7ad1"] },
  { id: "rose", name: "Rose", colors: ["#f43f5e", "#fb8098"] },
];

/**
 * The words a workspace gets named after.
 *
 * Short, positive, and about what somebody would want a place of their own to
 * be — open, honest, free — rather than about what is in it. The same register
 * the handle suggester works in, so "Candid Workspace" and a suggested handle
 * read as coming from one product.
 */
export const WORKSPACE_ADJECTIVES = [
  "Bright",
  "Candid",
  "Clear",
  "Cosy",
  "Free",
  "Honest",
  "Keen",
  "Open",
  "Steady",
  "True",
];

/** Every icon the picker offers, flattened, in the order it shows them. */
export const WORKSPACE_ICONS: string[] = SPACE_ICON_GROUPS.flatMap((group) =>
  group.icons.map((icon) => `${LUCIDE_PREFIX}${icon.name}`),
);

/**
 * Something from the pool that is not spoken for, or anything at all.
 *
 * Preferring the unused is the whole point — a fifth workspace should not be
 * the fourth one's colour when six are still free. When the pool is exhausted
 * it hands back a random one rather than nothing, because "you have had ten
 * workspaces, pick your own colour" is not an answer a new workspace can act
 * on. Callers that care whether it wrapped can compare against `used`.
 */
export function pickUnused<T>(pool: T[], used: Iterable<T>): T {
  const taken = new Set(used);
  const free = pool.filter((item) => !taken.has(item));
  const from = free.length > 0 ? free : pool;
  return from[Math.floor(Math.random() * from.length)]!;
}

/**
 * A name nobody is using, numbered once the adjectives run out.
 *
 * "Cosy Workspace 2" rather than a second "Cosy Workspace": a duplicate name is
 * the one collision that cannot be seen — two identical rows in the switcher
 * with no way to tell which is which — where a repeated colour or mark is at
 * worst a near-miss. The number is the lowest that is free, so deleting
 * "Cosy Workspace 2" and making another gets that name back rather than
 * climbing to 3.
 */
export function nextWorkspaceName(existing: Iterable<string>): string {
  const taken = new Set(existing);
  const base = `${pickUnused(WORKSPACE_ADJECTIVES, [])} Workspace`;
  const free = WORKSPACE_ADJECTIVES.map((word) => `${word} Workspace`).filter(
    (name) => !taken.has(name),
  );
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)]!;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
