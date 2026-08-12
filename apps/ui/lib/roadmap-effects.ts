/**
 * What this session has done to the roadmap.
 *
 * The board in `lib/data/roadmap.ts` is what shipped with the build. Everything
 * a person does to it — pledging, commenting, suggesting, dragging a card into
 * another column — lands here and is layered on top when the board is read.
 * Same module-store shape as {@link file://./command-effects.ts}, and for the
 * same reason: several surfaces show the same feature (the board, the detail
 * pane, a card in a chat thread) and they must never disagree about how much is
 * behind it.
 *
 * Nothing is written to disk. A pledge is a session's worth of pretending, and
 * persisting it would make the prototype claim a payment happened.
 */
import {
  roadmapFeatures,
  type RoadmapComment,
  type RoadmapFeature,
  type RoadmapPledge,
  type RoadmapStatus,
} from "@/lib/data";

interface RoadmapState {
  /** pledges this session added, by feature id */
  pledges: Record<string, RoadmapPledge[]>;
  /** comments this session added, by feature id */
  comments: Record<string, RoadmapComment[]>;
  /** columns a card was dragged into, by feature id */
  moved: Record<string, RoadmapStatus>;
  /** card order within a column, by status; absent means the data's own order */
  order: Partial<Record<RoadmapStatus, string[]>>;
  /** features suggested this session, newest first */
  suggested: RoadmapFeature[];
}

const INITIAL: RoadmapState = {
  pledges: {},
  comments: {},
  moved: {},
  order: {},
  suggested: [],
};

let state: RoadmapState = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeRoadmap(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRoadmap(): RoadmapState {
  return state;
}

/** The server renders the shipped board, which keeps hydration stable. */
export function getRoadmapServerSnapshot(): RoadmapState {
  return INITIAL;
}

/**
 * The board as it stands: seeded features plus anything suggested, with this
 * session's pledges, comments and moves folded in.
 *
 * Derived on read rather than kept as a second copy. Two lists that have to be
 * updated together are two lists that will eventually differ.
 */
export function currentFeatures(): RoadmapFeature[] {
  const all = [...state.suggested, ...roadmapFeatures];
  return all.map((feature) => {
    const extraPledges = state.pledges[feature.id];
    const extraComments = state.comments[feature.id];
    const moved = state.moved[feature.id];
    if (!extraPledges && !extraComments && !moved) return feature;
    const pledges = extraPledges
      ? [...feature.pledges, ...extraPledges]
      : feature.pledges;
    return {
      ...feature,
      pledges,
      pledgedSats: pledges.reduce((sum, pledge) => sum + pledge.sats, 0),
      comments: extraComments
        ? [...feature.comments, ...extraComments]
        : feature.comments,
      status: moved ?? feature.status,
    };
  });
}

export function currentFeature(id: string): RoadmapFeature | undefined {
  return currentFeatures().find((feature) => feature.id === id);
}

/**
 * One column, in the order it should be shown.
 *
 * A card dragged within a column keeps its place for the rest of the session;
 * one that has never been dragged sits where the data put it. Ids in the order
 * list that no longer belong to this column are ignored rather than pruned,
 * because dragging a card out and back should return it to where it was.
 */
export function columnFeatures(
  status: RoadmapStatus,
  all: RoadmapFeature[],
): RoadmapFeature[] {
  const inColumn = all.filter((feature) => feature.status === status);
  const order = state.order[status];
  if (!order) return inColumn;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...inColumn].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra === undefined && rb === undefined) return 0;
    /* Never-dragged cards keep the data's order, below anything placed by
       hand — a card you just dropped at the top should stay at the top. */
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}

/** Puts satoshis behind a feature. Returns the new total. */
export function pledge(featureId: string, sats: number, personId = "me"): number {
  const at = new Date().toISOString().slice(0, 10);
  const existing = state.pledges[featureId] ?? [];
  state = {
    ...state,
    pledges: {
      ...state.pledges,
      [featureId]: [...existing, { personId, sats, at }],
    },
  };
  emit();
  return currentFeature(featureId)?.pledgedSats ?? sats;
}

export function comment(featureId: string, body: string, personId = "me"): void {
  const existing = state.comments[featureId] ?? [];
  state = {
    ...state,
    comments: {
      ...state.comments,
      [featureId]: [
        ...existing,
        {
          id: `c-${featureId}-${existing.length + 1}-session`,
          personId,
          body,
          at: new Date().toISOString().slice(0, 10),
        },
      ],
    },
  };
  emit();
}

/**
 * Drops a card into a column at a position.
 *
 * `before` is the id the card was dropped above, or null for the end. The order
 * is rebuilt from the column as it looks *after* the move so the result is the
 * arrangement on screen, not an index into a list that has since changed.
 */
export function moveFeature(
  featureId: string,
  status: RoadmapStatus,
  before: string | null,
): void {
  const wasIn = currentFeature(featureId)?.status;
  const next = { ...state.moved };
  if (status === (roadmapFeatures.find((f) => f.id === featureId)?.status ?? status)) {
    delete next[featureId];
  } else {
    next[featureId] = status;
  }
  state = { ...state, moved: next };

  const column = columnFeatures(status, currentFeatures())
    .map((feature) => feature.id)
    .filter((id) => id !== featureId);
  const at = before === null ? column.length : column.indexOf(before);
  column.splice(at < 0 ? column.length : at, 0, featureId);

  const order = { ...state.order, [status]: column };
  /* The column it came from is re-pinned too. Without this the cards left
     behind fall back to the data's order and shuffle under the pointer. */
  if (wasIn && wasIn !== status) {
    order[wasIn] = columnFeatures(wasIn, currentFeatures()).map((f) => f.id);
  }
  state = { ...state, order };
  emit();
}

/** Adds a feature somebody asked for. It starts unfunded, like any other. */
export function suggestFeature(input: {
  title: string;
  summary: string;
  body: string;
  complexity: RoadmapFeature["complexity"];
  goalSats: number;
}): RoadmapFeature {
  const id = `suggested-${input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}`;
  const feature: RoadmapFeature = {
    id,
    title: input.title,
    summary: input.summary,
    body: input.body,
    status: "fundable",
    complexity: input.complexity,
    goalSats: input.goalSats,
    pledgedSats: 0,
    pledges: [],
    comments: [],
    createdAt: new Date().toISOString().slice(0, 10),
  };
  state = { ...state, suggested: [feature, ...state.suggested] };
  emit();
  return feature;
}
