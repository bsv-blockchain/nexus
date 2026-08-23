"use client";

import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { SpaceContent } from "@/components/hub/space-content";
import {
  SpaceDragProvider,
  useSpaceDrag,
} from "@/components/hub/space-drag";
import { ProfileConnections } from "@/components/hub/profile-connections";
import { SpaceIcon } from "@/components/hub/space-icon";
import { SpaceMenu } from "@/components/hub/space-menu";
import { ThemeButton } from "@/components/hub/theme-picker";
import { useCustomTheme } from "@/components/hub/theme-provider";
import { content, type Space } from "@/lib/data";
import { derivePalette, paletteVars, themeGradient } from "@/lib/theme";
import {
  consumeNewWorkspaceRequest,
  useNewWorkspaceRequested,
} from "@/lib/workspace-request";
import { MoreHorizontal, Move, Pencil, Plus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const SPACE_DRAG = "application/x-nexus-space";

// The app's default blueish dark palette — used to preview any profile that
// has no theme of its own (matches globals.css `.dark`).
const DARK_BASE: Record<string, string> = {
  "--background": "#17111f",
  "--foreground": "#f4f2f8",
  "--surface": "#221a2f",
  "--surface-raised": "#2b2240",
  "--surface-hover": "rgba(244, 242, 248, 0.07)",
  "--muted": "#2b2240",
  "--muted-foreground": "#9d94b3",
  "--border": "rgba(244, 242, 248, 0.09)",
  "--ring": "#5b6aff",
  "--accent": "#4353ff",
  "--accent-foreground": "#ffffff",
};

/**
 * Scope a column to its own profile's theme. The active profile inherits the
 * chrome (no override); non-active profiles preview their own theme, or the
 * default dark palette when none is set.
 */
function columnTheme(
  theme: string[] | null,
  isActive: boolean,
): CSSProperties | undefined {
  if (isActive) return undefined;
  if (theme && theme.length) {
    return {
      ...paletteVars(derivePalette(theme)),
      background: themeGradient(theme),
    } as CSSProperties;
  }
  return DARK_BASE as CSSProperties;
}

/**
 * Full-area Profiles manager (Profiles tab): every profile as a column, each
 * with an edit affordance, a drag handle to reorder, and an options menu.
 */
export function ProfilesManager(): ReactNode {
  const { spaces, moveSpace, createSpace } = useHub();
  /*
   * Every profile, the active one included.
   *
   * It used to be held back because the left column was showing it, which made
   * the manager a view of "the others" — you could not compare the profile you
   * were in against the ones you were not, which is the only reason to open
   * this screen. It is a column like the rest now, marked by a ring rather than
   * by absence.
   */
  const columns = spaces;
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{
    id: string;
    side: "before" | "after";
  } | null>(null);

  /*
   * The title bar's "+" asks for this one to be brought into sight.
   *
   * It cannot scroll this view itself — it has no idea how many columns there
   * are or how wide they came out — so it leaves a request and the view answers
   * it. The request is taken back once it has been served, so arriving here
   * some other way later does not yank the scroll position about.
   *
   * While it stands, the circle wears the help button's ring: something moved
   * on screen because of a control somewhere else, and the eye needs telling
   * where it landed. Hovering it is proof enough that it has been found.
   */
  const requested = useNewWorkspaceRequested();
  const plus = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!requested) return;
    /* `end` rather than `nearest`: the point is to push the columns left and
       show what is past them, which a minimal scroll would not do. `nearest`
       vertically, so nothing above this view moves. */
    plus.current?.scrollIntoView({
      behavior: "smooth",
      inline: "end",
      block: "nearest",
    });
    /* Long enough to be noticed, short enough not to become wallpaper if
       nobody ever points at it. */
    const timer = setTimeout(consumeNewWorkspaceRequest, 6000);
    return () => clearTimeout(timer);
  }, [requested]);

  const canDrop = (event: React.DragEvent): boolean =>
    event.dataTransfer.types.includes(SPACE_DRAG);
  const sideOf = (event: React.DragEvent): "before" | "after" => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX - rect.left < rect.width / 2 ? "before" : "after";
  };
  const reset = (): void => {
    setDragId(null);
    setOver(null);
  };

  return (
    <SpaceDragProvider>
    <div className="flex h-full items-stretch gap-3 py-4 pr-2 pl-4">
      {columns.map((space) => (
        <ProfileColumn
          key={space.id}
          space={space}
          isDragging={dragId === space.id}
          overSide={over?.id === space.id ? over.side : null}
          onDragStart={() => setDragId(space.id)}
          onDragEnd={reset}
          onDragOver={(event) => {
            if (canDrop(event) && dragId !== space.id) {
              event.preventDefault();
              setOver({ id: space.id, side: sideOf(event) });
            }
          }}
          onDragLeave={() =>
            setOver((current) => (current?.id === space.id ? null : current))
          }
          onDrop={(event) => {
            event.preventDefault();
            const id = event.dataTransfer.getData(SPACE_DRAG);
            if (id) moveSpace(id, space.id, sideOf(event));
            reset();
          }}
        />
      ))}

      <div className="flex h-full shrink-0 items-center px-3">
        <button
          ref={plus}
          type="button"
          onPointerEnter={consumeNewWorkspaceRequest}
          onFocus={consumeNewWorkspaceRequest}
          onClick={() => {
            consumeNewWorkspaceRequest();
            createSpace();
          }}
          aria-label={content.newItemMenu.newSpace}
          className={`focus-ring relative flex size-10 items-center justify-center rounded-full ${PRIMARY_CTA}`}
        >
          <Plus className="size-5" aria-hidden="true" />
          {/* `pointer-events-none` so the ring never eats the click it is
              advertising — the same reason the help circle's does. */}
          {requested && (
            <span
              aria-hidden="true"
              className="bg-accent/40 pointer-events-none absolute inset-0 animate-ping rounded-full"
            />
          )}
        </button>
      </div>
    </div>
    </SpaceDragProvider>
  );
}

