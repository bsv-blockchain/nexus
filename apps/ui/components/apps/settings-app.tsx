"use client";

import { Favicon } from "@/components/hub/favicon";
import { AppHelpBar } from "@/components/hub/app-help-bar";
import { IdentitySigil } from "@/components/hub/identity-sigil";
import { QrBlock } from "@/components/hub/qr-block";
import { ShellVersion } from "@/components/hub/shell-version";
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
  getLinkedDevices,
  getLanguage,
  getSearchEngine,
  licence,
  releases,
  searchEngines,
  type LinkedDevice,
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
import {
  DeveloperOnly,
  setDeveloperMode,
  useDeveloperMode,
} from "@/lib/developer-mode";
import { resetFirstRun } from "@/lib/first-run";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { startTour } from "@/lib/tour-store";
import { AutofillPanel } from "@/components/apps/settings/autofill-panel";
import { SettingsSearch } from "@/components/apps/settings/settings-search";
import { UpdatePanel } from "@/components/apps/settings/update-panel";
import { PermissionsPanel } from "@/components/apps/settings/permissions-panel";
import { ProfilesPanel } from "@/components/apps/settings/profiles-panel";
import { SecurityPanel } from "@/components/apps/settings/security-panel";
import { ShortcutsPanel } from "@/components/apps/settings/shortcuts-panel";
import {
  setSetting,
  useSettings,
  type ArchiveAfter,
  type ClearOnQuit,
  type CookiePolicy,
  type OpenLinksIn,
  type StartupBehaviour,
  type TabLayout,
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
  ArrowLeftRight,
  Check,
  ChevronRight,
  Columns3,
  Globe,
  Moon,
  Heart,
  Info,
  KeyRound,
  Keyboard,
  Lock,
  UserRound,
  Link2Off,
  Monitor,
  PanelLeftClose,
  Laptop,
  LogOut,
  ReceiptText,
  ScanLine,
  Smartphone,
  Rows3,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useUsdPerBsv } from "@/lib/exchange-rate";
