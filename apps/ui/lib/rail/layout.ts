/**
 * Rail layout: what sits in the sidebar, in what order, in which folders.
 *
 * A rail slot holds a RailRef, and the two kinds are deliberately different
 * types. `app` is a screen compiled into this binary; `site` is a website the
 * user pinned. Keeping them apart in the type is what stops a website reaching
 * code that assumes a screen — see the spec's compliance section. Widening this
 * to a single stringly-typed id would erase exactly the distinction that
 * argument rests on.
 *
 * Dependency-free so the bare Node test runner can reach it.
 */

export type RailRef =
  | { kind: "app"; slug: string }
  | { kind: "site"; id: string };

export type RailEntry =
  | { type: "single"; ref: RailRef }
  | {
      type: "group";
      id: string;
      name: string;
      /** optional folder tint (hex); falls back to the surface color */
      color?: string;
      members: RailRef[];
    };

/** Stable identity for a ref — React key, Set member, dedupe. */
export function refKey(ref: RailRef): string {
  return ref.kind === "app" ? `app:${ref.slug}` : `site:${ref.id}`;
}

export function sameRef(a: RailRef, b: RailRef): boolean {
  return refKey(a) === refKey(b);
}

function parseRef(value: unknown): RailRef | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind === "app" && typeof record.slug === "string") {
    return { kind: "app", slug: record.slug };
  }
  if (record.kind === "site" && typeof record.id === "string") {
    return { kind: "site", id: record.id };
  }
  return null;
}

function parseEntry(value: unknown): RailEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  // Current shape.
  if (record.type === "single") {
    const ref = parseRef(record.ref);
    return ref ? { type: "single", ref } : null;
  }

  // Pre-migration shape: a bare app slot.
  if (record.type === "app" && typeof record.slug === "string") {
    return { type: "single", ref: { kind: "app", slug: record.slug } };
  }

  if (record.type === "group" && typeof record.id === "string") {
    const name = typeof record.name === "string" ? record.name : "";
    // `members` is current; `apps` is the pre-migration array of slugs.
    const members = Array.isArray(record.members)
      ? record.members.map(parseRef).filter((ref): ref is RailRef => ref !== null)
      : Array.isArray(record.apps)
        ? record.apps
            .filter((slug): slug is string => typeof slug === "string")
            .map((slug): RailRef => ({ kind: "app", slug }))
        : [];
    // exactOptionalPropertyTypes: only attach `color` when there is one.
    return typeof record.color === "string"
      ? { type: "group", id: record.id, name, color: record.color, members }
      : { type: "group", id: record.id, name, members };
  }

  return null;
}

/**
 * Read a persisted layout, upgrading anything an older build wrote.
 *
 * Returns null when the payload is unusable, so the caller can fall back to a
 * freshly derived layout instead of rendering an empty rail.
 */
export function migrateRailLayout(raw: string): RailEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed
    .map(parseEntry)
    .filter((entry): entry is RailEntry => entry !== null);
}

/**
 * Reconcile a stored layout against what currently exists.
 *
 * Order in the stored layout wins; anything present but unplaced is appended;
 * anything placed but gone is dropped. A group that loses all but one member
 * collapses to a single slot, and an empty group disappears — otherwise a
 * removed site leaves a folder containing nothing.
 */
export function reconcileRail(
  layout: RailEntry[],
  present: RailRef[],
): RailEntry[] {
  const presentKeys = new Set(present.map(refKey));
  const seen = new Set<string>();
  const out: RailEntry[] = [];

  const take = (ref: RailRef): boolean => {
    const key = refKey(ref);
    if (!presentKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  for (const entry of layout) {
    if (entry.type === "single") {
      if (take(entry.ref)) out.push(entry);
      continue;
    }
    const members = entry.members.filter(take);
    if (members.length >= 2) out.push({ ...entry, members });
    else if (members.length === 1) {
      out.push({ type: "single", ref: members[0]! });
    }
  }

  for (const ref of present) {
    if (take(ref)) out.push({ type: "single", ref });
  }

  return out;
}