function ProfileColumn({
  space,
  isDragging,
  overSide,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  space: Space;
  isDragging: boolean;
  overSide: "before" | "after" | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
}): ReactNode {
  const { activeSpaceId, setActiveSpaceId } = useHub();
  const { profileTheme, previewFor } = useCustomTheme();
  const [menu, setMenu] = useState<
    null | "top" | "bottom" | "icon" | "rename"
  >(null);
  const [tab, setTab] = useState<"connections" | "browsing">("connections");
  const { drag } = useSpaceDrag();
  const isActive = space.id === activeSpaceId;
  // While this column's theme picker is open, show its unsaved edit live.
  const liveTheme = previewFor(space.id) ?? profileTheme(space.id);
  const scopedTheme = columnTheme(liveTheme, isActive);

  /*
   * Makes it the active profile and stays put.
   *
   * It used to jump to the app canvas, which meant the only way to look at a
   * profile was to stop looking at the others — and the click that was supposed
   * to say "this one" also said "and take me somewhere else". The ring and the
   * left column both move; nothing navigates.
   */
  const activate = () => setActiveSpaceId(space.id);

  return (
    <div
      style={scopedTheme}
      className={`relative flex h-full w-72 shrink-0 flex-col rounded-2xl bg-surface p-3 text-foreground transition-opacity ${
        isDragging ? "opacity-40" : ""
      } ${
        isActive
          ? "ring-accent ring-2"
          : "ring-border/60 cursor-pointer ring-1"
      }`}
      onClick={
        isActive
          ? undefined
          : (event) => {
              // Activate when clicking the column's own surface, but let
              // interactive controls (buttons, links) handle their own clicks.
              if (!(event.target as HTMLElement).closest("button, a")) {
                activate();
              }
            }
      }
      onDragOver={(event) => {
        /*
         * Reveal the list a drop would land in.
         *
         * A column showing Connections has nowhere visible to put a bookmark,
         * so dragging over it looked like a refusal. Switching to Browsing on
         * hover shows the target and the drop line in it — the alternative is
         * asking somebody to click a tab with something already in their hand.
         *
         * Only for a drag that came from another column, and only towards
         * Browsing: nothing here ever switches a column back, because that
         * would undo a tab somebody chose while they were merely passing over.
         */
        if (drag && drag.fromSpaceId !== space.id && tab !== "browsing") {
          setTab("browsing");
        }
        onDragOver(event);
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {overSide === "before" && (
        <span
          className="absolute inset-y-2 -left-1.5 w-0.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
      {overSide === "after" && (
        <span
          className="absolute inset-y-2 -right-1.5 w-0.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}

      {/*
        Header: the icon and the name are each the control for themselves.
        Clicking the icon asks for an icon and clicking the name asks to
        rename — both were a pencil two elements away, which is a menu standing
        in for the two things people actually point at. Activating the profile
        is the column's own click, which already works anywhere else on it.
      */}
      <div className="relative flex items-center gap-1 px-1.5 pb-2">
        <button
          type="button"
          onClick={() => setMenu("icon")}
          aria-label={`${space.name} icon`}
          title={content.spaceMenu.iconPanelTitle}
          className="focus-ring hover:bg-surface-hover shrink-0 rounded-md p-1 transition-colors"
        >
          <SpaceIcon value={space.emoji} size={18} />
        </button>
        <button
          type="button"
          onClick={() => setMenu("rename")}
          aria-label={`Rename ${space.name}`}
          className="focus-ring hover:bg-surface-hover min-w-0 flex-1 truncate rounded-md p-1 text-left text-sm font-semibold transition-colors"
        >
          {space.name}
        </button>
        <button
          type="button"
          aria-label={`${space.name} options`}
          onClick={() => setMenu("top")}
          className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        {/* Keyed by intent so each opens on the panel it was asked for; the
            view is read once per mount. */}
        <SpaceMenu
          key={menu ?? "closed"}
          open={menu === "top" || menu === "icon"}
          onClose={() => setMenu(null)}
          spaceId={space.id}
          initialView={menu === "icon" ? "icon" : "root"}
          initialDialog={menu === "rename" ? "rename" : null}
          className="top-9 right-0"
        />
      </div>

      {/* Connections first: what a profile *is* comes before what it has
          open. Browsing keeps the tabs and bookmarks, which is also what makes
          them draggable between columns. */}
      <div
        role="tablist"
        aria-label={space.name}
        className="bg-surface-raised ring-border/60 mb-2 grid grid-cols-2 gap-0.5 rounded-lg p-0.5 ring-1"
      >
        {(["connections", "browsing"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`focus-ring rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              tab === id
                ? "bg-accent/20 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {id === "connections"
              ? content.profiles.tabConnections
              : content.profiles.tabBrowsing}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "connections" ? (
          <ProfileConnections spaceId={space.id} />
        ) : (
          <SpaceContent spaceId={space.id} managerSpaceId={space.id} />
        )}
      </div>

      {/* Footer: theme palette + drag handle (reorder) + options menu. Left,
          like every other column's controls — a row of icons pinned to the
          right of one column and the left of the next is two conventions. */}
      <div className="border-border/60 relative flex items-center gap-1 border-t pt-2">
        {/* Handle first, then the palette: the one that moves the column comes
            before the one that paints it. The menu sits at the far end, where
            an overflow of everything else belongs. */}
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(SPACE_DRAG, space.id);
            event.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          aria-label={`Reorder ${space.name}`}
          className="focus-ring cursor-grab rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
        >
          <Move className="size-4" aria-hidden="true" />
        </button>
        <ThemeButton spaceId={space.id} />
        <button
          type="button"
          aria-label={`${space.name} options`}
          onClick={() => setMenu("bottom")}
          className="focus-ring ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
        <SpaceMenu
          open={menu === "bottom"}
          onClose={() => setMenu(null)}
          spaceId={space.id}
          className="right-0 bottom-full mb-2"
        />
      </div>
    </div>
  );
}
