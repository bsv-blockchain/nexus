"use client";

import { HandlesPanel } from "@/components/apps/identity/handles-panel";
import { WalletMark } from "@/components/apps/wallet/wallet-switcher";
import { allWallets, labelOf } from "@/lib/wallets-store";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { Dialog } from "@/components/hub/dialog";
import { IdentitySigil } from "@/components/hub/identity-sigil";
import { useHub } from "@/components/hub/hub-provider";
import { useCommandEffects } from "@/lib/use-command-effects";
import { content, getIdentityCertificates, type IdentityKey } from "@/lib/data";
import {
  Archive,
  BadgeCheck,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

/** Middle-truncate a key to first 5 … last 5 characters. */
function shortKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 5)}…${key.slice(-5)}` : key;
}

function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    // clipboard unavailable
  }
}

/** The per-badge action buttons — reused as hover pills and mobile-sheet rows. */
function BadgeActions({
  badge,
  variant,
  onRename,
  onDone,
}: {
  badge: IdentityKey;
  variant: "pill" | "row";
  onRename: (badge: IdentityKey) => void;
  onDone?: () => void;
}): ReactNode {
  const { setPrimaryIdentityKey, retireIdentityKey, restoreIdentityKey } =
    useHub();
  const copy = content.identity;
  const run = (fn: () => void) => (): void => {
    fn();
    onDone?.();
  };

  const items: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    {
      label: copy.copyKey,
      icon: Copy,
      onClick: run(() => copyToClipboard(badge.publicKey)),
    },
    {
      label: copy.rename,
      icon: Pencil,
      onClick: run(() => onRename(badge)),
    },
  ];
  if (badge.retired) {
    items.push({
      label: copy.restore,
      icon: RotateCcw,
      onClick: run(() => restoreIdentityKey(badge.id)),
    });
  } else if (!badge.primary) {
    items.push({
      label: copy.makePrimary,
      icon: Star,
      onClick: run(() => setPrimaryIdentityKey(badge.id)),
    });
    items.push({
      label: copy.retire,
      icon: Archive,
      onClick: run(() => retireIdentityKey(badge.id)),
    });
  }

  const cls =
    variant === "pill"
      ? "focus-ring flex w-full items-center justify-center gap-1.5 rounded-full bg-surface-raised px-3 py-1.5 text-xs font-medium ring-1 ring-border transition-colors hover:bg-surface-hover"
      : "focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-hover";

  return (
    <>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={cls}
        >
          <item.icon className="size-4 shrink-0" aria-hidden="true" />
          <span className={variant === "row" ? "flex-1 text-left" : ""}>
            {item.label}
          </span>
        </button>
      ))}
    </>
  );
}

/** ID-badge card: sigil + label + truncated key, with hover/mobile actions. */
function BadgeCard({
  badge,
  onOpenSheet,
  onRename,
}: {
  badge: IdentityKey;
  onOpenSheet: (badge: IdentityKey) => void;
  onRename: (badge: IdentityKey) => void;
}): ReactNode {
  const copy = content.identity;
  return (
    <li className="group bg-surface ring-border relative flex flex-col items-center overflow-hidden rounded-2xl p-5 text-center ring-1">
      <button
        type="button"
        aria-label={`${badge.label} actions`}
        onClick={() => onOpenSheet(badge)}
        className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground absolute top-2.5 right-2.5 rounded-md p-1.5 md:hidden"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>

      <IdentitySigil value={badge.publicKey} size={64} className="shadow-sm" />
      <p className="mt-3 max-w-full truncate text-sm font-semibold">
        {badge.label}
      </p>
      {badge.primary && (
        <span className="bg-accent/15 text-accent mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold">
          {copy.primaryBadge}
        </span>
      )}
      <span className="text-muted-foreground mt-2 font-mono text-[11px]">
        {shortKey(badge.publicKey)}
      </span>

      {/* Desktop: reveal action pills over the card content on hover. */}
      <div className="bg-surface/95 absolute inset-0 hidden flex-col items-center justify-center gap-1.5 rounded-2xl px-5 backdrop-blur-sm md:group-hover:flex">
        <BadgeActions badge={badge} variant="pill" onRename={onRename} />
      </div>
    </li>
  );
}

export function IdentityApp(): ReactNode {
  const {
    identitySection,
    identityKeys,
    createIdentityKey,
    renameIdentityKey,
  } = useHub();
  // Attestations and delegations issued this session from Messages
  // (`/attest`, `/delegate`, `/handoff`) sit above the seeded credentials.
  const { certificates: fromCommands } = useCommandEffects();
  const certificates = [...fromCommands, ...getIdentityCertificates()];
  const copy = content.identity;
  const [sheetBadge, setSheetBadge] = useState<IdentityKey | null>(null);
  const [renameBadge, setRenameBadge] = useState<IdentityKey | null>(null);
  const openRename = (badge: IdentityKey): void => {
    setSheetBadge(null);
    setRenameBadge(badge);
  };

  const active = identityKeys.filter((key) => !key.retired);
  const retired = identityKeys.filter((key) => key.retired);
  // Fall back to the active list if the Retired tab has emptied out.
  const section =
    identitySection === "retired" && retired.length === 0
      ? "keys"
      : identitySection;

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-2xl">
        {section === "handles" ? (
          <HandlesPanel />
        ) : section === "certificates" ? (
          <>
            <h2 className="text-lg font-bold">{copy.certificatesTitle}</h2>
            <p className="text-muted-foreground mt-1 text-sm text-balance">
              {copy.certificatesHint}
            </p>
            {certificates.length === 0 ? (
              <div className="bg-surface mt-4 flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
                <span className="bg-accent/10 text-accent flex size-14 items-center justify-center rounded-full">
                  <BadgeCheck className="size-7" aria-hidden="true" />
                </span>
                <p className="text-muted-foreground max-w-sm text-sm text-balance">
                  {copy.certificatesEmpty}
                </p>
                <button
                  type="button"
                  className="focus-ring bg-accent text-accent-foreground rounded-full px-4 py-2 text-sm font-semibold hover:opacity-90"
                >
                  {copy.registerAction}
                </button>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {certificates.map((cert) => (
                  <li key={cert.id} className="bg-surface rounded-2xl p-4">
                    <div className="flex items-center gap-2.5">
                      <BadgeCheck
                        className="text-accent size-5 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {cert.type}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {cert.issuer}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {cert.fields.map((field) => (
                        <div key={field.label}>
                          <dt className="text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd className="font-medium">{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : section === "retired" ? (
          <>
            <h2 className="text-lg font-bold">{copy.retiredTitle}</h2>
            <p className="text-muted-foreground mt-1 text-sm text-balance">
              {copy.retiredHint}
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {retired.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  onOpenSheet={setSheetBadge}
                  onRename={openRename}
                />
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">{copy.keysTitle}</h2>
            <p className="text-muted-foreground mt-1 text-sm text-balance">
              {copy.keysHint}
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {active.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  onOpenSheet={setSheetBadge}
                  onRename={openRename}
                />
              ))}
              <li>
                <button
                  type="button"
                  onClick={createIdentityKey}
                  className="focus-ring border-border text-muted-foreground hover:border-accent/50 hover:text-foreground flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-5 transition-colors"
                >
                  <span className="bg-muted flex size-11 items-center justify-center rounded-2xl">
                    <Plus className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium">{copy.newBadge}</span>
                </button>
              </li>
            </ul>

            {/*
              Wallets are identifiers too.

              A wallet key names you to whoever you paid as surely as a signing
              key names you to whoever you wrote to, and leaving it out of the
              one page called Identifiers meant the page was not the answer to
              its own question. Read-only on purpose: the label above it is
              yours to change and this is not, which is the whole distinction
              between what a thing is called and what it is.

              Demo only. `allWallets()` is the fixture set, and a live build has
              exactly one wallet whose identity key comes from the shell rather
              than from lib/data — printing four invented pubkeys on the page
              called Identifiers would be the worst place in the app to do it.
              The live listing belongs with the keys in Settings › Wallet, which
              is where the shell is already asked. See lib/surfaces.ts.
            */}
            {DEMO_SURFACES && (
              <>
                <h3 className="mt-8 text-sm font-bold">
                  {copy.walletKeysTitle}
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
                  {copy.walletKeysHint}
                </p>
                <ul className="border-border divide-border/60 bg-surface-raised mt-2.5 divide-y overflow-hidden rounded-xl border">
                  {allWallets().map((wallet) => (
                    <li
                      key={wallet.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <WalletMark wallet={wallet} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {labelOf(wallet)}
                        </span>
                        <span className="text-muted-foreground block truncate font-mono text-[11px]">
                          {wallet.identifier}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(wallet.identifier);
                          toast.success(copy.copyKey);
                        }}
                        aria-label={`${copy.copyKey}: ${labelOf(wallet)}`}
                        className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md p-1.5"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile: badge actions in a bottom sheet. */}
      <AnimatePresence>
        {sheetBadge && (
          <div
            className="fixed inset-0 z-80 flex items-end justify-center md:hidden"
            onClick={() => setSheetBadge(null)}
          >
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-label={`${sheetBadge.label} actions`}
              onClick={(event) => event.stopPropagation()}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="bg-surface-raised relative max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 ring-1 ring-black/10 dark:ring-white/10"
            >
              <div className="flex items-center gap-3">
                <IdentitySigil value={sheetBadge.publicKey} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {sheetBadge.label}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {shortKey(sheetBadge.publicKey)}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <BadgeActions
                  badge={sheetBadge}
                  variant="row"
                  onRename={openRename}
                  onDone={() => setSheetBadge(null)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Dialog
        open={renameBadge !== null}
        onClose={() => setRenameBadge(null)}
        label={copy.renameTitle}
      >
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem(
              "badge-name"
            ) as HTMLInputElement | null;
            if (renameBadge && input) {
              renameIdentityKey(renameBadge.id, input.value);
            }
            setRenameBadge(null);
          }}
        >
          <h2 className="text-base font-semibold">{copy.renameTitle}</h2>
          <input
            key={renameBadge?.id ?? "none"}
            name="badge-name"
            autoFocus
            defaultValue={renameBadge?.label ?? ""}
            aria-label={copy.renameTitle}
            className="border-border bg-surface focus:border-ring mt-4 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenameBadge(null)}
              className="focus-ring hover:bg-surface-hover rounded-full px-4 py-2 text-sm font-medium"
            >
              {copy.renameCancel}
            </button>
            <button
              type="submit"
              className="focus-ring bg-accent text-accent-foreground rounded-full px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              {copy.renameSave}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
