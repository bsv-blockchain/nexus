"use client";

import { formatBytes } from "@/components/hub/downloads-panel";
import { useHub } from "@/components/hub/hub-provider";
import { content, getVaultItems, type VaultItem } from "@/lib/data";
import {
  FileLock2,
  KeyRound,
  Plus,
  ShieldCheck,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const kindIcons: Record<VaultItem["kind"], LucideIcon> = {
  "seed-backup": Sprout,
  key: KeyRound,
  credential: ShieldCheck,
  file: FileLock2,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function VaultApp(): ReactNode {
  const { vaultKind } = useHub();
  const items = getVaultItems().filter(
    (item) => vaultKind === "all" || item.kind === vaultKind,
  );
  const copy = content.vault;

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{copy.title}</h2>
          <button
            type="button"
            className="focus-ring flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.addAction}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
            No items of this type.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl bg-surface">
            {items.map((item) => {
              const Icon = kindIcons[item.kind];
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {copy.lastAccessed} {formatDate(item.lastAccessedAt)}
                      {item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                    {item.kind.replace("-", " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          {copy.encryptedNote}
        </p>
      </div>
    </div>
  );
}
