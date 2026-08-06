"use client";

/**
 * Onboarding, and the honest answer to "is there a wallet here at all?".
 *
 * In demo mode this renders nothing — the fixtures already describe a funded
 * wallet, which is the whole point of demo mode. In live mode it stands in front of
 * everything until the shell reports a wallet that is actually ready, because every
 * screen behind it would otherwise show zeroes that look like a bug rather than like
 * an empty state.
 *
 * Three ways through: create a new wallet, restore from a recovery phrase, or —
 * when the shell says it is still deriving keys — wait. Create follows
 * bsv-browser's shape: the shell stores the phrase BEFORE the reveal, so
 * abandoning the flow mid-backup loses nothing, and an acknowledgement checkbox
 * (or a copy, which proves the same intent) gates Continue instead of a quiz.
 */

import {
  createWallet,
  restoreWallet,
  useHostOverlay,
  useWalletInfo,
} from "@/lib/wallet-data";
import { useState, type ReactNode } from "react";

type GateMode = "choose" | "create" | "restore";

export function WalletGate(): ReactNode {
  const info = useWalletInfo();
  const [mode, setMode] = useState<GateMode>("choose");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The generated phrase, held only between the shell handing it over and the
  // user confirming it is written down. Never anywhere more durable than this.
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const wellFormed = words.length === 12 || words.length === 24;

  /*
   * The shell reports ready the moment create finishes building, and the
   * wallet.state push re-reads info right then — which would unmount this gate
   * while the words are still on screen. Holding the gate open for as long as a
   * flow is mid-air or a phrase is showing is what makes Continue, not the
   * shell, decide when the words disappear.
   */
  const flowHeld = busy || mnemonic !== null;

  // Nothing to gate: demo fixtures, or a wallet that is up.
  const blocking =
    (info.mode === "live" && !info.loading && info.data.available && !info.data.ready) ||
    flowHeld;

  // The shell's tab WebViews paint above this document; without this a browsed page
  // would sit on top of the onboarding panel.
  useHostOverlay(blocking);

  if (!blocking) return null;

  const goTo = (next: GateMode): void => {
    setMode(next);
    setError(null);
  };

  const startCreate = async (): Promise<void> => {
    goTo("create");
    setBusy(true);
    try {
      const created = await createWallet();
      setMnemonic(created.mnemonic);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copyPhrase = async (): Promise<void> => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      // Copying is as deliberate as ticking the box — same rule as bsv-browser.
      setAcknowledged(true);
    } catch {
      setError("Could not copy to the clipboard — write the words down instead.");
    }
  };

  const finishCreate = (): void => {
    // Clear before re-reading: the words should not outlive the acknowledgement.
    setMnemonic(null);
    setCopied(false);
    setAcknowledged(false);
    setMode("choose");
    info.refresh();
  };

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

  const body = ((): ReactNode => {
    // Keys are deriving — a spinner state, not a form. Only when no flow on
    // this side is mid-air, so a restore or create in flight keeps its own
    // busy label instead of being swapped out from under the user.
    if (info.data.building && !flowHeld) {
      return (
        <div role="status">
          <h1 className="text-xl font-bold">Preparing your wallet…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Deriving keys on this device. This can take a moment.
          </p>
        </div>
      );
    }

    if (mode === "create") {
      return (
        <>
          <h1 className="text-xl font-bold">Your recovery phrase</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These 12 words are the wallet. Anyone who has them controls the
            money, and Nexus cannot recover them for you — write them down and
            keep them somewhere offline.
          </p>

          {busy ? (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              Creating…
            </p>
          ) : null}

          {mnemonic ? (
            <>
              <ol className="mt-5 grid grid-cols-3 gap-2">
                {mnemonic
                  .trim()
                  .split(/\s+/)
                  .map((word, index) => (
                    <li
                      key={index}
                      className="rounded-lg border border-border bg-surface px-2.5 py-2 font-mono text-sm"
                    >
                      <span className="mr-1.5 text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      {word}
                    </li>
                  ))}
              </ol>

              <button
                type="button"
                onClick={() => void copyPhrase()}
                className="focus-ring mt-3 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-hover"
              >
                {copied ? "Copied" : "Copy to clipboard"}
              </button>

              <label className="mt-4 flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="focus-ring mt-0.5 size-4 accent-accent"
                />
                <span>I wrote these words down somewhere safe</span>
              </label>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-negative">
              {error}
            </p>
          ) : null}

          {mnemonic ? (
            <button
              type="button"
              disabled={!acknowledged}
              onClick={finishCreate}
              className="focus-ring mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              Continue
            </button>
          ) : null}

          {/* A way out only before the shell has handed words over: once they
              exist, the wallet exists, and the path forward is Continue. */}
          {!busy && !mnemonic ? (
            <button
              type="button"
              onClick={() => goTo("choose")}
              className="focus-ring mt-3 w-full rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          ) : null}
        </>
      );
    }

    if (mode === "restore") {
      return (
        <>
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

          <button
            type="button"
            onClick={() => goTo("choose")}
            className="focus-ring mt-3 w-full rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back
          </button>

          {info.error ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Shell reported: {info.error}
            </p>
          ) : null}
        </>
      );
    }

    return (
      <>
        <h1 className="text-xl font-bold">Set up your wallet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This device has no wallet yet. Create a new one, or bring back one you
          already have.
        </p>

        <button
          type="button"
          onClick={() => void startCreate()}
          className="focus-ring mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          Create a new wallet
        </button>

        <button
          type="button"
          onClick={() => goTo("restore")}
          className="focus-ring mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold hover:bg-surface-hover"
        >
          Restore from recovery phrase
        </button>

        {info.error ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Shell reported: {info.error}
          </p>
        ) : null}
      </>
    );
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background p-5">
      <div className="w-full max-w-md">{body}</div>
    </div>
  );
}
