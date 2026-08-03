"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { CollectibleArt } from "@/components/apps/wallet/collectible-art";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getCollectibles,
  getCurrentMessageUser,
  getMessagePerson,
  type CommandCard,
} from "@/lib/data";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

/** WhatsOnChain, where a transaction id becomes something anyone can check. */
const EXPLORER = "https://whatsonchain.com/tx/";

/**
 * The record a `/send` leaves behind.
 *
 * A transfer of a thing is not a transfer of an amount, and a card that showed
 * only a name and a number would be indistinguishable from a payment. The
 * artwork is the point: the reader recognises what moved before they read who
 * it went to, which is the order they actually care about.
 *
 * Both handles are shown rather than only the recipient, because a card that
 * says "sent to Randy" is ambiguous the moment it is forwarded, quoted, or read
 * by somebody who joined the room afterwards.
 */
export function TransferCard({ card }: { card: CommandCard }): ReactNode {
  const copy = content.messages.transfer;
  const { navigateActiveTab } = useHub();
  const asset = getCollectibles().find((item) => item.id === card.assetId);
  const to = getMessagePerson(card.recipientIds?.[0] ?? "");
  const me = getCurrentMessageUser();
  if (!asset || !to) return null;

  return (
    <div className="mt-1.5 max-w-[min(100%,22rem)] overflow-hidden rounded-xl border border-border bg-surface-raised text-foreground">
      <div className="relative">
        <CollectibleArt
          src={asset.imageUrl}
          className="aspect-square w-full object-cover"
        />
        {/* The number, over the art rather than beside it: which one of the
            issue moved is part of what the picture is saying. */}
        <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
          #{asset.serialNumber}
        </span>
      </div>

      <div className="border-t border-border p-3">
        <p className="text-sm font-bold">{asset.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {asset.org ?? copy.asset}
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <MemberAvatar person={me} size={18} />
            <span className="truncate text-[11px] font-medium">{me.name}</span>
          </span>
          <ArrowRight
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="flex min-w-0 items-center gap-1.5">
            <MemberAvatar person={to} size={18} />
            <Handle
              person={to}
              size={11}
              className="max-w-full truncate text-[11px] font-medium"
            />
          </span>
        </div>
      </div>

      {card.txid && (
        <button
          type="button"
          onClick={() => navigateActiveTab(`${EXPLORER}${card.txid}`)}
          className="focus-ring flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          {copy.viewTransaction}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
