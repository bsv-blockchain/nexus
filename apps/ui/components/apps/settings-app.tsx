"use client";

import { Favicon } from "@/components/hub/favicon";
import { IdentitySigil } from "@/components/hub/identity-sigil";
import { QrBlock } from "@/components/hub/qr-block";
import { useCustomTheme } from "@/components/hub/theme-provider";
import { useHub, type SettingsCategory } from "@/components/hub/hub-provider";
import {
  getEffects,
  getEffectsServerSnapshot,
  setChainPolicy,
  setReach,
  setToll,
  subscribeEffects,
  type ChainPolicy,
  type Reach,
} from "@/lib/command-effects";
import {
  content,
  currentRelease,
  getDownloads,
  getLanguage,
  getSearchEngine,
  licence,
  releases,
  searchEngines,
} from "@/lib/data";
import { Sheet } from "@/components/apps/messages/sheet";
import {
  Choice,
  Group,
  Row,
  SatsAmount,
  Steps,
  Toggle,
} from "@/components/apps/settings/blocks";
import { WalletSettingsPanel } from "@/components/apps/settings-wallet";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { AutofillPanel } from "@/components/apps/settings/autofill-panel";
import { BetaDialog } from "@/components/apps/settings/beta-dialog";
import { PermissionsPanel } from "@/components/apps/settings/permissions-panel";
import { ShortcutsPanel } from "@/components/apps/settings/shortcuts-panel";
import {
  setSetting,
  useSettings,
  type ArchiveAfter,
  type ClearOnQuit,
  type CookiePolicy,
  type OpenLinksIn,
  type StartupBehaviour,
} from "@/lib/settings-store";
import { InfoPopover } from "@/components/apps/roadmap/info-popover";
import { PerSenderTolls } from "@/components/apps/settings/per-sender-tolls";
import {
  BRANDS,
  setBrandMode,
  useBrand,
  useBrandMode,
  type BrandMode,
} from "@/lib/brand";
import {
  Check,
  ChevronRight,
  Globe,
  Moon,
  Heart,
  Info,
  KeyRound,
  Keyboard,
  Link2Off,
  Monitor,
  PanelLeftClose,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** The accent every profile falls back to; see app/globals.css. */
const DEFAULT_ACCENT = "#4353ff";

/**
 * The alternate marks Nexus can wear on a home screen or dock.
 *
 * Four, not a gallery. An icon set is a maintenance cost per entry and the
 * point of the setting is that somebody with two profiles can tell their
 * windows apart, which four colours do as well as twenty.
 */
const APP_ICONS: { id: string; label: string }[] = [
  { id: "default", label: content.mobileBrowser.settings.iconDefault },
  { id: "mono", label: content.mobileBrowser.settings.iconMono },
  { id: "retro", label: content.mobileBrowser.settings.iconRetro },
  { id: "dragon", label: content.mobileBrowser.settings.iconDragon },
];

const ALL_SETTINGS_CATEGORIES: {
  id: SettingsCategory;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    id: "wallet",
    // Literals, not content.ts: that file is the design repo's fixture set and
    // merges flow through it; this category exists only in our live builds.
    label: "Wallet",
    hint: "Keys, network and backup.",
    icon: Wallet,
  },
  {
    id: "general",
    label: content.settings.general.title,
    hint: content.settings.general.hint,
    icon: Sliders,
  },
  {
    id: "privacy",
    label: content.settings.privacy.title,
    hint: content.settings.privacy.hint,
    icon: ShieldCheck,
  },
  {
    id: "permissions",
    label: content.settings.permissions.title,
    hint: content.settings.permissions.hint,
    icon: ShieldAlert,
  },
  {
    id: "autofill",
    label: content.settings.autofill.title,
    hint: content.settings.autofill.hint,
    icon: KeyRound,
  },
  {
    id: "browsing",
    label: content.settings.browsing.title,
    hint: content.settings.browsing.hint,
    icon: Globe,
  },
  {
    id: "shortcuts",
    label: content.settings.shortcuts.title,
    hint: content.settings.shortcuts.hint,
    icon: Keyboard,
  },
  {
    id: "appearance",
    label: content.settings.appearance.title,
    hint: content.settings.appearance.hint,
    icon: Monitor,
  },
  {
    id: "about",
    label: content.settings.about.title,
    hint: content.settings.about.hint,
    icon: Info,
  },
];

/**
 * Which categories a build actually offers.
 *
 * Same split as WALLET_SECTIONS in wallet-app.tsx: the demo keeps the
 * designer's eight categories untouched, while a shipping build offers only
 * what a real shell can answer — its wallet, its theme, and what build it is.
 * The demo panels are wired to fixtures and `soon` toasts, which on a live
 * build would be several dozen controls that lie.
 */
