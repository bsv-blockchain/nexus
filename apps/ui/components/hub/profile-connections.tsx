"use client";

import { WalletMark } from "@/components/apps/wallet/wallet-switcher";
import { AppTile } from "@/components/hub/app-icon";
import { AppName } from "@/components/hub/app-name";
import { ConnectPicker } from "@/components/hub/connect-picker";
import { RepoMark } from "@/components/hub/repo-section";
import { Tooltip } from "@/components/hub/tooltip";
import { useHub } from "@/components/hub/hub-provider";
import { content, getHubApps, getSpaces } from "@/lib/data";
import {
  activeHandleFor,
  handleHeldElsewhere,
  setHandleFor,
  useSettings,
} from "@/lib/settings-store";
import {
  activeWalletFor,
  labelOf,
  setActiveWallet,
  useWallets,
  walletsByRecent,
} from "@/lib/wallets-store";
import { useRepositories } from "@/lib/repositories-store";
import { Sheet } from "@/components/apps/messages/sheet";
import { ArrowLeftRight, ChevronDown, Lock } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.profiles.connections;

/**
 * A named section that can be shut.
 *
 * Three groups of things in a 288px column is more than fits at once, and the
 * one somebody came to change is rarely all three. Open by default: a column
 * that starts collapsed makes you click twice to see what a profile even is.
 */
function Group({
  title,
  count,
  collapsed,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: string;
  /** what stands in for the list once it is shut */
  collapsed?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-3 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="focus-ring text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase"
      >
        <ChevronDown
          className={`size-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
        {count && <span className="tabular-nums">{count}</span>}
      </button>
      {open ? (
        <div className="mt-1">{children}</div>
      ) : (
        collapsed && <div className="mt-1.5 px-1.5">{collapsed}</div>
      )}
    </section>
  );
}

/**
 * A shut list, still saying what is in it.
 *
 * Collapsing a group should hide the detail, not the fact. A heading reading
 * "Connected apps 6" with nothing under it makes somebody open it again to see
 * which six — so the icons stay and only the names and switches go.
 *
 * Sixteen is the ceiling because that is the whole catalogue; past it the pile
 * would be saying "lots" in a way a number says better, which is what the
 * remainder chip is for.
 */
const PILE_MAX = 16;

function AppPile({ apps }: { apps: ReturnType<typeof getHubApps> }): ReactNode {
  const shown = apps.slice(0, PILE_MAX);
  const rest = apps.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((app) => (
        /* The pile is what a shut group says instead of its list, so the
           icons have to be readable — sixteen unlabelled marks is a picture of
           having apps rather than a statement of which. */
        <Tooltip key={app.slug} label={app.name} side="top">
          <span className="flex rounded-[22%] ring-offset-1 transition-transform hover:scale-110">
            <AppTile app={app} size={22} />
          </span>
        </Tooltip>
      ))}
      {rest > 0 && (
        <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
          {copy.morePile.replace("{n}", String(rest))}
        </span>
      )}
    </div>
  );
}

function handleMark(on: boolean): ReactNode {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
        on ? "bg-accent/15 text-foreground" : "bg-muted text-muted-foreground"
      }`}
      aria-hidden="true"
    >
      @
    </span>
  );
}

/**
 * What one profile is connected to.
 *
 * One handle and one wallet, chosen from a list rather than switched on in a
 * row. A row of switches said a profile could hold several; it holds one. The
 * switches were also the wrong shape for the question — with five handles and
 * four wallets in play, "which one" is a choice from a list, not nine
 * independent yes-or-nos that happen to be mutually exclusive.
 */
