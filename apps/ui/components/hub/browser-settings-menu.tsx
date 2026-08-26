"use client";

import { CertificateDialog } from "@/components/hub/certificate-dialog";
import {
  MenuItem,
  MenuSeparator,
  PopoverMenu,
} from "@/components/hub/popover-menu";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { isPinnableUrl, shortNameFor } from "@/lib/rail/origin";
import {
  Camera,
  Cookie,
  Hammer,
  Lock,
  Moon,
  MoreHorizontal,
  Plus,
  Puzzle,
  ScanLine,
  Settings,
  Share,
  SquarePlus,
  Sun,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

/** URL-bar settings popover from the design: quick actions, extensions, settings. */
export function BrowserSettingsMenu({
  open,
  onClose,
  className = "",
  anchor,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  /** the trigger's rect; portals the menu clear of the sidebar's clip */
  anchor?: { top: number; left: number; right: number; bottom: number };
}): ReactNode {
  const copy = content.browserSettings;
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [developerMode, setDeveloperMode] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { activeTab, pinSite, pinnedSites, openPage } = useHub();

  /*
   * The page in this tab, put on the rail as an app.
   *
   * The slot this replaced was "Boost", which was a wand that did nothing. This
   * is the one thing somebody standing on a web app actually wants from a
   * browser that has a rail: keep it. A pinned site IS how a web listing is
   * connected — the same thing the App Store does when you connect one — so
   * this is not a second kind of tile, just the other door onto it.
   *
   * The name comes from the page title cut back to the site's own name, and the
   * mark from the largest icon that origin serves; see lib/rail/origin.
   */
  const addToRail = (): void => {
    if (!activeTab) return;
    if (!isPinnableUrl(activeTab.url)) {
      toast.error(copy.addToRailRefused);
      return;
    }
    const name = shortNameFor(activeTab.title, activeTab.url);
    const already = pinnedSites.some((site) => site.url === activeTab.url);
    const site = pinSite(activeTab.url, name);
    onClose();
    if (!site) {
      toast.error(copy.addToRailRefused);
      return;
    }
    toast.success(already ? copy.addToRailAlready : copy.addToRailDone, {
      description: name,
    });
  };

  const quickActions: {
    icon: typeof Share;
    label: string;
    onClick: () => void;
  }[] = [
    { icon: Share, label: "Share", onClick: onClose },
    { icon: SquarePlus, label: copy.addToRail, onClick: addToRail },
    { icon: Camera, label: "Capture", onClick: onClose },
    { icon: ScanLine, label: "Reader", onClick: onClose },
  ];

  return (
    <PopoverMenu
      open={open}
      onClose={onClose}
      label="Browser settings"
      {...(anchor ? { anchor } : {})}
      className={`w-72 p-3 ${className}`}
    >
      <div className="flex gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            title={action.label}
            onClick={action.onClick}
            className="focus-ring bg-muted hover:bg-surface-hover flex h-11 flex-1 items-center justify-center rounded-xl"
          >
            <action.icon className="size-4.5" aria-hidden="true" />
          </button>
        ))}
      </div>

      {/*
        The heading and the tiles are one hover target.

        `Manage` appears on the right of the heading rather than beside each
        tile: there is one manager and it is about all of them, so a control per
        extension would be the same destination offered N times. Grouping the
        heading with the row it labels means the reveal happens wherever the
        pointer is in this section — hovering a tile and finding nothing, then
        having to travel up to the words, is the version of this that feels
        broken.
      */}
      <div className="group/ext">
        <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
          <h3 className="flex-1 text-sm font-semibold">{copy.extensions}</h3>
          {/* Focusable at all times, visible on hover — a control that only
              exists under a pointer is a control a keyboard cannot reach. */}
          <button
            type="button"
            onClick={() => {
              onClose();
              openPage("extensions");
            }}
            className="focus-ring text-muted-foreground hover:text-foreground rounded-md px-1.5 py-0.5 text-xs font-semibold opacity-0 transition-opacity group-hover/ext:opacity-100 focus-visible:opacity-100"
          >
            {content.extensions.manage}
          </button>
        </div>
        <div className="flex gap-2">
          <span
            className="bg-muted text-negative relative flex size-11 items-center justify-center rounded-xl text-sm font-bold"
            aria-label="uBlock Origin — 2 items blocked"
          >
            uB
            <span
              className="bg-negative absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
              aria-hidden="true"
            >
              2
            </span>
          </span>
          <button
            type="button"
            aria-label="Add extension"
            onClick={() => {
              onClose();
              openPage("extensions");
            }}
            className="focus-ring bg-muted hover:bg-surface-hover flex size-11 items-center justify-center rounded-xl"
          >
            <Plus className="size-4.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <h3 className="px-1 pt-3 pb-1.5 text-sm font-semibold">
        {copy.settings}
      </h3>
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-pressed={isDark}
          className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left"
        >
          <span className="bg-muted flex size-8 items-center justify-center rounded-full">
            {isDark ? (
              <Moon
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
            ) : (
              <Sun
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{copy.appearance}</span>
            <span className="text-muted-foreground block text-xs">
              {isDark ? copy.appearanceDark : copy.appearanceLight}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDeveloperMode((on) => !on)}
          aria-pressed={developerMode}
          className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left"
        >
          <span className="bg-muted flex size-8 items-center justify-center rounded-full">
            <Hammer
              className="text-muted-foreground size-4"
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {copy.developerMode}
            </span>
            <span className="text-muted-foreground block text-xs">
              {developerMode ? copy.on : copy.off}
            </span>
          </span>
        </button>
      </div>

      <div className="border-border mt-2 flex items-center justify-between border-t pt-2.5">
        <button
          type="button"
          onClick={() => setCertOpen(true)}
          aria-haspopup="dialog"
          className="focus-ring bg-muted hover:bg-surface-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        >
          <Lock className="text-positive size-3.5" aria-hidden="true" />
          {copy.secure}
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="focus-ring bg-muted hover:bg-surface-hover flex size-8 items-center justify-center rounded-full"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
          <PopoverMenu
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            label="More options"
            className="right-0 bottom-full mb-2"
          >
            <MenuItem
              icon={Trash2}
              label={copy.more.clearCache}
              onClick={onClose}
            />
            <MenuItem
              icon={Cookie}
              label={copy.more.clearCookies}
              onClick={onClose}
            />
            <MenuSeparator />
            {/* Both of these named the extensions manager and then closed the
                menu without opening anything. */}
            <MenuItem
              icon={Puzzle}
              label={copy.more.manageExtensions}
              onClick={() => {
                onClose();
                openPage("extensions");
              }}
            />
            <MenuItem
              icon={Plus}
              label={copy.more.addExtension}
              onClick={() => {
                onClose();
                openPage("extensions");
              }}
            />
            <MenuSeparator />
            <MenuItem
              icon={Settings}
              label={copy.more.allSiteSettings}
              onClick={onClose}
            />
          </PopoverMenu>
        </div>
      </div>

      <CertificateDialog open={certOpen} onClose={() => setCertOpen(false)} />
    </PopoverMenu>
  );
}