const DEMO_CATEGORY_IDS: ReadonlySet<SettingsCategory> = new Set([
  "general",
  "privacy",
  "permissions",
  "autofill",
  "browsing",
  "shortcuts",
  "appearance",
  "about",
]);
const LIVE_CATEGORY_IDS: ReadonlySet<SettingsCategory> = new Set([
  "wallet",
  "appearance",
  "about",
]);

export const SETTINGS_CATEGORIES = ALL_SETTINGS_CATEGORIES.filter((category) =>
  (DEMO_SURFACES ? DEMO_CATEGORY_IDS : LIVE_CATEGORY_IDS).has(category.id)
);

/**
 * The category to show for a request this build does not carry.
 *
 * The hub's default is `general`, which a live build drops — and hub state can
 * also arrive from an older session, or from a deep link. Falling back to the
 * first entry beats rendering a header with no panel under it; same reasoning
 * as the WALLET_SECTIONS fallback in wallet-app.tsx.
 */
function resolveCategory(requested: SettingsCategory): SettingsCategory {
  return SETTINGS_CATEGORIES.some((entry) => entry.id === requested)
    ? requested
    : (SETTINGS_CATEGORIES[0]?.id ?? "about");
}

/**
 * The categories, in the narrow column.
 *
 * Same shape as every other app's contextual sidebar — a flat list of
 * destinations that change the canvas — so Settings is one more thing the rail
 * opens rather than a mode with its own rules.
 */
