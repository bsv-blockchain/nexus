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
 * NEVER an overlay on the page. Inside a shell the page is a native view that
 * paints above this entire document (see NativeSiteFrame here, and tabManager's
 * "always paints above" note in the desktop app), so anything drawn over the
 * page rect is not dimmed — it is gone. The two placements below are the two
 * ways of not being over the page. The popover DOES overlap it, so it asks the
 * shell to lower the tab layer for as long as it is open.
 *
 * ── THE TWO PLACEMENTS ──
 *
 * `canvas` — a row above the page, and WIDE LAYOUTS ONLY. It costs vertical
 * space, which a desktop pane has and a phone does not.
 *
 * `bar` — the middle cell of the mobile bottom bar, between the rail button and
 * page-options. Nothing is spent: that cell is `aria-hidden` filler for a site
 * (the address pill and tab stack are what a site drops), so the host moves into
 * space the bar was already holding open. Which is why the row above the page is
 * gone on narrow — it was the third of an inch of page the screenshot was
 * complaining about.
 *
 * Both placements are the same component on purpose. This is the only element
 * naming the origin of an app-like site, and two copies of it would be two
 * chances for them to disagree about what a page is called.
 */
export function OriginChip({
  url,
  placement = "canvas",
  onOpenInBrowser,
  onRemove,
}: {
  url: string;
  placement?: "canvas" | "bar";
  onOpenInBrowser: () => void;
  onRemove: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const origin = displayOrigin(url);
  // The scheme of THIS page, not of the origin it was pinned at: a downgrade to
  // http is exactly the thing worth showing.
  const secure = /^https:\/\//i.test(url);
  const inBar = placement === "bar";

  useHostOverlay(open);

  return (
    <div
      className={
        inBar
          ? // pointer-events-auto because the bar itself is pointer-events-none and
            // hands events only to its controls; without it the chip and its whole
            // popover are inert. min-w-0 so a long host wraps inside the cell
            // instead of widening the grid and pushing the buttons either side of
            // it out from under the thumb that already knows where they are.
            "pointer-events-auto relative flex min-w-0 justify-center"
          : "relative z-30 hidden shrink-0 items-center px-3 pt-2.5 pb-2 md:flex"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Site information for ${origin}`}
        /* items-start, not items-center: a long host wraps rather than being
           truncated, and the padlock belongs against the first line. In the bar
           that wrapping grows the bar, which the browse pane already measures —
           see BottomBar's data-nexus-browse-bar. Growing is the correct outcome:
           OriginLabel refuses to elide a hostname, because the end of a host is
           the part an attacker wants hidden. */
        className={
          inBar
            ? "focus-ring bg-surface-raised/95 ring-border flex max-w-full min-w-0 items-start gap-1.5 rounded-full px-3.5 py-2.5 text-left text-xs font-medium shadow-lg ring-1 backdrop-blur transition-transform active:scale-95"
            : "focus-ring bg-surface-raised/90 ring-border flex max-w-full min-w-0 items-start gap-1.5 rounded-2xl px-3 py-1.5 text-left text-xs font-medium shadow-sm ring-1 backdrop-blur"
        }
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
        /* In the bar it opens UPWARD: the trigger is a thumb's width off the
           bottom of the screen, and a menu below it would be off-screen. Centred
           on the cell, and clamped to the viewport rather than to the cell —
           the cell is a third of a phone and the menu needs more than that. */
        className={
          inBar
            ? "bottom-full left-1/2 mb-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2"
            : "top-full left-3 mt-1 max-w-[min(20rem,calc(100%-1.5rem))]"
        }
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
