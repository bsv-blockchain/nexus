"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { CollectibleArt } from "@/components/apps/wallet/collectible-art";
import {
  escrowById,
  getEffects,
  getEffectsServerSnapshot,
  recordTransfer,
  setEscrowStatus,
  subscribeEffects,
} from "@/lib/command-effects";
import {
  content,
  getCollectibles,
  getMessagePerson,
  type CommandCard,
} from "@/lib/data";
import { formatSats } from "@/lib/messages";
import { Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { useSyncExternalStore, type ReactNode } from "react";

/**
 * The state of an escrow, under the command that committed a side of it.
 *
 * Everything about this card is an argument that nothing has happened yet.
 * Two people have said what they will do and named someone to hold it; the
 * agent has not agreed, no value has moved, and either window can lapse. A
 * card that read like a receipt would be lying about all three.
 *
 * Accept, reject and release are shown only to the agent. That is a courtesy
 * of this client and not a guarantee — the room can see the offer, and a
 * client that wanted to draw the buttons for everyone could. What stops the
 * wrong person acting is that the agent is the only one the other two named.
 */
export function EscrowCard({
  card,
  onPost,
}: {
  card: CommandCard;
  /** append the card a decision produces, as every other action does */
  onPost?: (card: CommandCard) => void;
}): ReactNode {
  const copy = content.messages.escrow;
  useSyncExternalStore(subscribeEffects, getEffects, getEffectsServerSnapshot);

  const side = card.escrowId ? escrowById(card.escrowId) : undefined;
  const agent = getMessagePerson(card.agentId ?? "");
  const asset = getCollectibles().find((item) => item.id === card.assetId);
  if (!side || !agent) return null;

  const other = side.pairedWith ? escrowById(side.pairedWith) : undefined;
  const iAmAgent = side.agentId === "me";
  const lapsed = side.status === "open" && side.expiresAt <= new Date().toISOString();
  const status = lapsed ? "expired" : side.status;

  /* Each decision lands in the room as its own card: the agent accepting is
     an event the other two need to see, not a state change in a card they may
     have scrolled past. */
  const post = (next: CommandCard): void => onPost?.(next);

  const caveat =
    status === "accepted"
      ? copy.heldWarning
      : status === "open" || status === "paired"
        ? copy.trustWarning
        : undefined;

  const label: Record<string, string> = {
    open: copy.waiting,
    paired: copy.awaitingAgent,
    accepted: copy.held,
    rejected: copy.rejected,
    released: copy.released,
    expired: copy.expired,
  };

  return (
    <div className="mt-1.5 max-w-[min(100%,24rem)] overflow-hidden rounded-xl border border-border bg-surface-raised text-foreground">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
          {label[status] ?? status}
        </span>
        {status === "open" && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {copy.until} {new Date(side.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        {asset && (
          <div className="flex items-center gap-2.5">
            <CollectibleArt src={asset.imageUrl} className="size-10 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{asset.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                #{asset.serialNumber}
              </span>
            </span>
          </div>
        )}
        {(card.amountSats ?? other?.sats) !== undefined && (
          <p className="text-sm font-semibold">
            {formatSats((card.amountSats ?? other?.sats) as number)}
          </p>
        )}

        <div className="flex items-center gap-1.5 border-t border-border pt-2">
          <span className="text-[11px] text-muted-foreground">{copy.heldBy}</span>
          <MemberAvatar person={agent} size={16} />
          <Handle person={agent} size={10} className="truncate text-[11px] font-medium" />
        </div>

        {/* The part nobody else will say out loud, and only while it is
            still true: a settled escrow saying "nothing has moved" is worse
            than saying nothing. */}
        {caveat && (
          <p className="text-[11px] text-pretty text-muted-foreground">
            {caveat}
          </p>
        )}
      </div>

      {iAmAgent && status === "paired" && (
        <div className="flex gap-1.5 border-t border-border p-2">
          <button
            type="button"
            onClick={() => {
              setEscrowStatus(side.id, "rejected");
              toast.info(copy.rejectedToast);
              post({ ...card, status: "failed", note: copy.rejectedNote });
            }}
            className="focus-ring flex-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            {copy.reject}
          </button>
          <button
            type="button"
            onClick={() => {
              setEscrowStatus(side.id, "accepted");
              toast.success(copy.acceptedToast);
              post({ ...card, status: "held", note: copy.acceptedPost });
            }}
            className="focus-ring flex-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            {copy.accept}
          </button>
        </div>
      )}

      {iAmAgent && status === "accepted" && (
        <button
          type="button"
          onClick={() => {
            setEscrowStatus(side.id, "released");
            const assetSide = side.assetId ? side : other;
            const paySide = side.assetId ? other : side;
            if (assetSide?.assetId && paySide) {
              recordTransfer(assetSide.assetId, paySide.fromId, assetSide.fromId);
            }
            toast.success(copy.releasedToast);
            post({ ...card, status: "released", note: copy.releasedNote });
          }}
          className="focus-ring flex w-full items-center justify-center gap-1.5 border-t border-border bg-foreground/5 px-3 py-2 text-xs font-semibold hover:bg-surface-hover"
        >
          <Check className="size-3.5" aria-hidden="true" />
          {copy.release}
        </button>
      )}

      {!iAmAgent && status === "paired" && (
        <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <X className="size-3 shrink-0" aria-hidden="true" />
          {copy.theirCall}
        </p>
      )}
    </div>
  );
}
