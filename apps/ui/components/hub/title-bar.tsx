"use client";

/**
 * The window's own strip, above everything.
 *
 * Only in the desktop shell: a browser tab has a title bar already, and drawing
 * a second one inside the page would be a picture of a window rather than a
 * window.
 *
 * The whole strip is a drag region, so every interactive child has to opt out
 * with `no-drag` or it silently stops responding — no error, no warning, just a
 * button that does nothing. That is easy to forget once and impossible to
 * debug, so the opt-out lives in `Control` below and nothing here sets it by
 * hand.
 *
 * Left and right padding come from CSS variables rather than fixed numbers: on
 * Windows the Window Controls Overlay reports its real geometry through
 * `env(titlebar-area-*)`, and on macOS the traffic lights need a reservation
 * that disappears in fullscreen. See globals.css.
 *
 * @see lib/desktop-window.ts — the bridge this reads
 */

import { useHub } from "@/components/hub/hub-provider";
import { SpaceIcon } from "@/components/hub/space-icon";
import { Tooltip } from "@/components/hub/tooltip";
import { content } from "@/lib/data";
import { useDesktopWindow } from "@/lib/desktop-window";
import { installUpdate, useUpdateState } from "@/lib/update-data";
import { requestNewWorkspace } from "@/lib/workspace-request";
import { House, Minus, Plus, Square, X } from "lucide-react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

const copy = content.titleBar;

/**
 * `-webkit-app-region`, which React's CSSProperties has never carried.
 *
 * Written once here rather than cast at each of the half-dozen call sites,
 * because a cast repeated is a cast nobody reads.
 */
const DRAG = { WebkitAppRegion: "drag" } as CSSProperties;
const NO_DRAG = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function TitleBar(): ReactNode {
  const { platform, ownsControls, maximized, run } = useDesktopWindow();
  const {
    spaces,
    activeSpaceId,
    setActiveSpaceId,
    setMainView,
    openProfilesManager,
  } = useHub();
  const update = useUpdateState();

  /* Nothing at all outside the shell, including during the server render. */
  if (!platform) return null;

  return (
    <header
      /* `drag` on the strip, `no-drag` on each control. Doing it the other way
         round — dragging only on the gaps — leaves a window you can only move
         by finding a few pixels of nothing. */
      style={DRAG}
      className="bg-surface border-border/60 flex h-[var(--titlebar-height)] shrink-0 items-stretch border-b pr-[var(--titlebar-inset-right)] pl-[var(--titlebar-inset-left)] select-none"
    >
      {/* Only when there is genuinely one waiting. A permanent "Update now" is
          a button that means nothing on the day it matters. */}
      {update?.ready && (
        <>
          <div className="flex items-center pr-2 pl-1">
            {/* The pill is a child rather than the button itself: `Control`
                carries the strip's muted text colour, and two `text-*`
                utilities on one element is a coin toss over which one the
                stylesheet emits last. */}
            <Control
              onClick={() => void installUpdate()}
              className="rounded-md"
            >
              <span className="bg-accent text-accent-foreground block rounded-md px-3 py-1 text-xs font-semibold">
                {copy.updateNow}
              </span>
            </Control>
          </div>
          <Divider />
        </>
      )}

      <Tooltip label={copy.home} side="bottom">
        <Control
          /* Home is the Timeline of whichever workspace is current — the one
             place in the app that is about everything rather than about one
             app. It does not change workspace on the way. */
          onClick={() => setMainView("timeline")}
          aria-label={copy.home}
          className="hover:bg-surface-hover px-4"
        >
          <House className="size-4" aria-hidden="true" />
        </Control>
      </Tooltip>
      <Divider />

      {/* The workspaces. Scrolls rather than shrinks: a strip of twenty
          unreadable slivers is worse than a strip you can push. */}
      <div className="scrollbar-none flex min-w-0 items-stretch overflow-x-auto">
        {spaces.map((space) => {
          const active = space.id === activeSpaceId;
          return (
            <div key={space.id} className="flex items-stretch">
              <Control
                onClick={() => setActiveSpaceId(space.id)}
                aria-current={active ? "page" : undefined}
                className={`flex max-w-48 min-w-0 items-center gap-2 px-3 text-xs font-medium transition-colors ${
                  active
                    ? "bg-surface-raised text-foreground"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <SpaceIcon value={space.emoji} size={14} />
                <span className="truncate">{space.name}</span>
              </Control>
              <Divider />
            </div>
          );
        })}
      </div>

      <Tooltip label={copy.newWorkspace} side="bottom">
        <Control
          onClick={() => {
            /* Opens the Workspaces view and asks it to bring its own "+" into
               sight. The scrolling is the view's job, not this bar's: only it
               knows where that circle ended up. */
            openProfilesManager();
            requestNewWorkspace();
          }}
          aria-label={copy.newWorkspace}
          className="hover:bg-surface-hover px-4"
        >
          <Plus className="size-4" aria-hidden="true" />
        </Control>
      </Tooltip>
      <Divider />

      {/* Everything past the last control is somewhere to grab the window.
          Deliberately the widest thing in the strip. */}
      <span aria-hidden="true" className="flex-1" />

      {ownsControls && (
        <div className="flex items-stretch">
          <Control
            onClick={() => run("minimize")}
            aria-label={copy.minimize}
            className="hover:bg-surface-hover px-4"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </Control>
          <Control
            onClick={() => run("toggle-maximize")}
            aria-label={maximized ? copy.restore : copy.maximize}
            className="hover:bg-surface-hover px-4"
          >
            <Square className="size-3" aria-hidden="true" />
          </Control>
          <Control
            onClick={() => run("close")}
            aria-label={copy.close}
            className="hover:bg-negative px-4 hover:text-white"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Control>
        </div>
      )}
    </header>
  );
}

/** The hairline between one group of controls and the next. */
function Divider(): ReactNode {
  return <span aria-hidden="true" className="bg-border/60 w-px shrink-0" />;
}

/**
 * Anything clickable in the strip.
 *
 * Exists so `no-drag` cannot be forgotten. A drag region swallows pointer
 * events from its children, so a plain `<button>` in here is a button that does
 * nothing at all and says nothing about why.
 */
function Control({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return (
    <button
      type="button"
      style={NO_DRAG}
      className={`focus-ring text-muted-foreground hover:text-foreground shrink-0 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
