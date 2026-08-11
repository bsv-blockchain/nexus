"use client";

/**
 * The Wallet settings category — live builds only.
 *
 * Its own file rather than more panels in settings-app.tsx because that file is
 * forked from the design repo and upstream merges flow through it; everything
 * here is ours alone, built against the shell's settings surface
 * (packages/bridge — settings.get / settings.setNetwork / wallet.backup /
 * wallet.logout). See docs/SPEC-settings-and-setup.md.
 *
 * Destructive actions (network switch, sign out) confirm by arming: the first
 * click turns the control into its own warning, the second commits. Settings
 * has no dialog primitive, and a modal for one yes/no would be the only modal
 * in the app — the confirmation stays where the decision is.
 */

import { Choice, Group, Row } from "@/components/apps/settings-app";
import {
  canCreateBackupShares,
  createBackupShares,
  logoutWallet,
  readSettings,
  revealBackup,
  setArc,
  setAutoApprove,
  setNetwork,
  type ArcSettings,
  type AutoApproveSettings,
  type HostSettings,
} from "@/lib/wallet-data";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

type Network = HostSettings["network"];

const NETWORK_COPY: Record<Network, { label: string; hint: string }> = {
  main: { label: "Mainnet", hint: "The live chain. Real money." },
  test: { label: "Testnet", hint: "Worthless coins, for trying things out." },
};

/** What "where do my keys live" honestly means for each storage method. */
const CUSTODY_COPY: Record<
  HostSettings["secure"]["method"],
  { label: string; hint: string }
> = {
  "keychain-biometric": {
    label: "Keys unlock with Face ID / Touch ID",
    hint: "The recovery phrase lives in the device keychain and opens only after a biometric check.",
  },
  keychain: {
    label: "Keys live in the system keychain",
    hint: "Encrypted by the operating system, unlocked with your user session.",
  },
  none: {
    label: "No secure storage on this system",
    hint: "The recovery phrase is kept on disk without OS encryption. Anyone with access to this computer's files can read it.",
  },
};

/**
 * Where this network's transactions are broadcast.
 *
 * Per network, and the label says so: an endpoint that serves mainnet is not the
 * one that serves testnet, and an override that followed you across a switch would
 * quietly post mainnet transactions to a testnet ARC.
 *
 * The token is write-only. The shell reports whether one is set and never what it
 * is, so this field can add or replace a key but not read one back — leaving it
 * blank keeps whatever is already stored rather than clearing it, which is the
 * behaviour someone editing only the URL expects.
 */
function ArcGroup({ arc, onSaved }: { arc: ArcSettings; onSaved: () => void }): ReactNode {
  const [url, setUrl] = useState(arc.url);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = url.trim() !== arc.url || token.length > 0;

  const apply = (nextUrl: string | null, nextToken: string | null): void => {
    setSaving(true);
    setArc(nextUrl, nextToken)
      .then(() => {
        toast.success("Broadcast endpoint saved");
        setToken("");
        onSaved();
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : String(err)))
      .finally(() => setSaving(false));
  };

  return (
    <Group
      title="Broadcast endpoint"
      hint="Where this network's transactions are handed to the network. Changing it rebuilds the wallet."
    >
      <div className="space-y-2 px-3 py-2.5">
        <label className="block">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            ARC URL
          </span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={arc.defaultUrl}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            className="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none"
          />
        </label>

        <label className="block">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            API token
          </span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            placeholder={arc.hasToken ? "A token is set — type to replace it" : "Only if your endpoint needs one"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none"
          />
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => apply(url.trim() || null, token || null)}
            disabled={saving || !dirty}
            className="focus-ring bg-accent text-accent-foreground rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            {saving ? "Applying…" : "Apply"}
          </button>
          {!arc.isDefault ? (
            <button
              type="button"
              onClick={() => {
                setUrl(arc.defaultUrl);
                apply(null, null);
              }}
              disabled={saving}
              className="focus-ring text-accent text-xs font-semibold disabled:opacity-50"
            >
              Use the default
            </button>
          ) : null}
          {arc.hasToken ? (
            <button
              type="button"
              onClick={() => apply(url.trim() || null, "")}
              disabled={saving}
              className="focus-ring text-muted-foreground ml-auto text-xs font-semibold disabled:opacity-50"
            >
              Remove token
            </button>
          ) : null}
        </div>
      </div>
    </Group>
  );
}

