"use client";

import { Dialog } from "@/components/hub/dialog";
import { useHub } from "@/components/hub/hub-provider";
import { Ban, Check } from "lucide-react";
import { useState, type ReactNode } from "react";

const FOLDER_COLORS = [
  "#4353ff",
  "#0ea5e9",
  "#0891b2",
  "#16a34a",
  "#22c55e",
  "#7c3aed",
  "#db2777",
  "#e11d48",
  "#dc2626",
  "#f59e0b",
  "#d97706",
  "#64748b",
];

/** "Folder Settings" — rename a rail group and pick its folder color. */
export function GroupSettingsDialog({
  open,
  onClose,
  groupId,
  initialName,
  initialColor,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  initialName: string;
  initialColor?: string | undefined;
}): ReactNode {
  const { renameGroup, setGroupColor } = useHub();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string | undefined>(initialColor);

  const done = (): void => {
    const trimmed = name.trim();
    if (trimmed) renameGroup(groupId, trimmed);
    setGroupColor(groupId, color ?? "");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} label="Folder Settings">
      <form
        className="p-6"
        onSubmit={(event) => {
          event.preventDefault();
          done();
        }}
      >
        <h2 className="text-lg font-bold">Folder Settings</h2>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold">Folder Name</span>
          <input
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder="Folder name"
            aria-label="Folder name"
            className="focus-ring w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring"
          />
        </label>

        <div className="mt-5">
          <span className="mb-2 block text-sm font-semibold">Folder Color</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-7">
            <button
              type="button"
              aria-label="No color"
              aria-pressed={!color}
              onClick={() => setColor(undefined)}
              className={`focus-ring flex aspect-square items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground ${
                !color ? "ring-2 ring-ring ring-offset-2 ring-offset-surface-raised" : ""
              }`}
            >
              <Ban className="size-4" aria-hidden="true" />
            </button>
            {FOLDER_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Color ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => setColor(swatch)}
                style={{ backgroundColor: swatch }}
                className={`focus-ring flex aspect-square items-center justify-center rounded-xl ${
                  color === swatch
                    ? "ring-2 ring-ring ring-offset-2 ring-offset-surface-raised"
                    : ""
                }`}
              >
                {color === swatch && (
                  <Check className="size-4 text-white" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="focus-ring mt-6 w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          Done
        </button>
      </form>
    </Dialog>
  );
}
