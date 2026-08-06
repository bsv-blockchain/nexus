"use client";

import { AppTile } from "@/components/hub/app-icon";
import { ShellVersion } from "@/components/hub/shell-version";
import { AppCollections } from "@/components/hub/app-collections";
import { AppStore } from "@/components/hub/app-store";
import { DownloadsPanel } from "@/components/hub/downloads-panel";
import { useHub } from "@/components/hub/hub-provider";
import { SpaceContent } from "@/components/hub/space-content";
import { SpaceIcon } from "@/components/hub/space-icon";
import { ThemeToggleWithLabel } from "@/components/theme-toggle";
import { content, getHubApps } from "@/lib/data";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Gift,
  Layers,
  LayoutGrid,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

type SheetView =
  | { kind: "root" }
  | { kind: "spaces" }
  | { kind: "space"; spaceId: string }
  | { kind: "downloads" }
  | { kind: "apps" };

function RootRow({
  label,
  icon: Icon,
  onClick,
  drilldown = true,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  drilldown?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium hover:bg-surface-hover"
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {drilldown && (
        <ChevronRight
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/** Full-screen mobile navigation sheet with drilldown menus. */
export function MobileSheet(): ReactNode {
  const { mobileSheetOpen } = useHub();
  // Unmounting on close resets the drilldown to the root menu for next open.
  if (!mobileSheetOpen) return null;
  return <MobileSheetContent />;
}

function MobileSheetContent(): ReactNode {
  const {
    setMobileSheetOpen,
    installedApps,
    openApp,
    spaces,
    openShare,
    openSettings,
  } = useHub();
  const [view, setView] = useState<SheetView>({ kind: "root" });
  const installed = getHubApps().filter((app) =>
    installedApps.includes(app.slug),
  );

  const titles: Record<SheetView["kind"], string> = {
    root: content.brand.name,
    spaces: content.library.spaces.title,
    space:
      view.kind === "space"
        ? (spaces.find((space) => space.id === view.spaceId)?.name ?? "")
        : "",
    downloads: content.library.downloads.title,
    apps: content.library.apps.title,
  };

  const parent: Record<Exclude<SheetView["kind"], "root">, SheetView> = {
    spaces: { kind: "root" },
    space: { kind: "spaces" },
    downloads: { kind: "root" },
    apps: { kind: "root" },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Hub menu"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-3">
        {view.kind !== "root" ? (
          <button
            type="button"
            onClick={() => setView(parent[view.kind])}
            aria-label={content.mobile.backLabel}
            className="focus-ring flex items-center gap-0.5 rounded-md p-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            {content.mobile.backLabel}
          </button>
        ) : (
          <div className="w-9" aria-hidden="true" />
        )}
        <h2 className="flex-1 text-center text-sm font-semibold">
          {titles[view.kind]}
        </h2>
        <button
          type="button"
          onClick={() => setMobileSheetOpen(false)}
          aria-label="Close menu"
          className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {view.kind === "root" && (
          <div className="flex flex-col gap-0.5">
            <RootRow
              label={content.library.spaces.title}
              icon={Layers}
              onClick={() => setView({ kind: "spaces" })}
            />
            <RootRow
              label={content.library.downloads.title}
              icon={Download}
              onClick={() => setView({ kind: "downloads" })}
            />
            <RootRow
              label={content.library.apps.title}
              icon={LayoutGrid}
              onClick={() => setView({ kind: "apps" })}
            />

            {installed.length > 0 && (
              <div className="my-2 h-px bg-border" aria-hidden="true" />
            )}

            {installed.length > 0 && (
              <div className="grid grid-cols-2 gap-2 py-1">
                {installed.map((app) => (
                  <button
                    key={app.slug}
                    type="button"
                    onClick={() => openApp(app.slug)}
                    className="focus-ring flex flex-col items-center gap-2 rounded-xl p-3 text-center hover:bg-surface-hover"
                  >
                    <AppTile app={app} size={40} />
                    <span className="text-xs font-medium">{app.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="my-2 h-px bg-border" aria-hidden="true" />

            {/* The desktop rail's gear does not exist below md, and Settings is
                where backup and sign-out live — a phone without this row has no
                path to its own recovery phrase. */}
            <RootRow
              label={content.settings.title}
              icon={Settings}
              onClick={() => {
                setMobileSheetOpen(false);
                openSettings();
              }}
            />

            <button
              type="button"
              onClick={() => {
                setMobileSheetOpen(false);
                openShare();
              }}
              className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium hover:bg-surface-hover"
            >
              <Gift className="size-5 text-muted-foreground" aria-hidden="true" />
              Share Nexus
            </button>
            <div className="px-1 pt-1">
              <ThemeToggleWithLabel />
            </div>
            {/* Phones never see the desktop rail, and this number is what a bug
                report needs — so it lives here too. */}
            <div className="flex justify-center px-1 pb-1 pt-2">
              <ShellVersion />
            </div>
          </div>
        )}

        {view.kind === "spaces" && (
          <div className="flex flex-col gap-0.5">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                onClick={() => setView({ kind: "space", spaceId: space.id })}
                className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium hover:bg-surface-hover"
              >
                <SpaceIcon value={space.emoji} size={18} />
                <span className="flex-1">{space.name}</span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        )}

        {view.kind === "space" && <SpaceContent spaceId={view.spaceId} />}
        {view.kind === "downloads" && <DownloadsPanel />}
        {view.kind === "apps" && (
          <div className="space-y-3">
            <AppCollections />
            <div className="-mx-3">
              <AppStore />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