/**
 * How much a page may spend before the wallet stops asking.
 *
 * Entered in satoshis because that is what is actually spent, and the limit is a
 * safety boundary — converting it through an exchange rate would make the boundary
 * move on its own while you were not looking.
 *
 * Zero is a real answer, not an empty field: it means ask every time.
 */
function AutoApproveGroup({
  limit,
  onSaved,
}: {
  limit: AutoApproveSettings;
  onSaved: () => void;
}): ReactNode {
  const [value, setValue] = useState(String(limit.satoshis));
  const [saving, setSaving] = useState(false);
  const parsed = Number(value);
  const valid = value !== "" && Number.isFinite(parsed) && parsed >= 0;
  const dirty = valid && Math.round(parsed) !== limit.satoshis;

  return (
    <Group
      title="Spend without asking"
      hint="Payments below this go through silently. Anything above it asks you first."
    >
      <div className="space-y-2 px-3 py-2.5">
        <div className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3 py-2">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            aria-label="Spend limit in satoshis"
            className="w-full bg-transparent text-sm font-semibold outline-none"
          />
          <span className="text-muted-foreground shrink-0 text-xs font-semibold">sats</span>
        </div>
        <p className="text-muted-foreground text-[11px]">
          {parsed === 0 && valid
            ? "Every payment will ask for your approval."
            : `Payments up to ${parsed.toLocaleString("en-US")} sats go through without asking.`}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSaving(true);
              setAutoApprove(Math.round(parsed))
                .then(() => {
                  toast.success("Spending limit saved");
                  onSaved();
                })
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : String(err)))
                .finally(() => setSaving(false));
            }}
            disabled={saving || !dirty}
            className="focus-ring bg-accent text-accent-foreground rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {limit.satoshis !== limit.defaultSatoshis ? (
            <button
              type="button"
              onClick={() => setValue(String(limit.defaultSatoshis))}
              className="focus-ring text-accent text-xs font-semibold"
            >
              Use the default ({limit.defaultSatoshis.toLocaleString("en-US")})
            </button>
          ) : null}
        </div>
      </div>
    </Group>
  );
}

