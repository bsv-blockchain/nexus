"use client";

import { Sheet } from "@/components/apps/messages/sheet";
import { useHub } from "@/components/hub/hub-provider";
import { content, type WalletAccount } from "@/lib/data";
import {
  activeWalletFor,
  addWallet,
  isUnlocked,
  labelOf,
  profilesUsing,
  setActiveWallet,
  unlockWallet,
  useWallets,
  walletsByRecent,
} from "@/lib/wallets-store";
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  KeyRound,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react";
import { resolveDataMode } from "@/lib/data-mode";
import {
  getUsdPerBsv,
  usdForSatoshis,
  useUsdPerBsv,
} from "@/lib/exchange-rate";
import { activeHandleFor } from "@/lib/settings-store";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

/**
 * Whether this session has more than one wallet to choose between.
 *
 * Never, on a live build. docs/DECISIONS.md §3 settles it: storage is local,
 * there is one wallet per device and no key sync in v1, so a picker offering
 * four of them would be offering three that do not exist — and naming the one
 * that does after a fixture ("Everyday") above a real balance is worse than
 * saying nothing. The whole switcher is a demo affordance until a second wallet
 * is something the shell can actually hold.
 */
function switchable(): boolean {
  return resolveDataMode() === "demo";
}

const copy = content.wallet.switcher;

function gradient(wallet: WalletAccount): string {
  return `linear-gradient(135deg, ${wallet.colors[0]} 0%, ${wallet.colors[1]} 100%)`;
}

/**
 * A wallet's face.
 *
 * A picture where one is set, the gradient otherwise. Wallets are told apart at
 * a glance far more often than they are read, so every one of them gets a
 * colour whether or not anybody has bothered to give it an avatar — the
 * alternative is four identical grey rows called things like "Everyday".
 */
