"use client";

import { CollectibleArt } from "@/components/apps/wallet/collectible-art";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { Sheet } from "@/components/apps/messages/sheet";
import { content, type ChatMessage, type MessagePerson } from "@/lib/data";
import { originLabel, splitLegs, type ParsedCommand } from "@/lib/commands";
import { delegationsFor } from "@/lib/command-effects";
import { TokenAmount } from "@/components/apps/wallet/token-mark";
import { getToken } from "@/lib/data";
import { formatFiat, formatSats } from "@/lib/messages";
import { MOCK_USD_PER_BSV } from "@/lib/messages";
import {
  AlertTriangle,
  Ban,
  Coins,
  Info,
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
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
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
          className="max-w-full truncate text-[11px] text-muted-foreground"
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
  onCancel,
  onConfirm,
}: {
  command: ParsedCommand | null;
  boundMessage?: ChatMessage | undefined;
  boundSender?: MessagePerson | undefined;
  onCancel: () => void;
  onConfirm: (command: ParsedCommand) => void;
}): ReactNode {
  const copy = content.messages.confirm;
  const [wildcardConfirmed, setWildcardConfirmed] = useState(false);
  const [chosenSerial, setChosenSerial] = useState<string | null>(null);

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
  const legs =
    verb === "split" && command.amount
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
            className="focus-ring flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-hover"
          >
            {blocked || reserved || unsupported ? copy.close : copy.cancel}
          </button>
          {canConfirm && (
            <button
              type="button"
              onClick={() =>
                onConfirm(
                  verb === "revoke" && serial
                    ? { ...command, serial }
                    : command,
                )
              }
              className="focus-ring flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90"
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
          <code className="rounded-md bg-surface px-2 py-1 font-mono text-sm font-bold">
            {title}
          </code>
          {spec && !reserved && (
            <span className="text-[11px] text-muted-foreground">
              {originLabel(spec)}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          {unsupported
            ? copy.unsupported
            : reserved
              ? copy.reserved
              : (copy.effect[verb as keyof typeof copy.effect] ?? spec?.summary)}
        </p>

        {/* Blocking problems first — nothing below them can be actioned. */}
        {command.errors.length > 0 && (
          <ul className="mt-4 space-y-2">
            {command.errors.map((error) => (
              <li
                key={error}
                className="flex items-start gap-2 rounded-lg bg-negative/10 p-2.5 text-xs text-pretty"
              >
                {reserved || unsupported ? (
                  <Ban
                    className="mt-px size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldAlert
                    className="mt-px size-4 shrink-0 text-negative"
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
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-2.5">
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
              <span className="block truncate text-[11px] text-muted-foreground">
                {command.asset.org ?? content.messages.transfer.asset}
              </span>
            </span>
          </div>
        )}

        {!blocked && !reserved && !unsupported && (
          <dl className="mt-4 divide-y divide-border border-t border-border">
            {command.recipients.length === 1 && command.recipients[0]?.person && (
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
                <dt className="mb-1.5 text-xs text-muted-foreground">
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
                    ) : null,
                  )}
                </dd>
              </div>
            )}

            {boundMessage && (
              <div className="py-2">
                <dt className="mb-1 text-xs text-muted-foreground">
                  {verb === "sign" ? copy.signing : copy.boundTo}
                </dt>
                <dd className="rounded-lg bg-surface p-2.5 text-xs text-pretty">
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
                      (getToken(command.amount.token.id)?.usdPerUnit ?? 0),
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
                      command.amount.fiat.currency,
                    )}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      @ ${MOCK_USD_PER_BSV}/BSV
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
            {command.reach && (
              <Line label={copy.reach}>{command.reach}</Line>
            )}
            {verb === "renounce" && (
              <Line label={copy.visibility}>
                {command.public ? copy.visibilityPublic : copy.visibilityAnon}
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
            <legend className="mb-2 text-xs text-muted-foreground">
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
                        <span className="size-2 rounded-full bg-accent" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <code className="font-mono text-xs font-bold">
                          {certificate.serial}
                        </code>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {certificate.expiry
                            ? `${copy.expires} ${certificate.expiry}`
                            : copy.noExpiry}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
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
              <Caveat icon={<TriangleAlert className="size-4 text-warning" />}>
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
              <Caveat icon={<TriangleAlert className="size-4 text-warning" />}>
                {copy.caveats.attest}
              </Caveat>
            )}
            {verb === "renounce" && (
              <Caveat icon={<TriangleAlert className="size-4 text-warning" />}>
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
              <Caveat icon={<TriangleAlert className="size-4 text-warning" />}>
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
          </div>
        )}

        {/* Section 5.11: `*` scope takes a second, distinct confirmation. */}
        {wildcard && !blocked && (
          <button
            type="button"
            onClick={() => setWildcardConfirmed((value) => !value)}
            aria-pressed={wildcardConfirmed}
            className="focus-ring mt-4 flex w-full items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-left"
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
    <p className="flex items-start gap-2 rounded-lg bg-surface p-2.5 text-xs text-pretty text-muted-foreground">
      <span className="mt-px shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}
