"use client";

import { SealButton, VaultDoors } from "@/components/apps/vault/vault-doors";
import { formatBytes } from "@/components/hub/downloads-panel";
import { useHub } from "@/components/hub/hub-provider";
import { content, getVaultItems, type VaultItem } from "@/lib/data";
import { LOCK_AFTER_MS, lock, useVault } from "@/lib/vault-store";
import {
  FileLock2,
  KeyRound,
  Plus,
  ShieldCheck,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

/** The reveal, shared by both columns so they read as one movement. */
const EASE = [0.4, 0, 0.2, 1] as const;
const STAGGER = 0.055;
/** The head start the heading takes before the rows follow it. */
const HEADER_LEAD = 0.08;

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
  const { vaultKind, activeApp } = useHub();
  const { phase, policy } = useVault();
  const items = getVaultItems().filter(
    (item) => vaultKind === "all" || item.kind === vaultKind,
  );
  const copy = content.vault;

  /*
   * Shutting it again.
   *
   * `on-leave` runs on unmount, which is exactly when you stopped looking at
   * the vault — the canvas swaps the moment another app takes it. `timed` is a
   * single timeout from the moment it opened rather than a rolling idle timer:
   * "after five minutes" is a promise about how long a vault can be open, and
   * one that resets every time you move the mouse is not that promise.
   */
  useEffect(() => {
    if (policy !== "on-leave") return;
    return () => lock();
  }, [policy]);

  useEffect(() => {
    if (policy !== "timed" || phase !== "open") return;
    const id = window.setTimeout(lock, LOCK_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [policy, phase]);

  /* Shut whenever the vault is not the app on screen, so a workspace switch
     cannot leave it standing open behind something else. */
  useEffect(() => {
    if (activeApp === "vault" || policy === "never") return;
    return () => lock();
  }, [activeApp, policy]);

  /* The doors cover the canvas until they have finished travelling, so the
     contents are never in the document while the vault is shut. */
  if (phase !== "open") {
    return (
      <div className="relative h-full">
        <VaultDoors />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-2xl">
        <motion.div
          className="flex items-center justify-between gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <h2 className="text-lg font-bold">{copy.title}</h2>
          <div className="flex items-center gap-2">
            <SealButton />
            <button
              type="button"
              className="focus-ring flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              <Plus className="size-4" aria-hidden="true" />
              {copy.addAction}
            </button>
          </div>
        </motion.div>

        {items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
            No items of this type.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl bg-surface">
            {items.map((item, index) => {
              const Icon = kindIcons[item.kind];
              return (
                /*
                 * One after another, not all together.
                 *
                 * The doors have just come off something; a list that appears
                 * whole in one frame undoes that by arriving faster than the
                 * thing that revealed it. The stagger is short enough to read
                 * as one movement and long enough to have a direction.
                 */
                <motion.li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.34,
                    ease: EASE,
                    delay: HEADER_LEAD + index * STAGGER,
                  }}
                >
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
                </motion.li>
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
