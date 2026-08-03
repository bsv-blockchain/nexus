"use client";

import { CertificateDialog } from "@/components/hub/certificate-dialog";
import { MenuItem, MenuSeparator, PopoverMenu } from "@/components/hub/popover-menu";
import { content } from "@/lib/data";
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
  Sun,
  Trash2,
  Wand2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";

/** URL-bar settings popover from the design: quick actions, extensions, settings. */
export function BrowserSettingsMenu({
  open,
  onClose,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
}): ReactNode {
  const copy = content.browserSettings;
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [developerMode, setDeveloperMode] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const quickActions = [
    { icon: Share, label: "Share" },
    { icon: Wand2, label: "Boost" },
    { icon: Camera, label: "Capture" },
    { icon: ScanLine, label: "Reader" },
  ];

  return (
    <PopoverMenu
      open={open}
      onClose={onClose}
      label="Browser settings"
      className={`w-72 p-3 ${className}`}
    >
      <div className="flex gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            onClick={onClose}
            className="focus-ring flex h-11 flex-1 items-center justify-center rounded-xl bg-muted hover:bg-surface-hover"
          >
            <action.icon className="size-4.5" aria-hidden="true" />
          </button>
        ))}
      </div>

      <h3 className="px-1 pt-3 pb-1.5 text-sm font-semibold">
        {copy.extensions}
      </h3>
      <div className="flex gap-2">
        <span
          className="relative flex size-11 items-center justify-center rounded-xl bg-muted text-sm font-bold text-negative"
          aria-label="uBlock Origin — 2 items blocked"
        >
          uB
          <span
            className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-negative text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            2
          </span>
        </span>
        <button
          type="button"
          aria-label="Add extension"
          onClick={onClose}
          className="focus-ring flex size-11 items-center justify-center rounded-xl bg-muted hover:bg-surface-hover"
        >
          <Plus className="size-4.5" aria-hidden="true" />
        </button>
      </div>

      <h3 className="px-1 pt-3 pb-1.5 text-sm font-semibold">
        {copy.settings}
      </h3>
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-pressed={isDark}
          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-surface-hover"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-muted">
            {isDark ? (
              <Moon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <Sun
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {copy.appearance}
            </span>
            <span className="block text-xs text-muted-foreground">
              {isDark ? copy.appearanceDark : copy.appearanceLight}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDeveloperMode((on) => !on)}
          aria-pressed={developerMode}
          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-surface-hover"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-muted">
            <Hammer className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {copy.developerMode}
            </span>
            <span className="block text-xs text-muted-foreground">
              {developerMode ? copy.on : copy.off}
            </span>
          </span>
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
        <button
          type="button"
          onClick={() => setCertOpen(true)}
          aria-haspopup="dialog"
          className="focus-ring flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
        >
          <Lock className="size-3.5 text-positive" aria-hidden="true" />
          {copy.secure}
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="focus-ring flex size-8 items-center justify-center rounded-full bg-muted hover:bg-surface-hover"
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
            <MenuItem
              icon={Puzzle}
              label={copy.more.manageExtensions}
              onClick={onClose}
            />
            <MenuItem
              icon={Plus}
              label={copy.more.addExtension}
              onClick={onClose}
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
