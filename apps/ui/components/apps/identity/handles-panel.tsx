"use client";

import {
  ClaimHandle,
  HandleList,
  HandleMarket,
} from "@/components/apps/identity/handle-list";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useHub } from "@/components/hub/hub-provider";
import { HandleShareSheet } from "@/components/apps/identity/share-sheet";
import { IdentitySigil } from "@/components/hub/identity-sigil";
import {
  content as contentRoot,
  getMessagePeople,
  linkedAccounts,
  socialProviders,
  type SocialProvider,
} from "@/lib/data";
import {
  activeHandleFor,
  HANDLE_GRACE_MS,
  reclaimHandle,
  releaseHandle,
  setLinked,
  setSetting,
  useSettings,
} from "@/lib/settings-store";
import {
  BadgeCheck,
  Clock,
  Copy,
  LifeBuoy,
  Link2,
  Loader2,
  QrCode,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const copy = contentRoot.identity.handles;

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && (
        <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
          {hint}
        </p>
      )}
      <div className="border-border bg-surface-raised mt-2.5 overflow-hidden rounded-xl border">
        {children}
      </div>
    </section>
  );
}

/**
 * A handle you just gave up, while it is still yours to take back.
 *
 * Counts down rather than sitting still: "you have a minute" and "you have
 * eight seconds" are different decisions, and a static label makes them look
 * the same. When it lapses the card leaves and the name is genuinely gone.
 */
function GraceCard(): ReactNode {
  const settings = useSettings();
  const previous = settings.previousHandle;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!previous) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [previous]);

  if (!previous) return null;
  const left = previous.releasesAt - now;
  if (left <= 0) {
    /* Cleared rather than left as a lapsed record: the store should not hold a
       claim that has expired. */
    releaseHandle();
    return null;
  }

  const seconds = Math.ceil(left / 1000);
  const fraction = Math.max(0, Math.min(1, left / HANDLE_GRACE_MS));

  return (
    <Card title={copy.graceTitle}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Clock
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-bold">@{previous.handle}</span>{" "}
            <span className="text-muted-foreground">
              {copy.graceBody.replace("{seconds}", String(seconds))}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              reclaimHandle(Date.now());
              toast.success(`@${previous.handle}`, {
                description: copy.reclaimed,
              });
            }}
            className="focus-ring border-border hover:bg-surface-hover shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
          >
            {copy.reclaim}
          </button>
        </div>
        <span className="bg-muted mt-2.5 block h-1 overflow-hidden rounded-full">
          <span
            className="bg-accent block h-full rounded-full"
            style={{ width: `${fraction * 100}%` }}
          />
        </span>
      </div>
    </Card>
  );
}

/**
 * Accounts vouching for the handle.
 *
 * From Vela, consent step and all. That step is the honest part: it names what
 * the service hands over, which is the username and nothing else.
 */
