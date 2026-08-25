"use client";

/**
 * Get paid, in anything the wallet supports.
 *
 * Two shapes, because there are two kinds of answer. Paid in BSV or in a token
 * issued on it, and the answer is your handle — a name a person can read back
 * to you, which is the whole argument for handles. Paid in ether, and the
 * answer is an Ethereum address, because that is what an Ethereum sender needs
 * and no handle will do.
 *
 * Both are yours. This wallet holds a key on every chain it supports, the way
 * Exodus does, so getting paid in SOL does not route through anybody and does
 * not require a swap. The swap is the optional part, offered underneath: leave
 * it and you hold what you were sent, tick it and it lands as BSV.
 *
 * @see lib/chain-address.ts for where the addresses come from
 */

import { CoinPicker } from "@/components/apps/wallet/coin-picker";
import { Sheet } from "@/components/apps/messages/sheet";
import { useWalletAccount } from "@/components/apps/wallet/use-wallet-account";
import { formatUnits } from "@/components/apps/wallet/token-mark";
import { getCurrentMessageUser, content } from "@/lib/data";
import { handleOf } from "@/lib/messages";
import { chainMemo, memoLabelFor } from "@/lib/chain-address";
import {
  BSV_NETWORK,
  ownAddress,
  quote,
  SWAP_FEE,
  useSwapCoins,
  type SwapCoin,
} from "@/lib/swap";
import { Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

/**
 * A stand-in for a QR: a deterministic block grid, not a real code.
 *
 * Seeded on whatever it stands for, so switching asset visibly changes the
 * pattern. A fixed drawing under a changing address would be the one element on
 * the screen quietly insisting nothing had happened.
 */
function CodeBlock({ value, label }: { value: string; label: string }): ReactNode {
  return (
    <div className="flex justify-center py-2">
      <div
        className="bg-surface grid size-40 grid-cols-11 gap-px rounded-xl p-2"
        role="img"
        aria-label={label}
      >
        {Array.from({ length: 121 }, (_, i) => {
          const on =
            (i * 7 + (i % 11) * 3 + value.charCodeAt(i % value.length)) % 3 < 1;
          return (
            <span key={i} className={on ? "bg-foreground" : "bg-transparent"} />
          );
        })}
      </div>
    </div>
  );
}

/** A value somebody has to hand to a payer, with the button that copies it. */
function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
}): ReactNode {
  const copy = content.wallet;
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <div className="border-border flex items-center gap-2 rounded-xl border px-3 py-2.5">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            toast.success(copy.copied);
          }}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded p-1"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
      </div>
      {hint && (
        <p className="text-muted-foreground mt-1.5 text-xs text-pretty">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Land it as BSV instead of holding what you were sent.
 *
 * Off by default, because the honest default is that you get what somebody
 * chose to send you. Ticking it is a decision to convert, and a decision to
 * convert has a price, so the rate is on the control rather than a screen
 * later. Absent where nothing can price the pair — an unpriced estimate beside
 * a checkbox reads as a quote, and it would not be one.
 */
function SwapIntoBsv({
  coin,
  bsv,
  on,
  onChange,
}: {
  coin: SwapCoin;
  bsv: SwapCoin | undefined;
  on: boolean;
  onChange: (next: boolean) => void;
}): ReactNode {
  const priced = bsv ? quote(coin, bsv, 1) : null;
  /* The box is centred against the pair of lines rather than aligned to the
     first. It belongs to the whole control — the label and the rate under it
     are one statement — and sitting it on the top line made it look like it
     governed the title and not the price. */
  return (
    <label className="border-border hover:bg-surface-hover flex cursor-pointer items-center gap-3 rounded-xl border p-3">
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-accent size-4 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Swap into BSV</span>
        <span className="text-muted-foreground block text-xs text-pretty">
          {priced && bsv ? (
            <>
              1 {coin.symbol} = {formatUnits(priced.rate, bsv.decimals)} BSV
              {priced.fee > 0 && (
                <> · rate includes a {(priced.fee * 100).toFixed(2)}% fee</>
              )}
            </>
          ) : (
            <>Converted at the rate when it lands.</>
          )}
        </span>
      </span>
    </label>
  );
}

export function ReceiveSheet({
  open,
  tokenId,
  onClose,
}: {
  open: boolean;
  tokenId: string;
  onClose: () => void;
}): ReactNode {
  const copy = content.wallet;
  const account = useWalletAccount();
  const coins = useSwapCoins(account?.id);
  const [assetId, setAssetId] = useState(tokenId);
  const [swapIn, setSwapIn] = useState(false);
  const myHandle = handleOf(getCurrentMessageUser());

  /* Follows the asset the caller opened on — Get paid from a token's own page
     should land on that token, and the sheet outlives the intent that set it. */
  const [wasToken, setWasToken] = useState(tokenId);
  if (wasToken !== tokenId) {
    setWasToken(tokenId);
    setAssetId(tokenId);
    setSwapIn(false);
  }

  const coin = coins.find((entry) => entry.id === assetId) ?? coins[0];
  const bsv = coins.find((entry) => entry.id === "bsv");
  if (!coin) return null;

  /*
   * The handle for anything on BSV, an address for anything that is not.
   *
   * A handle resolves to this wallet's BSV key, so it is the right answer for
   * every asset the chain carries and the wrong one for all the others — an
   * Ethereum sender has nowhere to type it.
   */
  const onChain = coin.network === BSV_NETWORK;
  const seed = account?.identifier ?? "";
  const address = onChain ? myHandle : ownAddress(seed, coin.network);
  const memoLabel = onChain ? null : memoLabelFor(coin.network);

  return (
    <Sheet open={open} onClose={onClose} label={copy.receive}>
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold">{copy.receive}</h2>

        <CoinPicker
          coins={coins}
          selected={coin.id}
          onSelect={(next) => {
            setAssetId(next);
            /* Cleared on every change. A tick carried over from the last asset
               is a conversion nobody asked for on a coin they just chose. */
            setSwapIn(false);
          }}
          label={copy.asset}
        />

        <CodeBlock value={address} label={copy.qrLabel} />

        <Field
          label={onChain ? copy.yourHandle : `${coin.symbol} address`}
          value={address}
          hint={
            onChain ? (
              coin.native && coin.id === "bsv" ? (
                copy.receiveHintBsv
              ) : (
                copy.receiveHintToken
              )
            ) : (
              <span className="text-negative flex items-start gap-1.5">
                <TriangleAlert
                  className="mt-px size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {coin.symbol} on {coin.networkLabel} only. The same ticker on
                  another network goes to an address nobody holds the key to.
                </span>
              </span>
            )
          }
        />

        {memoLabel && (
          <Field
            label={memoLabel}
            value={chainMemo(seed, coin.network)}
            hint={`Without the ${memoLabel.toLowerCase()} the payment arrives somewhere real and is not credited to you.`}
          />
        )}

        {/* Only where there is something to convert. Offering to swap BSV into
            BSV is offering to do nothing, slowly. */}
        {coin.id !== "bsv" && (
          <SwapIntoBsv
            coin={coin}
            bsv={bsv}
            on={swapIn}
            onChange={setSwapIn}
          />
        )}
      </div>
    </Sheet>
  );
}

/** What the fee is, for anyone quoting it outside a swap. */
export const RECEIVE_SWAP_FEE = SWAP_FEE;
