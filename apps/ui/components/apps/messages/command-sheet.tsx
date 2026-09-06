"use client";

import { CollectibleArt } from "@/components/apps/wallet/collectible-art";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { Sheet } from "@/components/apps/messages/sheet";
import {
  content,
  type ChatMessage,
  type MediaItem,
  type MessagePerson,
} from "@/lib/data";
import { originLabel, splitLegs, type ParsedCommand } from "@/lib/commands";
import { delegationsFor } from "@/lib/command-effects";
import { TokenAmount } from "@/components/apps/wallet/token-mark";
import { getToken } from "@/lib/data";
import { formatFiat, formatSats } from "@/lib/messages";
import { useUsdPerBsv } from "@/lib/exchange-rate";
import {
  AlertTriangle,
  Ban,
  Coins,
  Eye,
  EyeOff,
  Info,
  Paperclip,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { useState, type ReactNode } from "react";

function Line({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground shrink-0 text-xs">{label}</dt>
      <dd
        className={`min-w-0 text-right text-sm ${strong ? "font-bold" : "font-medium"}`}
      >
        {children}
      </dd>
    </div>
  );
}

function Recipient({ person }: { person: MessagePerson }): ReactNode {
  return (
    <span className="inline-flex items-center gap-2">
      <MemberAvatar person={person} size={20} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">
          {person.name}
        </span>
        {/* Section 4.3: always the fully-qualified form, never a bare alias. */}
        <Handle
          person={person}
          size={10}
          className="text-muted-foreground max-w-full truncate text-[11px]"
        />
      </span>
    </span>
  );
}

/**
 * The structured confirmation BRC-218 section 4.1 requires before anything that
 * moves value, issues or revokes a certificate, or changes reachability.
 *
 * It shows the verb, the fully-qualified recipient, the amount in both
 * satoshis and the typed fiat, and a plain statement of the effect. Blocking
 * problems — an unresolved handle, a changed key, an unconvertible currency —
 * are surfaced here and prevent execution until acknowledged (section 4.6).
 */
export function CommandSheet({
  command,
  boundMessage,
  boundSender,
  attachments = [],
  onCancel,
  onConfirm,
}: {
  command: ParsedCommand | null;
  boundMessage?: ChatMessage | undefined;
  boundSender?: MessagePerson | undefined;
  /** files staged on the draft, which `/once` seals rather than sends */
  attachments?: MediaItem[];
  onCancel: () => void;
  onConfirm: (command: ParsedCommand) => void;
}): ReactNode {
  const copy = content.messages.confirm;
  /* The rate this sheet is quoting is the rate the amount was converted at, so
     it is read here rather than written down. */
  const usdPerBsv = useUsdPerBsv();
  const [wildcardConfirmed, setWildcardConfirmed] = useState(false);
  const [chosenSerial, setChosenSerial] = useState<string | null>(null);
  /*
   * The `/once` payload is masked here too, and shown on request.
   *
   * The check that matters in this sheet is the handle: sealing to the wrong key
   * cannot be undone and cannot be resent. The secret itself was typed seconds
   * ago, so showing it by default buys almost nothing and puts a credential on
   * screen in a room that may have other people in it.
   */
  const [peek, setPeek] = useState(false);

  if (!command) {
    return (
      <Sheet open={false} onClose={onCancel} label="">
        {null}
      </Sheet>
    );
  }

  const spec = command.spec;
  const verb = command.verb;
  const blocked = command.errors.length > 0;
  const reserved = Boolean(spec?.reserved);
  const unsupported = !spec;

  // Section 5.11: issuing `*` scope needs an additional, distinct confirmation.
  const wildcard = verb === "delegate" && command.scope === "*";

  // Section 5.12: where more than one certificate was issued to the recipient
  // and no serial was given, list them and require a selection. Guessing which
  // one to spend is not an option.
  const revokeTarget = command.recipients[0]?.person;
  const revokeCandidates =
    verb === "revoke" && revokeTarget ? delegationsFor(revokeTarget.id) : [];
  const needsPick =
    verb === "revoke" && !command.serial && revokeCandidates.length > 1;
  const serial = command.serial ?? chosenSerial ?? revokeCandidates[0]?.serial;
  const toll = command.recipients[0]?.person?.tollSats ?? 0;
  const showToll = (verb === "pay" || verb === "message") && toll > 0;
  /* A /pay naming several handles divides like a /split, so the sheet shows
     the same per-recipient breakdown — the figure a payer needs to check is
     what each one gets, not what they typed. */
  const legs =
    (verb === "split" || (verb === "pay" && command.recipients.length > 1)) &&
    command.amount
      ? splitLegs(command.amount.sats, command.recipients.length)
      : [];

  const canConfirm =
    !blocked &&
    !reserved &&
    !unsupported &&
    (!wildcard || wildcardConfirmed) &&
    (!needsPick || Boolean(chosenSerial));

  const title = spec ? `/${verb}` : `/${verb}`;

  return (
    <Sheet
      open
      onClose={onCancel}
      label={`${copy.title} /${verb}`}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring border-border hover:bg-surface-hover flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold"
          >
            {blocked || reserved || unsupported ? copy.close : copy.cancel}
          </button>
          {canConfirm && (
            <button
              type="button"
              onClick={() =>
                onConfirm(
                  verb === "revoke" && serial ? { ...command, serial } : command
                )
              }
              className="focus-ring bg-accent text-accent-foreground flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            >
              {copy.confirmVerb[verb as keyof typeof copy.confirmVerb] ??
                copy.confirm}
            </button>
          )}
        </div>
      }
    >
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center gap-2">
          <code className="bg-surface rounded-md px-2 py-1 font-mono text-sm font-bold">
            {title}
          </code>
          {spec && !reserved && (
            <span className="text-muted-foreground text-[11px]">
              {originLabel(spec)}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-sm text-pretty">
          {unsupported
            ? copy.unsupported
            : reserved
              ? copy.reserved
              : (copy.effect[verb as keyof typeof copy.effect] ??
                spec?.summary)}
        </p>

        {/* Blocking problems first — nothing below them can be actioned. */}
        {command.errors.length > 0 && (
          <ul className="mt-4 space-y-2">
            {command.errors.map((error) => (
              <li
                key={error}
                className="bg-negative/10 flex items-start gap-2 rounded-lg p-2.5 text-xs text-pretty"
              >
                {reserved || unsupported ? (
                  <Ban
                    className="text-muted-foreground mt-px size-4 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldAlert
                    className="text-negative mt-px size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{error}</span>
              </li>
            ))}
          </ul>
        )}

        {/*
          The thing itself, before the sentence about it.

          A collectible is identified by looking at it. Confirming a transfer
          against an id and a name asks the user to verify from the label on
          the box, which is exactly the check people skip.
        */}
        {!blocked && command.asset && (
          <div className="border-border mt-4 flex items-center gap-3 rounded-xl border p-2.5">
            <span className="relative shrink-0">
              <CollectibleArt
                src={command.asset.imageUrl}
                className="size-14 rounded-lg object-cover"
              />
              <span className="absolute right-0.5 bottom-0.5 rounded-full bg-black/70 px-1 text-[9px] font-bold text-white tabular-nums">
                #{command.asset.serialNumber}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {command.asset.name}
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                {command.asset.org ?? content.messages.transfer.asset}
              </span>
            </span>
          </div>
        )}

        {!blocked && !reserved && !unsupported && (
          <dl className="divide-border border-border mt-4 divide-y border-t">
            {command.recipients.length === 1 &&
              command.recipients[0]?.person && (
                <Line
                  label={
                    command.recipients[0].implicit
                      ? copy.recipientImplied
                      : copy.recipient
                  }
                >
                  <Recipient person={command.recipients[0].person} />
                </Line>
              )}

            {command.recipients.length > 1 && (
              <div className="py-2">
                <dt className="text-muted-foreground mb-1.5 text-xs">
                  {copy.recipients} ({command.recipients.length})
                </dt>
                <dd className="space-y-1.5">
                  {command.recipients.map((recipient, index) =>
                    recipient.person ? (
                      <div
                        key={recipient.raw}
                        className="flex items-center justify-between gap-3"
                      >
                        <Recipient person={recipient.person} />
                        {legs[index] !== undefined && (
                          <span className="shrink-0 text-sm font-bold">
                            {formatSats(legs[index]!)}
                          </span>
                        )}
                      </div>
                    ) : null
                  )}
                </dd>
              </div>
            )}

            {boundMessage && (
              <div className="py-2">
                <dt className="text-muted-foreground mb-1 text-xs">
                  {verb === "sign" ? copy.signing : copy.boundTo}
                </dt>
                <dd className="bg-surface rounded-lg p-2.5 text-xs text-pretty">
                  {boundSender && (
                    <span className="mb-1 block font-semibold">
                      {boundSender.name}
                    </span>
                  )}
                  {boundMessage.text || copy.noText}
                </dd>
              </div>
            )}

            {command.amount?.token && (
              <>
                <Line label={copy.amount} strong>
                  <TokenAmount
                    tokenId={command.amount.token.id}
                    units={command.amount.token.units}
                    size={15}
                  />
                </Line>
                <Line label={copy.issuedBy}>
                  {getToken(command.amount.token.id)?.name}
                </Line>
                <Line label={copy.estimatedValue}>
                  {formatFiat(
                    command.amount.token.units *
                      (getToken(command.amount.token.id)?.usdPerUnit ?? 0)
                  )}
                </Line>
              </>
            )}

            {command.amount && !command.amount.token && (
              <>
                {/* Section 3.4: satoshis alongside the typed fiat, always. */}
                <Line label={copy.amount} strong>
                  {formatSats(command.amount.sats)}
                </Line>
                {command.amount.fiat && (
                  <Line label={copy.typedAs}>
                    {formatFiat(
                      command.amount.fiat.amount,
                      command.amount.fiat.currency
                    )}
                    <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">
                      @ ${usdPerBsv.toFixed(2)}/BSV
                    </span>
                  </Line>
                )}
              </>
            )}

            {showToll && (
              <>
                <Line label={copy.toll}>{formatSats(toll)}</Line>
                <Line label={copy.total} strong>
                  {formatSats((command.amount?.sats ?? 0) + toll)}
                </Line>
              </>
            )}

            {command.period && (
              <Line label={copy.period}>
                {copy.every} {command.period}
              </Line>
            )}
            {command.duration && (
              <Line label={copy.expires}>{command.duration}</Line>
            )}
            {command.scope && (
              <Line label={copy.scope}>
                <code className="font-mono text-xs">{command.scope}</code>
              </Line>
            )}
            {command.reach && <Line label={copy.reach}>{command.reach}</Line>}
            {verb === "renounce" && (
              <Line label={copy.visibility}>
                {command.public ? copy.visibilityPublic : copy.visibilityAnon}
              </Line>
            )}
            {/*
              What is going into the seal, named.

              The one confirmation where the file list is a safety feature rather
              than a nicety: sealing the wrong document to the right handle cannot
              be resent, only burned, and by then they may have opened it. The
              handle is checked above; this is the other half of the check.
            */}
            {verb === "once" && attachments.length > 0 && (
              <div className="py-2">
                <dt className="text-muted-foreground mb-1.5 text-xs">
                  {copy.sealing}
                </dt>
                <dd className="space-y-1">
                  {attachments.map((item) => (
                    <div
                      key={item.src}
                      className="bg-surface flex items-center gap-2 rounded-lg p-1.5"
                    >
                      <Paperclip
                        className="text-muted-foreground size-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {item.fileName ?? item.alt ?? item.src.split("/").pop()}
                      </span>
                      {item.fileSize && (
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {item.fileSize}
                        </span>
                      )}
                    </div>
                  ))}
                </dd>
              </div>
            )}
            {command.secret && (
              <Line label={copy.secret}>
                <button
                  type="button"
                  onClick={() => setPeek((value) => !value)}
                  aria-pressed={peek}
                  aria-label={peek ? copy.secretHide : copy.secretShow}
                  title={peek ? copy.secretHide : copy.secretShow}
                  className="focus-ring hover:bg-surface-hover inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5"
                >
                  <span className="min-w-0 truncate font-mono">
                    {peek ? command.secret : content.messages.once.sealedMask}
                  </span>
                  {peek ? (
                    <EyeOff
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </Line>
            )}
            {command.off && <Line label={copy.toll}>{copy.lifted}</Line>}
            {command.text && (
              <Line label={verb === "renounce" ? copy.reason : copy.memo}>
                {command.text}
              </Line>
            )}
          </dl>
        )}

        {needsPick && (
          <fieldset className="mt-4">
            <legend className="text-muted-foreground mb-2 text-xs">
              {revokeCandidates.length} {copy.certificatesIssued}
            </legend>
            <div className="space-y-1.5">
              {revokeCandidates.map((certificate) => {
                const active = chosenSerial === certificate.serial;
                return (
                  <button
                    key={certificate.serial}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setChosenSerial(certificate.serial)}
                    className={`focus-ring flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-accent bg-accent/10"
                        : "border-border hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        active ? "border-accent" : "border-muted-foreground"
                      }`}
                      aria-hidden="true"
                    >
                      {active && (
                        <span className="bg-accent size-2 rounded-full" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <code className="font-mono text-xs font-bold">
                          {certificate.serial}
                        </code>
                        <span className="text-muted-foreground shrink-0 text-[11px]">
                          {certificate.expiry
                            ? `${copy.expires} ${certificate.expiry}`
                            : copy.noExpiry}
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                        {certificate.scope}
                        {certificate.perActionCapSats !== null
                          ? ` · ${formatSats(certificate.perActionCapSats)} ${copy.perAction}`
                          : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Caveats the spec insists are stated plainly rather than glossed. */}
        {!blocked && !reserved && !unsupported && (
          <div className="mt-4 space-y-2">
            {showToll && (
              <Caveat icon={<Coins className="size-4" />}>
                {copy.caveats.toll}
              </Caveat>
            )}
            {command.amount?.token && (
              <Caveat icon={<Coins className="size-4" />}>
                {copy.caveats.token}
              </Caveat>
            )}
            {verb === "request" && (
              <Caveat icon={<Info className="size-4" />}>
                {copy.caveats.request}
              </Caveat>
            )}
            {verb === "split" && (
              <Caveat icon={<TriangleAlert className="text-warning size-4" />}>
                {copy.caveats.split}
              </Caveat>
            )}
            {verb === "subscribe" && (
              <Caveat icon={<Info className="size-4" />}>
                {command.amount?.fiat
                  ? copy.caveats.subscribeFiat
                  : copy.caveats.subscribe}
              </Caveat>
            )}
            {verb === "attest" && (
              <Caveat icon={<TriangleAlert className="text-warning size-4" />}>
                {copy.caveats.attest}
              </Caveat>
            )}
            {verb === "renounce" && (
              <Caveat icon={<TriangleAlert className="text-warning size-4" />}>
                {copy.caveats.renounce}
              </Caveat>
            )}
            {verb === "scope" && (
              <Caveat icon={<Info className="size-4" />}>
                {copy.caveats.scope}
              </Caveat>
            )}
            {verb === "trolltoll" && command.off && (
              <Caveat icon={<Info className="size-4" />}>
                {copy.caveats.tollLifted}
              </Caveat>
            )}
            {(verb === "delegate" || verb === "handoff") && (
              <Caveat icon={<TriangleAlert className="text-warning size-4" />}>
                {copy.caveats.perActionCap}
              </Caveat>
            )}
            {verb === "revoke" && (
              <Caveat icon={<Info className="size-4" />}>
                {copy.caveats.revoke}
              </Caveat>
            )}
            {verb === "receipt" && (
              <Caveat icon={<Info className="size-4" />}>
                {copy.caveats.receipt}
              </Caveat>
            )}
            {verb === "once" && (
              <>
                <Caveat
                  icon={<TriangleAlert className="text-warning size-4" />}
                >
                  {copy.caveats.once}
                </Caveat>
                <Caveat icon={<Eye className="size-4" />}>
                  {copy.caveats.onceRead}
                </Caveat>
              </>
            )}
          </div>
        )}

        {/* Section 5.11: `*` scope takes a second, distinct confirmation. */}
        {wildcard && !blocked && (
          <button
            type="button"
            onClick={() => setWildcardConfirmed((value) => !value)}
            aria-pressed={wildcardConfirmed}
            className="focus-ring border-warning/40 bg-warning/10 mt-4 flex w-full items-start gap-2.5 rounded-lg border p-3 text-left"
          >
            <span
              className={`mt-px flex size-4 shrink-0 items-center justify-center rounded border ${
                wildcardConfirmed
                  ? "border-warning bg-warning text-background"
                  : "border-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {wildcardConfirmed && <AlertTriangle className="size-2.5" />}
            </span>
            <span className="text-xs text-pretty">{copy.wildcard}</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Caveat({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <p className="bg-surface text-muted-foreground flex items-start gap-2 rounded-lg p-2.5 text-xs text-pretty">
      <span className="mt-px shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}
