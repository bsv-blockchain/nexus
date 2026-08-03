"use client";

import { Dialog } from "@/components/hub/dialog";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { Check, Copy, Gift } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

/** "Share Nexus with a friend" referral modal opened from the rail gift button. */
export function ShareModal(): ReactNode {
  const { shareOpen, setShareOpen } = useHub();
  if (!shareOpen) return null;
  return <ShareModalContent onClose={() => setShareOpen(false)} />;
}

function ShareModalContent({ onClose }: { onClose: () => void }): ReactNode {
  const copy = content.share;
  const { shareCode: code } = useHub();
  const [gift, setGift] = useState(true);
  const [copied, setCopied] = useState(false);

  const link = gift
    ? `https://nexus.xyz/gift/${code}`
    : `https://nexus.xyz/i/${code}`;
  const headline = gift ? copy.giftHeadline : copy.plainHeadline;
  const subhead = gift ? copy.giftSubhead : copy.plainSubhead;
  const message = gift ? copy.giftMessage : copy.plainMessage;

  const onCopy = (): void => {
    const text = `${message}\n\n${link}`;
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      // clipboard unavailable — button still gives feedback
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open onClose={onClose} label="Share Nexus" className="max-w-sm">
      <div className="px-7 pt-10 pb-7 text-center">
        <Image
          src="/icons/nexus.png"
          alt=""
          aria-hidden="true"
          width={64}
          height={64}
          className="mx-auto rounded-[22%]"
        />
        <h2 className="mt-5 text-3xl leading-[1.05] font-extrabold tracking-tight whitespace-pre-line">
          {headline}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">{subhead}</p>

        {/* Receipt-style card */}
        <div className="mt-6 overflow-hidden rounded-xl bg-surface">
          <div className="p-4 text-center">
            <p className="text-sm leading-relaxed text-balance">{message}</p>
            <p className="mt-3 font-mono text-sm break-all text-accent">
              {link}
            </p>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="focus-ring flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            {copied ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                {copy.copied}
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" />
                {copy.copy}
              </>
            )}
          </button>
        </div>

        {/* Gift toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={gift}
          onClick={() => setGift((on) => !on)}
          className="focus-ring mt-4 flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left"
        >
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
              gift ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
            }`}
            aria-hidden="true"
          >
            <Gift className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-balance">
            {copy.toggleLabel}
          </span>
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              gift ? "bg-accent" : "bg-muted-foreground/40"
            }`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
                gift ? "left-4.5" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </div>
    </Dialog>
  );
}