export function WalletMark({
  wallet,
  size = 36,
}: {
  wallet: WalletAccount;
  size?: number;
}): ReactNode {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl"
      style={{ width: size, height: size, backgroundImage: gradient(wallet) }}
      aria-hidden="true"
    >
      {wallet.avatar ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={wallet.avatar} alt="" className="size-full object-cover" />
      ) : (
        <span
          className="font-bold text-white"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {labelOf(wallet).slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function fiat(wallet: WalletAccount, usdPerBsv: number): string {
  return usdForSatoshis(wallet.balanceSatoshis, usdPerBsv).toLocaleString(
    "en-GB",
    {
      style: "currency",
      currency: wallet.fiatCurrency,
      maximumFractionDigits: 2,
    }
  );
}

/**
 * The handle a wallet answers to.
 *
 * A wallet does not hold a handle; a workspace does, and a workspace spends
 * from one wallet — so the name attached to money leaving this wallet is the
 * handle of the workspace using it. Set in Identity, read here.
 *
 * The workspace you are in wins when it is one of them, because that is whose
 * money is on screen. Otherwise the first workspace using it, which is at least
 * true. A wallet no workspace has selected shows nothing rather than borrowing
 * somebody else's name.
 */
function handleFor(
  wallet: WalletAccount,
  activeSpaceId: string,
  spaceIds: string[]
): string | null {
  const using = profilesUsing(wallet.id, spaceIds);
  const space = using.includes(activeSpaceId) ? activeSpaceId : using[0];
  if (!space) return null;
  const handle = activeHandleFor(space);
  return handle ? `@${handle}` : null;
}

/**
 * The wallet you are spending from, and the way to change it.
 *
 * The trigger states the wallet rather than opening straight into a list: the
 * question "which wallet is this" is asked far more often than "give me a
 * different one", and a control that answers only the second makes you open it
 * to answer the first.
 */
export function WalletTrigger({
  onOpen,
  className = "",
}: {
  onOpen: () => void;
  className?: string;
}): ReactNode {
  const { activeSpaceId } = useHub();
  useWallets();
  const wallet = activeWalletFor(activeSpaceId);
  if (!wallet || !switchable()) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      /* One line again. It used to carry the handle under the wallet's name,
         which made one control state two facts that are set in different places
         and changed for different reasons — and gave the row that changes the
         wallet a second line nobody could press on its own. The handle has its
         own row now; see wallet-column. */
      className={`focus-ring border-border bg-surface hover:bg-surface-hover flex items-center gap-3 rounded-xl border py-2 pr-3.5 pl-2 text-left ${className}`}
    >
      <WalletMark wallet={wallet} size={40} />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-bold">
        {labelOf(wallet)}
      </span>
      <ChevronDown
        className="text-muted-foreground size-4.5 shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}

/** Sealed until a password is given; the field is the whole ceremony. */
function UnlockRow({
  wallet,
  onDone,
}: {
  wallet: WalletAccount;
  onDone: () => void;
}): ReactNode {
  const [value, setValue] = useState("");
  return (
    <div className="border-border bg-surface mt-2 rounded-lg border p-2.5">
      <p className="text-[11px] font-semibold">{copy.unlockTitle}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !value) return;
            unlockWallet(wallet.id);
            onDone();
          }}
          placeholder={copy.unlockPlaceholder}
          aria-label={copy.unlockTitle}
          className="focus-within:ring-accent border-border bg-surface-raised placeholder:text-muted-foreground min-w-0 flex-1 rounded-lg border px-2.5 py-1 text-xs outline-none focus:ring-2"
        />
        <button
          type="button"
          disabled={!value}
          onClick={() => {
            unlockWallet(wallet.id);
            onDone();
          }}
          className="focus-ring bg-accent text-accent-foreground rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-40"
        >
          {copy.unlock}
        </button>
      </div>
      {/* Said plainly rather than left for somebody to discover: nothing here
          checks a password, and a prototype that pretends to would be teaching
          a security habit it cannot keep. */}
      <p className="text-muted-foreground mt-1.5 text-[10px] text-pretty">
        {copy.unlockNote}
      </p>
    </div>
  );
}

/** Creating, importing from a phrase, importing from a key — one shape each. */
type AddKind = "create" | "phrase" | "key";

const ADD_KINDS: { id: AddKind; label: string; hint: string }[] = [
  { id: "create", label: copy.addCreate, hint: copy.addCreateHint },
  { id: "phrase", label: copy.addPhrase, hint: copy.addPhraseHint },
  { id: "key", label: copy.addKey, hint: copy.addKeyHint },
];

const PALETTE: [string, string][] = [
  ["#4353ff", "#22d3ee"],
  ["#7c3aed", "#f472b6"],
  ["#f59e0b", "#ef4444"],
  ["#059669", "#a3e635"],
  ["#0ea5e9", "#6366f1"],
];

function AddWallet({ onDone }: { onDone: () => void }): ReactNode {
  const { activeSpaceId } = useHub();
  const [kind, setKind] = useState<AddKind | null>(null);
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");

  if (!kind) {
    return (
      <ul className="divide-border/60 divide-y">
        {ADD_KINDS.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setKind(entry.id)}
              className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg">
                {entry.id === "create" ? (
                  <Sparkles className="size-4" aria-hidden="true" />
                ) : entry.id === "phrase" ? (
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{entry.label}</span>
                <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                  {entry.hint}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const needsSecret = kind !== "create";
  const ready = label.trim().length > 0 && (!needsSecret || secret.trim());

  return (
    <div className="p-4">
      <label className="block text-[11px] font-semibold" htmlFor="wallet-label">
        {copy.nameLabel}
      </label>
      <input
        id="wallet-label"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={copy.namePlaceholder}
        className="focus-within:ring-accent border-border bg-surface mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
      />
      {needsSecret && (
        <>
          <label
            className="mt-3 block text-[11px] font-semibold"
            htmlFor="wallet-secret"
          >
            {kind === "phrase" ? copy.phraseLabel : copy.keyLabel}
          </label>
          <textarea
            id="wallet-secret"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            rows={kind === "phrase" ? 3 : 2}
            placeholder={
              kind === "phrase" ? copy.phrasePlaceholder : copy.keyPlaceholder
            }
            className="focus-within:ring-accent border-border bg-surface mt-1.5 w-full resize-none rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:ring-2"
          />
          {/* The warning belongs beside the box, not after the button. */}
          <p className="text-warning mt-1.5 text-[11px] text-pretty">
            {copy.importWarning}
          </p>
        </>
      )}
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          const id = `acct-${label
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")}`;
          const colors =
            PALETTE[Math.abs(id.length * 7) % PALETTE.length] ?? PALETTE[0]!;
          addWallet(
            {
              id,
              label: label.trim(),
              address: "1NexusNewWalletAddressPlaceholder0000",
              identifier: `wk_${id.slice(-14).padStart(16, "0")}`,
              colors,
              balanceSatoshis: 0,
              fiatCurrency: "USD",
              fiatRate: getUsdPerBsv(),
            },
            activeSpaceId,
            Date.now()
          );
          toast.success(label.trim(), { description: copy.added });
          onDone();
        }}
        className="focus-ring bg-accent text-accent-foreground mt-4 w-full rounded-full px-3 py-2 text-sm font-bold disabled:opacity-40"
      >
        {kind === "create" ? copy.addCreate : copy.importAction}
      </button>
    </div>
  );
}

/**
 * Every wallet this profile can reach, and which one it is spending from.
 *
 * Shared between the wallet app's header and the profiles manager, because they
 * ask the same question from two places and two sheets that drift apart is how
 * one of them ends up missing the wallet you just added.
 */
export function WalletSwitcher({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const { activeSpaceId, spaces } = useHub();
  useWallets();
  const usdPerBsv = useUsdPerBsv();
  const spaceIds = spaces.map((space) => space.id);
  const [adding, setAdding] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const wallets = walletsByRecent();
  const active = activeWalletFor(activeSpaceId);

  const close = (): void => {
    setAdding(false);
    setUnlocking(null);
    onClose();
  };

  /* Belt as well as braces: WalletTrigger is the only thing that opens this,
     and it does not render on a live build — but a sheet that can list four
     invented wallets beside a real balance is worth refusing twice. */
  if (!switchable()) return null;

  return (
    <Sheet
      open={open}
      onClose={close}
      label={adding ? copy.addTitle : copy.title}
    >
      {adding ? (
        <AddWallet onDone={() => setAdding(false)} />
      ) : (
        <>
          <ul className="divide-border/60 divide-y">
            {wallets.map((wallet) => {
              const sealed = wallet.locked === true && !isUnlocked(wallet.id);
              const current = wallet.id === active?.id;
              const handle = handleFor(wallet, activeSpaceId, spaceIds);
              return (
                <li key={wallet.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <WalletMark wallet={wallet} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold">
                          {labelOf(wallet)}
                        </span>
                        {wallet.locked === true && (
                          <Lock
                            className="text-muted-foreground size-3 shrink-0"
                            aria-label={copy.locked}
                          />
                        )}
                      </span>
                      {/* A sealed wallet does not show a balance it cannot
                          have read. The handle beside it is the name money
                          leaves this wallet under — see `handleFor`. */}
                      <span className="text-muted-foreground block truncate text-[11px]">
                        <span className="tabular-nums">
                          {sealed ? copy.sealed : fiat(wallet, usdPerBsv)}
                        </span>
                        {handle && ` · ${handle}`}
                      </span>
                    </span>
                    {current ? (
                      <Check
                        className="text-accent size-4 shrink-0"
                        aria-label={copy.active}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (sealed) {
                            setUnlocking(
                              unlocking === wallet.id ? null : wallet.id
                            );
                            return;
                          }
                          setActiveWallet(activeSpaceId, wallet.id);
                          toast.success(labelOf(wallet), {
                            description: copy.switched,
                          });
                          close();
                        }}
                        className="focus-ring border-border hover:bg-surface-hover shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                      >
                        {sealed ? copy.unlock : copy.use}
                      </button>
                    )}
                  </div>
                  {unlocking === wallet.id && (
                    <UnlockRow
                      wallet={wallet}
                      onDone={() => {
                        setUnlocking(null);
                        setActiveWallet(activeSpaceId, wallet.id);
                        toast.success(labelOf(wallet), {
                          description: copy.unlocked,
                        });
                        close();
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <div className="border-border/60 border-t p-4">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="focus-ring border-border hover:bg-surface-hover flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold"
            >
              <Plus className="size-4" aria-hidden="true" />
              {copy.addTitle}
            </button>
            {/* Says where the other wallets went, rather than leaving somebody
                to wonder why this list is shorter than the one they own. */}
            <p className="text-muted-foreground mt-2 text-[11px] text-pretty">
              {copy.scopeNote}
            </p>
          </div>
        </>
      )}
    </Sheet>
  );
}
