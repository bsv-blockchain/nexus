"use client";

import { WalletMark } from "@/components/apps/wallet/wallet-switcher";
import { AppHelpBar } from "@/components/hub/app-help-bar";
import { useHub } from "@/components/hub/hub-provider";
import { useCreateWorkspace } from "@/components/hub/use-create-workspace";
import { SpaceIcon } from "@/components/hub/space-icon";
import { content, MAX_HANDLES } from "@/lib/data";
import { activeHandleFor, useSettings } from "@/lib/settings-store";
import {
  activeWalletFor,
  allWallets,
  labelOf,
  useWallets,
} from "@/lib/wallets-store";
import { Check, PanelLeftClose, Plus } from "lucide-react";
import type { ReactNode } from "react";

const copy = content.profiles.sidebar;

/**
 * The box a library column's top control wears.
 *
 * Shared by the stat tiles and by the buttons that sit above them here and in
 * the Timeline's column, because those have to be the same height — a 32px
 * button over a row of 47px tiles read as an afterthought stuck on top rather
 * than the first item in a set.
 *
 * The height is stated rather than left to the content: the tiles get theirs
 * from two lines of type and the buttons carry one, so nothing but a floor
 * makes them agree. In rem so it moves with the root size.
 */
export const COLUMN_TILE =
  "ring-border/60 grid min-h-[2.9375rem] place-items-center rounded-lg px-2 py-1.5 ring-1";

function Stat({ value, label }: { value: string; label: string }): ReactNode {
  return (
    <div className={`${COLUMN_TILE} bg-surface-raised`}>
      {/* A block inside the grid cell: the tile centres its content, and these
          two lines are one thing, left-aligned against the tile's padding. */}
      <div className="w-full">
        <p className="text-sm font-bold tabular-nums">{value}</p>
        <p className="text-muted-foreground text-[10px]">{label}</p>
      </div>
    </div>
  );
}

/**
 * The column beside the profiles manager, about all of them.
 *
 * It used to show the active profile's bookmarks, which made it a duplicate of
 * one of the columns beside it — and worse, it made the active profile the
 * only one you could not compare against the others, since it was the one
 * pulled out of the row. The manager holds every profile now, so this column is
 * free to answer the question the manager cannot: what is true across them.
 *
 * The answer worth having is what is shared. A wallet in two profiles is not a
 * mistake, but it is the thing somebody separating Work from Personal would
 * want to know about, and it is invisible when you are looking at one column at
 * a time.
 */
