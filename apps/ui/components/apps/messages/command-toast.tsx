"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { TokenMark, formatUnits } from "@/components/apps/wallet/token-mark";
import { EcosystemMark } from "@/components/apps/messages/ecosystem-tag";
import { AppTile } from "@/components/hub/app-icon";
import {
  content,
  getEcosystem,
  getHubApp,
  getToken,
  type EcosystemId,
  type MessagePerson,
} from "@/lib/data";
import { formatSats, handleOf } from "@/lib/messages";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

/**
 * The thing a toast is about, so it can show the right image rather than a
 * generic tick: a person's avatar, a token's mark, an ecosystem's logo, or an
 * app's tile.
 */
export type ToastSubject =
  | { kind: "person"; person: MessagePerson }
  | { kind: "token"; tokenId: string; units: number }
  | { kind: "ecosystem"; ecosystem: EcosystemId }
  | { kind: "app"; slug: string }
  | { kind: "none" };

function SubjectImage({ subject }: { subject: ToastSubject }): ReactNode {
  switch (subject.kind) {
    case "person":
      return <MemberAvatar person={subject.person} size={34} />;
    case "token": {
      const token = getToken(subject.tokenId);
      return token ? <TokenMark token={token} size={34} /> : null;
    }
    case "ecosystem":
      return (
        <span
          className="grid size-[34px] place-items-center rounded-lg bg-surface"
          aria-hidden="true"
        >
          <EcosystemMark ecosystem={subject.ecosystem} size={22} />
        </span>
      );
    case "app": {
      const app = getHubApp(subject.slug as never);
      return app ? <AppTile app={app} size={34} /> : null;
    }
    default:
      return null;
  }
}

/** Trailing detail line, built from whatever the toast is about. */
function subjectLine(subject: ToastSubject): string | null {
  switch (subject.kind) {
    case "person":
      return handleOf(subject.person);
    case "token": {
      const token = getToken(subject.tokenId);
      return token
        ? `${formatUnits(subject.units, token.decimals)} ${token.symbol}`
        : null;
    }
    case "ecosystem":
      return getEcosystem(subject.ecosystem)?.name ?? null;
    case "app":
      return getHubApp(subject.slug as never)?.name ?? null;
    default:
      return null;
  }
}

/**
 * A command's success toast.
 *
 * Built as a custom sonner toast rather than a string so it can carry the right
 * image and read the theme's own tokens — the surface, border and accent all
 * come from CSS custom properties, so it follows a custom theme and light/dark
 * without a second set of colours to maintain.
 */
export function commandToast({
  verb,
  title,
  detail,
  subject = { kind: "none" },
  tone = "success",
}: {
  verb: string;
  title: string;
  /** short second line; falls back to the subject's own label */
  detail?: string;
  subject?: ToastSubject;
  tone?: "success" | "info" | "warning";
}): void {
  const line = detail ?? subjectLine(subject);
  const accent =
    tone === "warning"
      ? "text-warning"
      : tone === "info"
        ? "text-muted-foreground"
        : "text-positive";

  toast.custom(
    (id) => (
      <div className="group relative flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-raised px-3.5 py-3 shadow-2xl">
        {/* Matches the default toasts' dismiss: top-right, neutral, on hover. */}
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          aria-label={content.messages.card.dismiss}
          className="focus-ring absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-border bg-surface-raised text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
        <SubjectImage subject={subject} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <code
              className={`shrink-0 font-mono text-[11px] font-bold ${accent}`}
            >
              /{verb}
            </code>
            <span className="min-w-0 truncate text-sm font-semibold">
              {title}
            </span>
          </p>
          {line && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {line}
            </p>
          )}
        </div>
      </div>
    ),
    { duration: 4200 },
  );
}

/** Plain-text formatter for amounts inside a toast title. */
export function toastSats(sats: number): string {
  return formatSats(sats);
}