export function WalletSettingsPanel(): ReactNode {
  const [settings, setSettings] = useState<HostSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Network switch: armed choice + in-flight flag. `armed` remembers which
  // network the warning was issued for, so picking the other one re-arms
  // instead of confirming a different switch than the one warned about.
  const [armed, setArmed] = useState<Network | null>(null);
  const [switching, setSwitching] = useState(false);

  // Backup reveal: a warning stage first, words only after a second explicit
  // step — the reveal can put a biometric prompt on screen, so it must never
  // fire from merely opening the row.
  const [backupOpen, setBackupOpen] = useState(false);
  const [words, setWords] = useState<string[] | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Printed backup shares. Armed once before it commits, like the other two
  // consequential controls on this screen: it puts a biometric prompt and then a print
  // or share dialogue on screen, and it produces paper that IS the wallet.
  const [sharesArmed, setSharesArmed] = useState(false);
  const [sharesBusy, setSharesBusy] = useState(false);
  const [sharesError, setSharesError] = useState<string | null>(null);
  const [sharesDone, setSharesDone] = useState<string | null>(null);
  // Read once: the capability comes from the shell's declaration at page load and
  // cannot change while this document is alive.
  const [sharesSupported] = useState(() => canCreateBackupShares());

  const [signOutArmed, setSignOutArmed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Fetched once on mount, re-read after setNetwork: the switch tears the
  // wallet down and rebuilds it, and the re-read is the only proof it took.
  useEffect(() => {
    let cancelled = false;
    readSettings()
      .then((next) => {
        if (cancelled) return;
        setSettings(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSettings(null);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  const refresh = (): void => setNonce((n) => n + 1);

  const pickNetwork = (next: Network): void => {
    if (!settings || switching || next === settings.network) return;
    if (armed !== next) {
      setArmed(next);
      return;
    }
    setArmed(null);
    setSwitching(true);
    setNetwork(next)
      .then(() => {
        toast.success(`Switched to ${NETWORK_COPY[next].label}`);
        refresh();
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setSwitching(false));
  };

  const reveal = (): void => {
    setRevealing(true);
    setBackupError(null);
    revealBackup()
      .then(({ mnemonic }) => {
        setWords(mnemonic.trim().split(/\s+/));
      })
      .catch((err: unknown) => {
        setBackupError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setRevealing(false));
  };

  const hideWords = (): void => {
    setWords(null);
    setBackupOpen(false);
  };

  const copyWords = (): void => {
    if (!words) return;
    navigator.clipboard
      .writeText(words.join(" "))
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Could not copy to the clipboard"));
  };

  /**
   * Split the wallet's entropy and let the OS print or share the pages.
   *
   * No share ever reaches this document — the shell renders the pages and hands them
   * straight to the print dialogue or share sheet, and answers with counts. Any two of
   * the three pages together are the wallet, and this is a browser chrome.
   */
  const makeShares = (): void => {
    if (!sharesArmed) {
      setSharesArmed(true);
      return;
    }
    setSharesArmed(false);
    setSharesBusy(true);
    setSharesError(null);
    setSharesDone(null);
    createBackupShares()
      .then((result) => {
        // `printed`/`shared` only mean the OS dialogue closed without error. Cancelling
        // is a decision, not a failure, so it reads as one.
        const reached = result.printed ?? result.shared ?? false;
        setSharesDone(
          reached
            ? `Any ${result.threshold} of ${result.totalShares} pages recover this wallet — store them apart.`
            : "Nothing was printed. Your wallet is unchanged.",
        );
      })
      .catch((err: unknown) => {
        // Shown verbatim: the one refusal a real user can hit explains that their
        // phrase carries no entropy and cannot be split at all.
        setSharesError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setSharesBusy(false));
  };

  const signOut = (): void => {
    if (!signOutArmed) {
      setSignOutArmed(true);
      return;
    }
    setSigningOut(true);
    // No navigation on success: the shell publishes wallet.state, and the
    // onboarding gate stands back up in front of everything by itself.
    logoutWallet()
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setSigningOut(false);
        setSignOutArmed(false);
      });
  };

  if (!settings) {
    return (
      <p
        role={error ? "alert" : "status"}
        className={`mt-6 text-sm ${error ? "text-negative" : "text-muted-foreground"}`}
      >
        {error ?? "Asking the shell…"}
      </p>
    );
  }

  const custody = CUSTODY_COPY[settings.secure.method];

  return (
    <>
      <Group
        title="Network"
        hint="Which chain every screen reads and spends on."
      >
        <Choice<Network>
          value={settings.network}
          onPick={pickNetwork}
          options={settings.networks.map((network) => ({
            id: network,
            label: NETWORK_COPY[network].label,
            hint: NETWORK_COPY[network].hint,
          }))}
        />
        {armed ? (
          <p role="alert" className="px-3 py-2.5 text-xs font-medium text-negative text-pretty">
            Switch to {NETWORK_COPY[armed].label}? Every screen switches with it
            — your funds live on mainnet. Choose it again to confirm.
          </p>
        ) : null}
        {switching ? (
          <p role="status" className="text-muted-foreground px-3 py-2.5 text-xs">
            Switching — rebuilding the wallet against the other chain…
          </p>
        ) : null}
      </Group>

      {settings.arc ? (
        <ArcGroup arc={settings.arc} onSaved={refresh} />
      ) : null}

      {settings.autoApprove ? (
        <AutoApproveGroup limit={settings.autoApprove} onSaved={refresh} />
      ) : null}

      <Group
        title="Backup"
        hint="The words are the wallet; everything else on this device is replaceable."
      >
        <Row
          label="Reveal recovery phrase"
          hint="Show the words stored on this device."
          onClick={() => {
            setBackupOpen((open) => !open);
            setWords(null);
            setBackupError(null);
          }}
        />
        {backupOpen ? (
          <div className="px-3 py-3">
            {words ? (
              <>
                <ol className="grid grid-cols-3 gap-2">
                  {words.map((word, index) => (
                    <li
                      key={index}
                      className="rounded-lg border border-border bg-surface px-2.5 py-2 font-mono text-sm"
                    >
                      <span className="text-muted-foreground mr-1.5 text-xs">
                        {index + 1}
                      </span>
                      {word}
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={copyWords}
                    className="focus-ring border-border bg-surface hover:bg-surface-hover flex-1 rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={hideWords}
                    className="focus-ring bg-accent text-accent-foreground flex-1 rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    Hide
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-xs text-pretty">
                  Anyone who sees these words can take the money. Reveal them
                  only somewhere private, and never send them to anyone.
                </p>
                {backupError ? (
                  <p role="alert" className="mt-2 text-xs text-negative">
                    {backupError}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={reveal}
                  disabled={revealing}
                  className="focus-ring bg-accent text-accent-foreground mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {revealing ? "Revealing…" : "Reveal"}
                </button>
              </>
            )}
          </div>
        ) : null}
        {/* Absent rather than dead on a shell that does not answer backup.shares —
            the same rule the ARC and spend-limit rows follow above. */}
        {sharesSupported ? (
          <>
            <button
              type="button"
              onClick={makeShares}
              disabled={sharesBusy}
              className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {sharesBusy
                    ? "Preparing pages…"
                    : sharesArmed
                      ? "Print them now?"
                      : "Create printed backup shares"}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                  {sharesArmed
                    ? "Three pages will be printed. Any two of them together are this wallet, so store each one somewhere different — and take them off the printer."
                    : "Three pages, any two of which recover this wallet — including its recovery phrase. For a phrase you would rather not keep written in one place."}
                </span>
              </span>
            </button>
            {sharesError ? (
              <p role="alert" className="px-3 pb-2.5 text-xs text-negative text-pretty">
                {sharesError}
              </p>
            ) : null}
            {sharesDone ? (
              <p role="status" className="text-muted-foreground px-3 pb-2.5 text-xs text-pretty">
                {sharesDone}
              </p>
            ) : null}
          </>
        ) : null}
        {settings.secure.method === "none" ? (
          <p role="alert" className="px-3 py-2.5 text-xs text-negative text-pretty">
            This system has no secure keystore, so the phrase is stored
            unencrypted on disk. A written copy matters more here, not less.
          </p>
        ) : null}
      </Group>

      <Group title="Security" hint="Where the keys live on this device.">
        <Row label={custody.label} hint={custody.hint} />
        <Row
          label="Secure storage"
          value={settings.secure.storedSecurely ? "Yes" : "No"}
        />
      </Group>

      <Group
        title="Sign out"
        hint="Removes the keys from this device. It does not touch the chain."
      >
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:opacity-50"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-negative">
              {signingOut
                ? "Signing out…"
                : signOutArmed
                  ? "Click again to sign out"
                  : "Sign out of this wallet"}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
              Deletes the keys from this device — not your transaction history.
              Your funds stay yours only if the recovery phrase is written down
              somewhere.
            </span>
          </span>
        </button>
      </Group>
    </>
  );
}
