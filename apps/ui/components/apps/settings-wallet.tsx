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
  logoutWallet,
  readSettings,
  revealBackup,
  setNetwork,
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

      <Group
        title="Backup"
        hint="The 12 words are the wallet; everything else on this device is replaceable."
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
