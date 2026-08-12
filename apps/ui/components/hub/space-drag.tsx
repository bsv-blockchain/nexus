"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** What is being dragged between profile columns. */
export interface SpaceDrag {
  kind: "item" | "tab";
  id: string;
  fromSpaceId: string;
  /** how many links a dragged folder is carrying, for the ghost stack */
  childCount: number;
}

export const SPACE_ITEM_MIME = "application/x-nexus-space-item";
export const SPACE_TAB_MIME = "application/x-nexus-space-tab";

interface DragState {
  drag: SpaceDrag | null;
  setDrag: (drag: SpaceDrag | null) => void;
  /** the column and slot a drop would land in */
  over: { spaceId: string; index: number } | null;
  setOver: (over: { spaceId: string; index: number } | null) => void;
}

const Context = createContext<DragState | null>(null);

/**
 * One drag, shared by every column.
 *
 * The columns are siblings, and the thing being dragged has to be known to all
 * of them at once: the source column collapses the folder it is giving up, and
 * the target column has to draw a line where the drop would land. Local state
 * in either one cannot tell the other.
 */
export function SpaceDragProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [drag, setDrag] = useState<SpaceDrag | null>(null);
  const [over, setOver] = useState<{ spaceId: string; index: number } | null>(
    null,
  );
  return (
    <Context.Provider value={{ drag, setDrag, over, setOver }}>
      {children}
    </Context.Provider>
  );
}

export function useSpaceDrag(): DragState {
  return (
    useContext(Context) ?? {
      drag: null,
      setDrag: () => undefined,
      over: null,
      setOver: () => undefined,
    }
  );
}

/**
 * The line a drop would land on.
 *
 * Between rows rather than on them, because "before this one" and "onto this
 * one" are different intentions and a highlight on a row cannot tell them
 * apart. Kept out of the flow so it never nudges the list it is describing.
 */
export function DropLine({ active }: { active: boolean }): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={`relative block h-0 ${active ? "" : "pointer-events-none"}`}
    >
      <span
        className={`bg-accent absolute inset-x-1 -top-px block h-0.5 rounded-full transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}

/**
 * A folder while it is being carried.
 *
 * Shut, with its contents implied by a couple of stacked edges behind it and a
 * count — a folder that stays open while you drag it is eleven rows following
 * the cursor, and the question at that moment is only "how much is coming with
 * this", which a number answers.
 */
export function DragStack({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}): ReactNode {
  return (
    <span className="relative block">
      {count > 0 && (
        <>
          <span
            aria-hidden="true"
            className="bg-surface-raised ring-border/60 absolute inset-x-2 -bottom-1 block h-2 rounded-b-lg ring-1"
          />
          <span
            aria-hidden="true"
            className="bg-surface-raised ring-border/60 absolute inset-x-3 -bottom-2 block h-2 rounded-b-lg ring-1"
          />
        </>
      )}
      <span className="bg-surface-raised ring-border relative block rounded-lg ring-1">
        {children}
      </span>
    </span>
  );
}
