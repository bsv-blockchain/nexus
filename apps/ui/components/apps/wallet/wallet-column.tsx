"use client";

/**
 * The wallet, and who it pays as, at the head of the Wallet app's column.
 *
 * It used to sit inside Portfolio, level with the balance — which put the
 * control that decides WHOSE number is on screen inside the panel showing the
 * number, and made it read as part of the reading rather than as the thing that
 * chose it. The column is where every other app puts what it is scoped to, and
 * this app is scoped to a wallet.
 *
 * The handle is a row of its own rather than a second line inside the button.
 * Two facts were being stated by one control: which wallet, and which name its
 * money leaves under. They are set in different places and changed for
 * different reasons, so somebody who wants to change the second should not have
 * to press the thing that changes the first.
 *
 * Connecting and disconnecting here act on the WORKSPACE, not on the wallet. A
 * handle belongs to a workspace and a workspace spends from one wallet, so this
 * row is a third window onto the assignment the profiles column and Identity
 * both edit — which is why it asks the same question before taking a handle off
 * somewhere else.
 */

import { Sheet } from "@/components/apps/messages/sheet";
import {
  WalletSwitcher,
  WalletTrigger,
} from "@/components/apps/wallet/wallet-switcher";
import { ConnectPicker } from "@/components/hub/connect-picker";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import {
  activeHandleFor,
  clearHandleFor,
  handleHeldElsewhere,
  setHandleFor,
  useSettings,
} from "@/lib/settings-store";
import { ArrowLeftRight, X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.profiles.connections;
const wallet = content.wallet;

function handleMark(on: boolean): ReactNode {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
        on ? "bg-accent/15 text-foreground" : "bg-muted text-muted-foreground"
      }`}
      aria-hidden="true"
    >
      @
    </span>
  );
}

export function WalletColumnHeader(): ReactNode {
  const settings = useSettings();
  const { activeSpaceId, spaces } = useHub();
  const [switching, setSwitching] = useState(false);
  const [moving, setMoving] = useState<
    { handle: string; fromId: string; fromName: string } | undefined
  >(undefined);

  const handle = activeHandleFor(activeSpaceId);
  const space = spaces.find((entry) => entry.id === activeSpaceId);
  const holderOf = (entry: string): (typeof spaces)[number] | undefined => {
    const held = handleHeldElsewhere(entry, activeSpaceId);
    return held === undefined
      ? undefined
      : spaces.find((other) => other.id === held);
  };

  return (
    <div className="border-border/60 mb-3 border-b pb-3">
      <WalletTrigger onOpen={() => setSwitching(true)} className="w-full" />

      <div className="mt-2">
        {handle ? (
          <div className="border-border bg-surface flex items-center gap-2 rounded-lg border px-2 py-1.5">
            {handleMark(true)}
            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground block text-[10px]">
                {wallet.payingAs}
              </span>
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium">
                @{handle}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearHandleFor(activeSpaceId);
                toast.success(`@${handle}`, {
                  description:
                    `${wallet.handleOff} ${space?.name ?? ""}`.trim(),
                  /* Undo rather than a confirmation. Taking a handle off costs
                     nothing while it is still yours to put back, and a dialog
                     in front of a reversible act is a dialog people learn to
                     dismiss. */
                  action: {
                    label: content.hub.undo,
                    onClick: () => setHandleFor(activeSpaceId, handle),
                  },
                });
              }}
              aria-label={wallet.disconnectHandle}
              title={wallet.disconnectHandle}
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md p-1"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <ConnectPicker
            label={copy.pickHandle}
            emptyLabel={copy.connectHandle}
            connected={null}
            options={[...settings.handles].reverse().map((entry) => {
              const holder = holderOf(entry);
              return {
                id: entry,
                label: `@${entry}`,
                mark: handleMark(false),
                ...(holder
                  ? { hint: copy.heldBy.replace("{name}", holder.name) }
                  : {}),
              };
            })}
            onPick={(id) => {
              const holder = holderOf(id);
              if (holder) {
                setMoving({
                  handle: id,
                  fromId: holder.id,
                  fromName: holder.name,
                });
                return;
              }
              setHandleFor(activeSpaceId, id);
              toast.success(`@${id}`, {
                description: `${copy.nowOn} ${space?.name ?? ""}`.trim(),
              });
            }}
          />
        )}
      </div>

      <WalletSwitcher open={switching} onClose={() => setSwitching(false)} />

      {/* Portalled for the same reason the profiles column's is: a full-screen
          surface rendered inside a themed subtree comes up wearing that
          subtree's palette. */}
      {moving !== undefined &&
        createPortal(
          <Sheet
            open
            onClose={() => setMoving(undefined)}
            label={copy.moveTitle
              .replace("{handle}", moving.handle)
              .replace("{name}", moving.fromName)}
            footer={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMoving(undefined)}
                  className="focus-ring border-border hover:bg-surface-hover flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold"
                >
                  {copy.moveCancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHandleFor(activeSpaceId, moving.handle);
                    toast.success(`@${moving.handle}`, {
                      description:
                        `${copy.nowOn} ${space?.name ?? ""} · ${copy.movedFrom.replace("{name}", moving.fromName)}`.trim(),
                      action: {
                        label: content.hub.undo,
                        onClick: () =>
                          setHandleFor(moving.fromId, moving.handle),
                      },
                    });
                    setMoving(undefined);
                  }}
                  className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                >
                  {copy.moveConfirm}
                </button>
              </div>
            }
          >
            <div className="space-y-2 px-5 pt-3 pb-4">
              <h2 className="flex items-start gap-2 text-base font-bold">
                <ArrowLeftRight
                  className="text-warning mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {copy.moveTitle
                  .replace("{handle}", moving.handle)
                  .replace("{name}", moving.fromName)}
              </h2>
              <p className="text-muted-foreground text-sm text-pretty">
                {copy.moveBody.replace("{name}", moving.fromName)}
              </p>
            </div>
          </Sheet>,
          document.body,
        )}
    </div>
  );
}