import { agoLabel } from "@/lib/timeline";
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
    /* Below General and above Security: this is who you are, and the two
       under it are who can get in and what they may see. */
    id: "profiles",
    label: content.profilesPanel.title,
    hint: content.profilesPanel.hint,
    icon: UserRound,
  },
  {
    /* Above Privacy on purpose: this decides who can get in at all, and
       Privacy decides what they see once they have. */
    id: "security",
    label: content.security.title,
    hint: content.security.hint,
    icon: Lock,
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
    /* Under Preferences rather than beside Privacy, though it borrows from
       both. Privacy is who can reach you; Permissions is what a site may do;
       this is what happens to money either way, and it is the one somebody
       comes looking for by name. */
    id: "payments",
    label: content.settings.payments.title,
    hint: content.settings.payments.hint,
    icon: ArrowLeftRight,
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
  "profiles",
  /* Demo only, like the rest of this list: the flows behind it register keys
     and phones that do not exist, which is exactly the kind of control a live
     build must not offer. */
  "security",
  "privacy",
  "permissions",
  "autofill",
  "browsing",
  "shortcuts",
  "appearance",
  "payments",
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
/**
 * What each Settings category is for, and the way into it.
 *
 * Built from `SETTINGS_CATEGORIES` rather than written out again in lib/data,
 * which is where every other guide lives. Two reasons: the list is filtered per
 * build — Wallet only exists in a live one — so a fixture copy would describe
 * categories this install does not have; and a hand-written second list is a
 * list that goes stale the first time somebody adds a category and forgets.
 *
 * Each row opens the thing it describes. A guide you have to read and then go
 * and find the subject of is a guide that has made you do the work twice.
 */
function SettingsGuidePane(): ReactNode {
  const { settingsCategory, setSettingsCategory } = useHub();
  const current = resolveCategory(settingsCategory);
  const copy = content.settings.guide;

  return (
    <div>
      <div className="border-border/60 border-b p-4">
        <p className="text-muted-foreground text-[11px] leading-relaxed text-pretty">
          {copy.blurb}
        </p>
      </div>
      <ul className="divide-border/60 divide-y">
        {SETTINGS_CATEGORIES.map(({ id, label, hint, icon: Icon }) => {
          const here = id === current;
          return (
            <li key={id} className="flex items-start gap-2.5 p-4">
              <span className="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-lg">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed text-pretty">
                  {hint}
                </p>
                {/* The one you are already reading says so rather than
                    offering to take you where you are. */}
                <button
                  type="button"
                  disabled={here}
                  onClick={() => setSettingsCategory(id)}
                  className="focus-ring border-border hover:bg-surface-hover mt-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:pointer-events-none disabled:opacity-45"
                >
                  {here ? copy.here : copy.open.replace("{name}", label)}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SettingsGuide(): ReactNode {
  return <SettingsGuidePane />;
}

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
      {/* Above the list rather than filtering it. Settings is eleven
          categories deep and the one thing somebody hunting a setting does not
          know is which of them it is under. */}
      <div className="px-1.5">
        <SettingsSearch />
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
      {/* The same bar every app's column ends with, so the way into a guide is
          in one place across the shell rather than in one place per screen.
          Nothing on the left of it: Settings has no second control to put
          there, and an empty slot is not a reason to invent one. */}
      <AppHelpBar slug="settings" pane={{ kind: "settings-guide", id: "" }} />
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
/**
 * A price in cents, and what that is in satoshis right now.
 *
 * Both, together, because neither is the whole answer: a cent is what somebody
 * decides to charge and satoshis are what actually moves, and showing only the
 * second turns a policy into a number that quietly means something different
 * every week. The rate comes from WhatsOnChain — the same feed the wallet
 * prices with, so two screens in this app never disagree about what a coin is
 * worth — and the line says so, because a conversion whose source is invisible
 * is a conversion nobody can check.
 *
 * Greyed rather than hidden when strangers are not being charged. The setting
 * above is what turns it on, and a section that vanishes when you pick the
 * wrong option teaches nobody that the two are connected.
 */
function StrangerFee({ active }: { active: boolean }): ReactNode {
  const copy = content.settings.privacy;
  const settings = useSettings();
  /* Subscribing is what starts the fetch — see lib/exchange-rate. Without it
     this renders the fallback rate and never corrects. */
  const usdPerBsv = useUsdPerBsv();
  const cents = settings.strangerFeeCents;
  const sats = Math.round((cents / 100 / usdPerBsv) * 100_000_000);

  return (
    <div className={`p-2.5 ${active ? "" : "opacity-55"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {[1, 5, 10, 25].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setSetting("strangerFeeCents", preset)}
            aria-pressed={cents === preset}
            className={`focus-ring rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors ${
              cents === preset
                ? "border-accent bg-accent/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {preset === 100 ? "$1" : `${preset}\u00a2`}
          </button>
        ))}
        <span className="text-muted-foreground ml-1 text-xs tabular-nums">
          &asymp; {sats.toLocaleString("en-US")} sats
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-[11px] text-pretty">
        {copy.feeRate.replace(
          "{rate}",
          usdPerBsv.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          }),
        )}
        {" \u00b7 "}
        {active ? copy.feeApplies : copy.feeIdle}
      </p>
    </div>
  );
}

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

      {/* Above the per-message toll, because it is the number that toll is a
          departure FROM: this is what everybody pays, and the group below is
          who pays something else. */}
      <Group title={copy.feeTitle} hint={copy.feeHint}>
        <StrangerFee active={effects.reach === "toll"} />
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
 * Pairing a phone, from whichever end you are holding.
 *
 * A QR rather than an account form, because there is no account to sign into:
 * pairing here is two devices agreeing to share one identity's keys, and the
 * only secret involved should never be typed into a second screen. The code is
 * decorative in a prototype — same trick the wallet's receive panel uses — but
 * the shape is the real one, so the steps beside it are the actual steps.
 *
 * Which is exactly why the phone gets a different half. A code is shown by one
 * device and read by another; a phone showing one is asking a laptop to hold
 * itself up to a phone. So on a narrow screen this is a button that opens the
 * camera, and the steps point at the desktop instead.
 */
function SyncPanel(): ReactNode {
  const copy = content.settings.sync;
  const isDesktop = useIsDesktop();
  const { activeSpaceId, openLinkInBrowser } = useHub();
  if (!isDesktop) return <DevicesPanel />;
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
                src="/icons/Nexus-logo-solid-BG2.png"
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

        {/* Opens in a tab rather than toasting "soon": there is a real place
            to send somebody who has no phone client yet, and it is the client
            itself. */}
        <button
          type="button"
          onClick={() =>
            openLinkInBrowser(activeSpaceId, `https://${copy.getAppUrl}`)
          }
          className="focus-ring text-accent rounded-md px-2 py-1 text-sm font-semibold hover:underline"
        >
          {copy.hasApp}
        </button>
      </div>
    </section>
  );
}

/**
 * The phone's half of pairing: the register, not the code.
 *
 * Reworked from a card that offered "Scan the code on your desktop", which is
 * an instruction rather than a screen — it told somebody to go and do a thing
 * and gave them nowhere to come back to. The question a person opens this to
 * ask is not "how do I scan" but "what is signed in as me, and how do I stop
 * one of them", and that has an answer with a shape every messenger already
 * uses. This is Telegram's: linking at the top, this device below it, then
 * everything else with a way to end each one.
 *
 * The desktop keeps the QR, because a code is displayed by one device and read
 * by the other and the desktop is the one with a screen to hold still.
 */
function DevicesPanel(): ReactNode {
  const copy = content.settings.sync;
  const devices = getLinkedDevices();
  const here = devices.find((device) => device.current);
  const others = devices.filter((device) => !device.current);

  return (
    <section className="mb-6 space-y-3">
      {/* The action first, and as a whole row rather than a link at the foot
          of a list: linking a device is what somebody came here to do, and it
          is the one thing on this screen that adds rather than removes. */}
      <button
        type="button"
        onClick={soon}
        className="focus-ring border-border bg-surface-raised hover:bg-surface-hover flex w-full items-center gap-3 rounded-xl border p-3 text-left"
      >
        <span
          className="bg-accent/12 text-accent grid size-10 shrink-0 place-items-center rounded-xl"
          aria-hidden="true"
        >
          <ScanLine className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-accent block text-sm font-bold">
            {copy.linkDevice}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
            {copy.linkDeviceHint}
          </span>
        </span>
      </button>

      {here && (
        <Group title={copy.thisDevice}>
          <DeviceRow device={here} />
        </Group>
      )}

      <Group title={copy.otherDevices}>
        {others.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2.5 text-xs">
            {copy.noOthers}
          </p>
        ) : (
          <>
            {others.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
            {/* Last, and worded as "all other" every time it is mentioned.
                This is the button somebody presses when they think they have
                been compromised, and the one thing they must not fear is that
                it signs out the device they are pressing it on. */}
            <button
              type="button"
              onClick={() => toast.success(copy.endOthersDone)}
              className="focus-ring text-negative hover:bg-surface-hover w-full px-3 py-2.5 text-left text-sm font-medium"
            >
              {copy.endOthers}
            </button>
          </>
        )}
      </Group>
    </section>
  );
}

/** One signed-in place: what it is, where it is, and when it last spoke. */
function DeviceRow({ device }: { device: LinkedDevice }): ReactNode {
  const copy = content.settings.sync;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span
        className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg"
        aria-hidden="true"
      >
        {device.platform.toLowerCase().includes("ios") ? (
          <Smartphone className="size-4" />
        ) : (
          <Laptop className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {device.label}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
          {device.platform} · {device.place}
        </span>
      </span>
      {device.lastActiveMinutes === null ? (
        <span className="text-positive shrink-0 text-[11px] font-medium">
          {copy.online}
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground text-[11px]">
            {agoLabel(device.lastActiveMinutes)}
          </span>
          <button
            type="button"
            onClick={() => toast.success(`${copy.endSessionDone} ${device.label}`)}
            aria-label={`${copy.endSession} ${device.label}`}
            className="focus-ring text-muted-foreground hover:text-negative rounded-md p-1"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
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
      {/* Above Sites and Tabs because it decides whether Browse is a thing you
          have at all before either of them describes how it behaves. */}
      <Group title={copy.browseTitle}>
        <Toggle
          label={copy.browseAsButtonLabel}
          hint={copy.browseAsButtonHint}
          value={settings.browseAsButton}
          onChange={(next) => setSetting("browseAsButton", next)}
        />
      </Group>
      <Group title={copy.sitesTitle}>
        <Row
          label={mobile.globalSiteSettings}
          hint={content.settings.sites.title}
          onClick={() => openDetailPane({ kind: "sites", id: "" })}
        />
      </Group>
      <Group title={copy.tabsTitle}>
        {/* Above archiving, because it decides WHERE the tabs being archived
            are drawn — answering "which list are we talking about" before the
            question about that list. */}
        <Choice<TabLayout>
          value={settings.tabLayout}
          options={[
            {
              id: "horizontal",
              label: copy.tabLayoutHorizontal,
              hint: copy.tabLayoutHorizontalHint,
              icon: <Rows3 className="size-4" aria-hidden="true" />,
            },
            {
              id: "vertical",
              label: copy.tabLayoutVertical,
              hint: copy.tabLayoutVerticalHint,
              icon: <Columns3 className="size-4" aria-hidden="true" />,
            },
          ]}
          onPick={(next) => setSetting("tabLayout", next)}
        />
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

/**
 * The switches the master carries with it.
 *
 * Listed once so adding a fourth tool is one edit rather than three: the group
 * renders them, this turns them on and off with the mode.
 */
const DEV_TOOLS = ["devTools", "overlayInspector", "unsignedRepos"] as const;

export function AppearancePanel(): ReactNode {
  const copy = content.settings.appearance;
  /* The three moved switches kept their own copy where it was — they are the
     same switches, and rewriting their descriptions to sit under a new heading
     would have made them look like new features. */
  const browsing = content.settings.browsing;
  const settings = useSettings();
  const developer = useDeveloperMode();
  const [confirmReplay, setConfirmReplay] = useState(false);
  const {
    spaces,
    setSpaceThemeColor,
    isInstalled,
    installApp,
    uninstallApp,
    mainView,
    setMainView,
  } = useHub();
  const brandMode = useBrandMode();
  /* The rail only exists above the `md` breakpoint — below it the tab bar along
     the bottom is the navigation — so a switch about what the rail holds has
     nothing to say on a phone. Hidden rather than disabled: a control that
     cannot do anything here is not a control, it is a claim. */
  const isDesktop = useIsDesktop();
  const custom = spaces.filter(
    (space) => space.themeColor && space.themeColor !== DEFAULT_ACCENT
  );

  return (
    <>
      {/* First, because it is the only thing on this page that changes what the
          window looks like rather than what it is coloured. */}
      {/* Above the rail, because it answers the bigger question: what you see
          when the window opens, rather than what is down the side of it. */}
      <Group title={copy.homeTitle} hint={copy.homeHint}>
        <Choice
          value={settings.homescreen}
          onPick={(next) => {
            setSetting("homescreen", next);
            /*
             * Asking for the Timeline is asking for there to BE one.
             *
             * The two switches in this group can contradict each other: promote
             * the Timeline to an app, disconnect it, then choose it here, and
             * the answer was silently ignored — `homeView` has nothing to show,
             * so it keeps handing back Focus. Picking it as your homescreen is
             * unambiguous, so it reconnects rather than arguing.
             */
            if (next === "timeline" && !isInstalled("timeline")) {
              installApp("timeline");
            }
            /*
             * And go there, if you are looking at the other one.
             *
             * The setting decides what Home MEANS, and `?view=home` and
             * `?view=timeline` each name one of them outright — so answering
             * the question while standing on the losing screen changed
             * everything except what was in front of you. Only when the canvas
             * is already a homescreen: picking a homescreen from Settings is
             * not a request to leave Settings.
             */
            if (mainView === "home" || mainView === "timeline") {
              setMainView(next === "focus" ? "home" : "timeline");
            }
          }}
          options={[
            {
              id: "timeline" as const,
              label: copy.homeTimeline,
              hint: copy.homeTimelineHint,
            },
            {
              id: "focus" as const,
              label: copy.homeFocus,
              hint: copy.homeFocusHint,
            },
          ]}
        />
      </Group>

      {isDesktop && (
        <Group title={copy.railTitle} hint={copy.railHint}>
          <Toggle
            label={copy.railWorkspacesLabel}
            hint={copy.railWorkspacesHint}
            value={settings.workspacesInRail}
            onChange={(next) => setSetting("workspacesInRail", next)}
          />
          {/* Beside it because it is the same question — what the rail holds —
              and because both answers change what the window opens on. */}
          <Toggle
            label={copy.timelineLabel}
            hint={copy.timelineHint}
            value={settings.timelineAsApp}
            onChange={(next) => {
              setSetting("timelineAsApp", next);
              /* Connected on the way in, so the tile it promises is there when
                 the switch finishes moving. Turning it off leaves the listing
                 disconnected rather than deleting it, which is what every other
                 app does and what makes turning it back on cheap. */
              if (next) installApp("timeline");
              else uninstallApp("timeline");
            }}
          />
        </Group>
      )}

      {/* Above the theme, because it is the thing somebody came here to find
          again — a welcome you cannot get back to is a demo you can only give
          once. Demo-gated to match the screen it replays: with fixtures
          compiled out there is no first run to trigger, and a row that does
          nothing is worse than no row. */}
      {DEMO_SURFACES && (
        <Group
          title={content.settings.onboarding.title}
          hint={content.settings.onboarding.hint}
        >
          {/* Asks first. Replaying the welcome rebuilds this workspace's rail
              from whatever presets get picked the second time, which is not
              something to discover after the screen has already taken over. */}
          <Row
            label={content.settings.onboarding.firstRunLabel}
            hint={content.settings.onboarding.firstRunHint}
            value={content.settings.onboarding.replay}
            onClick={() => setConfirmReplay(true)}
          />
          <Sheet
            open={confirmReplay}
            onClose={() => setConfirmReplay(false)}
            label={content.settings.onboarding.confirmTitle}
            footer={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReplay(false)}
                  className="focus-ring ring-border hover:bg-surface-hover flex-1 rounded-full px-4 py-2.5 text-sm font-semibold ring-1"
                >
                  {content.settings.onboarding.confirmCancel}
                </button>
                <button
                  type="button"
                  /* No toast: the welcome takes the whole screen the moment
                     this is pressed, so a message about it would be covered by
                     the thing it describes. */
                  onClick={() => {
                    setConfirmReplay(false);
                    resetFirstRun();
                  }}
                  className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
                >
                  {content.settings.onboarding.confirmGo}
                </button>
              </div>
            }
          >
            <p className="text-muted-foreground px-6 py-5 text-center text-sm leading-relaxed text-balance">
              {content.settings.onboarding.confirmBody}
            </p>
          </Sheet>
          {/* Named now and empty on purpose: the flow after the first run is
              next, and a section that appears later looks like a setting that
              moved. */}
          {/* Runs the tour again for whatever presets this install was set up
              with — the run is assembled from the saved answer, so it is the
              same tour, not a generic one. */}
          <Row
            label={content.settings.onboarding.flowLabel}
            hint={content.settings.onboarding.flowHint}
            value={content.settings.onboarding.replayTour}
            onClick={startTour}
          />
        </Group>
      )}

      {/*
        Above the theme, because it changes what the rest of Settings — and
        every other app — has in it. A switch that reveals other switches has to
        come before the things it reveals, or the page appears to grow upwards.

        The three it holds came from Browsing. They were grouped there because
        the first one docks a panel under a web page, but the other two were
        never about browsing at all, and a developer hunting for them had to
        guess which app owned them. One place, one switch to find it by.
      */}
      <Group
        title={copy.devTitle}
        hint={copy.devHint}
        tour="settings-developer-tools"
      >
        <Toggle
          label={copy.devModeLabel}
          hint={copy.devModeHint}
          value={developer}
          onChange={(next) => {
            setDeveloperMode(next);
            /*
             * The master carries the three with it, both ways.
             *
             * Revealing three switches that are all off would make turning the
             * mode on do nothing visible, and leaving them on after the mode
             * goes off would strand a page inspector with no setting on screen
             * that explains it. So the master is the state, and these follow.
             */
            for (const key of DEV_TOOLS) setSetting(key, next);
            toast.success(next ? copy.devModeOn : copy.devModeOff, {
              ...(next ? { description: copy.devModeOnHint } : {}),
            });
            /* Two of the three live inside Browse. Offered, not done: an app
               that connects itself because you opened a settings switch is a
               worse surprise than a prompt you can ignore. */
            if (next && !isInstalled("browser")) {
              toast(copy.devNeedsBrowse, {
                description: copy.devNeedsBrowseHint,
                action: {
                  label: copy.devConnectBrowse,
                  /* Straight to `installApp`, which is the same call the
                     permission sheet makes once you approve it. The sheet asks
                     what an app may do; you have just said what you want, and
                     asking again in a modal would be asking twice. */
                  onClick: () => {
                    installApp("browser");
                    toast.success(copy.devBrowseConnected);
                  },
                },
              });
            }
          }}
        />
        {/*
          The individual tools, revealed by the switch above.

          Rendered inside the same group rather than in one of their own: they
          are what the switch is for, and a second card appearing below would
          read as an unrelated section that happened to arrive at the same
          moment. `DeveloperOnly` is the same gate every other app will use.
        */}
        <DeveloperOnly>
          <Toggle
            label={browsing.devToolsLabel}
            hint={browsing.devToolsHint}
            value={settings.devTools}
            badge={browsing.devToolsShortcut}
            onChange={(next) => {
              setSetting("devTools", next);
              toast.success(next ? browsing.devToolsOn : browsing.devToolsOff, {
                ...(next ? { description: browsing.devWarn } : {}),
              });
            }}
          />
          <Toggle
            label={browsing.devOverlayLabel}
            hint={browsing.devOverlayHint}
            value={settings.overlayInspector}
            onChange={(next) => setSetting("overlayInspector", next)}
          />
          <Toggle
            label={browsing.devUnsafeLabel}
            hint={browsing.devUnsafeHint}
            value={settings.unsignedRepos}
            onChange={(next) => setSetting("unsignedRepos", next)}
          />
        </DeveloperOnly>
      </Group>

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

      {/*
        Updates.

        This was a Stable/Beta channel picker with a beta-warning dialog, and
        there was nothing behind either of them — a switch with no wire, and a
        dialog warning about a ring nobody could join. UpdatePanel says what the
        updater is actually doing and offers the one action that is the user's,
        which is when to restart. It draws nothing without a shell, so the web
        preview loses a control it could never have honoured anyway.

        Channels come back when there is something on the other end of them;
        settings/beta-dialog.tsx stays in the tree for that day.
      */}
      <UpdatePanel />
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
/**
 * Payments: what arrives, what leaves, and what happens without asking.
 *
 * Two halves, because money moves both ways and the decisions are unrelated.
 * Receiving is about coins that turn up in something other than bitcoin.
 * Spending is the pair that used to sit at the bottom of Permissions — which
 * is the page about whether a site may spend at all, a different question from
 * how much and whether you get asked. Permissions keeps the grant and points
 * here.
 */
export function PaymentsPanel(): ReactNode {
  const copy = content.settings.payments;
  const settings = useSettings();
  const { setSettingsCategory } = useHub();

  return (
    <>
      <Group title={copy.receivingTitle} hint={copy.receivingHint}>
        <Toggle
          label={copy.autoSwap}
          hint={copy.autoSwapHint}
          value={settings.autoSwapToBsv}
          onChange={(next) => setSetting("autoSwapToBsv", next)}
        />
        {/* Said here because a global switch reads as absolute. It sets the
            box in Get paid; it does not weld it. */}
        <p className="text-muted-foreground px-3 py-2.5 text-[11px] text-pretty">
          {copy.autoSwapPerPayment}
        </p>
      </Group>

      <Group title={copy.spendingTitle} hint={copy.spendingHint}>
        {/* First, because it decides whether the cap under it is ever read
            aloud: with this on, a paying action inside the cap happens without
            a prompt. */}
        <Toggle
          label={copy.oneClick}
          hint={copy.oneClickHint}
          value={settings.oneClickPay}
          onChange={(next) => setSetting("oneClickPay", next)}
        />
        <div className="px-3 py-2.5">
          <p className="text-sm font-medium">{copy.spendCap}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
            {copy.spendCapHint}
          </p>
          <div className="mt-2">
            <SatsAmount
              label={copy.spendCap}
              value={settings.spendCapSats}
              presets={SPEND_CAPS}
              offLabel={copy.capAsk}
              onPick={(next) => setSetting("spendCapSats", next)}
            />
          </div>
        </div>
        {/* The other half of the same decision, kept where it belongs. A cap
            means nothing until a site is allowed to spend, so the way to that
            answer is on the screen that states the cap. */}
        <button
          type="button"
          onClick={() => setSettingsCategory("permissions")}
          className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-3 py-2.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{copy.grantsLink}</span>
            <span className="text-muted-foreground mt-0.5 block text-[11px]">
              {copy.grantsHint}
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        </button>
      </Group>
    </>
  );
}

/* Shortcuts either side of what a small purchase costs; the field takes the
   rest. Zero means every payment asks, which is why it reads as "Ask". */
const SPEND_CAPS = [21_800, 218_000];

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
          {/*
            About says which build this is, where every other category says what
            it is for.

            It used to sit in the rail, under the apps, which put a version
            number on screen at all times for the one moment a year somebody
            needs it. This is where they come looking, and the header line was
            spending itself on "Version and what changed" directly above a group
            titled Version.

            The SHELL's version, which is the part the panel below cannot state:
            that group reports the chrome's own release, and these two differ —
            a desktop build carries a chrome it may have shipped a week earlier.
            Renders nothing where no shell answers, which is the honest result in
            a browser: there is no shell to have a version.
          */}
          {settingsCategory === "about" ? (
            <ShellVersion className="mt-0.5" />
          ) : (
            <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
              {category?.hint}
            </p>
          )}
        </header>
        {/* Ours, and the one panel here that is live rather than drawn: keys,
            network and BRC-157 backup all reach @nexus/wallet-core. It sits
            first because on a shipping build it is the only reason to open
            Settings at all. */}
        {settingsCategory === "wallet" && <WalletSettingsPanel />}
        {settingsCategory === "general" && <GeneralPanel />}
        {settingsCategory === "profiles" && <ProfilesPanel />}
        {settingsCategory === "security" && <SecurityPanel />}
        {settingsCategory === "privacy" && <PrivacyPanel />}
        {settingsCategory === "payments" && <PaymentsPanel />}
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