export function SettingsSidebar(): ReactNode {
  const {
    settingsCategory: requestedCategory,
    setSettingsCategory,
    toggleRail,
  } = useHub();
  const settingsCategory = resolveCategory(requestedCategory);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Padding matches the app sidebars' header, which sits inset from the
          panel's own p-3 while the rows below it run flush. */}
      <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-3">
        {/* The same panel icon the app sidebars use. It was a slider here,
            which is the General category's own mark — two different things
            wearing one icon a few pixels apart. */}
        <button
          type="button"
          onClick={toggleRail}
          aria-label={content.hub.collapsePanel}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-0.5 shrink-0 rounded-md p-1"
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {content.settings.title}
        </h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {SETTINGS_CATEGORIES.map((category) => {
          const active = category.id === settingsCategory;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSettingsCategory(category.id)}
              aria-current={active ? "true" : undefined}
              /* Selection is the tint behind the row, not a recolouring of the
                 words. These rows carry a label and a sentence under it, and
                 turning both accent-coloured made the selected category the
                 least readable thing in the column. */
              className={`focus-ring text-foreground flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                active ? "bg-accent/15" : "hover:bg-surface-hover"
              }`}
            >
              <category.icon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {category.label}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                  {category.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const soon = (): void => {
  toast.info(content.settings.soon);
};

/* ------------------------------------------------------------------ panels */

/**
 * Privacy: who can reach you, what it costs them, and what outlives the chat.
 *
 * The three settings BRC-218 and BRC-169 actually give the user, in one place —
 * `/scope` and `/trolltoll` are commands you can type in a thread, but a policy
 * that only exists as a command is a policy nobody who has not read the grammar
 * will ever find.
 */
export function PrivacyPanel(): ReactNode {
  const copy = content.settings.privacy;
  const settings = useSettings();
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot
  );
  const { openDetailPane } = useHub();
  const generalToll = effects.tolls.find((rule) => !rule.personId)?.sats ?? 0;
  const overrides = Object.keys(effects.conversationChainPolicy).length;

  return (
    <>
      <Group title={copy.reachTitle} hint={copy.reachHint}>
        <Choice<Reach>
          value={effects.reach}
          onPick={(next) => {
            setReach(next);
            toast.success(`${copy.reachSaved} ${next}`);
          }}
          options={[
            {
              id: "everyone",
              label: copy.reachEveryone,
              hint: copy.reachEveryoneHint,
              info: (
                <InfoPopover
                  label={copy.reachExplainLabel}
                  trigger={
                    <Info
                      className="text-muted-foreground size-3.5"
                      aria-hidden="true"
                    />
                  }
                >
                  <span className="block text-xs font-bold">
                    {copy.reachExplainLabel}
                  </span>
                  {copy.reachExplain.map((para) => (
                    <span
                      key={para.slice(0, 24)}
                      className="text-muted-foreground mt-1.5 block text-[11px] leading-relaxed text-pretty"
                    >
                      {para}
                    </span>
                  ))}
                </InfoPopover>
              ),
            },
            {
              id: "contacts",
              label: copy.reachContacts,
              hint: copy.reachContactsHint,
            },
            {
              id: "ecosystem",
              label: copy.reachEcosystem,
              hint: copy.reachEcosystemHint,
            },
            { id: "toll", label: copy.reachToll, hint: copy.reachTollHint },
          ]}
        />
      </Group>

      <Group title={copy.tollTitle} hint={copy.tollHint}>
        <div className="p-2.5">
          <SatsAmount
            label={copy.tollTitle}
            value={generalToll}
            presets={[218, 2180]}
            offLabel={copy.tollOff}
            onPick={(sats) => {
              setToll(undefined, sats === 0 ? null : sats);
              toast.success(sats === 0 ? copy.tollLifted : copy.tollSet);
            }}
          />
        </div>
        {/* Said here because lifting the general toll is the one change people
            assume is total. BRC-218 §5.10(3) requires saying so out loud. */}
        <PerSenderTolls />
      </Group>

      <Group title={copy.chainTitle} hint={copy.chainHint}>
        <Choice<ChainPolicy>
          value={effects.chainPolicy}
          onPick={(next) => {
            setChainPolicy(next);
            toast.success(copy.chainSaved);
          }}
          options={[
            /* `messages` is deliberately absent: making every conversation
               permanent is a decision to take about a room you are looking at,
               which is why it lives in the conversation's own settings. */
            {
              id: "receipts",
              label: content.messages.chain.receipts,
              hint: content.messages.chain.receiptsHint,
              icon: <ReceiptText className="size-3.5" />,
            },
            {
              id: "nothing",
              label: content.messages.chain.nothing,
              hint: content.messages.chain.nothingHint,
              icon: <Link2Off className="size-3.5" />,
            },
          ]}
        />
        <Row
          label={copy.chainPerConversation}
          hint={copy.chainPerConversationHint}
          {...(overrides ? { value: String(overrides) } : {})}
        />
      </Group>

      <Group title={copy.trackingTitle}>
        <Choice<CookiePolicy>
          value={settings.cookies}
          onPick={(next) => setSetting("cookies", next)}
          options={[
            {
              id: "third-party",
              label: copy.cookiesThird,
              hint: copy.cookiesHint,
            },
            { id: "allow", label: copy.cookiesAllow, hint: "" },
            { id: "block", label: copy.cookiesBlock, hint: "" },
          ]}
        />
        <Toggle
          label={copy.trackers}
          hint={copy.trackersHint}
          value={settings.blockTrackers}
          onChange={(next) => setSetting("blockTrackers", next)}
        />
        <Toggle
          label={copy.doNotTrack}
          hint={copy.doNotTrackHint}
          value={settings.sendDoNotTrack}
          onChange={(next) => setSetting("sendDoNotTrack", next)}
        />
      </Group>

      <Group title={copy.quitTitle}>
        <Choice<ClearOnQuit>
          value={settings.clearOnQuit}
          onPick={(next) => setSetting("clearOnQuit", next)}
          options={[
            { id: "nothing", label: copy.clearNothing, hint: "" },
            { id: "history", label: copy.clearHistory, hint: "" },
            { id: "everything", label: copy.clearEverything, hint: "" },
          ]}
        />
      </Group>

      <Group title={copy.dataTitle}>
        <Row
          label={content.mobileBrowser.settings.clearData}
          hint={copy.clearDataHint}
          onClick={() => openDetailPane({ kind: "clear-data", id: "" })}
        />
      </Group>
    </>
  );
}

/**
 * Pairing a phone, as a code you point a camera at.
 *
 * A QR rather than an account form, because there is no account to sign into:
 * pairing here is two devices agreeing to share one identity's keys, and the
 * only secret involved should never be typed into a second screen. The code is
 * decorative in a prototype — same trick the wallet's receive panel uses — but
 * the shape is the real one, so the steps beside it are the actual steps.
 */

function SyncPanel(): ReactNode {
  const copy = content.settings.sync;
  return (
    <section className="border-border bg-surface-raised mb-6 rounded-xl border p-6">
      <div className="flex flex-col items-center gap-4">
        {/* Flips up into place rather than fading in — see `.nexus-flip-in`.
            The whole block turns together, mark included, so the code stays one
            object instead of a card with a badge sliding about on it. */}
        <div className="nexus-flip-in">
          <QrBlock value="nexus-pairing" label={copy.codeLabel}>
            <span className="grid size-11 place-items-center rounded-xl bg-white ring-4 ring-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/nexus.png"
                alt=""
                aria-hidden="true"
                className="size-9 rounded-lg object-contain"
              />
            </span>
          </QrBlock>
        </div>

        <h3 className="text-center text-base font-bold text-pretty">
          {copy.title}
        </h3>

        <ol className="w-full max-w-xs space-y-2.5">
          {[copy.step1, copy.step2, copy.step3].map((step, index) => (
            <li key={step} className="flex items-start gap-2.5">
              <span
                className="bg-accent text-accent-foreground mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="text-sm text-pretty">{step}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={soon}
          className="focus-ring text-accent rounded-md px-2 py-1 text-sm font-semibold hover:underline"
        >
          {copy.hasApp}
        </button>
      </div>
    </section>
  );
}

/**
 * Which engine the address bar asks.
 *
 * A row that opens the list rather than a row that says "coming soon", because
 * this is the one setting in a browser that decides who watches you type. Each
 * entry carries a line on what it costs you, which is the part a name alone
 * never says: "DuckDuckGo" and "Google" look like the same kind of choice until
 * somebody tells you they are not.
 */
function SearchEnginePicker(): ReactNode {
  const mobile = content.mobileBrowser.settings;
  const [open, setOpen] = useState(false);
  const [engineId, setEngineId] = useState(searchEngines[0]!.id);
  const engine = getSearchEngine(engineId) ?? searchEngines[0]!;

  return (
    <>
      <Row
        label={mobile.searchEngine}
        value={engine.name}
        onClick={() => setOpen(true)}
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label={mobile.searchEngine}
      >
        <div className="p-1.5">
          {searchEngines.map((option) => {
            const active = option.id === engine.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setEngineId(option.id);
                  setOpen(false);
                }}
                className={`focus-ring flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors ${
                  active ? "bg-accent/15" : "hover:bg-surface-hover"
                }`}
              >
                {/* Its own mark, fetched from the engine's own host. A row of
                    hand-drawn approximations of other people's logos is worse
                    than no logos at all. */}
                {option.iconSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={option.iconSrc}
                    alt=""
                    aria-hidden="true"
                    width={22}
                    height={22}
                    className="mt-0.5 size-5.5 shrink-0 rounded"
                  />
                ) : (
                  <Favicon
                    url={`https://${option.host}`}
                    letter={option.name.slice(0, 1)}
                    color={option.color}
                    size={22}
                    rounded="rounded"
                    className="mt-0.5"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {option.name}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                    {option.hint}
                  </span>
                </span>
                {active && (
                  <Check
                    className="text-foreground mt-1 size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

export function GeneralPanel(): ReactNode {
  const copy = content.settings.general;
  const mobile = content.mobileBrowser.settings;
  const settings = useSettings();
  const { openDetailPane } = useHub();
  return (
    <>
      <SyncPanel />
      <Group title={mobile.startupTitle}>
        <Choice<StartupBehaviour>
          value={settings.startup}
          onPick={(next) => setSetting("startup", next)}
          options={[
            { id: "continue", label: mobile.startupContinue, hint: "" },
            { id: "new-tab", label: mobile.startupNewTab, hint: "" },
            { id: "home", label: mobile.startupHome, hint: "" },
          ]}
        />
        <Toggle
          label={mobile.restoreProfile}
          hint={mobile.restoreProfileHint}
          value={settings.restoreProfile}
          onChange={(next) => setSetting("restoreProfile", next)}
        />
      </Group>
      <Group title={copy.searchTitle}>
        <SearchEnginePicker />
        <Row
          label={mobile.languages}
          hint={mobile.languagesHint}
          value={getLanguage(settings.language)?.name ?? settings.language}
          onClick={() => openDetailPane({ kind: "languages", id: "" })}
        />
      </Group>
      <Group title={copy.linksTitle}>
        <Choice<OpenLinksIn>
          value={settings.openLinksIn}
          onPick={(next) => setSetting("openLinksIn", next)}
          options={[
            {
              id: "nexus",
              label: mobile.openLinksNexus,
              hint: mobile.openLinksInHint,
            },
            { id: "native", label: mobile.openLinksNative, hint: "" },
          ]}
        />
        {/* A toggle rather than a button that says "Set…": the state it puts
            you in is one you can be in already, and a button offering to do
            what is already done is the commonest lie in a settings page. */}
        <Toggle
          label={mobile.setDefault}
          hint={mobile.setDefaultHint}
          value={settings.defaultBrowser}
          onChange={(next) => {
            setSetting("defaultBrowser", next);
            toast.success(
              next ? mobile.setDefaultToast : mobile.setDefaultUndone
            );
          }}
        />
      </Group>
      {/* No "Sync with Nexus Desktop" row: the panel at the top of this page is
          that, and a link to the thing you are already looking at is furniture. */}
      <Group title={copy.deviceTitle}>
        <Choice<string>
          value={settings.appIcon}
          onPick={(next) => {
            setSetting("appIcon", next);
            toast.success(mobile.iconToast, {
              description: APP_ICONS.find((icon) => icon.id === next)?.label,
            });
          }}
          options={APP_ICONS.map((icon) => ({
            id: icon.id,
            label: icon.label,
            hint: icon.id === settings.appIcon ? mobile.changeIconHint : "",
          }))}
        />
        <Toggle
          label={mobile.autoKeyboard}
          value={settings.autoKeyboard}
          onChange={(next) => setSetting("autoKeyboard", next)}
        />
        {/* Steps rather than a button: nothing in a web app can put an icon on
            a home screen, and a control that cannot do what it says is worse
            than an instruction that admits it. */}
        <Row label={mobile.addToHome} hint={mobile.addToHomeNote} />
      </Group>
    </>
  );
}

export function BrowsingPanel(): ReactNode {
  const copy = content.settings.browsing;
  const settings = useSettings();
  const mobile = content.mobileBrowser.settings;
  const { openDetailPane } = useHub();
  return (
    <>
      <Group title={copy.sitesTitle}>
        <Row
          label={mobile.globalSiteSettings}
          hint={content.settings.sites.title}
          onClick={() => openDetailPane({ kind: "sites", id: "" })}
        />
      </Group>
      <Group title={copy.tabsTitle}>
        <Steps
          label={mobile.archiveInactive}
          value={settings.archiveAfter}
          options={[0, 1, 7, 30]}
          format={(n) =>
            n === 0
              ? mobile.archiveNever
              : n === 1
                ? mobile.archiveDay
                : n === 7
                  ? mobile.archiveWeek
                  : mobile.archiveMonth
          }
          onPick={(next) => setSetting("archiveAfter", next as ArchiveAfter)}
        />
        <Row label={mobile.archive} hint={mobile.archiveEmptyHint} value="0" />
      </Group>
      <Group title={copy.filesTitle}>
        {/* Its own pane rather than a jump to the rail's panel: the question
            that brings somebody here is "where did that file go", and the rail
            only ever shows the profile you are browsing in. */}
        <Row
          label={mobile.downloads}
          hint={copy.downloadsHint}
          value={`${getDownloads().length}`}
          onClick={() => openDetailPane({ kind: "downloads", id: "" })}
        />
      </Group>
      <Group title={copy.readingTitle}>
        {/* Steps rather than a slider: a slider invites a value nobody wants,
            and these are the sizes a page is actually readable at. */}
        <Steps
          label={copy.zoom}
          value={settings.zoom}
          options={[80, 90, 100, 110, 125, 150]}
          format={(n) => `${n}%`}
          onPick={(next) => setSetting("zoom", next)}
        />
        <Steps
          label={copy.fontSize}
          value={settings.fontSize}
          options={[14, 16, 18, 20]}
          format={(n) => `${n}px`}
          onPick={(next) => setSetting("fontSize", next)}
        />
        <Toggle
          label={copy.pdfs}
          hint={copy.pdfsHint}
          value={settings.openPdfsInNexus}
          onChange={(next) => setSetting("openPdfsInNexus", next)}
        />
        <Toggle
          label={copy.translate}
          hint={copy.translateHint}
          value={settings.translateOffer}
          onChange={(next) => setSetting("translateOffer", next)}
        />
      </Group>

      {/* Off by default, and grouped as its own thing rather than mixed in with
          tabs and files: every switch in here widens what a page is allowed to
          see, which is a different kind of decision from where downloads go. */}
      <Group title={copy.devTitle} hint={copy.devHint}>
        <Toggle
          label={copy.devToolsLabel}
          hint={copy.devToolsHint}
          value={settings.devTools}
          badge={copy.devToolsShortcut}
          onChange={(next) => {
            setSetting("devTools", next);
            toast.success(next ? copy.devToolsOn : copy.devToolsOff, {
              ...(next ? { description: copy.devWarn } : {}),
            });
          }}
        />
        <Toggle
          label={copy.devOverlayLabel}
          hint={copy.devOverlayHint}
          value={settings.overlayInspector}
          onChange={(next) => setSetting("overlayInspector", next)}
        />
        <Toggle
          label={copy.devUnsafeLabel}
          hint={copy.devUnsafeHint}
          value={settings.unsignedRepos}
          onChange={(next) => setSetting("unsignedRepos", next)}
        />
      </Group>
    </>
  );
}

/**
 * Light, dark, or whatever the device says.
 *
 * Icons alone. Three words next to three unmistakable pictures is the kind of
 * label that only adds width, and this control is the same in every product a
 * reader has used.
 */
function ModePicker(): ReactNode {
  const copy = content.settings.appearance;
  const { activeSpaceId } = useHub();
  const { profileMode, setProfileMode } = useCustomTheme();
  /*
   * Sets the profile's mode, not the document's.
   *
   * This called next-themes directly, which looks right for one frame and is
   * then undone: the theme provider forces the active profile's saved mode
   * whenever it changes, so the picker was fighting a rule that always won and
   * the control simply appeared not to work. Modes belong to a profile here —
   * that is the whole reason a profile can look different from the one next to
   * it — so the picker has to say which profile it is talking about.
   *
   * Auto clears the profile's mode rather than storing "system", which is what
   * hands it back to the operating system.
   */
  const current = profileMode(activeSpaceId) ?? "system";
  const modes: {
    id: "light" | "dark" | "system";
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: "light", label: copy.modeLight, icon: Sun },
    { id: "dark", label: copy.modeDark, icon: Moon },
    { id: "system", label: copy.modeAuto, icon: Monitor },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={copy.themeTitle}
      /* `surface`, not `muted`: in dark those two tokens are the same
             colour, so a muted track on a raised card had no edge at all.
             Surface is a step darker than the card in dark and a step greyer
             in light, which is what an inset track should be in both. */
      className="bg-surface ring-border/60 m-3 grid grid-cols-3 gap-0.5 rounded-lg p-0.5 ring-1"
    >
      {modes.map((mode) => {
        const active = current === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={mode.label}
            title={mode.label}
            onClick={() =>
              setProfileMode(
                activeSpaceId,
                mode.id === "system" ? null : mode.id
              )
            }
            /* Tint behind, glyph unchanged — the house rule. */
            className={`focus-ring flex items-center justify-center rounded-md py-2 transition-colors ${
              active
                ? "bg-accent/20 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <mode.icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export function AppearancePanel(): ReactNode {
  const copy = content.settings.appearance;
  const { spaces, setSpaceThemeColor } = useHub();
  const brandMode = useBrandMode();
  const custom = spaces.filter(
    (space) => space.themeColor && space.themeColor !== DEFAULT_ACCENT
  );

  return (
    <>
      <Group title={copy.themeTitle} hint={copy.themeHint}>
        <ModePicker />
        {/* One look across every profile. Per-profile palettes were a way to
            tell them apart at a glance, and the profile's own name and mark
            already do that without giving each one its own idea of what an
            accent means. */}
        <Row
          label={copy.themeDefault}
          {...(custom.length > 0
            ? {
                value: copy.themeReset,
                onClick: () => {
                  custom.forEach((space) =>
                    setSpaceThemeColor(space.id, DEFAULT_ACCENT)
                  );
                  toast.success(copy.themeResetDone);
                },
              }
            : {})}
        />
      </Group>

      {/* What the reader wants the chain called. The scope note is not
          decoration: a setting that says it renames something had better say
          what it will not rename, or the first person to open the licence and
          find the old name will think it is broken. */}
      <Group title={copy.brandTitle} hint={copy.brandHint}>
        <Choice<BrandMode>
          value={brandMode}
          onPick={setBrandMode}
          options={[
            { id: "bsv", label: BRANDS.bsv.label, hint: BRANDS.bsv.hint },
            {
              id: "bitcoinsv",
              label: BRANDS.bitcoinsv.label,
              hint: BRANDS.bitcoinsv.hint,
            },
          ]}
        />
        <p className="text-muted-foreground border-border/60 border-t px-3 py-2.5 text-[11px] text-pretty">
          {copy.brandScope}
        </p>
      </Group>
    </>
  );
}

/**
 * The version the shell is actually running, for a build that has one.
 *
 * `currentRelease` is the fixture release list — the design repository's own
 * numbering, and it describes a different artifact from the binary somebody
 * installed. The number worth quoting in a bug report is the shell manifest's,
 * which tools/version.mjs stamps across every platform from one value per
 * release, so it is asked over the bridge rather than baked into this bundle.
 *
 * Same check-then-subscribe as components/hub/shell-version.tsx, and for the
 * same reason: Android's WebView injects the host client asynchronously (the
 * documented react-native-webview onPageStarted race), so `nexusHost` can turn
 * up after this mounts. A mount-only check leaves the version permanently blank
 * whenever injection loses that race.
 */
type HostInfo = { version?: string; shell?: string; platform?: string };

function HostVersionBlock(): ReactNode {
  const [info, setInfo] = useState<HostInfo | null>(null);

  useEffect(() => {
    let alive = true;
    const ask = (): boolean => {
      const host = (
        window as unknown as { nexusHost?: { info?: () => Promise<HostInfo> } }
      ).nexusHost;
      if (!host?.info) return false;
      host
        .info()
        .then((next) => {
          if (alive) setInfo(next);
        })
        .catch(() => {
          // Better a blank version than a wrong one.
        });
      return true;
    };
    if (ask()) {
      return () => {
        alive = false;
      };
    }
    const onReady = (): void => void ask();
    window.addEventListener("nexushost:ready", onReady, { once: true });
    return () => {
      alive = false;
      window.removeEventListener("nexushost:ready", onReady);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <IdentitySigil
        value={info?.version ?? content.brand.name}
        size={44}
        className="shrink-0 rounded-xl"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {content.brand.name}
          {info?.version ? ` v${info.version}` : ""}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
          {info
            ? `${info.shell ?? "?"} · ${info.platform ?? "?"}`
            : "no shell connected"}
        </span>
      </span>
    </div>
  );
}

/**
 * About: which build this is, and the way into what changed.
 *
 * In demo the version comes from the release list rather than from a constant,
 * so there is one place a release is recorded and no way for the number shown
 * here to disagree with the notes behind it. A live build shows the shell's
 * version instead — the fixture number would describe a different artifact.
 */
export function AboutPanel(): ReactNode {
  const copy = content.settings.about;
  const settings = useSettings();
  const [betaAsk, setBetaAsk] = useState(false);
  const { openDetailPane } = useHub();
  return (
    <>
      <Group title={copy.versionTitle}>
        {!DEMO_SURFACES ? (
          <HostVersionBlock />
        ) : (
          /* Straight to this release's own notes, not the list of every release:
            somebody clicking the build they are running is asking what is in it,
            and the list is one row below if they wanted the others. */
          <button
            type="button"
            onClick={() =>
              openDetailPane({ kind: "release", id: currentRelease.version })
            }
            className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-3 py-3 text-left"
          >
            <IdentitySigil
              value={currentRelease.version}
              size={44}
              className="shrink-0 rounded-xl"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {content.brand.name} v{currentRelease.version}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                {copy.released}{" "}
                <time dateTime={currentRelease.date}>
                  {currentRelease.date}
                </time>{" "}
                · {currentRelease.headline}
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
          </button>
        )}
        <Row
          label={copy.whatsNew}
          hint={copy.whatsNewHint}
          value={`${releases.length}`}
          onClick={() => openDetailPane({ kind: "releases", id: "" })}
        />
      </Group>

      <Group title={copy.channelTitle} hint={copy.channelHint}>
        {/* Stable is one click; Beta asks first. The asymmetry is the point —
            going back is free and going forward is the decision. */}
        <Choice<"stable" | "beta">
          value={settings.updateChannel}
          onPick={(next) => {
            if (next === settings.updateChannel) return;
            if (next === "beta") {
              setBetaAsk(true);
              return;
            }
            setSetting("updateChannel", next);
            /* Coming back gets a line too, so the safe choice is not the
               silent one. A lock rather than a tick: what you are getting is
               not confirmation, it is the build we have hammered on longest. */
            toast.success(copy.stableDone, {
              icon: <span aria-hidden="true">🔒</span>,
            });
          }}
          options={[
            { id: "stable", label: copy.channelStable, hint: "" },
            { id: "beta", label: copy.channelBeta, hint: "" },
          ]}
        />
      </Group>

      {betaAsk && (
        <BetaDialog
          onCancel={() => setBetaAsk(false)}
          onConfirm={() => {
            setSetting("updateChannel", "beta");
            setBetaAsk(false);
            /* The dialog's rocket carries through to the confirmation, in
               place of the tick every other toast gets: the tick says a thing
               worked, and this one is going somewhere. */
            toast.success(copy.betaDone, {
              icon: <span aria-hidden="true">🚀</span>,
            });
          }}
        />
      )}
    </>
  );
}

/** The Swiss flag: red square, white cross. Small enough to be a word. */
function SwissFlag(): ReactNode {
  return (
    <svg
      viewBox="0 0 32 32"
      className="inline size-3.5 rounded-[3px]"
      aria-hidden="true"
    >
      <rect width="32" height="32" fill="#DA291C" />
      <rect x="13" y="6" width="6" height="20" fill="#fff" />
      <rect x="6" y="13" width="20" height="6" fill="#fff" />
    </svg>
  );
}

/**
 * Who made this, at the foot of About.
 *
 * The same line the landing page signs off with, so the product and the page
 * that sells it say it the same way. About only: this is the category that is
 * already about provenance, and repeating a colophon under the theme picker
 * makes it furniture rather than a signature.
 *
 * The reds are fixed hex rather than tokens: a Swiss flag and a heart are the
 * colours they are, and re-tinting them per theme would make them something
 * else.
 */
function SettingsFooter(): ReactNode {
  const copy = content.settings.footer;
  const { openDetailPane } = useHub();
  const brand = useBrand();
  const link =
    "hover:text-foreground underline decoration-transparent transition-colors hover:decoration-current";
  return (
    /* Stacked and centred rather than split left and right: the landing page has
       a full page width to put those two ends of, and in a 2xl settings column
       they collide and wrap mid-phrase. Centring holds the block together as one
       colophon instead of four ragged lines against the left edge. */
    <footer className="border-border/60 text-muted-foreground mt-8 flex flex-col items-center gap-1.5 border-t pt-5 text-center text-[11px]">
      <p className="flex flex-wrap items-center justify-center gap-x-1.5">
        <span>{copy.creed}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          {copy.madeWith}
          {/* `fill` as a prop, not a utility: lucide ships `fill="none"` on the
              svg, and a solid heart is the point of it. */}
          <Heart
            className="size-3 text-[#DA291C]"
            fill="currentColor"
            aria-hidden="true"
          />
          {copy.madeIn} <SwissFlag /> {copy.country}
        </span>
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-1.5">
        {/* The lockup, under the promise it is making. What the product is for
            is worth more of the reader's attention than what it is called. */}
        <span className="text-foreground font-semibold">
          {content.brand.name}
        </span>
        <span aria-hidden="true">/</span>
        <span>{content.brand.slogan}</span>
        <span aria-hidden="true">·</span>
        {/* In the app, not out to GitHub: the terms that bind you are the ones
            shipped with the copy you are running, and a page on a server can
            change after you install. The pane links out to the canonical copy
            for anybody who wants to check the two agree. */}
        <button
          type="button"
          onClick={() => openDetailPane({ kind: "licence", id: "" })}
          className={`focus-ring rounded ${link}`}
        >
          {copy.copyright} {licence.short}
        </button>
      </p>
      {/* Both credits on their own row: the lockup line is this product's own
          signature, and who it is from is a separate claim. */}
      <p className="flex flex-wrap items-center justify-center gap-x-1.5">
        <a
          href={copy.associationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 ${link}`}
        >
          {/* The association's own favicon rather than a generic verified tick:
              a mark somebody else controls says who this is, where a check we
              draw ourselves only says we approve of them. */}
          <Favicon
            url={copy.associationUrl}
            letter="B"
            color="#1d9bf0"
            size={14}
          />
          {copy.association}
        </a>
        <span aria-hidden="true">·</span>
        <a
          href={copy.networkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          {copy.poweredBy} {brand.name}
        </a>
      </p>
      {/* The BRC authors get their own line rather than a clause on the end of
          somebody else's. Nothing in this client is its own invention: every
          verb it speaks is a standard somebody else wrote down first. */}
      <p>
        {copy.thanksBefore}{" "}
        <a
          href={copy.thanksUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          {copy.thanksLink}
        </a>
        {copy.thanksAfter}
      </p>
    </footer>
  );
}

/**
 * The settings canvas.
 *
 * One panel per category, chosen by the sidebar — the same split every app in
 * the hub uses, so the rail's gear lands somewhere that already feels like the
 * rest of the product.
 */
export function SettingsApp(): ReactNode {
  const { settingsCategory: requestedCategory } = useHub();
  const settingsCategory = resolveCategory(requestedCategory);
  const category = SETTINGS_CATEGORIES.find(
    (entry) => entry.id === settingsCategory
  );

  return (
    /* `overscroll-contain` so a flick that reaches the end of settings does not
       carry on and scroll the shell behind it — the usual annoyance on a phone,
       where the two scrollers are the same gesture. */
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
        <header className="mb-5">
          <h1 className="text-lg font-bold">{category?.label}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
            {category?.hint}
          </p>
        </header>
        {/* Ours, and the one panel here that is live rather than drawn: keys,
            network and BRC-157 backup all reach @nexus/wallet-core. It sits
            first because on a shipping build it is the only reason to open
            Settings at all. */}
        {settingsCategory === "wallet" && <WalletSettingsPanel />}
        {settingsCategory === "general" && <GeneralPanel />}
        {settingsCategory === "privacy" && <PrivacyPanel />}
        {settingsCategory === "permissions" && <PermissionsPanel />}
        {settingsCategory === "autofill" && <AutofillPanel />}
        {settingsCategory === "browsing" && <BrowsingPanel />}
        {settingsCategory === "shortcuts" && <ShortcutsPanel />}
        {settingsCategory === "appearance" && <AppearancePanel />}
        {settingsCategory === "about" && <AboutPanel />}
        {/* About only: the colophon belongs with provenance, not under the
            theme picker. */}
        {settingsCategory === "about" && <SettingsFooter />}
      </div>
    </div>
  );
}
