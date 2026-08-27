"use client";

import {
  AboutPanel,
  AppearancePanel,
  BrowsingPanel,
  GeneralPanel,
  PaymentsPanel,
  PrivacyPanel,
  SETTINGS_CATEGORIES,
} from "@/components/apps/settings-app";
import { ProfilesPanel } from "@/components/apps/settings/profiles-panel";
import { SecurityPanel } from "@/components/apps/settings/security-panel";
import { WalletSettingsPanel } from "@/components/apps/settings-wallet";
import { AutofillPanel } from "@/components/apps/settings/autofill-panel";
import { PermissionsPanel } from "@/components/apps/settings/permissions-panel";
import { ShortcutsPanel } from "@/components/apps/settings/shortcuts-panel";
import { DownloadsPane } from "@/components/hub/downloads-pane";
import { useHub, type SettingsCategory } from "@/components/hub/hub-provider";
import { LicencePane } from "@/components/hub/licence-pane";
import { LegalPane } from "@/components/hub/legal-pane";
import { ReleaseDetail, ReleaseList } from "@/components/hub/release-notes";
import { RepositoriesButton } from "@/components/hub/repositories-button";
import { SettingsSearch } from "@/components/apps/settings/settings-search";
import { ClearDataPane, LanguagesPane } from "@/components/hub/settings-panes";
import { SiteSettingsPane } from "@/components/hub/site-settings-pane";
import { content, getDownloads, licence } from "@/lib/data";
import { ChevronLeft, ChevronRight, Download, ListChecks } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import { useState, type ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const copy = content.mobileBrowser.settings;
const spring = { type: "spring" as const, damping: 34, stiffness: 360 };

/**
 * The panel for one category, whichever it is.
 *
 * The desktop components, unchanged. Every one of them is a stack of cards
 * with no fixed width, so a phone gets the same controls rather than a second
 * implementation that drifts a fortnight after it is written — which is what
 * this sheet was: thirteen rows, twelve of them toasting "coming soon", beside
 * a settings page with eight full categories.
 */
function CategoryPanel({ id }: { id: SettingsCategory }): ReactNode {
  switch (id) {
    case "general":
      return <GeneralPanel />;
    case "profiles":
      return <ProfilesPanel />;
    case "security":
      return <SecurityPanel />;
    case "privacy":
      return <PrivacyPanel />;
    case "payments":
      return <PaymentsPanel />;
    case "permissions":
      return <PermissionsPanel />;
    case "autofill":
      return <AutofillPanel />;
    case "browsing":
      return <BrowsingPanel />;
    case "shortcuts":
      return <ShortcutsPanel />;
    case "appearance":
      return <AppearancePanel />;
    case "wallet":
      return <WalletSettingsPanel />;
    case "about":
      return <AboutPanel />;
  }
}

/**
 * What the hub's reference pane would be showing, as a pushed screen.
 *
 * The shared panels open panes — languages, downloads, site settings, the
 * licence, the release notes — by writing to hub state, and on desktop the
 * column beside them renders it. There is no column on a phone, so the sheet
 * reads the same state and pushes a screen instead. One row, one destination,
 * two shapes; the alternative was a `Row` that knew which device it was on.
 */
function PaneScreen({ kind, id }: { kind: string; id: string }): ReactNode {
  switch (kind) {
    case "languages":
      return <LanguagesPane />;
    case "clear-data":
      return <ClearDataPane />;
    case "downloads":
      return <DownloadsPane />;
    case "sites":
      return <SiteSettingsPane />;
    case "licence":
      return <LicencePane />;
    case "legal":
      return <LegalPane />;
    case "release":
      return <ReleaseDetail version={id} />;
    case "releases":
      return <ReleaseList />;
    default:
      return null;
  }
}

/** The title bar's words for whatever pane is open. */
function paneTitle(kind: string, id: string): string {
  switch (kind) {
    case "languages":
      return copy.languages;
    case "clear-data":
      return content.settings.privacy.clearTitle;
    case "downloads":
      return content.library.downloads.title;
    case "sites":
      return content.settings.sites.title;
    case "licence":
      return `${licence.name} ${licence.version}`;
    case "legal":
      return content.legal.title;
    case "release":
      return `${content.releases.whatsNewIn} v${id}`;
    case "releases":
      return content.releases.title;
    default:
      return content.settings.title;
  }
}

/** Kinds this sheet knows how to draw; anything else is somebody else's pane. */
const PANE_KINDS = new Set([
  "languages",
  "clear-data",
  "downloads",
  "sites",
  "licence",
  "legal",
  "release",
  "releases",
]);

/**
 * Settings on a phone: the same settings, one column at a time.
 *
 * A drill-down rather than a longer scroll. Everything the desktop page can do
 * is here, reached by pushing a screen per category the way the platform's own
 * settings do — which is also the only way eight categories of controls fit on
 * a screen this size without becoming a page nobody reaches the bottom of.
 *
 * The stack is two deep at most: root → category → pane. Deeper than that and
 * the back button stops being a place people can predict.
 */
export function MobileSettings({
  onClose,
}: {
  onClose: () => void;
}): ReactNode {
  const { detailPane, closeDetailPane, openDetailPane } = useHub();
  const [category, setCategory] = useState<SettingsCategory | null>(null);
  const still = useReducedMotion();
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(true);

  /* Derived from hub state rather than copied into local state: the panels
     write there, and a second copy would be a second thing to keep in step. */
  const pane =
    detailPane && PANE_KINDS.has(detailPane.kind) ? detailPane : null;

  const depth = pane ? 2 : category ? 1 : 0;
  const title = pane
    ? paneTitle(pane.kind, pane.id)
    : category
      ? (SETTINGS_CATEGORIES.find((entry) => entry.id === category)?.label ??
        content.settings.title)
      : copy.title;

  const back = (): void => {
    if (pane) closeDetailPane();
    else setCategory(null);
  };

  const slide = still
    ? {}
    : {
        initial: {
          x: depth === 0 ? 0 : "100%",
          opacity: depth === 0 ? 1 : 0.6,
        },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 0.6 },
        transition: spring,
      };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={spring}
      className="bg-background fixed inset-0 z-60 flex flex-col md:hidden"
    >
      <header className="flex items-center gap-1 px-2 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        {/* Back where there is somewhere to go back to, and nothing where
            there is not — a disabled chevron is a promise of a screen that
            does not exist. */}
        {depth > 0 ? (
          <button
            type="button"
            onClick={back}
            aria-label={copy.back}
            className="focus-ring text-accent flex w-16 items-center gap-0.5 text-[15px] font-semibold"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            {copy.back}
          </button>
        ) : (
          <div className="w-16" aria-hidden="true" />
        )}
        <h2 className="flex-1 truncate text-center text-base font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => {
            closeDetailPane();
            onClose();
          }}
          className="focus-ring text-accent w-16 text-right text-[15px] font-semibold"
        >
          {copy.done}
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={pane ? `pane:${pane.kind}:${pane.id}` : (category ?? "root")}
            {...slide}
            className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
          >
            {pane ? (
              <PaneScreen kind={pane.kind} id={pane.id} />
            ) : category ? (
              <div className="pt-1">
                <CategoryPanel id={category} />
              </div>
            ) : (
              <Root onOpen={setCategory} onPane={openDetailPane} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * Categories worth opening on a phone.
 *
 * Shortcuts goes: it is twenty-two chord bindings and a control for recording
 * a new one, and a phone has no ⌘ to hold down. It is not hidden because it is
 * long — Preferences is longer — but because every row in it describes an
 * action this device cannot perform.
 *
 * Nothing else is dropped. A settings category that exists on one device and
 * not the other is a thing people have to learn, so the bar for removing one is
 * that it be inert here rather than merely less useful.
 */
const PHONE_CATEGORIES = SETTINGS_CATEGORIES.filter(
  (entry) => entry.id !== "shortcuts",
);

/**
 * The list you land on.
 *
 * Two tiles for the things people open settings to look at rather than
 * change, then the categories, then the one destination with no home on the
 * desktop page. Nothing else: every setting that exists lives in exactly one
 * category, and a root that also surfaced the popular ones would be two places
 * to change one thing and two places for them to disagree.
 */
function Root({
  onOpen,
  onPane,
}: {
  onOpen: (id: SettingsCategory) => void;
  onPane: (pane: { kind: "downloads"; id: string }) => void;
}): ReactNode {
  const downloads = getDownloads().length;
  return (
    <div className="space-y-6 pt-1">
      {/*
        The same search, told where to push.

        A phone needs it more than a desktop does, not less: the drill-down
        that makes eleven categories fit is the same drill-down that hides
        every setting one tap deeper. `onNavigate` is how a result opens the
        category here rather than only in hub state, which this sheet does not
        read for its depth.
      */}
      <SettingsSearch
        onNavigate={onOpen}
        categories={PHONE_CATEGORIES}
        className="focus-ring border-border bg-surface-raised text-muted-foreground flex w-full items-center gap-2 rounded-2xl border px-4 py-3 text-left"
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onPane({ kind: "downloads", id: "" })}
          className="focus-ring bg-surface-raised ring-border flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium ring-1"
        >
          <Download className="size-4" aria-hidden="true" />
          {copy.downloads}
          {downloads > 0 && (
            <span className="text-muted-foreground text-xs">{downloads}</span>
          )}
        </button>
        {/* The repositories sheet, as a tile. It is the one thing here with no
            row on the desktop settings page — it lives at the foot of the Apps
            column, which a phone reaches a different way. */}
        <RepositoriesButton className="focus-ring bg-surface-raised ring-border flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium ring-1">
          <ListChecks className="size-4" aria-hidden="true" />
          {content.repositories.button}
        </RepositoriesButton>
      </div>

      <div className="border-border divide-border/60 bg-surface-raised divide-y overflow-hidden rounded-2xl border">
        {PHONE_CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onOpen(entry.id)}
            className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
              <entry.icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">
                {entry.label}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                {entry.hint}
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
