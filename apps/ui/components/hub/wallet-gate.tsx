"use client";

/**
 * Onboarding, and the honest answer to "is there a wallet here at all?".
 *
 * In demo mode this renders nothing — the fixtures already describe a funded
 * wallet, which is the whole point of demo mode. In live mode it stands in front of
 * everything until the shell reports a wallet that is actually ready, because every
 * screen behind it would otherwise show zeroes that look like a bug rather than like
 * an empty state.
 */

import { restoreWallet, useHostOverlay, useWalletInfo } from "@/lib/wallet-data";
import { useState, type ReactNode } from "react";

export function WalletGate(): ReactNode {
  const info = useWalletInfo();
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const wellFormed = words.length === 12 || words.length === 24;

  // Nothing to gate: demo fixtures, or a wallet that is up.
  const blocking =
    info.mode === "live" && !info.loading && info.data.available && !info.data.ready;

  // The shell's tab WebViews paint above this document; without this a browsed page
  // would sit on top of the onboarding panel.
  useHostOverlay(blocking);

  if (!blocking) return null;

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await restoreWallet(phrase);
      // Clear before re-reading: the words should not outlive the call.
      setPhrase("");
      info.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background p-5">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-bold">Restore your wallet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your 12- or 24-word recovery phrase. It is handed straight to this
          device&rsquo;s keychain and never leaves it.
        </p>

        <textarea
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          rows={4}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="word word word…"
          aria-label="Recovery phrase"
          className="focus-ring mt-4 w-full resize-none rounded-xl border border-border bg-surface p-3 font-mono text-sm outline-none"
        />

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {words.length} {words.length === 1 ? "word" : "words"}
          </span>
          {info.data.network ? <span>{info.data.network}net</span> : null}
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-negative">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!wellFormed || busy}
          onClick={() => void submit()}
          className="focus-ring mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Restoring…" : "Restore wallet"}
        </button>

        {info.error ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Shell reported: {info.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