function LinkedAccounts(): ReactNode {
  const settings = useSettings();
  const [asking, setAsking] = useState<SocialProvider | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const provider = (id: SocialProvider) =>
    socialProviders.find((entry) => entry.id === id)!;

  const allow = (): void => {
    const account = linkedAccounts.find((entry) => entry.provider === asking);
    if (!account) return;
    setAsking(null);
    setBusy(account.id);
    window.setTimeout(() => {
      setLinked(account.id, new Date().toISOString());
      setBusy(null);
      toast.success(
        copy.linkedToast.replace("{service}", provider(account.provider).label)
      );
    }, 1400);
  };

  return (
    <>
      <Card title={copy.linkedTitle} hint={copy.linkedHint}>
        <ul className="divide-border/60 divide-y">
          {linkedAccounts.map((account) => {
            const meta = provider(account.provider);
            const attestedAt =
              account.id in settings.linked
                ? settings.linked[account.id]
                : account.attestedAt;
            const working = busy === account.id;
            return (
              <li
                key={account.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: meta.colour }}
                  aria-hidden="true"
                >
                  {meta.mark}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {meta.label}
                  </span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {attestedAt
                      ? account.handle || meta.domain
                      : working
                        ? copy.verifying
                        : copy.notLinked}
                  </span>
                </span>
                {attestedAt ? (
                  <span className="text-positive flex shrink-0 items-center gap-1 text-[11px] font-semibold">
                    <BadgeCheck className="size-4" aria-hidden="true" />
                    {copy.attested}
                  </span>
                ) : working ? (
                  <Loader2
                    className="text-muted-foreground size-4 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAsking(account.provider)}
                    className="focus-ring border-border hover:bg-surface-hover flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
                  >
                    <Link2 className="size-3.5" aria-hidden="true" />
                    {copy.link}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {asking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.consentTitle.replace(
            "{service}",
            provider(asking).label
          )}
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAsking(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="border-border bg-surface-raised w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
          >
            {/* The service's own mark and domain, because what is being judged
                is whether this looks like the real sign-in. */}
            <div className="flex items-center gap-2.5">
              <span
                className="grid size-9 place-items-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: provider(asking).colour }}
                aria-hidden="true"
              >
                {provider(asking).mark}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {provider(asking).domain}
              </span>
            </div>
            <h2 className="mt-3 text-base font-bold text-pretty">
              {copy.consentTitle.replace("{service}", provider(asking).label)}
            </h2>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed text-pretty">
              {copy.consentBody}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="focus-ring bg-muted hover:bg-surface-hover flex-1 rounded-full px-3 py-2 text-sm font-semibold"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={allow}
                className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-3 py-2 text-sm font-bold hover:opacity-90"
              >
                {copy.allow}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** What a data URL can sanely carry at the size this is shown. */
const MAX_KB = 256;

/**
 * The card somebody else sees, with a face on it.
 *
 * The picture is the button, which is the thing WhatsOnChain's uploader gets
 * right that most do not: everybody clicks their own avatar first, and a
 * preview that ignores the click while a button beside it does the work is a
 * control somebody has to be taught.
 *
 * Read to a data URL in the browser. There is no object store behind this
 * prototype, and a data URL is the honest stand-in — it genuinely appears
 * wherever the avatar is used rather than faking a progress bar.
 */
function ShareCard(): ReactNode {
  const settings = useSettings();
  const { activeSpaceId } = useHub();
  const handle = activeHandleFor(activeSpaceId);
  const input = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(sheet);
  const link = `https://nexus.build/@${handle}`;

  const attested = linkedAccounts.filter((account) =>
    account.id in settings.linked
      ? settings.linked[account.id]
      : account.attestedAt
  );

  const pick = (file: File): void => {
    setError(null);
    if (file.size > MAX_KB * 1024) {
      setError(
        copy.avatarTooBig
          .replace("{size}", String(Math.round(file.size / 1024)))
          .replace("{max}", String(MAX_KB))
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSetting("avatar", String(reader.result));
      toast.success(copy.avatarSaved);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card title={copy.shareTitle} hint={copy.shareHint}>
      {/* The share modal's accent bloom, so the thing you hand somebody looks
          like an object rather than another settings row. */}
      <div
        className="flex items-center gap-4 p-5"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%)",
        }}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={settings.avatar ? copy.avatarReplace : copy.avatarUpload}
          className="focus-ring group relative size-24 shrink-0 overflow-hidden rounded-2xl"
        >
          {settings.avatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={settings.avatar}
              alt=""
              aria-hidden="true"
              className="size-full object-cover"
            />
          ) : (
            /* The generated mark: what everybody has before they upload
               anything, and what they fall back to if they remove it. */
            <IdentitySigil value={handle} size={96} className="rounded-2xl" />
          )}
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Upload className="size-5 text-white" aria-hidden="true" />
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) pick(file);
            event.target.value = "";
          }}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">@{handle}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
            {attested.length > 0
              ? copy.shareAttested
                  .replace("{count}", String(attested.length))
                  .replace("{s}", attested.length === 1 ? "" : "s")
              : copy.shareNone}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  void navigator.clipboard?.writeText(link);
                } catch {
                  /* clipboard unavailable — the button still confirms */
                }
                toast.success(copy.copied, { description: link });
              }}
              className="focus-ring border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              {copy.copyLink}
            </button>
            {/* A button, not a picture of one. This was a 36px icon of a code:
                nothing could scan it and nothing could read it, so the only
                honest thing it can be is the way into one big enough to use. */}
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label={copy.sheetOpen}
              title={copy.sheetOpen}
              className="focus-ring grid size-9 shrink-0 place-items-center rounded-lg bg-white transition-transform hover:scale-105"
            >
              <QrCode
                className="size-6 text-black"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
            {settings.avatar && (
              <button
                type="button"
                onClick={() => {
                  setSetting("avatar", null);
                  toast.success(copy.avatarRemoved);
                }}
                className="focus-ring text-muted-foreground hover:text-negative text-xs font-semibold"
              >
                {copy.avatarRemove}
              </button>
            )}
          </div>
          {error && (
            <p className="text-negative mt-2 text-[11px] text-pretty">
              {error}
            </p>
          )}
        </div>
      </div>
      {sheet && (
        <HandleShareSheet
          handle={handle}
          link={link}
          onClose={() => setSheet(false)}
        />
      )}
    </Card>
  );
}

/**
 * Who could vouch you back in.
 *
 * Named here and honest about being unbuilt: social recovery is a funded card
 * on the roadmap, and a page about identity that omitted it would let somebody
 * assume their handle survives a lost laptop. It does not yet.
 */
function RecoveryCard(): ReactNode {
  const { openApp, openDetailPane } = useHub();
  const candidates = getMessagePeople()
    .filter((person) => (person.socials ?? []).length > 0)
    .slice(0, 3);

  return (
    <Card title={copy.recoveryTitle} hint={copy.recoveryHint}>
      <div className="p-4">
        <p className="text-muted-foreground text-[11px] text-pretty">
          {candidates.length > 0 ? copy.recoveryPending : copy.recoveryNone}
        </p>
        {candidates.length > 0 && (
          <ul className="mt-3 space-y-2">
            {candidates.map((person) => (
              <li key={person.id} className="flex items-center gap-2.5">
                <MemberAvatar person={person} size={24} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {person.name}
                </span>
                <Handle
                  person={person}
                  size={10}
                  className="text-muted-foreground shrink-0 text-[10px]"
                />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            openApp("roadmap");
            openDetailPane({ kind: "feature", id: "social-recovery" });
          }}
          className="focus-ring border-border hover:bg-surface-hover mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
        >
          <LifeBuoy className="size-3.5" aria-hidden="true" />
          {copy.recoveryOpen}
        </button>
      </div>
    </Card>
  );
}

export function HandlesPanel(): ReactNode {
  return (
    <div className="mx-auto max-w-2xl">
      <Card title={copy.yoursTitle} hint={copy.yoursHint}>
        <HandleList />
        <div className="border-border/60 border-t">
          <ClaimHandle />
        </div>
      </Card>
      <Card title={copy.marketTitle} hint={copy.marketHint}>
        <HandleMarket />
      </Card>
      <GraceCard />
      <ShareCard />
      <LinkedAccounts />
      <RecoveryCard />
    </div>
  );
}
