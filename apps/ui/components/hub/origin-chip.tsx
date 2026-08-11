"use client";

import { OriginLabel } from "@/components/hub/origin-label";
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
 * Strip the userinfo before showing a URL to a person.
 *
 * `https://paypal.com@evil.com/` reaches this component, and the detail view
 * whose whole job is exposing look-alikes would otherwise open with
 * `paypal.com@`. Browsers drop userinfo from display for exactly this reason.
 * Both halves have to be cleared: clearing the username alone leaves `:pass@`.
 *
 * The chip's own label was never affected — `displayOrigin` reads `URL.host`,
 * which is `evil.com` here — but the popover printed the raw string.
 */
function withoutUserinfo(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Who you are actually talking to.
 *
 * A site opened from the rail renders without an address bar, so this is the
 * only thing on screen naming the origin. It is handed the active tab's `url`
 * and derives from that on every render — never from `PinnedSite.url`.
 *
 * WHAT THIS DOES NOT YET DO. It follows the hub's tab RECORD, and that record
 * does not yet follow the page. Nothing in `apps/ui` subscribes to the shell's
 * navigation event, so an in-page redirect — the phishing case this component
 * exists for — changes the native webview without changing the url here, and the
 * chip keeps showing where the tab was opened. Only user-driven navigation
 * (`navigateActiveTab`, Back/Forward via `stepHistory`) reaches it today. Closing
 * that gap means listening to `tab.nav`, which the desktop shell already emits on
 * `did-navigate` at `apps/desktop/src/tabManager.mjs:72` and which no chrome code
 * consumes; note that writing the url back into the hub also requires
 * `NativeSiteFrame` to stop being keyed by `tab.url`, or every navigation
 * destroys and recreates the webview that just navigated.
 *
 * It does not protect a payment path either, because there is not one yet:
 * `window.nexus` is not bound to browsed tabs, and both shells still answer
 * `getPublicKey` with a spike constant and throw on `createAction`.
 *
 * So this is the surface and the constraint, not a working defence. What IS
 * already true is that the string comes from the same `displayOrigin`, and is
 * drawn by the same `OriginLabel`, as the spend-authorization dialog: if those
 * two can disagree about what a page is called, one of them is lying.
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
        /* items-start, not items-center: a long host wraps rather than being
           truncated, and the padlock belongs against the first line. */
        className="focus-ring bg-surface-raised/90 ring-border flex max-w-full min-w-0 items-start gap-1.5 rounded-2xl px-3 py-1.5 text-left text-xs font-medium shadow-sm ring-1 backdrop-blur"
      >
        {secure ? (
          <Lock
            className="text-positive mt-0.5 size-3 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <ShieldAlert
            className="text-negative mt-0.5 size-3 shrink-0"
            aria-hidden="true"
          />
        )}
        <OriginLabel origin={origin} />
      </button>

      <PopoverMenu
        open={open}
        onClose={() => setOpen(false)}
        label={`Site information for ${origin}`}
        className="top-full left-3 mt-1 max-w-[min(20rem,calc(100%-1.5rem))]"
      >
        {/* The whole URL, not only the origin the chip has room for: the path is
            where a look-alike tends to give itself away. Minus the userinfo,
            which is where one tries to look like somebody else. */}
        <p className="text-muted-foreground px-2.5 pt-1.5 pb-2 text-xs break-all">
          {withoutUserinfo(url)}
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
