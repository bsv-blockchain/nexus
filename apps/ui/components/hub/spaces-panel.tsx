"use client";

import {
  AppContextSidebar,
  hasContextSidebar,
} from "@/components/hub/app-context-sidebar";
import { BrowserNav } from "@/components/hub/browser-nav";
import { useHub } from "@/components/hub/hub-provider";
import { NewItemMenu } from "@/components/hub/new-item-menu";
import { SpaceContent } from "@/components/hub/space-content";
import { SpaceIcon } from "@/components/hub/space-icon";
import { ThemeButton } from "@/components/hub/theme-picker";
import { SpaceMenu } from "@/components/hub/space-menu";
import { panelContainer, panelItem } from "@/components/hub/panel-motion";
import { content } from "@/lib/data";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Pencil,
  Plus,
  RotateCw,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

const PROFILE_LABELS: Record<string, string> = {
  personal: "Personal",
  work: "Work",
  shared: "Shared",
};

/** Library-mode Spaces column, matching the multi-column mock. */
export function SpacesPanel(): ReactNode {
  const {
    spaces,
    activeSpaceId,
    setActiveSpaceId,
    setLibraryTab,
    activeApp,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useHub();
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [newItemMenuOpen, setNewItemMenuOpen] = useState(false);
  const activeSpace =
    spaces.find((space) => space.id === activeSpaceId) ?? spaces[0];

  // Contextual column: for a non-Browse app, show the app's sidebar instead
  // of My Hub. My Hub only appears when Browse (or no app) is active.
  if (activeApp && activeApp !== "browser" && hasContextSidebar(activeApp)) {
    return (
      <div className="flex h-full flex-col rounded-2xl bg-surface p-3">
        <AppContextSidebar slug={activeApp} />
      </div>
    );
  }

  if (!activeSpace) return null;

  return (
    <motion.div
      className="relative flex h-full flex-col rounded-2xl bg-surface p-3"
      variants={panelContainer}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <motion.div
        variants={panelItem}
        className="relative flex items-center justify-between gap-2 px-1.5 pb-2"
      >
        <button
          type="button"
          aria-label={`${activeSpace.name} options`}
          aria-expanded={spaceMenuOpen}
          onClick={() => setSpaceMenuOpen(true)}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left text-muted-foreground transition-colors hover:bg-surface-hover"
        >
          <SpaceIcon value={activeSpace.emoji} size={18} />
          <span className="min-w-0 leading-tight text-foreground">
            <span className="block truncate text-sm font-semibold">
              {activeSpace.name}
            </span>
            {activeSpace.profile && (
              <span className="block truncate text-[11px] text-muted-foreground">
                {PROFILE_LABELS[activeSpace.profile]}
              </span>
            )}
          </span>
          <Pencil className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="Go back"
            className="focus-ring rounded-md p-1.5 hover:bg-surface-hover hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={!canGoForward}
            aria-label="Go forward"
            className="focus-ring rounded-md p-1.5 hover:bg-surface-hover hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Reload"
            className="focus-ring rounded-md p-1.5 hover:bg-surface-hover hover:text-foreground"
          >
            <RotateCw className="size-4" aria-hidden="true" />
          </button>
        </div>
        <SpaceMenu
          open={spaceMenuOpen}
          onClose={() => setSpaceMenuOpen(false)}
          spaceId={activeSpace.id}
          className="top-9 left-0"
        />
      </motion.div>

      <motion.div variants={panelItem} className="px-0.5 pb-1">
        <BrowserNav />
      </motion.div>

      <motion.div
        variants={panelItem}
        className="mt-2 min-h-0 flex-1 overflow-y-auto"
      >
        <SpaceContent spaceId={activeSpace.id} />
      </motion.div>

      <motion.div
        variants={panelItem}
        className="relative flex items-center justify-between pt-2"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={content.library.downloads.title}
            onClick={() => setLibraryTab("downloads")}
            className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
          {/* The profiles manager shows every profile but the active one, so
              until now the one you were actually using was the only one you
              could not theme. */}
          <ThemeButton spaceId={activeSpace.id} />
        </div>

        <div
          className="flex items-center gap-1.5"
          role="tablist"
          aria-label="Profiles"
        >
          {spaces.map((space) => {
            const selected = space.id === activeSpace.id;
            return (
              <button
                key={space.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={space.name}
                onClick={() => setActiveSpaceId(space.id)}
                /* The selected dot used to be painted with the profile's own
                   themeColor, which read as a stray brand colour in every other
                   theme. `--foreground` is the same treatment as the primary
                   CTAs: whatever the active palette's strongest ink is. */
                className={`focus-ring size-2.5 rounded-full transition-colors ${
                  selected ? "bg-foreground" : ""
                }`}
              >
                {!selected && (
                  <span className="block size-full rounded-full bg-muted-foreground/40 hover:bg-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="New item"
            aria-expanded={newItemMenuOpen}
            onClick={() => setNewItemMenuOpen(true)}
            className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <NewItemMenu
            open={newItemMenuOpen}
            onClose={() => setNewItemMenuOpen(false)}
            className="right-0 bottom-full mb-2"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
