"use client";

import { ConversationList } from "@/components/apps/messages/conversation-list";
import { AppName } from "@/components/hub/app-name";
import { RoadmapSidebar } from "@/components/apps/roadmap/roadmap-sidebar";
import { SuggestFeature } from "@/components/apps/roadmap/suggest-feature";
import { WALLET_SECTIONS } from "@/components/apps/wallet-app";
import { WalletColumnHeader } from "@/components/apps/wallet/wallet-column";
import { Tooltip } from "@/components/hub/tooltip";
import { Favicon } from "@/components/hub/favicon";
import { useGrantedConnections } from "@/lib/connections-store";
import {
  toggleRepoCollapsed,
  useCollapsedRepos,
} from "@/lib/collapsed-repos";
import type { Connection } from "@/lib/data/types";
import { AppHelpBar } from "@/components/hub/app-help-bar";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import {
  content,
  getAppOnboarding,
  getConnections,
  storeCategories,
  getCourses,
  getHubApp,
  getIdentityCertificates,
  getMailMessages,
  getMarketListings,
  getMintTiers,
  getOutputBaskets,
  getProposals,
  getVaultItems,
  getWalletAccount,
  getWalletTransactions,
  type VaultItem,
} from "@/lib/data";
import {
  Archive,
  ArchiveX,
  AtSign,
  BadgeCheck,
  Boxes,
  ChevronDown,
  File,
  FileCheck,
  FileLock2,
  FileText,
  Inbox,
  KeyRound,
  Lock,
  PanelLeftClose,
  PenTool,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  Tv,
  Upload,
  User,
  Vault as VaultIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { toggleConnection, useSettings } from "@/lib/settings-store";
import { useVault } from "@/lib/vault-store";
import { VaultLockButton } from "@/components/apps/vault/vault-lock-button";
import type { ReactNode } from "react";

/** Apps whose sidebar column is contextual (everything except Browse). */
const CONTEXTUAL: AppSlug[] = [
  "mail",
  "messages",
  "vault",
  "market",
  "learn",
  "vote",
  "tx-viewer",
  "signer",
  "publisher",
  "wallet",
  "connect",
  "baskets",
  "identity",
  "attestations",
  "roadmap",
];

export function hasContextSidebar(slug: AppSlug | null): boolean {
  return slug !== null && CONTEXTUAL.includes(slug);
}

function Header({
  slug,
  onClose,
}: {
  slug: AppSlug;
  /** set on a phone, where this is a sheet and there is no panel to fold */
  onClose?: (() => void) | undefined;
}): ReactNode {
  const app = getHubApp(slug);
  const {
    messagesUnreadOnly,
    setMessagesUnreadOnly,
    openNewConversation,
    toggleRail,
    spaces,
    activeSpaceId,
  } = useHub();
  if (!app) return null;

  /*
   * The Vault says whose it is; the other apps do not need to.
   *
   * Every app in this column is scoped to the workspace, but for most of them
   * that is obvious from what is in the list — these are your messages, these
   * are the sites you connected. A vault is a closed door with a count beside
   * it, and the one thing you want to know before opening it is which one it
   * is. Naming it here is cheaper than opening it to find out.
   */
  const space =
    slug === "vault"
      ? spaces.find((entry) => entry.id === activeSpaceId)
      : undefined;
  return (
    <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-3">
      {/* Closing the pane belongs beside what the pane is called, rather than
          in the rail's footer where it sat next to controls that have nothing
          to do with it. Re-opening is the rail's job, since this button goes
          with the panel it closes. */}
      {/* On a phone this is a sheet rather than a column, so the leading
          control shuts the sheet: there is no panel to fold away, and a
          "close this panel" on something that is not one would be a button
          claiming to do a thing the screen cannot do. */}
      <Tooltip
        label={onClose ? content.messages.media.close : content.hub.collapsePanel}
      >
        <button
          type="button"
          onClick={onClose ?? toggleRail}
          aria-label={
            onClose ? content.messages.media.close : content.hub.collapsePanel
          }
          className="focus-ring -ml-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          {onClose ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
        </button>
      </Tooltip>
      {/* No app tile: the rail already shows which app is open, in the same
          mark, a few pixels to the left. Twice is not clearer. */}
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
        {space && (
          <span className="text-muted-foreground font-normal">
            {space.name}{" "}
          </span>
        )}
        <AppName app={app} />
      </h2>
      {slug === "messages" && (
        <>
          {/* A filter, not a mode: it hides rows rather than changing what a
              row means, so it reads as a switch and keeps its label. */}
          {/* Downwards: these sit on the panel's top edge, where an upward
              tooltip has no room and gets clipped by the column. */}
          <Tooltip label={content.messages.newChat.unreadHint} side="bottom">
            <button
              type="button"
              role="switch"
              aria-checked={messagesUnreadOnly}
              onClick={() => setMessagesUnreadOnly(!messagesUnreadOnly)}
              className={`focus-ring flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                messagesUnreadOnly
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  messagesUnreadOnly ? "bg-accent" : "bg-muted-foreground/50"
                }`}
              />
              {content.messages.newChat.unread}
            </button>
          </Tooltip>
          <Tooltip label={content.messages.newChat.open} side="bottom">
            <button
              type="button"
              onClick={openNewConversation}
              aria-label={content.messages.newChat.open}
              className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/* ---------------------------------------------------------------- Mail --- */

const MAIL_FOLDERS: { icon: LucideIcon; label: string }[] = [
  { icon: Inbox, label: "Inbox" },
  { icon: File, label: "Drafts" },
  { icon: Send, label: "Sent" },
  { icon: ArchiveX, label: "Junk" },
  { icon: Trash2, label: "Trash" },
  { icon: Archive, label: "Archive" },
];

const MAIL_LABELS: { label: string; color: string }[] = [
  { label: "Social", color: "#818cf8" },
  { label: "Updates", color: "#2dd4bf" },
  { label: "Forums", color: "#fb923c" },
  { label: "Shopping", color: "#a3e635" },
  { label: "Promotions", color: "#f472b6" },
];

function MailSidebar(): ReactNode {
  const { mailFolder, setMailFolder } = useHub();
  const mails = getMailMessages();
  const counts: Record<string, number> = {
    Inbox: mails.length,
    Drafts: 9,
    Junk: 23,
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        {MAIL_FOLDERS.map((folder) => {
          const active = mailFolder === folder.label;
          return (
            <button
              key={folder.label}
              type="button"
              onClick={() => setMailFolder(folder.label)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                active
                  ? "bg-accent/15 font-medium text-foreground"
                  : "text-foreground hover:bg-surface-hover"
              }`}
            >
              <folder.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{folder.label}</span>
              {counts[folder.label] !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {counts[folder.label]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <SectionLabel>Labels</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {MAIL_LABELS.map((label) => (
          <button
            key={label.label}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-surface-hover"
          >
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: label.color }}
              aria-hidden="true"
            />
            <span className="flex-1 text-left">{label.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Messages --- */

/**
 * The Messages conversation list. The whole list — search, DM and group rows,
 * unread badges, network badges — lives with the app itself, so the sidebar
 * just hosts it.
 */
function MessagesList(): ReactNode {
  return <ConversationList />;
}

/* --------------------------------------------------------------- Vault --- */

const VAULT_KINDS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All items", icon: VaultIcon },
  { id: "seed-backup", label: "Seed backups", icon: Sprout },
  { id: "key", label: "Keys", icon: KeyRound },
  { id: "credential", label: "Credentials", icon: ShieldCheck },
  { id: "file", label: "Files", icon: FileLock2 },
];

function VaultSidebar(): ReactNode {
  const { vaultKind, setVaultKind, activeSpaceId } = useHub();
  const { phase } = useVault();
  const items = getVaultItems(activeSpaceId);

  /*
   * A shut vault has no contents to filter.
   *
   * Listing the kinds and their counts beside a closed door tells anybody
   * looking over your shoulder what is inside and how much of it — which is
   * most of what a vault is for keeping to yourself. One row, saying the only
   * true thing about it right now.
   */
  if (phase !== "open") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        <div className="text-muted-foreground flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left">{content.vault.lock.locked}</span>
        </div>
      </div>
    );
  }

  const countOf = (id: string): number =>
    id === "all"
      ? items.length
      : items.filter((item: VaultItem) => item.kind === id).length;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {VAULT_KINDS.map((kind, index) => {
        const active = vaultKind === kind.id;
        return (
          /* Staggered with the canvas beside it, on the same curve and the same
             step, so opening the vault is one thing arriving in two columns
             rather than two lists that happen to appear at once. */
          <motion.button
            key={kind.id}
            type="button"
            onClick={() => setVaultKind(kind.id)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.34,
              ease: [0.4, 0, 0.2, 1],
              delay: 0.08 + index * 0.055,
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
              active
                ? "bg-accent/15 font-medium text-foreground"
                : "text-foreground hover:bg-surface-hover"
            }`}
          >
            <kind.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{kind.label}</span>
            <span className="text-xs text-muted-foreground">
              {countOf(kind.id)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Market --- */

function MarketSidebar(): ReactNode {
  const { marketFilters: f, setMarketFilters } = useHub();
  const listings = getMarketListings();
  const applications = [...new Set(listings.map((l) => l.application))].sort();
  const collections = [...new Set(listings.map((l) => l.collection))].sort();
  const patch = (next: Partial<typeof f>): void =>
    setMarketFilters({ ...f, ...next });
  const copy = content.market;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">
          {copy.labelName}
        </span>
        <input
          value={f.query}
          onChange={(event) => patch({ query: event.target.value })}
          placeholder={copy.search}
          aria-label={copy.labelName}
          className="focus-ring w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none"
        />
      </label>
      <SidebarSelect
        label={copy.labelApplication}
        value={f.application}
        onChange={(v) => patch({ application: v })}
        options={[
          { value: "all", label: copy.allApplications },
          ...applications.map((a) => ({ value: a, label: a })),
        ]}
      />
      <SidebarSelect
        label={copy.labelCollection}
        value={f.collection}
        onChange={(v) => patch({ collection: v })}
        options={[
          { value: "all", label: copy.allCollections },
          ...collections.map((c) => ({ value: c, label: c })),
        ]}
      />
      <SidebarSelect
        label={copy.labelChrono}
        value={f.chrono}
        onChange={(v) => patch({ chrono: v as typeof f.chrono })}
        options={[
          { value: "recent", label: copy.chronoRecent },
          { value: "oldest_activity", label: copy.chronoOldestActivity },
          { value: "newest", label: copy.chronoNewest },
          { value: "oldest", label: copy.chronoOldest },
        ]}
      />
      <SidebarSelect
        label={copy.labelSale}
        value={f.sale}
        onChange={(v) => patch({ sale: v as typeof f.sale })}
        options={[
          { value: "all", label: copy.saleAll },
          { value: "price_high", label: copy.salePriceHigh },
          { value: "price_low", label: copy.salePriceLow },
          { value: "not_listed", label: copy.saleNotListed },
        ]}
      />
    </div>
  );
}

function SidebarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}): ReactNode {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* --------------------------------------------------------------- Learn --- */

function LearnSidebar(): ReactNode {
  const { learnCourse, setLearnCourse } = useHub();
  const courses = getCourses();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {courses.map((course) => {
        const active = learnCourse === course.id;
        const progress = Math.round(
          (course.lessonsCompleted / course.lessonsTotal) * 100,
        );
        return (
          <button
            key={course.id}
            type="button"
            onClick={() => setLearnCourse(course.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left ${
              active ? "bg-accent/10" : "hover:bg-surface-hover"
            }`}
          >
            <span
              className="size-9 shrink-0 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${course.thumbnail.from}, ${course.thumbnail.to})`,
              }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {course.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {progress}% · {course.lessonsTotal} {content.learn.lessonsLabel}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Vote --- */

function VoteSidebar(): ReactNode {
  const { voteStatus, setVoteStatus } = useHub();
  const proposals = getProposals();
  const counts = {
    all: proposals.length,
    open: proposals.filter((p) => p.status === "open").length,
    closed: proposals.filter((p) => p.status !== "open").length,
  };
  const options: { id: typeof voteStatus; label: string }[] = [
    { id: "all", label: "All proposals" },
    { id: "open", label: content.vote.openColumn },
    { id: "closed", label: content.vote.closedColumn },
  ];
  return (
    <div className="flex flex-col gap-0.5">
      <SectionLabel>Filter</SectionLabel>
      {options.map((option) => {
        const active = voteStatus === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setVoteStatus(option.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
              active
                ? "bg-accent/15 font-medium text-foreground"
                : "text-foreground hover:bg-surface-hover"
            }`}
          >
            <span className="flex-1 text-left">{option.label}</span>
            <span className="text-xs text-muted-foreground">
              {counts[option.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Explore --- */

const EXPLORE_KINDS = [
  { id: "all", label: "All" },
  { id: "block", label: "Block" },
  { id: "tx", label: "Txid" },
  { id: "address", label: "Address" },
  { id: "tag", label: "Tags" },
];

function ExploreSidebar(): ReactNode {
  const { exploreQuery, setExploreQuery, exploreKind, setExploreKind } =
    useHub();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">
          Search
        </span>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={exploreQuery}
            onChange={(event) => setExploreQuery(event.target.value)}
            placeholder="Block height/hash, txid, address, tags"
            aria-label="Search the chain"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </label>
      <div>
        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          Filter
        </span>
        <div className="flex flex-wrap gap-1.5">
          {EXPLORE_KINDS.map((kind) => {
            const active = exploreKind === kind.id;
            return (
              <button
                key={kind.id}
                type="button"
                onClick={() => setExploreKind(kind.id)}
                className={`focus-ring rounded-full px-3 py-1 text-xs font-medium ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {kind.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Sign --- */

const SIGN_NAV: { section: string; items: { icon: LucideIcon; label: string }[] }[] =
  [
    {
      section: content.brand.name,
      items: [
        { icon: Tv, label: "Dashboard" },
        { icon: FileText, label: "Envelopes" },
        { icon: PenTool, label: "Drafts" },
      ],
    },
    {
      section: "Account",
      items: [
        { icon: FileCheck, label: "Document Verification" },
        { icon: User, label: "My Account" },
        { icon: PenTool, label: "Visual Signature" },
      ],
    },
  ];

function SignSidebar(): ReactNode {
  const { signSection, setSignSection } = useHub();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {SIGN_NAV.map((section) => (
        <div key={section.section}>
          <SectionLabel>{section.section}</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = signSection === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSignSection(item.label)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                    active
                      ? "bg-accent/15 font-medium text-foreground"
                      : "text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Publish --- */

const MINT_STEPS: { icon: LucideIcon; label: string; step: string }[] = [
  { icon: Upload, label: "Upload asset", step: "Step 1" },
  { icon: Settings2, label: "Configure tiers", step: "Step 2" },
  { icon: Sparkles, label: "Mint collection", step: "Step 3" },
];

function PublishSidebar(): ReactNode {
  const tiers = getMintTiers();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SectionLabel>Create</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {MINT_STEPS.map((step, index) => (
          <div
            key={step.label}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
              index === 0 ? "bg-accent/15 font-medium text-foreground" : "text-foreground"
            }`}
          >
            <step.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">{step.label}</span>
            <span className="text-[10px] text-muted-foreground">{step.step}</span>
          </div>
        ))}
      </div>
      <SectionLabel>Tiers</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {tiers.map((tier, index) => (
          <div
            key={tier.id}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: tier.accent }}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{tier.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {tier.supplyPct}% · {tier.price}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Spend --- */

const WALLET_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All activity" },
  { id: "incoming", label: "Received" },
  { id: "outgoing", label: "Sent" },
  { id: "pending", label: "Pending" },
];

function SpendSidebar(): ReactNode {
  const { walletSection, setWalletSection, walletFilter, setWalletFilter } =
    useHub();
  const account = getWalletAccount();
  const txs = getWalletTransactions(account.id);
  const countOf = (id: string): number => {
    if (id === "all") return txs.length;
    if (id === "pending") return txs.filter((t) => t.status === "pending").length;
    return txs.filter((t) => t.direction === id).length;
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {/* Above Cash, because everything under it is "…of this wallet". */}
      <WalletColumnHeader />
      <div className="-mt-4 flex flex-col gap-0.5">
        {WALLET_SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = walletSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setWalletSection(id)}
              aria-current={active ? "page" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                active
                  ? "bg-accent/15 font-medium text-foreground"
                  : "text-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-left">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Activity filters only mean anything while the activity list is open. */}
      {walletSection === "activity" && (
        <div className="flex flex-col gap-0.5 border-t border-border pt-3">
          <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {content.wallet.filters}
          </p>
          {WALLET_FILTERS.map((filter) => {
            const active = walletFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() =>
                  setWalletFilter(filter.id as typeof walletFilter)
                }
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                  active
                    ? "bg-accent/15 font-medium text-foreground"
                    : "text-foreground hover:bg-surface-hover"
                }`}
              >
                <span className="min-w-0 flex-1 text-left">{filter.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {countOf(filter.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Docked primary/secondary CTAs at the bottom of a contextual column. */
function AppContextFooter({ slug }: { slug: AppSlug }): ReactNode {
  if (slug === "roadmap") {
    /* Suggesting a feature is the one thing on this board you do rather than
       read, so it gets the docked slot the wallet's CTAs use. */
    return (
      <div className="border-border mt-2 shrink-0 border-t pt-3">
        <SuggestFeature />
      </div>
    );
  }
  /*
   * The wallet had a docked Pay / Get paid pair here. It is gone: the Portfolio
   * carries the same two actions a few hundred pixels to the right, on the card
   * with the balance they act on, and two routes to one sheet a screen apart
   * teaches that they are different sheets.
   *
   * `setWalletIntent` is untouched and still the way in — TokenDetail's buttons
   * and the command runner both raise an intent, and wallet-app.tsx still
   * translates it to the live PaySheet or an honest refusal.
   */
  return null;
}

/* ------------------------------------------------------------- Connect --- */

function ConnectSidebar(): ReactNode {
  const { connectSelected, setConnectSelected } = useHub();
  const settings = useSettings();
  const collapsed = useCollapsedRepos();
  /*
   * Revoked sites leave this list rather than sitting in it greyed out.
   *
   * Safe to drop them because revoking still is not deleting: Settings › Sites
   * lists them with their revoked state and the toggle back, and the toast below
   * carries an Undo for the moment right after. This list answers "who can reach
   * my wallet", and a row that cannot is a different question.
   */
  /* The seeded three plus anything this session has granted — a site opened
     while auto-connect was on, or an app put on the rail. One list, because
     from here they are the same fact: something that can reach the wallet. */
  const connections = [...getConnections(), ...useGrantedConnections()].filter(
    (conn) => !settings.revokedConnections.includes(conn.id),
  );
  const activeId = connectSelected ?? connections[0]?.id ?? null;
  const copy = content.connect;

  /*
   * Grouped onto the store's own shelves.
   *
   * A flat list answers "what have I connected" and nothing else. Past a dozen
   * the question becomes "what have I given the block explorers", which is a
   * question about kinds — and the kinds already exist, on the App Store's
   * filter, so this borrows them rather than inventing a second vocabulary that
   * would drift from the first within a week of either being edited.
   *
   * Only shelves with something on them, in the store's own order. An empty
   * heading is a claim that you might have connected a wallet, which is not
   * information.
   */
  const shelves = storeCategories
    .map((category) => ({
      category,
      rows: connections.filter((conn) => conn.category === category.id),
    }))
    .filter((shelf) => shelf.rows.length > 0);

  const disconnect = (conn: Connection): void => {
    toggleConnection(conn.id);
    /* Selection would otherwise point at a row that is no longer here, leaving
       the pane beside it showing a site this list denies. */
    if (conn.id === activeId) {
      const next = connections.find((entry) => entry.id !== conn.id);
      setConnectSelected(next?.id ?? null);
    }
    toast.success(conn.name, {
      description: copy.disconnected,
      action: {
        label: content.hub.undo,
        onClick: () => toggleConnection(conn.id),
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {shelves.map(({ category, rows }) => {
        /* Namespaced into the store the App Store's sections already use, so
           the two accordions behave identically — same persistence, same
           "collapsed is what is remembered" rule — and a category here cannot
           collide with a repository id there. */
        const key = `conn:${category.id}`;
        const shut = collapsed.has(key);
        return (
          <section key={category.id}>
            <button
              type="button"
              onClick={() => toggleRepoCollapsed(key)}
              aria-expanded={!shut}
              className="focus-ring text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-bold tracking-wide uppercase"
            >
              <ChevronDown
                className={`size-3 shrink-0 transition-transform ${
                  shut ? "-rotate-90" : ""
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-left">
                {category.label}
              </span>
              <span className="tabular-nums">{rows.length}</span>
            </button>
            {!shut && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {rows.map((conn) => {
                  const active = conn.id === activeId;
                  return (
                    /* A row, not a button: the X is its own control, and a
                       button inside a button is neither valid nor clickable. */
                    <div
                      key={conn.id}
                      className={`group relative flex items-center rounded-lg ${
                        active ? "bg-accent/10" : "hover:bg-surface-hover"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setConnectSelected(conn.id)}
                        aria-current={active ? "true" : undefined}
                        className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-2 text-left"
                      >
                        <Favicon
                          url={conn.origin}
                          letter={conn.favicon}
                          color={conn.faviconColor}
                          size={22}
                          rounded="rounded-lg"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate pr-6 text-sm font-medium">
                            {conn.name}
                          </span>
                          <span className="text-muted-foreground block truncate pr-6 text-xs">
                            {conn.origin.replace(/^https?:\/\//, "")}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => disconnect(conn)}
                        aria-label={`${copy.disconnect} ${conn.name}`}
                        title={copy.disconnect}
                        className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-negative absolute right-1.5 rounded p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Baskets --- */

function BasketsSidebar(): ReactNode {
  const { basketSelected, setBasketSelected } = useHub();
  const baskets = getOutputBaskets();
  const activeId = basketSelected ?? baskets[0]?.id ?? null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {baskets.map((basket) => {
        const active = basket.id === activeId;
        return (
          <button
            key={basket.id}
            type="button"
            onClick={() => setBasketSelected(basket.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left ${
              active ? "bg-accent/10" : "hover:bg-surface-hover"
            }`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Boxes className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-sm font-medium">
                {basket.name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {basket.protocol}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Identity --- */

function IdentitySidebar(): ReactNode {
  const { identitySection, setIdentitySection, identityKeys } = useHub();
  const retiredCount = identityKeys.filter((key) => key.retired).length;
  const sections: {
    id: "handles" | "keys" | "retired" | "certificates";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    /* First, and the default. A handle is the part of an identity other people
       use; keys are the part only this client does. */
    {
      id: "handles",
      label: content.identity.handles.title,
      icon: AtSign,
      count: 0,
    },
    {
      id: "keys",
      label: content.identity.keysTitle,
      icon: KeyRound,
      count: identityKeys.length - retiredCount,
    },
    // The Retired tab only appears once at least one badge is retired.
    ...(retiredCount > 0
      ? [
          {
            id: "retired" as const,
            label: content.identity.retiredLabel,
            icon: Archive,
            count: retiredCount,
          },
        ]
      : []),
    {
      id: "certificates",
      label: content.identity.certificatesTitle,
      icon: BadgeCheck,
      count: getIdentityCertificates().length,
    },
  ];
  return (
    <div className="flex flex-col gap-0.5">
      {sections.map((section) => {
        const active = identitySection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => setIdentitySection(section.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
              active
                ? "bg-accent/15 font-medium text-foreground"
                : "text-foreground hover:bg-surface-hover"
            }`}
          >
            <section.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{section.label}</span>
            {/* Handles has no count worth showing — you have one. A zero
                beside it would read as "none". */}
            {section.count > 0 && (
              <span className="text-xs text-muted-foreground">
                {section.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------- Attestations --- */

const ATTESTATION_FILTERS: { id: "all" | "issued" | "received"; label: string }[] =
  [
    { id: "all", label: "All attestations" },
    { id: "received", label: "Received" },
    { id: "issued", label: "Issued" },
  ];

function AttestationsSidebar(): ReactNode {
  const { attestationFilter, setAttestationFilter } = useHub();
  return (
    <div className="flex flex-col gap-0.5">
      <SectionLabel>Filter</SectionLabel>
      {ATTESTATION_FILTERS.map((option) => {
        const active = attestationFilter === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setAttestationFilter(option.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
              active
                ? "bg-accent/15 font-medium text-foreground"
                : "text-foreground hover:bg-surface-hover"
            }`}
          >
            <span className="flex-1 text-left">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- Aggregator --- */

/** The contextual body for the active app (no outer chrome). */
export function AppContextBody({ slug }: { slug: AppSlug }): ReactNode {
  switch (slug) {
    case "mail":
      return <MailSidebar />;
    case "messages":
      return <MessagesList />;
    case "vault":
      return <VaultSidebar />;
    case "market":
      return <MarketSidebar />;
    case "learn":
      return <LearnSidebar />;
    case "vote":
      return <VoteSidebar />;
    case "tx-viewer":
      return <ExploreSidebar />;
    case "signer":
      return <SignSidebar />;
    case "publisher":
      return <PublishSidebar />;
    case "wallet":
      return <SpendSidebar />;
    case "connect":
      return <ConnectSidebar />;
    case "baskets":
      return <BasketsSidebar />;
    case "identity":
      return <IdentitySidebar />;
    case "attestations":
      return <AttestationsSidebar />;
    case "roadmap":
      return <RoadmapSidebar />;
    default:
      return null;
  }
}

/** Full contextual sidebar column: header, scrolling body, docked CTAs. */
export function AppContextSidebar({
  slug,
  /**
   * Set where this is the phone's sheet rather than the desktop's column.
   *
   * The whole panel it normally lives in is inside the shell's `hidden
   * md:block`, so below that width every app's list — Mail's folders, the
   * vault's sections, the roadmap's filters — simply was not there. Eleven of
   * the fifteen apps with one had no phone equivalent at all. This is the same
   * component in a bottom sheet rather than fifteen second implementations.
   *
   * @see components/hub/mobile-app-sheet.tsx
   */
  onClose,
}: {
  slug: AppSlug;
  onClose?: (() => void) | undefined;
}): ReactNode {
  /* Messages carries its own bar, with two controls this one has no business
     showing. Anything with nothing written about it gets no button rather than
     a button onto an empty pane. */
  const helped = slug !== "messages" && Boolean(getAppOnboarding(slug));

  if (!helped) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Header slug={slug} onClose={onClose} />
        <AppContextBody slug={slug} />
        <AppContextFooter slug={slug} />
      </div>
    );
  }

  /*
    The docked block floats over the body rather than sitting under it, so the
    list scrolls behind it the way the conversation list does. The body's own
    root is the scroller in most of these columns, so the reserve space goes
    there: a translucent strip with nothing reserved behind it leaves the last
    row permanently half-covered, which reads as a rendering fault.

    The reserve is per-shape rather than measured. Wallet's column ends in a
    pair of CTAs and everything else ends in the bar alone, and being a few
    pixels generous costs nothing — it is empty space below the last row.
  */
  const hasCta = slug === "wallet" || slug === "roadmap";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header slug={slug} onClose={onClose} />
      <div
        className={`relative flex min-h-0 flex-1 flex-col ${
          hasCta ? "[&>*:first-child]:pb-28" : "[&>*:first-child]:pb-12"
        }`}
      >
        <AppContextBody slug={slug} />
        {/* Fades the list out into the bar, so the strip reads as the bottom of
            the column rather than as a footer parked on top of a list. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent"
        />
        <div className="bg-surface absolute inset-x-0 bottom-0">
          {/* CTAs first, then the bar: the help button is the least urgent
              thing in the column and belongs furthest from the content. */}
          <AppContextFooter slug={slug} />
          {/* The vault is the one app whose column carries a setting: when it
              shuts itself again. It goes in the help bar's left slot, which is
              where App repositories sits in the Apps column — same bar, same
              corner, same kind of thing. */}
          <AppHelpBar slug={slug}>
            {slug === "vault" ? <VaultLockButton /> : null}
          </AppHelpBar>
        </div>
      </div>
    </div>
  );
}