export function ProfilesSidebar(): ReactNode {
  const {
    spaces,
    activeSpaceId,
    setActiveSpaceId,
    toggleRail,
    mainView,
    setMainView,
  } = useHub();
  const createWorkspace = useCreateWorkspace();
  const settings = useSettings();
  useWallets();

  const wallets = allWallets();
  /* Attached to more than one profile — computed here rather than stored,
     because it is a fact about the attachments and not a setting of its own. */
  const shared = wallets.filter(
    (wallet) =>
      spaces.filter((space) => activeWalletFor(space.id)?.id === wallet.id)
        .length > 1,
  );

  return (
    <div className="bg-surface flex h-full flex-col rounded-2xl p-3">
      <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-3">
        <button
          type="button"
          onClick={toggleRail}
          aria-label={content.hub.collapsePanel}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-0.5 shrink-0 rounded-md p-1"
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {copy.title}
        </h2>
      </div>

      {/* Wearing the stat tile's shape at full width: this is the one thing in
          the column that leaves it, and a tile reads as a destination where a
          text link would read as one more row in the list below. */}
      <button
        type="button"
        onClick={() => setMainView("timeline")}
        aria-current={mainView === "timeline" ? "page" : undefined}
        className={`focus-ring ${COLUMN_TILE} mx-0.5 text-center text-sm font-bold transition-colors ${
          mainView === "timeline"
            ? "bg-accent/15"
            : "bg-surface-raised hover:bg-surface-hover"
        }`}
      >
        {copy.viewFeed}
      </button>

      {/* Outside the scroller on purpose: the counts describe the whole column,
          so they stay put while the thing they are counting scrolls past. */}
      <div className="mt-2 grid shrink-0 grid-cols-3 gap-1.5 px-0.5">
        <Stat value={String(spaces.length)} label={copy.statProfiles} />
        <Stat
          value={`${settings.handles.length}/${MAX_HANDLES}`}
          label={copy.statHandles}
        />
        <Stat value={String(wallets.length)} label={copy.statWallets} />
      </div>

      {/*
        The workspaces sit at the FOOT of what is left, not the top of it.

        `mt-auto` on the content rather than `justify-end` on the scroller: the
        two agree while everything fits and disagree the moment it does not. A
        flex column that justifies to the end pushes its first child above the
        top of its own scroll box, so a long list would start out of reach. An
        auto margin collapses to nothing once the content is taller than the
        box, which leaves the list scrolling normally from its first row.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-auto">
        <h3 className="text-muted-foreground mt-4 px-1.5 text-[10px] font-bold tracking-wide uppercase">
          {copy.allProfiles}
        </h3>
        <ul className="mt-1">
          {spaces.map((space) => {
            const isActive = space.id === activeSpaceId;
            return (
              <li key={space.id}>
                <button
                  type="button"
                  onClick={() => setActiveSpaceId(space.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left ${
                    isActive ? "bg-accent/15" : "hover:bg-surface-hover"
                  }`}
                >
                  <SpaceIcon value={space.emoji} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {space.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-[10px]">
                      {/* A dash on either side where nothing is connected. A
                          workspace made a moment ago has neither, and "@" on
                          its own is a handle that looks like it failed to load
                          rather than one that was never chosen. */}
                      {copy.rowSummary
                        .replace(
                          "{handle}",
                          activeHandleFor(space.id)
                            ? `@${activeHandleFor(space.id)}`
                            : "—",
                        )
                        .replace(
                          "{wallet}",
                          activeWalletFor(space.id)
                            ? labelOf(activeWalletFor(space.id)!)
                            : "—",
                        )}
                    </span>
                  </span>
                  {isActive && (
                    <Check
                      className="text-accent size-3.5 shrink-0"
                      aria-label={copy.current}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {shared.length > 0 && (
          <>
            <h3 className="text-muted-foreground mt-4 px-1.5 text-[10px] font-bold tracking-wide uppercase">
              {copy.sharedTitle}
            </h3>
            <ul className="mt-1.5">
              {shared.map((wallet) => {
                const names = spaces
                  .filter((space) => activeWalletFor(space.id)?.id === wallet.id)
                  .map((space) => space.name);
                return (
                  <li
                    key={wallet.id}
                    className="flex items-center gap-2.5 px-1.5 py-1.5"
                  >
                    <WalletMark wallet={wallet} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">
                        {labelOf(wallet)}
                      </span>
                      <span className="text-muted-foreground block truncate text-[10px]">
                        {names.join(" · ")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        </div>
      </div>

      <div className="border-border/60 mt-2 border-t pt-2">
        <button
          type="button"
          onClick={createWorkspace}
          /* The wallet's secondary actions, in a narrower column: a raised
             surface with a hairline ring rather than an outline on nothing.
             Two secondary buttons in one product should not be two shapes. */
          className="focus-ring bg-surface-raised ring-border/60 hover:bg-surface-hover flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold ring-1 transition-colors"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {content.newItemMenu.newSpace}
        </button>
      </div>

      {/*
        The same bar every app column ends in, with the profile dots on its
        left.

        They were in the browsing column, where they switched the profile whose
        bookmarks you were looking at — a control about profiles, parked in a
        panel about tabs. Here they sit under a list of the same profiles and
        mean the one obvious thing.
      */}
      <AppHelpBar slug="profiles">
        <div
          className="flex items-center gap-1.5 px-1"
          role="tablist"
          aria-label={copy.title}
        >
          {spaces.map((space) => {
            const selected = space.id === activeSpaceId;
            return (
              <button
                key={space.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={space.name}
                title={space.name}
                onClick={() => setActiveSpaceId(space.id)}
                /* `--foreground` rather than the profile's own colour: the
                   selected dot is a state, and painting it with a brand tint
                   made it read as a stray colour in every other theme. */
                className={`focus-ring size-2.5 rounded-full transition-colors ${
                  selected ? "bg-foreground" : ""
                }`}
              >
                {!selected && (
                  <span className="bg-muted-foreground/40 hover:bg-muted-foreground block size-full rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </AppHelpBar>
    </div>
  );
}
