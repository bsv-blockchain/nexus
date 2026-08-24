"use client";

/**
 * Which profile this workspace is wearing, changed from where it is stated.
 *
 * Opened by the posting-as row rather than sitting beside it: the row is
 * already the answer to "who am I here", and the shortest possible route from
 * reading an answer to changing it is pressing the answer.
 *
 * Same popover-on-a-pointer, sheet-on-a-phone shape as the repositories manager
 * and the vault's lock policy, anchored to a rect captured at click.
 */

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { connectProfile, profileFor, useProfiles } from "@/lib/profiles-store";
import { Check, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const copy = content.timeline.switcher;

export function ProfileSwitcher({
  anchor,
  onClose,
}: {
  anchor: DOMRect | null;
  onClose: () => void;
}): ReactNode {
  return (
    <AnimatePresence>
      {anchor && <Sheet anchor={anchor} onClose={onClose} />}
    </AnimatePresence>
  );
}

function Sheet({
  anchor,
  onClose,
}: {
  anchor: DOMRect;
  onClose: () => void;
}): ReactNode {
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(true);

  const isDesktop = useIsDesktop();
  const state = useProfiles();
  const { activeSpaceId, setMainView, setSettingsCategory } = useHub();
  const connected = profileFor(state, activeSpaceId);

  const desktopPos = isDesktop
    ? {
        left: Math.max(12, Math.min(anchor.left, window.innerWidth - 320)),
        bottom: window.innerHeight - anchor.top + 8,
      }
    : null;

  const base =
    "z-70 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.button
        type="button"
        aria-label={copy.close}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-65 ${isDesktop ? "cursor-default" : "bg-black/40"}`}
      />
      <motion.div
        role="dialog"
        aria-label={copy.title}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(desktopPos
          ? { style: { left: desktopPos.left, bottom: desktopPos.bottom } }
          : {})}
        className={
          isDesktop
            ? `fixed w-[288px] rounded-2xl ${base}`
            : `fixed inset-x-0 bottom-0 rounded-t-3xl ${base}`
        }
      >
        {!isDesktop && (
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="bg-muted-foreground/30 h-1 w-9 rounded-full" />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setSettingsCategory("profiles");
            setMainView("settings");
            onClose();
          }}
          className="focus-ring hover:bg-surface-hover border-border flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left"
        >
          <Pencil
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold">{copy.edit}</span>
        </button>

        <p className="text-muted-foreground px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-wide uppercase">
          {copy.switchTo}
        </p>
        <div className="p-1.5 pt-0">
          {state.profiles.map((profile) => {
            const active = profile.id === connected.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  /*
                   * Connecting one disconnects the other by construction: a
                   * workspace holds a single profile, so this is an assignment
                   * rather than a pair of calls that could half-fail.
                   */
                  connectProfile(activeSpaceId, profile.id);
                  onClose();
                }}
                className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left"
              >
                <MemberAvatar person={profile} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {profile.name || copy.untitled}
                  </span>
                  <span className="text-muted-foreground block truncate font-mono text-[11px]">
                    @{profile.handle}
                  </span>
                </span>
                {active && (
                  <Check
                    className="text-accent size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
