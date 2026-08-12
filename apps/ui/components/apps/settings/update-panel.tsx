"use client";

/**
 * Settings › About › Updates, on a build that actually has an updater.
 *
 * What this replaced was a Stable/Beta channel picker with a beta-warning
 * dialog, inherited from the design repository, behind which there was nothing
 * at all — a switch with no wire. Channels are a later conversation; being on
 * the current version is this one, so the group says what the updater is doing
 * and offers the one action that is genuinely the user's.
 *
 * Downloading is not offered because it is not a decision: the shell fetches an
 * update as soon as it sees one. Restarting IS a decision, and never ours —
 * quitAndInstall closes the app, and doing that to somebody mid-payment would be
 * its own kind of wrong.
 */

import { Group, Row } from "@/components/apps/settings/blocks";
import { PRIMARY_CTA } from "@/components/hub/cta";
import {
  checkForUpdate,
  installUpdate,
  sinceLabel,
  useUpdateState,
} from "@/lib/update-data";
import { content } from "@/lib/data";
import { Download, RefreshCw, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Where a Linux package user goes, since we cannot update them in place. */
const RELEASES_URL = "https://github.com/bsv-blockchain/nexus/releases/latest";

export function UpdatePanel(): ReactNode {
  const copy = content.settings.about;
  const state = useUpdateState();
  const [checking, setChecking] = useState(false);

  // No shell, or one that has not answered yet. The release-notes row above this
  // is still worth showing, so the group simply is not drawn.
  if (!state) return null;

  /*
   * A .deb (or any distro package). electron-updater cannot replace a file the
   * package manager owns, so the honest thing is to say so and point at the
   * download — rather than run a checker whose answer could never be acted on.
   */
  if (!state.supported) {
    if (state.reason === "dev") return null;
    return (
      <Group title={copy.channelTitle} hint={copy.updateManualHint}>
        <Row
          label={copy.updateManualLabel}
          hint={copy.updateManualRow}
          value={copy.updateOpen}
          onClick={() => window.open(RELEASES_URL, "_blank", "noopener")}
        />
      </Group>
    );
  }

  const busy = checking || state.checking;

  const status = state.error
    ? copy.updateError
    : state.ready
      ? `${copy.updateReady} ${state.available ?? ""}`.trim()
      : state.downloading
        ? `${copy.updateDownloading} ${state.percent}%`
        : busy
          ? copy.updateChecking
          : state.available
            ? `${copy.updateFound} ${state.available}`
            : copy.updateCurrent;

  const checked = sinceLabel(state.lastCheckedAt);

  return (
    <Group title={copy.channelTitle} hint={copy.updateHint}>
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{status}</span>
          <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
            {state.error
              ? state.error
              : checked
                ? `${copy.updateChecked} ${checked}`
                : copy.updateNeverChecked}
          </span>
        </span>

        {state.ready ? (
          <button
            type="button"
            onClick={() => void installUpdate()}
            className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${PRIMARY_CTA}`}
          >
            <RotateCw className="size-3.5" aria-hidden="true" />
            {copy.updateRestart}
          </button>
        ) : state.downloading ? (
          <Download
            className="text-muted-foreground size-4 shrink-0 animate-pulse"
            aria-hidden="true"
          />
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setChecking(true);
              void checkForUpdate().finally(() => setChecking(false));
            }}
            className="focus-ring bg-muted hover:bg-surface-hover flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${busy ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {copy.updateCheck}
          </button>
        )}
      </div>

      {/* A progress track only while there is progress to show. A bar sitting at
          zero reads as stalled, which is the one thing it is not. */}
      {state.downloading && (
        <div className="px-3.5 pb-3">
          <div className="bg-muted h-1 overflow-hidden rounded-full">
            <div
              className="bg-accent h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.max(2, state.percent)}%` }}
            />
          </div>
        </div>
      )}
    </Group>
  );
}
