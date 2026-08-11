"use client";

import {
  MenuItem,
  MenuSeparator,
  PopoverMenu,
} from "@/components/hub/popover-menu";
import { displayOrigin } from "@/lib/rail/origin";
import { useHostOverlay } from "@/lib/wallet-data";
import { ExternalLink, Lock, ShieldAlert, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Who you are actually talking to.
 *
 * A site opened from the rail renders without an address bar, so this is the
 * only thing on screen naming the origin. The `url` it is handed is the LIVE
 * tab's, re-read on every navigation — never `PinnedSite.url`. A site that
 * redirects somewhere else has to show where it went; that is the whole reason
 * this exists.
 *
 * It does not currently protect a payment path, because there is not one yet:
 * `window.nexus` is not bound to browsed tabs, and both shells still answer
 * `getPublicKey` with a spike constant and throw on `createAction`. This is the
 * constraint that has to already hold when that lands — which is why the string
 * comes from the same `displayOrigin` the spend-authorization dialog uses. If
 * the two can disagree, one of them is lying.
 *
 * A ROW, not a floating overlay. Inside a shell the page is a native view that
 * paints above this entire document (see NativeSiteFrame here, and tabManager's
 * "always paints above" note in the desktop app), so anything drawn over the
 * page rect is not dimmed — it is gone. Taking height out of the layout is what
 * keeps this on screen. The popover does overlap the page, so it asks the shell
 * to lower the tab layer for as long as it is open.
 */
export function OriginChip({
  url,
  onOpenInBrowser,
  onRemove,
}: {
  url: string;
  onOpenInBrowser: () => void;
  onRemove: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const origin = displayOrigin(url);
  // The scheme of THIS page, not of the origin it was pinned at: a downgrade to
  // http is exactly the thing worth showing.
  const secure = /^https:\/\//i.test(url);

  useHostOverlay(open);

  return (
    <div
      // Measured by NativeSiteFrame, so the native tab rect starts below this
      // row instead of on top of it.
      data-nexus-origin-chip=""
      className="relative z-30 flex shrink-0 items-center px-3 pt-2.5 pb-2"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Site information for ${origin}`}
        className="focus-ring bg-surface-raised/90 ring-border flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ring-1 backdrop-blur"
      >
        {secure ? (
          <Lock className="text-positive size-3 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldAlert
            className="text-negative size-3 shrink-0"
            aria-hidden="true"
          />
        )}
        <span className="truncate font-mono">{origin}</span>
      </button>

      <PopoverMenu
        open={open}
        onClose={() => setOpen(false)}
        label={`Site information for ${origin}`}
        className="top-full left-3 mt-1 max-w-[min(20rem,calc(100%-1.5rem))]"
      >
        {/* The whole URL, not only the origin the chip has room for: the path is
            where a look-alike tends to give itself away. */}
        <p className="text-muted-foreground px-2.5 pt-1.5 pb-2 text-xs break-all">
          {url}
        </p>
        <MenuSeparator />
        <MenuItem
          icon={ExternalLink}
          label="Open in Browser"
          onClick={() => {
            setOpen(false);
            onOpenInBrowser();
          }}
        />
        <MenuItem
          icon={Trash2}
          label="Remove from rail"
          destructive
          onClick={() => {
            setOpen(false);
            onRemove();
          }}
        />
      </PopoverMenu>
    </div>
  );
}
