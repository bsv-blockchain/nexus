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
 * Four ways through: create a new wallet, restore from a recovery phrase, restore from
 * printed backup shares, or — when the shell says it is still deriving keys — wait.
 *
 * Create follows bsv-browser's shape: the shell stores the phrase BEFORE the reveal, so
 * abandoning the flow mid-backup loses nothing, and an acknowledgement checkbox (or a
 * copy, which proves the same intent) gates Continue instead of a quiz.
 *
 * Share recovery ends in that SAME reveal, and that is the point of BRC-157: the shares
 * reconstruct the wallet's entropy, so a successful recovery hands the words back. Under
 * the old scheme the shares split the operational key and a share-recovered wallet could
 * never produce a phrase at all — which is the one case below that still cannot, and it
 * says so.
 */

import {
  createWallet,
  isWordCount,
  restoreFromShares,
  restoreWallet,
  useHostOverlay,
  useWalletInfo,
  WORD_COUNTS,
  type WordCount,
} from "@/lib/wallet-data";
import { useState, type ReactNode } from "react";

type GateMode = "choose" | "create" | "restore" | "shares";

/** Where a revealed phrase came from, which decides the copy around it. */
type RevealSource = "created" | "recovered";

export function WalletGate(): ReactNode {
  const info = useWalletInfo();
  const [mode, setMode] = useState<GateMode>("choose");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The generated (or share-recovered) phrase, held only between the shell handing it
  // over and the user confirming it is written down. Never anywhere more durable.
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [revealSource, setRevealSource] = useState<RevealSource>("created");
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  // Share recovery. `shareText` is one share per line; the words the shares recover are
  // not known until the shell answers, so the count is asked for rather than inferred.
  const [shareText, setShareText] = useState("");
  const [shareWordCount, setShareWordCount] = useState<WordCount | null>(null);
  const [legacy, setLegacy] = useState(false);
  // Set when a legacy recovery succeeded: there is no phrase, and pretending otherwise
  // would be the worst possible lie on this screen.
  const [legacyDone, setLegacyDone] = useState(false);

  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const wellFormed = isWordCount(words.length);

  const shares = shareText
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  // Shape only. Whether they belong together is the shell's answer, because only it can
  // compare integrity tags — and only it may hold enough of them to try.
  const shareShaped = shares.length >= 2 && shares.every((s) => s.split(".").length === 4);

  /*
   * The shell reports ready the moment create finishes building, and the
   * wallet.state push re-reads info right then — which would unmount this gate
   * while the words are still on screen. Holding the gate open for as long as a
   * flow is mid-air or a phrase is showing is what makes Continue, not the
   * shell, decide when the words disappear.
   *
   * `error` is held for the same reason and it is not hypothetical: on Android,
   * create built the wallet and then reported a failure, so the wallet went
   * ready, the gate unmounted, and the message explaining what had happened went
   * with it — leaving a wallet whose owner had never seen its recovery phrase and
   * no indication anything was wrong. A screen that fails must stay on screen.
   */
  const flowHeld = busy || mnemonic !== null || legacyDone || error !== null;

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
      setRevealSource("created");
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

  const finishReveal = (): void => {
    // Clear before re-reading: the words should not outlive the acknowledgement.
    setMnemonic(null);
    setCopied(false);
    setAcknowledged(false);
    setLegacyDone(false);
    setShareText("");
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

  const submitShares = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      // Built conditionally: `exactOptionalPropertyTypes` refuses an explicit
      // `undefined`, and omitting the count is what asks the shell to fall back to
      // BRC-157's heuristic rather than to guess 24.
      const result = await restoreFromShares(shares, {
        ...(shareWordCount === null ? {} : { wordCount: shareWordCount }),
        legacy,
      });
      // Clear before anything re-renders: the shares are as sensitive as the phrase.
      setShareText("");
      if (result.mnemonic) {
        setRevealSource("recovered");
        setMnemonic(result.mnemonic);
      } else {
        setLegacyDone(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /** The words, and the acknowledgement that gates leaving them behind. */
  const revealPanel = (words_: string): ReactNode => (
    <>
      <ol className="mt-5 grid grid-cols-3 gap-2">
        {words_
          .trim()
          .split(/\s+/)
          .map((word, index) => (
            <li
              key={index}
              className="rounded-lg border border-border bg-surface px-2.5 py-2 font-mono text-sm"
            >
              <span className="mr-1.5 text-xs text-muted-foreground">{index + 1}</span>
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
  );

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

    // A legacy share recovery has no phrase and never will. Say it plainly rather than
    // sending the user to a Reveal screen that can only fail.
    if (legacyDone) {
      return (
        <>
          <h1 className="text-xl font-bold">Wallet recovered</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These shares were printed before Nexus rooted backups in entropy, so they
            recover the wallet&rsquo;s key but not a recovery phrase — there is no set of
            words for this wallet, and Nexus cannot make one. Keep the shares you have;
            they remain its only backup.
          </p>
          <button
            type="button"
            onClick={finishReveal}
            className="focus-ring mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
          >
            Continue
          </button>
        </>
      );
    }

    if (mode === "create" || (mnemonic !== null && revealSource === "recovered")) {
      const recovered = revealSource === "recovered";
      return (
        <>
          <h1 className="text-xl font-bold">
            {recovered ? "Your recovery phrase, recovered" : "Your recovery phrase"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {recovered
              ? "Your backup shares carried the wallet itself, so these are its words. " +
                "Write them down — a phrase you hold is a backup that needs no printer."
              : "These 24 words are the wallet. Anyone who has them controls the money, " +
                "and Nexus cannot recover them for you — write them down and keep them " +
                "somewhere offline."}
          </p>

          {busy ? (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              {recovered ? "Recovering…" : "Creating…"}
            </p>
          ) : null}

          {mnemonic ? revealPanel(mnemonic) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-negative">
              {error}
            </p>
          ) : null}

          {mnemonic ? (
            <button
              type="button"
              disabled={!acknowledged}
              onClick={finishReveal}
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
            Enter your 12-, 15-, 18-, 21- or 24-word recovery phrase. It is handed
            straight to this device&rsquo;s keychain and never leaves it.
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

    if (mode === "shares") {
      return (
        <>
          <h1 className="text-xl font-bold">Restore from backup shares</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the shares from your printed pages, one per line. You need as many as
            the pages say — usually any two of three.
          </p>

          <textarea
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            rows={5}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={"share…\nshare…"}
            aria-label="Backup shares, one per line"
            className="focus-ring mt-4 w-full resize-none rounded-xl border border-border bg-surface p-3 font-mono text-xs outline-none"
          />

          <div className="mt-2 text-xs text-muted-foreground">
            {shares.length} {shares.length === 1 ? "share" : "shares"} entered
          </div>

          {/* The one fact the shares themselves cannot carry. Printed on the page for
              exactly this moment; skipping it makes the shell guess from leading zero
              bytes, which is right for most phrases and not for all of them. */}
          <fieldset className="mt-4">
            <legend className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Phrase length on the page
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WORD_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setShareWordCount(shareWordCount === count ? null : count)}
                  aria-pressed={shareWordCount === count}
                  className={`focus-ring rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    shareWordCount === count
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface hover:bg-surface-hover"
                  }`}
                >
                  {count} words
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {shareWordCount === null
                ? "Not sure? Leave it unset and Nexus will work it out."
                : `The page says these shares recover a ${shareWordCount}-word phrase.`}
            </p>
          </fieldset>

          <label className="mt-4 flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={legacy}
              onChange={(e) => setLegacy(e.target.checked)}
              className="focus-ring mt-0.5 size-4 accent-accent"
            />
            <span>
              These pages were printed by BSV Browser or MetaNet Mobile
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Older pages split the wallet&rsquo;s key rather than its entropy. The
                shares look identical either way, so only you can tell us — and a wallet
                recovered from those has no recovery phrase.
              </span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-negative">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!shareShaped || busy}
            onClick={() => void submitShares()}
            className="focus-ring mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            {busy ? "Recovering…" : "Recover wallet"}
          </button>

          <button
            type="button"
            onClick={() => goTo("choose")}
            className="focus-ring mt-3 w-full rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back
          </button>
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

        <button
          type="button"
          onClick={() => goTo("shares")}
          className="focus-ring mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold hover:bg-surface-hover"
        >
          Restore from backup shares
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
