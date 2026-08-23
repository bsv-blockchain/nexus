"use client";

/**
 * The one control that explains everything else.
 *
 * Always there, bottom right, beside the demo chip. It is the only thing in the
 * app whose job is to answer "how does this work", so it does not hide behind a
 * menu or wait for a state — it is present from the first frame after the
 * welcome and stays.
 *
 * It pulses until it has been hovered once, then never again. A control nobody
 * has looked at is worth pointing out; a control somebody has already found and
 * ignored is not, and a permanent indicator is a permanent nag.
 *
 * `useHostOverlay` while the menu is open, because the browsed page is a native
 * view above this document and would otherwise paint straight over it.
 */

import {
  PopoverMenu,
  MenuItem,
  MenuSeparator,
} from "@/components/hub/popover-menu";
import { Tooltip } from "@/components/hub/tooltip";
import { Sheet } from "@/components/apps/messages/sheet";
import { useHub } from "@/components/hub/hub-provider";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { content } from "@/lib/data";
import { markHelpSeen, startTour, useTour } from "@/lib/tour-store";
import { requestFeedback } from "@/lib/feedback-request";
import { useHostOverlay } from "@/lib/wallet-data";
import {
  ChevronRight,
  FileText,
  Flag,
  Keyboard,
  LifeBuoy,
  MessageSquare,
  Play,
  Rocket,
  Scale,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const copy = content.help;

export function HelpCircle(): ReactNode {
  const isDesktop = useIsDesktop();
  const { helpSeen } = useTour();
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    right: number;
    bottom: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  useHostOverlay(open);

  /*
   * Nothing floating on a phone.
   *
   * The bottom-right corner belongs to the tab bar and the composer down there,
   * and a third circle over them is the one nobody meant to hit. The same menu
   * is reachable from the browser's own sheet instead, where it sits in a list
   * of rows rather than on top of the page.
   */
  if (!isDesktop) return null;

  return (
    /* Beside the demo chip rather than on top of it. Both are fixed to the same
       corner, so this one owns the corner and the chip is pushed left of it —
       see phase-switcher, which carries the offset. */
    <div className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[70] md:bottom-4">
      <Tooltip label={copy.label} side="top">
        <button
          type="button"
          aria-label={copy.label}
          aria-haspopup="menu"
          aria-expanded={open}
          onPointerEnter={markHelpSeen}
          onFocus={markHelpSeen}
          onClick={(event) => {
            markHelpSeen();
            const box = event.currentTarget.getBoundingClientRect();
            setAnchor({
              top: box.top,
              left: box.left,
              right: box.right,
              bottom: box.bottom,
            });
            setOpen(true);
          }}
          className="focus-ring border-border bg-surface-raised text-muted-foreground hover:text-foreground relative grid size-10 place-items-center rounded-full border shadow-lg transition-colors"
        >
          <span className="text-base font-semibold">?</span>
          {/* The pulse, until it has been looked at once. `pointer-events-none`
              so the ring never eats the click it is advertising. */}
          {!helpSeen && (
            <span
              aria-hidden="true"
              className="bg-accent/40 pointer-events-none absolute inset-0 animate-ping rounded-full"
            />
          )}
        </button>
      </Tooltip>

      <PopoverMenu
        open={open}
        onClose={() => setOpen(false)}
        label={copy.label}
        /* Stated, so the edge clamp and the rendered menu agree. Left to the
           default it clamped against a nominal 288 while rendering at 225, and
           the menu sat 63px adrift of the button it belongs to. */
        width={260}
        {...(anchor ? { anchor } : {})}
      >
        <HelpItems onDone={() => setOpen(false)} />
      </PopoverMenu>
    </div>
  );
}

/**
 * The menu itself, without the thing that opens it.
 *
 * Shared by the desktop popover and the phone's sheet, because they are the
 * same list of destinations and two copies would drift the moment one gained an
 * entry. `MenuItem` renders as a row either way, so nothing had to be
 * duplicated to make it work in a sheet.
 */
export function HelpItems({
  onDone,
  variant = "menu",
}: {
  onDone: () => void;
  /** "rows" matches the chunky button rows the mobile browser sheet uses */
  variant?: "menu" | "rows";
}): ReactNode {
  const hub = useHub();
  const go =
    (run: () => void): (() => void) =>
    () => {
      onDone();
      run();
    };

  /* One list, two dressings. The destinations are identical, so they are
     written once and the shape is chosen here rather than in a second copy of
     the list that would drift the moment either gained an entry. */
  const Item = variant === "rows" ? SheetRow : MenuItem;
  const Rule = variant === "rows" ? Spacer : MenuSeparator;

  return (
    <>
      <Item
        icon={Rocket}
        label={copy.restartTour}
        onClick={go(() => startTour())}
      />
      <Rule />
      <Item
        icon={LifeBuoy}
        label={copy.helpCentre}
        onClick={go(() =>
          hub.openLinkInBrowser(hub.activeSpaceId, copy.helpCentreUrl)
        )}
      />
      <Item
        icon={MessageSquare}
        label={copy.community}
        onClick={go(() =>
          hub.openLinkInBrowser(hub.activeSpaceId, copy.communityUrl)
        )}
      />
      <Item
        icon={Play}
        label={copy.videos}
        onClick={go(() =>
          hub.openLinkInBrowser(hub.activeSpaceId, copy.videosUrl)
        )}
      />
      <Item
        icon={FileText}
        label={copy.releaseNotes}
        /* Straight to About, where the notes already live. */
        onClick={go(() => {
          hub.setMainView("settings");
          hub.setSettingsCategory("about");
        })}
      />
      <Item
        icon={Scale}
        label={copy.legal}
        /* Terms and privacy, which is what somebody asking for "legal" wants.
           It used to open the software licence, which is a different document
           about a different question and is one tap further in from here. */
        onClick={go(() => hub.openDetailPane({ kind: "legal", id: "" }))}
      />
      <Rule />
      <Item
        icon={Sparkles}
        label={copy.feedback}
        onClick={go(() => {
          requestFeedback();
          hub.openApp("roadmap");
        })}
      />
      <Item
        icon={Flag}
        label={copy.abuse}
        /* Same destination as feedback, as specified. The sheet is where an
           abuse report gets written; the difference is what somebody types
           into it, not which form they are handed. */
        onClick={go(() => {
          requestFeedback();
          hub.openApp("roadmap");
        })}
      />
      <Rule />
      {/* No "Guided setup" row: "Restart Guided Tour" at the top of this menu
          is the same destination said better, and a menu that offers one thing
          twice teaches that the two are different. */}
      <Item
        icon={Keyboard}
        label={copy.shortcuts}
        shortcut={copy.shortcutsKeys}
        onClick={go(() => {
          hub.setMainView("settings");
          hub.setSettingsCategory("shortcuts");
        })}
      />
    </>
  );
}

/**
 * The same menu on a phone, as a sheet.
 *
 * Reached from the browser's own details sheet rather than from a floating
 * circle, because the bottom-right corner of a phone already belongs to the tab
 * bar and the composer. Same items, same destinations.
 */
export function HelpSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  useHostOverlay(open);
  return (
    <Sheet open={open} onClose={onClose} label={copy.label} full>
      <div className="space-y-2 p-4">
        <HelpItems onDone={onClose} variant="rows" />
      </div>
    </Sheet>
  );
}

/** A destination as the mobile browser sheet draws them. */
function SheetRow({
  icon: Icon,
  label,
  shortcut,
  onClick,
}: {
  icon?: LucideIcon;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring bg-surface ring-border flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ring-1"
    >
      {Icon && (
        <Icon className="text-muted-foreground size-5" aria-hidden="true" />
      )}
      <span className="flex-1 text-left">{label}</span>
      {shortcut ? (
        <span className="text-muted-foreground text-xs">{shortcut}</span>
      ) : (
        <ChevronRight
          className="text-muted-foreground size-4"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/** What a separator is between stacked rows: a gap, not a line. */
function Spacer(): ReactNode {
  return <span aria-hidden="true" className="block h-1" />;
}
