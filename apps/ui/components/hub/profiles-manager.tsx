"use client";

import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import { SpaceContent } from "@/components/hub/space-content";
import { SpaceIcon } from "@/components/hub/space-icon";
import { SpaceMenu } from "@/components/hub/space-menu";
import { ThemeButton } from "@/components/hub/theme-picker";
import { useCustomTheme } from "@/components/hub/theme-provider";
import { content, type Space } from "@/lib/data";
import { derivePalette, paletteVars, themeGradient } from "@/lib/theme";
import { MoreHorizontal, Move, Pencil, Plus } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

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
  const { spaces, activeSpaceId, moveSpace, createSpace } = useHub();
  // The active profile is shown in the left sidebar, so omit it here.
  const columns = spaces.filter((space) => space.id !== activeSpaceId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{
    id: string;
    side: "before" | "after";
  } | null>(null);

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
          type="button"
          onClick={createSpace}
          aria-label={content.newItemMenu.newSpace}
          className={`focus-ring flex size-10 items-center justify-center rounded-full ${PRIMARY_CTA}`}
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
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
  const { activeSpaceId, setActiveSpaceId, setMainView } = useHub();
  const { profileTheme, previewFor } = useCustomTheme();
  const [menu, setMenu] = useState<null | "top" | "bottom">(null);
  const isActive = space.id === activeSpaceId;
  // While this column's theme picker is open, show its unsaved edit live.
  const liveTheme = previewFor(space.id) ?? profileTheme(space.id);
  const scopedTheme = columnTheme(liveTheme, isActive);

  const activate = () => {
    setActiveSpaceId(space.id);
    setMainView("app");
  };

  return (
    <div
      style={scopedTheme}
      className={`relative flex h-full w-72 shrink-0 flex-col rounded-2xl bg-surface p-3 text-foreground transition-opacity ${
        isDragging ? "opacity-40" : ""
      } ${isActive ? "" : "cursor-pointer"}`}
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
      onDragOver={onDragOver}
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

      {/* Header: icon + name (opens the profile) + edit menu */}
      <div className="relative flex items-center gap-2 px-1.5 pb-2">
        <button
          type="button"
          onClick={activate}
          aria-label={`Open ${space.name}`}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-surface-hover"
        >
          <SpaceIcon value={space.emoji} size={18} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {space.name}
          </span>
        </button>
        <button
          type="button"
          aria-label={`${space.name} options`}
          onClick={() => setMenu("top")}
          className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        <SpaceMenu
          open={menu === "top"}
          onClose={() => setMenu(null)}
          spaceId={space.id}
          className="top-9 right-0"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SpaceContent spaceId={space.id} managerSpaceId={space.id} />
      </div>

      {/* Footer: theme palette + drag handle (reorder) + options menu, right-aligned */}
      <div className="relative flex items-center justify-end gap-1 pt-2">
        <ThemeButton spaceId={space.id} />
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
        <button
          type="button"
          aria-label={`${space.name} options`}
          onClick={() => setMenu("bottom")}
          className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
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
