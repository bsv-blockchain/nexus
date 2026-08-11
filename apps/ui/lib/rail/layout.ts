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

/*
 * There is no reader for a persisted layout here, and no migration for one.
 *
 * `migrateRailLayout` and its parsers were written to upgrade a stored payload,
 * but the rail layout has never been persisted: the provider holds it in
 * useState with no storage key, so no build has ever written the old shape and
 * nothing has ever had to be upgraded from it. Should the layout gain a storage
 * key later, the parser it needs will be written against the shape actually
 * being stored at that point rather than against a guess kept alive for it.
 */

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
