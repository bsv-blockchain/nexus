"use client";

import { AppTile } from "@/components/hub/app-icon";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import { PopoverMenu } from "@/components/hub/popover-menu";
import { content, getAppOnboarding, getHubApp } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import {
  ChevronDown,
  Columns2,
  Info,
  Link2Off,
  MoreVertical,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const copy = content.appMenu;

function Item({
  icon: Icon,
  label,
  onClick,
  tone = "normal",
}: {
  icon: typeof Info;
  label: string;
  onClick: () => void;
  tone?: "normal" | "negative";
}): ReactNode {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs ${
        tone === "negative" ? "text-negative" : ""
      }`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

/**
 * The actions that belong to whichever app is on screen.
 *
 * Every app gets one, in the same corner, so "what can I do with this thing"
 * has a single answer everywhere instead of being wherever each app happened to
 * put it. Apps that draw their own chrome mount it themselves; the rest get it
 * from the pane's header.
 *
 * `extra` is where an app adds what only it can offer. The shared items are the
 * ones true of any app: put it beside another one, read what it does,
 * disconnect it from this profile.
 */
export function AppMenu({
  slug,
  extra,
  className = "",
}: {
  slug: AppSlug;
  /** app-specific rows, rendered above the shared ones */
  extra?: ReactNode;
  className?: string;
}): ReactNode {
  const {
    splitApp,
    setSplitApp,
    openDetailPane,
    uninstallApp,
    installApp,
    activeSpaceId,
    spaces,
  } = useHub();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<
    { top: number; left: number; right: number; bottom: number } | undefined
  >(undefined);
  const isDesktop = useIsDesktop();

  const app = getHubApp(slug);
  const guide = getAppOnboarding(slug);
  const space = spaces.find((entry) => entry.id === activeSpaceId);
  const splitting = splitApp !== null;

  const close = (): void => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          });
          setOpen(true);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={copy.label}
        title={copy.label}
        className={`focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md p-1.5 ${className}`}
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>

      <PopoverMenu
        open={open}
        {...(anchor ? { anchor } : {})}
        onClose={close}
        label={copy.label}
        className="w-52"
      >
        {extra}

        {/* Only where there is room for two. Below the desktop breakpoint a
            split is two half-width apps, which is neither of them. */}
        {isDesktop &&
          (splitting ? (
            <Item
              icon={X}
              label={copy.closeSplit}
              onClick={() => {
                setSplitApp(null);
                close();
              }}
            />
          ) : (
            <Item
              icon={Columns2}
              label={copy.openSplit}
              onClick={() => {
                /* Opened empty: the second pane asks which app rather than
                   guessing, because guessing means opening the wrong one and
                   making somebody close it. */
                setSplitApp("");
                close();
              }}
            />
          ))}

        {guide && (
          <Item
            icon={Info}
            label={content.onboarding.button}
            onClick={() => {
              openDetailPane({ kind: "onboarding", id: slug });
              close();
            }}
          />
        )}

        {app && app.essential !== true && (
          <Item
            icon={Link2Off}
            tone="negative"
            label={copy.disconnect}
            onClick={() => {
              uninstallApp(slug, activeSpaceId);
              toast.success(app.name, {
                description: `${copy.disconnected} ${space?.name ?? ""}`.trim(),
                action: {
                  label: content.hub.undo,
                  onClick: () => installApp(slug, activeSpaceId),
                },
              });
              close();
            }}
          />
        )}
      </PopoverMenu>
    </>
  );
}

/**
 * The second pane's own chrome: which app it holds, and the way to shut it.
 *
 * Its picker offers only apps this profile has connected. A profile is a
 * selection of apps, and a split that could reach past it would be a hole in
 * the one boundary the profile exists to draw.
 */
export function SplitPaneHeader(): ReactNode {
  const { splitApp, setSplitApp } = useHub();
  const app = splitApp ? getHubApp(splitApp) : undefined;

  return (
    <header className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
      {/* A control only once there is something to change. With the picker
          already filling the pane, a button that reopens the picker is a button
          that does nothing — so while the pane is asking, this is a label. */}
      {app ? (
        <button
          type="button"
          onClick={() => setSplitApp("")}
          className="focus-ring hover:bg-surface-hover flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
        >
          <AppTile app={app} size={20} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {app.name}
          </span>
          <ChevronDown
            className="text-muted-foreground size-3.5 shrink-0"
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="text-muted-foreground min-w-0 flex-1 truncate px-1 text-sm">
          {copy.pickApp}
        </span>
      )}

      <button
        type="button"
        onClick={() => setSplitApp(null)}
        aria-label={copy.closeSplit}
        title={copy.closeSplit}
        className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md p-1.5"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </header>
  );
}