export function ProfileConnections({ spaceId }: { spaceId: string }): ReactNode {
  const settings = useSettings();
  const { installedFor: installedForSpace, uninstallApp, installApp, spaces, openApp } =
    useHub();
  useWallets();
  const repos = useRepositories();
  const repoOf = (id: string): (typeof repos)[number] | undefined =>
    repos.find((repo) => repo.id === id);

  const handle = activeHandleFor(spaceId);
  const wallet = activeWalletFor(spaceId);
  /* A pick that would take a handle off another workspace, held until it has
     been agreed to. Null the rest of the time, which is also what keeps the
     sheet out of the tree on the server. */
  const [moving, setMoving] = useState<
    { handle: string; fromId: string; fromName: string } | undefined
  >(undefined);
  /* This profile's apps, not the active profile's. A column is about the
     profile it names, and reading the active one made every column show the
     same six. */
  /*
   * A profile made just now opens shut.
   *
   * A new column is three groups of controls for a profile that has nothing in
   * it yet — a wall of switches asking to be read before there is anything to
   * read. Shut, it is a name and three headings, which is the right amount to
   * meet a thing you have only just made.
   *
   * Derived from whether the profile shipped rather than remembered: a seeded
   * one has been lived in, anything else has not. It is only the initial state,
   * so opening a group sticks for as long as the column is on screen.
   */
  const seeded = getSpaces().some((entry) => entry.id === spaceId);
  const here = installedForSpace(spaceId);
  const apps = getHubApps().filter((app) => here.includes(app.slug));
  /* Connected somewhere else but not here. Which profiles have it goes on the
     row, because "Work has this" is the reason somebody is about to add it. */
  const others = spaces.filter((entry) => entry.id !== spaceId);
  const usedBy = (slug: string): string =>
    others
      .filter((entry) => installedForSpace(entry.id).includes(slug as never))
      .map((entry) => entry.name)
      .join(", ");
  const addable = getHubApps().filter(
    (app) => !here.includes(app.slug) && usedBy(app.slug) !== "",
  );
  const space = spaces.find((entry) => entry.id === spaceId);
  /** The workspace already wearing a handle, where it is not this one. */
  const holderOf = (entry: string): (typeof spaces)[number] | undefined => {
    const held = handleHeldElsewhere(entry, spaceId);
    return held === undefined
      ? undefined
      : spaces.find((other) => other.id === held);
  };

  return (
    <div className="pb-2">
      <Group title={copy.handle} defaultOpen={seeded}>
        <div className="px-1.5">
          <ConnectPicker
            label={copy.pickHandle}
            emptyLabel={copy.connectHandle}
            connected={
              handle
                ? { id: handle, label: `@${handle}`, mark: handleMark(true) }
                : null
            }
            /* Newest first: the handle somebody just claimed is the one they
               are most likely pointing a profile at. */
            options={[...settings.handles].reverse().map((entry) => {
              /* One workspace at most, since a handle is one identity. Named on
                 the row rather than left to be discovered: taking it is allowed,
                 but it is a move, and "Work has it" is what makes that legible
                 before the click rather than after it. */
              const holder = holderOf(entry);
              return {
                id: entry,
                label: `@${entry}`,
                mark: handleMark(entry === handle),
                ...(holder
                  ? { hint: copy.heldBy.replace("{name}", holder.name) }
                  : {}),
              };
            })}
            onPick={(id) => {
              const holder = holderOf(id);
              /* Somebody else's: ask, and let the sheet do it. Free: just
                 connect it, because a confirmation for a move that costs
                 nothing is a dialog that teaches people to dismiss dialogs. */
              if (holder) {
                setMoving({
                  handle: id,
                  fromId: holder.id,
                  fromName: holder.name,
                });
                return;
              }
              setHandleFor(spaceId, id);
              toast.success(`@${id}`, {
                description: `${copy.nowOn} ${space?.name ?? ""}`.trim(),
              });
            }}
            onAdd={() => openApp("identity")}
            addLabel={copy.newHandle}
          />
        </div>
      </Group>

      <Group title={copy.wallet} defaultOpen={seeded}>
        <div className="px-1.5">
          <ConnectPicker
            label={copy.pickWallet}
            emptyLabel={copy.connectWallet}
            connected={
              wallet
                ? {
                    id: wallet.id,
                    label: labelOf(wallet),
                    mark: <WalletMark wallet={wallet} size={28} />,
                    ...(wallet.locked === true ? { hint: copy.locked } : {}),
                  }
                : null
            }
            options={walletsByRecent().map((entry) => ({
              id: entry.id,
              label: labelOf(entry),
              mark: (
                <span className="relative shrink-0">
                  <WalletMark wallet={entry} size={24} />
                  {entry.locked === true && (
                    <Lock
                      className="text-muted-foreground bg-surface absolute -right-1 -bottom-1 size-3 rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </span>
              ),
              ...(entry.locked === true ? { hint: copy.locked } : {}),
            }))}
            onPick={(id) => {
              setActiveWallet(spaceId, id);
              const picked = walletsByRecent().find((entry) => entry.id === id);
              toast.success(picked ? labelOf(picked) : "", {
                description: `${copy.nowWallet} ${space?.name ?? ""}`.trim(),
              });
            }}
            onAdd={() => openApp("wallet")}
            addLabel={copy.newWallet}
          />
        </div>
      </Group>

      <Group
        title={copy.connectedApps}
        count={String(apps.length)}
        collapsed={<AppPile apps={apps} />}
        defaultOpen={seeded}
      >
        {/*
          Adding one, from what another profile already has.

          Only those: connecting something brand new is the store's job, and it
          asks for permissions this row cannot. What this offers is the far
          commoner move — you already decided to trust this app somewhere else,
          and now you want it here too.
        */}
        {addable.length > 0 && (
          <div className="mb-1.5 px-1.5">
            <ConnectPicker
              label={copy.addAppLabel}
              emptyLabel={copy.addApp}
              connected={null}
              options={addable.map((app) => ({
                id: app.slug,
                label: app.name,
                hint: usedBy(app.slug),
                mark: <AppTile app={app} size={24} />,
              }))}
              onPick={(id) => {
                const picked = getHubApps().find((app) => app.slug === id);
                installApp(id as typeof apps[number]["slug"], spaceId);
                toast.success(picked?.name ?? "", {
                  description: `${copy.connectedTo} ${space?.name ?? ""}`.trim(),
                });
              }}
            />
          </div>
        )}
        <ul>
          {apps.map((app) => (
            <li
              key={app.slug}
              className="flex items-center gap-2.5 px-1.5 py-1.5"
            >
              <AppTile app={app} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">
                  <AppName app={app} />
                </span>
                {/* Where it came from, not what it is to us. "Essential" said
                    the same thing on three rows and told nobody anything they
                    could act on; the source is the part that decides whether an
                    app belongs in a profile at all. */}
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  {repoOf(app.repoId) && (
                    <RepoMark repo={repoOf(app.repoId)!} size={12} />
                  )}
                  <span className="truncate">
                    {repoOf(app.repoId)?.name ?? copy.unknownRepo}
                  </span>
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked
                aria-disabled={app.essential === true}
                disabled={app.essential === true}
                aria-label={app.name}
                onClick={() => {
                  uninstallApp(app.slug, spaceId);
                  toast.success(app.name, {
                    description: `${copy.disconnected} ${space?.name ?? ""}`.trim(),
                    action: {
                      label: content.hub.undo,
                      onClick: () => installApp(app.slug, spaceId),
                    },
                  });
                }}
                className={`focus-ring bg-accent relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  app.essential === true ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <span
                  className="absolute top-0.5 left-4.5 size-4 rounded-full bg-white"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
          {apps.length === 0 && (
            <li className="text-muted-foreground px-1.5 py-2 text-[11px]">
              {copy.noApps}
            </li>
          )}
        </ul>
      </Group>

      <p className="text-muted-foreground mt-3 px-1.5 text-[10px] text-pretty">
        {copy.footnote}
      </p>

      {/*
        Taking a handle off somewhere else, agreed to first.

        Portalled to the body for the same reason the picker's menu is: a column
        carries its own profile's palette as CSS variables, so a full-screen
        surface rendered inside one would come up wearing the colours of
        whichever column opened it rather than the app's.
      */}
      {moving !== undefined &&
        createPortal(
          <Sheet
            open
            onClose={() => setMoving(undefined)}
            label={copy.moveTitle
              .replace("{handle}", moving.handle)
              .replace("{name}", moving.fromName)}
            footer={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMoving(undefined)}
                  className="focus-ring border-border hover:bg-surface-hover flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold"
                >
                  {copy.moveCancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHandleFor(spaceId, moving.handle);
                    toast.success(`@${moving.handle}`, {
                      description:
                        `${copy.nowOn} ${space?.name ?? ""} · ${copy.movedFrom.replace("{name}", moving.fromName)}`.trim(),
                      /* The move is one call and so is putting it back, which
                         makes an undo honest rather than a second confirmation
                         wearing a different hat. */
                      action: {
                        label: content.hub.undo,
                        onClick: () =>
                          setHandleFor(moving.fromId, moving.handle),
                      },
                    });
                    setMoving(undefined);
                  }}
                  className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                >
                  {copy.moveConfirm}
                </button>
              </div>
            }
          >
            <div className="space-y-2 px-5 pt-3 pb-4">
              <h2 className="flex items-start gap-2 text-base font-bold">
                <ArrowLeftRight
                  className="text-warning mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {copy.moveTitle
                  .replace("{handle}", moving.handle)
                  .replace("{name}", moving.fromName)}
              </h2>
              <p className="text-muted-foreground text-sm text-pretty">
                {copy.moveBody.replace("{name}", moving.fromName)}
              </p>
            </div>
          </Sheet>,
          document.body,
        )}
    </div>
  );
}
