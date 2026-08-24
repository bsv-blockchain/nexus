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
import { useCustomTheme } from "@/components/hub/theme-provider";
import { homeView } from "@/lib/home-view";
import { activeHandleFor, useSettings } from "@/lib/settings-store";
import { activeWalletFor, labelOf, useWallets } from "@/lib/wallets-store";
import { SpaceIcon } from "@/components/hub/space-icon";
import { Tooltip } from "@/components/hub/tooltip";
import { content } from "@/lib/data";
import { useDesktopWindow } from "@/lib/desktop-window";
import { installUpdate, useUpdateState } from "@/lib/update-data";
import { requestNewWorkspace } from "@/lib/workspace-request";
import { useReducedMotion } from "@/lib/motion";
import { themeGradient } from "@/lib/theme";
import { House, Minus, Plus, Square, X } from "lucide-react";
import { motion } from "motion/react";
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

/** The default stops, for a workspace that has never been given a theme. */
const DEFAULT_STOPS = ["#4353ff", "#5b6aff"];

/**
 * A workspace's own colours, along the bottom of its tab.
 *
 * On the tabs you are NOT in, which is the opposite of where a selected marker
 * usually goes and is the point: the active tab is already told apart by its
 * raised surface, and it does not need saying twice. What the strip could not
 * say was which of the OTHER tabs was which — six workspaces reading as six
 * greys, distinguishable only by a name that truncates at 48px. The colour is
 * the same one the workspace paints its whole chrome in, so the strip becomes a
 * legend for the thing you are about to switch to.
 *
 * The animation runs the way the eye expects a thing to leave: activating a tab
 * drops its mark out through the bottom edge, and the tab you just left grows
 * one up from that same edge. Two marks are in flight at once and they move in
 * opposite directions, which is what makes the swap legible rather than a pair
 * of unrelated fades.
 */
function ThemeUnderline({
  spaceId,
  active,
}: {
  spaceId: string;
  active: boolean;
}): ReactNode {
  const { profileTheme } = useCustomTheme();
  const reduced = useReducedMotion();
  const stops = profileTheme(spaceId) ?? DEFAULT_STOPS;
  return (
    <motion.span
      aria-hidden="true"
      /* `scaleY` from the bottom edge rather than a height or a y-offset: a
         transform is composited, and this sits in a strip that is being dragged
         around the screen. */
      initial={false}
      animate={{ scaleY: active ? 0 : 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        /* Horizontal, so a two- or three-stop theme reads as its own spread of
           colour rather than as whichever stop happened to be first. A solid
           theme renders one colour, which `themeGradient` already handles. */
        backgroundImage: themeGradient(stops).replace("140deg", "90deg"),
        transformOrigin: "bottom",
      }}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
    />
  );
}

export function TitleBar(): ReactNode {
  const { platform, ownsControls, maximized, run } = useDesktopWindow();
  const {
    spaces,
    activeSpaceId,
    setActiveSpaceId,
    setMainView,
    openProfilesManager,
    isInstalled,
    installedFor,
  } = useHub();
  const update = useUpdateState();
  const settings = useSettings();
  /* Subscribed so a wallet switched in another view repaints the strip. */
  useWallets();
  /* Home is a question, not a destination — see lib/home-view. */
  const home = homeView(
    settings.homescreen,
    !settings.timelineAsApp || isInstalled("timeline"),
  );

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
          onClick={() => setMainView(home)}
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
          /* What is over there, for a tab you are not on. Read per workspace
             rather than for the active one — that was the bug this shape of
             code caused everywhere else in the app. */
          const handle = activeHandleFor(space.id);
          const wallet = activeWalletFor(space.id);
          const apps = installedFor(space.id).length;
          const tab = (
            <Control
              onClick={() => setActiveSpaceId(space.id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-full max-w-48 min-w-0 items-center gap-2 px-3 text-xs font-medium transition-colors ${
                active
                  ? "bg-surface-raised text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              <SpaceIcon value={space.emoji} size={14} />
              <span className="truncate">{space.name}</span>
              <ThemeUnderline spaceId={space.id} active={active} />
            </Control>
          );
          return (
            <div key={space.id} className="flex items-stretch">
              {/* Only the one you are on. A name that is cut off at 48px is a
                  name worth spelling out, but on the others the tab is a place
                  to go and a tooltip would be repeating the label it covers —
                  here it answers the different question the raised surface
                  raises, which is why this tab is not like the rest. */}
              {active ? (
                <Tooltip
                  label={copy.youAreIn.replace("{name}", space.name)}
                  side="bottom"
                  className="min-w-0"
                >
                  {tab}
                </Tooltip>
              ) : (
                <Tooltip
                  label={
                    <span className="block space-y-0.5">
                      <span className="block font-semibold">
                        {copy.moveTo.replace("{name}", space.name)}
                      </span>
                      <span className="block opacity-80">
                        {handle ? `@${handle}` : copy.tabNoHandle}
                      </span>
                      <span className="block opacity-80">
                        {wallet ? labelOf(wallet) : copy.tabNoWallet}
                      </span>
                      <span className="block opacity-80">
                        {apps === 1
                          ? copy.tabOneApp
                          : copy.tabApps.replace("{n}", String(apps))}
                      </span>
                    </span>
                  }
                  side="bottom"
                  className="min-w-0"
                >
                  {tab}
                </Tooltip>
              )}
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
