"use client";

import type { ReactNode } from "react";

/**
 * Split a host into the part worth eliding and the part that must never be.
 *
 * "Last two labels" is not a public suffix list, and it gets `a.b.co.uk` wrong —
 * it calls `co.uk` the tail. That is deliberately survivable: this split decides
 * only which characters are EMPHASISED, never which are shown. Being wrong costs
 * emphasis; it cannot hide a character. A real PSL would need a dependency, and
 * there are none in this build.
 *
 * A port and a bracketed IPv6 literal are the whole tail. Neither has subdomain
 * labels in front of it, and the port is part of which endpoint this is.
 */
function splitHost(host: string): { prefix: string; tail: string } {
  if (host.startsWith("[")) return { prefix: "", tail: host };
  const bare = host.replace(/:\d+$/, "");
  const labels = bare.split(".");
  if (labels.length <= 2) return { prefix: "", tail: host };
  const cut = bare.length - labels.slice(-2).join(".").length;
  return { prefix: host.slice(0, cut), tail: host.slice(cut) };
}

/**
 * A host, written so that the part identifying the site cannot be the part that
 * gets cut off.
 *
 * This replaces `truncate`, which was actively dangerous here. `text-overflow`
 * clips the TAIL, and the tail of a hostname is the registrable domain, so on a
 * narrow viewport
 * `paypal.com.secure-login.verify-account.example.io` came out as
 * `paypal.com.secure-login.verify-acc…` — attacker-chosen padding kept, the real
 * domain hidden, on the two surfaces whose entire job is saying which site this
 * is.
 *
 * So nothing is elided at all: the host wraps. `break-all` lets a long label
 * break mid-word and the row grows, which the browse pane already accounts for —
 * its ResizeObserver watches the chip's row and re-pushes the native tab bounds,
 * and the chip is a row ABOVE that rect rather than an overlay on it.
 *
 * Emphasis does the reading work instead of truncation: the last two labels at
 * full strength, everything in front of them muted, so the eye lands on the end
 * of the host rather than the beginning.
 *
 * One component rather than two copies, used by the origin chip and by the
 * spend-authorization dialog. Those two must agree about what a page is called,
 * and sharing the string was not enough — they have to agree about which half of
 * it a person actually reads.
 */
export function OriginLabel({
  origin,
  className = "",
}: {
  origin: string;
  className?: string;
}): ReactNode {
  const { prefix, tail } = splitHost(origin);
  return (
    <span className={`min-w-0 font-mono break-all ${className}`}>
      {prefix ? <span className="text-muted-foreground">{prefix}</span> : null}
      {/* Both tones are explicit, because this renders inside a muted <p> in one
          caller and full-strength chrome in the other. */}
      <span className="text-foreground font-semibold">{tail}</span>
    </span>
  );
}
