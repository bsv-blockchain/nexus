"use client";

import { IdentitySigil } from "@/components/hub/identity-sigil";
import { ThemeButton } from "@/components/hub/theme-picker";
import {
  useHub,
  type SettingsCategory,
} from "@/components/hub/hub-provider";
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
import { content, currentRelease, releases } from "@/lib/data";
import { formatSats } from "@/lib/messages";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { WalletSettingsPanel } from "@/components/apps/settings-wallet";
import {
  Globe,
  Info,
  Link2Off,
  Monitor,
  PanelLeftClose,
  ReceiptText,
  ShieldCheck,
  Sliders,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

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
    id: "browsing",
    label: content.settings.browsing.title,
    hint: content.settings.browsing.hint,
    icon: Globe,
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
 * Same split as WALLET_SECTIONS in wallet-app.tsx: the demo keeps the
 * designer's five categories untouched, while a shipping build offers only
 * what a real shell can answer — its wallet, its theme, and what build it is.
 * The demo panels are wired to fixtures and `soon` toasts, which on a live
 * build would be seventeen controls that lie.
 */
const DEMO_CATEGORY_IDS: ReadonlySet<SettingsCategory> = new Set([
  "general",
  "privacy",
  "browsing",
  "appearance",
  "about",
]);
const LIVE_CATEGORY_IDS: ReadonlySet<SettingsCategory> = new Set([
  "wallet",
  "appearance",
  "about",
]);

export const SETTINGS_CATEGORIES = ALL_SETTINGS_CATEGORIES.filter((category) =>
  (DEMO_SURFACES ? DEMO_CATEGORY_IDS : LIVE_CATEGORY_IDS).has(category.id),
);

/**
 * The category to show for a request this build does not carry.
 *
 * The hub's default is `general`, which a live build drops — and hub state can
 * also arrive from an older session. Falling back to the first entry beats
 * rendering a header with no panel under it; same reasoning as the
 * WALLET_SECTIONS fallback in wallet-app.tsx.
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
    <div className="flex h-full min-h-0 flex-col px-1.5 pt-0.5">
      <div className="flex items-center gap-2 pb-3">
        {/* The same panel icon the app sidebars use. It was a slider here,
            which is the General category's own mark — two different things
            wearing one icon a few pixels apart. */}
        <button
          type="button"
          onClick={toggleRail}
          aria-label={content.hub.collapsePanel}
          className="focus-ring -ml-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
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
              className={`focus-ring flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-foreground ${
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

/* ------------------------------------------------------------- building blocks */

export function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && (
        <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
          {hint}
        </p>
      )}
      <div className="border-border divide-border/60 mt-2.5 divide-y overflow-hidden rounded-xl border">
        {children}
      </div>
    </section>
  );
}

/** A row that states a setting and its current value. */
export function Row({
  label,
  hint,
  value,
  onClick,
}: {
  label: string;
  hint?: string;
  value?: string;
  onClick?: () => void;
}): ReactNode {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
            {hint}
          </span>
        )}
      </span>
      {value && (
        <span className="text-muted-foreground shrink-0 text-xs">{value}</span>
      )}
    </>
  );
  if (!onClick) {
    return <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-3 py-2.5 text-left"
    >
      {body}
    </button>
  );
}

/**
 * An exclusive choice, one row per option.
 *
 * The same shape as the on-chain popover in Messages, because it is the same
 * kind of decision: a handful of mutually exclusive settings whose consequences
 * differ enough that each one needs a sentence rather than a label.
 */
export function Choice<T extends string>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: { id: T; label: string; hint: string; icon?: ReactNode }[];
  onPick: (next: T) => void;
}): ReactNode {
  return (
    <div role="radiogroup" className="p-1">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(option.id)}
            className={`focus-ring flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors ${
              selected ? "bg-accent/10" : "hover:bg-surface-hover"
            }`}
          >
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {selected && <span className="bg-current size-1.5 rounded-full" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {/* The radio dot is the only accent in a row: the leading icon
                    is a label for the option, not a second selection marker. */}
                {option.icon && (
                  <span className="text-muted-foreground" aria-hidden="true">
                    {option.icon}
                  </span>
                )}
                {option.label}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                {option.hint}
              </span>
            </span>
          </button>
        );
      })}
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
function PrivacyPanel(): ReactNode {
  const copy = content.settings.privacy;
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
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
            { id: "everyone", label: copy.reachEveryone, hint: copy.reachEveryoneHint },
            { id: "contacts", label: copy.reachContacts, hint: copy.reachContactsHint },
            { id: "ecosystem", label: copy.reachEcosystem, hint: copy.reachEcosystemHint },
            { id: "toll", label: copy.reachToll, hint: copy.reachTollHint },
          ]}
        />
      </Group>

      <Group title={copy.tollTitle} hint={copy.tollHint}>
        <div className="flex flex-wrap items-center gap-1.5 p-2.5">
          {[0, 300, 1000, 5000].map((sats) => {
            const selected = generalToll === sats;
            return (
              <button
                key={sats}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setToll(undefined, sats === 0 ? null : sats);
                  toast.success(sats === 0 ? copy.tollLifted : copy.tollSet);
                }}
                /* Selected is the border and the tint; the amount itself stays
                   readable rather than turning accent-coloured. */
                className={`focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {sats === 0 ? copy.tollOff : formatSats(sats)}
              </button>
            );
          })}
        </div>
        {/* Said here because lifting the general toll is the one change people
            assume is total. BRC-218 §5.10(3) requires saying so out loud. */}
        <Row label={copy.tollPerSender} hint={copy.tollPerSenderHint} />
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

      <Group title={copy.dataTitle}>
        <Row
          label={content.mobileBrowser.settings.clearData}
          hint={copy.clearDataHint}
          onClick={soon}
        />
      </Group>
    </>
  );
}

/** A version-1 QR's module count, so the finder patterns land where they do. */
const QR_SIZE = 21;

/**
 * Whether one module of the decorative pairing code is dark.
 *
 * Not a real encoder — nothing here has anything to encode yet — but the three
 * finder squares are drawn properly, because those are what makes a block of
 * noise read as a QR rather than as a barcode. The rest is a hash of the
 * coordinates: deterministic, so the code does not reshuffle on every render and
 * look like a live token expiring while you line up your camera.
 */
function qrCell(row: number, col: number): boolean {
  const inFinder = (top: number, left: number): boolean =>
    row >= top && row < top + 7 && col >= left && col < left + 7;
  for (const [top, left] of [
    [0, 0],
    [0, QR_SIZE - 7],
    [QR_SIZE - 7, 0],
  ] as const) {
    if (!inFinder(top, left)) continue;
    const r = row - top;
    const c = col - left;
    const ring = r === 0 || r === 6 || c === 0 || c === 6;
    const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
    return ring || core;
  }
  // The one-module gap that separates a finder from the data around it.
  const nearFinder =
    (row < 8 && col < 8) ||
    (row < 8 && col >= QR_SIZE - 8) ||
    (row >= QR_SIZE - 8 && col < 8);
  if (nearFinder) return false;
  const hash = (row * 73856093) ^ (col * 19349663) ^ ((row + col) * 83492791);
  return ((hash >>> 4) & 7) < 4;
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
    <section className="border-border mb-6 rounded-xl border p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className="grid size-44 grid-cols-21 gap-px rounded-2xl bg-white p-2.5"
            role="img"
            aria-label={copy.codeLabel}
          >
            {Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => (
              <span
                key={index}
                className={
                  qrCell(Math.floor(index / QR_SIZE), index % QR_SIZE)
                    ? "bg-black"
                    : "bg-transparent"
                }
              />
            ))}
          </div>
          {/* The mark sits in the middle, as it does on every pairing code
              people have already been trained by. */}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="grid size-11 place-items-center rounded-xl bg-white ring-4 ring-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/nexus.png"
                alt=""
                aria-hidden="true"
                className="size-9 rounded-lg object-contain"
              />
            </span>
          </span>
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
          {copy.byCode}
        </button>
      </div>
    </section>
  );
}

function GeneralPanel(): ReactNode {
  const copy = content.settings.general;
  const mobile = content.mobileBrowser.settings;
  return (
    <>
      <SyncPanel />
      <Group title={copy.searchTitle}>
        <Row
          label={mobile.searchEngine}
          value={mobile.searchEngineValue}
          onClick={soon}
        />
        <Row label={mobile.languages} onClick={soon} />
      </Group>
      <Group title={copy.linksTitle}>
        <Row
          label={mobile.openLinksIn}
          value={mobile.openLinksInValue}
          onClick={soon}
        />
        <Row label={mobile.setDefault} onClick={soon} />
      </Group>
      {/* No "Sync with Nexus Desktop" row: the panel at the top of this page is
          that, and a link to the thing you are already looking at is furniture. */}
      <Group title={copy.deviceTitle}>
        <Row label={mobile.changeIcon} onClick={soon} />
        <Row label={mobile.addToHome} onClick={soon} />
        <Row label={mobile.autoKeyboard} onClick={soon} />
      </Group>
    </>
  );
}

function BrowsingPanel(): ReactNode {
  const copy = content.settings.browsing;
  const mobile = content.mobileBrowser.settings;
  const { setLibraryTab } = useHub();
  return (
    <>
      <Group title={copy.sitesTitle}>
        <Row label={mobile.globalSiteSettings} onClick={soon} />
      </Group>
      <Group title={copy.tabsTitle}>
        <Row
          label={mobile.archiveInactive}
          value={mobile.archiveInactiveValue}
          onClick={soon}
        />
        <Row label={mobile.archive} onClick={soon} />
      </Group>
      <Group title={copy.filesTitle}>
        {/* Goes where the thing itself is rather than reimplementing it here:
            the downloads panel already exists in the rail. */}
        <Row
          label={mobile.downloads}
          hint={copy.downloadsHint}
          onClick={() => setLibraryTab("downloads")}
        />
      </Group>
    </>
  );
}

function AppearancePanel(): ReactNode {
  const copy = content.settings.appearance;
  const { activeSpaceId } = useHub();
  return (
    <Group title={copy.themeTitle} hint={copy.themeHint}>
      <div className="flex items-center gap-3 p-3">
        {/* The picker the browser chrome already uses, so there is one theme
            editor in the product rather than two that can disagree. Themes are
            per profile, which is why it needs to be told which one. */}
        <ThemeButton
          spaceId={activeSpaceId}
          className="focus-ring border-border hover:bg-surface-hover inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
        />
        <span className="text-muted-foreground text-[11px] text-pretty">
          {copy.themeProfile}
        </span>
      </div>
    </Group>
  );
}

type HostInfo = { version?: string; shell?: string; platform?: string };

/**
 * The shell's version, for the About panel of a shipping build.
 *
 * The fixture release list describes the design repo, not the binary the user
 * is running: the number worth quoting in a bug report is the shell
 * manifest's, asked over the bridge. Same check-then-subscribe as
 * components/hub/shell-version.tsx — the host client can be injected after
 * this mounts (the react-native-webview onPageStarted race), and a mount-only
 * check would leave the version permanently blank when injection loses it.
 */
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
          {info ? `${info.shell ?? "?"} · ${info.platform ?? "?"}` : "no shell connected"}
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
function AboutPanel(): ReactNode {
  const copy = content.settings.about;
  const { openDetailPane } = useHub();
  return (
    <>
      <Group title={copy.versionTitle}>
        {DEMO_SURFACES ? (
          <div className="flex items-center gap-3 px-3 py-3">
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
                <time dateTime={currentRelease.date}>{currentRelease.date}</time>{" "}
                · {currentRelease.headline}
              </span>
            </span>
          </div>
        ) : (
          <HostVersionBlock />
        )}
        <Row
          label={copy.whatsNew}
          hint={copy.whatsNewHint}
          value={`${releases.length}`}
          onClick={() => openDetailPane({ kind: "releases", id: "" })}
        />
      </Group>
    </>
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
  const { settingsCategory: requestedCategory, setSettingsCategory } = useHub();
  const settingsCategory = resolveCategory(requestedCategory);
  const category = SETTINGS_CATEGORIES.find(
    (entry) => entry.id === settingsCategory,
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Mobile category tabs; the sidebar carries these at md+ — same split as
          the wallet's section nav. Without them a phone (which never sees the
          panel column) lands on one category with no way to the others. */}
      <nav
        aria-label={content.settings.title}
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden"
      >
        {SETTINGS_CATEGORIES.map(({ id, label, icon: Icon }) => {
          const active = id === settingsCategory;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSettingsCategory(id)}
              aria-current={active ? "page" : undefined}
              className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
        <header className="mb-5">
          <h1 className="text-lg font-bold">{category?.label}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
            {category?.hint}
          </p>
        </header>
        {settingsCategory === "wallet" && <WalletSettingsPanel />}
        {settingsCategory === "general" && <GeneralPanel />}
        {settingsCategory === "privacy" && <PrivacyPanel />}
        {settingsCategory === "browsing" && <BrowsingPanel />}
        {settingsCategory === "appearance" && <AppearancePanel />}
        {settingsCategory === "about" && <AboutPanel />}
      </div>
      </div>
    </div>
  );
}
