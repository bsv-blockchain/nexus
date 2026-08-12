"use client";

import {
  content,
  getCurrentMessageUser,
  getMessagePerson,
  getToken,
  getWalletAccount,
  type ChatMessage,
  type CommandCard,
  type MediaItem,
  type CommandLeg,
  type MessagePerson,
} from "@/lib/data";
import {
  parseCommand,
  splitLegs,
  type ParsedCommand,
} from "@/lib/commands";
import {
  burnSecret,
  cancelSubscription,
  delegationsFor,
  recordCertificate,
  recordDelegation,
  recordPayment,
  recordRenounce,
  recordSubscription,
  recordVouch,
  revokeDelegation,
  setReach,
  beginResolving,
  recordEscrowSide,
  recordTransfer,
  sealSecret,
  setToll,
  toggleWatch,
  withdrawRequest,
  type Reach,
} from "@/lib/command-effects";
import { commandToast } from "@/components/apps/messages/command-toast";
import { RESOLVE_MS } from "@/components/apps/messages/whois-inline";
import { formatSats, handleOf } from "@/lib/messages";
import { useCallback, useState } from "react";

/** Short pseudo-random serial for a certificate, stable enough for a demo. */
function serial(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash ^ seed.charCodeAt(i)) * 16777619;
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

const DURATION_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * The wall-clock moment a `<duration>` argument runs out.
 *
 * BRC-218's duration grammar is `1*DIGIT ("m" / "h" / "d")`, so all three units
 * are handled here rather than in each caller — a verb that only understood
 * hours would read `30d` as thirty of something and be quietly wrong by a
 * factor of twenty-four.
 */
function expiryFrom(
  duration: string | undefined,
  fromIso: string,
): string | undefined {
  const match = /^(\d+)([mhd])$/.exec(duration ?? "");
  if (!match) return undefined;
  const unit = DURATION_MS[match[2] as keyof typeof DURATION_MS];
  return new Date(
    new Date(fromIso).getTime() + Number(match[1]) * unit,
  ).toISOString();
}

function signatureFor(seed: string): string {
  let hash = 5381;
  let out = "";
  for (let i = 0; out.length < 128; i += 1) {
    hash = (hash * 33) ^ (seed.charCodeAt(i % seed.length) + i);
    out += (hash >>> 0).toString(16).padStart(8, "0");
  }
  return `3045${out.slice(0, 128)}`;
}

export interface PendingCommand {
  command: ParsedCommand;
  boundMessage?: ChatMessage | undefined;
  boundSender?: MessagePerson | undefined;
}

/**
 * Turns a locally-composed command line into a confirmation, and a confirmed
 * command into a thread card plus whatever it changed elsewhere in the hub.
 *
 * Every value-moving, certificate-issuing or reachability-changing verb goes
 * through the confirmation sheet first — BRC-218 section 4.7 rules out a mode
 * that suppresses it, because a client-side toggle is unverifiable by any
 * counterparty and unenforceable once an agent holds keys. Only a delegation
 * certificate can authorise non-interactive execution, and issuing one is
 * itself a confirmed command.
 */
export function useCommandRunner({
  conversationId,
  onCard,
  /** the message a bound command applies to, when the user replied to one */
  replyTo,
  /** other participants, used to resolve `/tip` and `/sign` targets */
  participants,
  /** the single counterparty in a DM, allowed to stand in for a recipient */
  implicitRecipient,
  attachments = [],
  onConsumeAttachments,
}: {
  conversationId: string;
  onCard: (message: ChatMessage) => void;
  replyTo?: { message: ChatMessage; sender?: MessagePerson | undefined } | undefined;
  participants: MessagePerson[];
  implicitRecipient?: MessagePerson | undefined;
  /**
   * Files staged on the draft. `/sign` signs them along with the message;
   * `/once` seals them instead of sending them.
   */
  attachments?: MediaItem[];
  /**
   * Clear the staged files, for a verb that took them rather than sent them.
   * Without it a sealed document would still be sitting on the draft, ready to
   * go out in the clear with whatever the user types next.
   */
  onConsumeAttachments?: (() => void) | undefined;
}): {
  pending: PendingCommand | null;
  start: (input: string) => void;
  cancel: () => void;
  confirm: (command: ParsedCommand) => void;
} {
  const [pending, setPending] = useState<PendingCommand | null>(null);

  const start = useCallback(
    (input: string) => {
      const result = parseCommand(
        input,
        implicitRecipient,
        attachments.length > 0,
      );
      if (result.kind === "chat") return;
      const command = result.command;
      const spec = command.spec;

      /*
       * `/help` answers here rather than through the confirmation sheet. It
       * moves nothing and sends nothing, so there is nothing to confirm, and a
       * modal would be in the way of the one command you reach for when you do
       * not know the grammar. The reply is ephemeral: local to this thread and
       * visible only to the user who asked.
       */
      /*
       * `/whois` resolves on the spot.
       *
       * Section 4.2 now says so outright: a command that moves nothing, sends
       * nothing and discloses nothing MUST NOT ask. A lookup does none of those:
       * it moves nothing, sends nothing, and the handle is never told it was
       * looked up. Asking "are you sure you want to read this" is ceremony,
       * and ceremony where none is needed makes the real confirmations read
       * as noise.
       */
      if (command.verb === "whois" && command.recipients[0]?.person) {
        const person = command.recipients[0].person;
        const now = new Date().toISOString();
        commandToast({
          verb: "whois",
          title: `Resolved ${person.name}`,
          detail: "Fresh resolution, not from cache",
          subject: { kind: "person", person },
          tone: "info",
        });
        const id = `cmd-${now}`;
        beginResolving(id, RESOLVE_MS);
        onCard({
          id,
          conversationId,
          senderId: "me",
          text: "",
          createdAt: now,
          status: "sent",
          command: {
            verb: "whois",
            status: "resolved",
            recipientIds: [person.id],
            note: "Resolved fresh, not from cache. Open the card for the full identity.",
          },
        });
        return;
      }

      if (command.verb === "standing") {
        const now = new Date().toISOString();
        onCard({
          id: `standing-${now}`,
          conversationId,
          senderId: "nexus-bot",
          text: "",
          createdAt: now,
          ephemeral: true,
          standing: true,
        });
        return;
      }

      if (command.verb === "help") {
        const now = new Date().toISOString();
        // `/help <verb>` narrows the listing to one verb, per BRC-218 5.16.
        const asked = command.text?.trim().replace(/^\//, "").toLowerCase();
        onCard({
          id: `help-${now}`,
          conversationId,
          senderId: "nexus-bot",
          text: "",
          createdAt: now,
          ephemeral: true,
          help: true,
          ...(asked ? { helpVerb: asked } : {}),
        });
        return;
      }

      // Section 4.9: a command needing a binding reports the error rather than
      // silently applying itself to the thread's most recent message. `/sign`
      // binds optionally: with a reply it signs that message, without one it
      // signs the draft it was typed on, including whatever is attached.
      if (spec?.binds === "required" && !replyTo) {
        const fallback = participants.length === 1 ? participants[0] : undefined;
        if (spec.verb === "tip" && fallback) {
          // A one-to-one thread has an unambiguous sender to tip.
          setPending({
            command,
            ...(fallback ? { boundSender: fallback } : {}),
          });
          return;
        }
        setPending({
          command: {
            ...command,
            errors: [
              ...command.errors,
              `/${spec.verb} applies to one specific message. Reply to it first. This client will not pick the most recent message for you.`,
            ],
          },
        });
        return;
      }

      setPending({
        command,
        ...(replyTo?.message ? { boundMessage: replyTo.message } : {}),
        ...(replyTo?.sender ? { boundSender: replyTo.sender } : {}),
      });
    },
    [
      attachments.length,
      conversationId,
      implicitRecipient,
      onCard,
      participants,
      replyTo,
    ],
  );

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback(
    (command: ParsedCommand) => {
      const now = new Date().toISOString();
      const bound = pending?.boundMessage;
      const boundSender = pending?.boundSender;
      const me = getCurrentMessageUser();
      const account = getWalletAccount();
      const first = command.recipients[0]?.person;
      const card = buildCard();
      setPending(null);
      if (!card) return;

      onCard({
        id: `cmd-${now}`,
        conversationId,
        senderId: "me",
        text: "",
        createdAt: now,
        status: "sent",
        command: card,
      });

      function buildCard(): CommandCard | null {
        switch (command.verb) {
          case "pay": {
            if (!first || !command.amount) return null;

            /*
             * Several handles divide the amount.
             *
             * The figure typed is what leaves the wallet either way — naming
             * three people budgets it three ways rather than tripling it,
             * which is the only reading that does not make a typo expensive.
             * The division and the partial-failure handling are /split's, so
             * the two cannot disagree about who got the odd satoshi.
             */
            if (command.recipients.length > 1) {
              const people = command.recipients
                .map((r) => r.person)
                .filter((p): p is MessagePerson => Boolean(p));
              const payToken = command.amount.token;
              const decimals = payToken
                ? (getToken(payToken.id)?.decimals ?? 0)
                : 0;
              const scale = 10 ** decimals;
              const total = payToken
                ? Math.round(payToken.units * scale)
                : command.amount.sats;
              const shares = splitLegs(total, people.length);
              const legs: CommandLeg[] = people.map((person, index) => {
                const ok = !person.keyChanged;
                const raw = shares[index] ?? 0;
                const leg: CommandLeg = {
                  personId: person.id,
                  sats: payToken ? 0 : raw,
                  ...(payToken ? { units: raw / scale } : {}),
                  ok,
                };
                if (!ok) leg.error = "identity key changed";
                return leg;
              });
              /* Each recipient's toll is theirs and rides on top of their own
                 share, so one expensive messagebox does not quietly shrink
                 what everybody else receives. */
              let tolls = 0;
              for (const leg of legs) {
                const person = getMessagePerson(leg.personId);
                if (!leg.ok || !person) continue;
                const legToll = person.tollSats ?? 0;
                tolls += legToll;
                recordPayment({
                  person,
                  sats: payToken ? legToll : leg.sats + legToll,
                  memo: command.text ?? "/pay",
                  accountId: account.id,
                  ...(payToken && leg.units !== undefined
                    ? { token: { id: payToken.id, units: leg.units } }
                    : {}),
                });
              }
              const failed = legs.filter((leg) => !leg.ok).length;
              commandToast({
                verb: "pay",
                title: failed
                  ? `${legs.length - failed} of ${legs.length} payments sent`
                  : `Split between ${legs.length}`,
                detail: payToken
                  ? `${payToken.units} ${payToken.symbol}`
                  : formatSats(total),
                ...(payToken
                  ? {
                      subject: {
                        kind: "token" as const,
                        tokenId: payToken.id,
                        units: payToken.units,
                      },
                    }
                  : {}),
              });
              return {
                verb: "pay",
                status: failed ? "partial" : "sent",
                recipientIds: people.map((person) => person.id),
                legs,
                ...(payToken
                  ? { token: payToken }
                  : {
                      amountSats: total,
                      ...(command.amount.fiat
                        ? { fiat: command.amount.fiat }
                        : {}),
                    }),
                ...(tolls ? { tollSats: tolls } : {}),
                ...(command.text ? { memo: command.text } : {}),
              };
            }

            const toll = first.tollSats ?? 0;
            const token = command.amount.token;
            recordPayment({
              person: first,
              sats: token ? toll : command.amount.sats + toll,
              memo: command.text ?? `/pay ${handleOf(first)}`,
              accountId: account.id,
              ...(token ? { token: { id: token.id, units: token.units } } : {}),
            });
            commandToast({
              verb: "pay",
              title: token
                ? `Sent ${token.units} ${token.symbol}`
                : `Sent ${formatSats(command.amount.sats)}`,
              detail: `to ${handleOf(first)}`,
              subject: token
                ? { kind: "token", tokenId: token.id, units: token.units }
                : { kind: "person", person: first },
            });
            return {
              verb: "pay",
              status: "sent",
              recipientIds: [first.id],
              ...(token
                ? { token }
                : {
                    amountSats: command.amount.sats,
                    ...(command.amount.fiat ? { fiat: command.amount.fiat } : {}),
                  }),
              ...(toll ? { tollSats: toll } : {}),
              ...(command.text ? { memo: command.text } : {}),
            };
          }

          case "message": {
            if (!first) return null;
            return {
              verb: "message",
              status: "sent",
              recipientIds: [first.id],
              ...(command.text ? { memo: command.text } : {}),
            };
          }

          case "request": {
            if (!first || !command.amount) return null;
            commandToast({
              verb: "request",
              title: "Payment requested",
              detail: `${handleOf(first)} has to confirm it themselves`,
              subject: { kind: "person", person: first },
              tone: "info",
            });
            return {
              verb: "request",
              status: "pending",
              recipientIds: [first.id],
              ...(command.amount.token
                ? { token: command.amount.token }
                : {
                    amountSats: command.amount.sats,
                    ...(command.amount.fiat ? { fiat: command.amount.fiat } : {}),
                  }),
              ...(command.text ? { memo: command.text } : {}),
              note: "Confers no authority. Nothing moves until they confirm it.",
            };
          }

          case "tip": {
            const target = boundSender ?? first;
            if (!target) return null;
            const sats = command.amount?.sats ?? 500;
            recordPayment({
              person: target,
              sats,
              memo: "/tip",
              accountId: account.id,
            });
            commandToast({
              verb: "tip",
              title: `Tipped ${formatSats(sats)}`,
              detail: `to ${handleOf(target)}`,
              subject: { kind: "person", person: target },
            });
            return {
              verb: "tip",
              status: "sent",
              recipientIds: [target.id],
              amountSats: sats,
              ...(command.amount?.fiat ? { fiat: command.amount.fiat } : {}),
              ...(bound ? { boundMessageId: bound.id } : {}),
            };
          }

          case "split": {
            if (!command.amount) return null;
            const people = command.recipients
              .map((r) => r.person)
              .filter((p): p is MessagePerson => Boolean(p));
            const token = command.amount.token;
            // Tokens divide in their own smallest unit; BSV divides in satoshis.
            const decimals = token ? (getToken(token.id)?.decimals ?? 0) : 0;
            const scale = 10 ** decimals;
            const total = token
              ? Math.round(token.units * scale)
              : command.amount.sats;
            const amounts = splitLegs(total, people.length);
            const legs: CommandLeg[] = people.map((person, index) => {
              // A toll on a leg is a plausible partial failure to demonstrate:
              // the recipient wants paying to be reached, and the leg is short.
              const ok = !person.keyChanged;
              const raw = amounts[index] ?? 0;
              const leg: CommandLeg = {
                personId: person.id,
                sats: token ? 0 : raw,
                ...(token ? { units: raw / scale } : {}),
                ok,
              };
              if (!ok) leg.error = "identity key changed";
              return leg;
            });
            for (const leg of legs) {
              const person = getMessagePerson(leg.personId);
              if (leg.ok && person) {
                recordPayment({
                  person,
                  sats: leg.sats,
                  memo: "/split",
                  accountId: account.id,
                  ...(token && leg.units !== undefined
                    ? { token: { id: token.id, units: leg.units } }
                    : {}),
                });
              }
            }
            const failed = legs.filter((leg) => !leg.ok).length;
            commandToast({
              verb: "split",
              title: failed
                ? `${legs.length - failed} of ${legs.length} legs sent`
                : `Split ${legs.length} ways`,
              detail: failed
                ? "Failed legs were not retried"
                : token
                  ? `${token.units} ${token.symbol} divided evenly`
                  : `${formatSats(command.amount.sats)} divided evenly`,
              subject: token
                ? { kind: "token", tokenId: token.id, units: token.units }
                : { kind: "none" },
              ...(failed ? { tone: "warning" as const } : {}),
            });
            return {
              verb: "split",
              status: failed === 0 ? "sent" : failed === legs.length ? "failed" : "partial",
              ...(token
                ? { token }
                : {
                    amountSats: command.amount.sats,
                    ...(command.amount.fiat ? { fiat: command.amount.fiat } : {}),
                  }),
              legs,
              ...(failed
                ? {
                    note: "Legs are independent, so the successful ones stand. Failed legs were not retried.",
                  }
                : {}),
            };
          }

          case "subscribe": {
            // `/subscribe <recipient> off` ends one, per BRC-218 5.6.
            if (command.off) {
              if (!first) return null;
              cancelSubscription(first.id);
              commandToast({
                verb: "subscribe",
                title: content.messages.card.act.subCancelled,
                detail: content.messages.card.act.subCancelledNote,
                subject: { kind: "person", person: first },
                tone: "info",
              });
              return {
                verb: "subscribe",
                status: "cancelled",
                recipientIds: [first.id],
              };
            }
            if (!first || !command.amount || !command.period) return null;
            recordSubscription({
              personId: first.id,
              amountSats: command.amount.sats,
              ...(command.amount.fiat ? { fiat: command.amount.fiat } : {}),
              period: command.period,
            });
            commandToast({
              verb: "subscribe",
              title: `Repeating every ${command.period}`,
              detail: `to ${handleOf(first)} · cancel any time`,
              subject: { kind: "person", person: first },
            });
            return {
              verb: "subscribe",
              status: "set",
              recipientIds: [first.id],
              ...(command.amount.token
                ? { token: command.amount.token }
                : {
                    amountSats: command.amount.sats,
                    ...(command.amount.fiat ? { fiat: command.amount.fiat } : {}),
                  }),
              period: command.period,
              note: "Your wallet executes this. They cannot pull funds, and you can cancel before the next run.",
            };
          }

          case "whois": {
            if (!first) return null;
            commandToast({
              verb: "whois",
              title: `Resolved ${first.name}`,
              detail: "Fresh resolution, not from cache",
              subject: { kind: "person", person: first },
              tone: "info",
            });
            return {
              verb: "whois",
              status: "resolved",
              recipientIds: [first.id],
              note: "Resolved fresh, not from cache. Open the card for the full identity.",
            };
          }

          case "attest": {
            if (!first) return null;
            recordCertificate({
              type: "peer attestation",
              issuer: me.name,
              fields: [
                { label: "Subject", value: handleOf(first, { qualified: true }) },
                { label: "Claim", value: "handle-to-key binding" },
                { label: "Visibility", value: "public" },
              ],
            });
            commandToast({
              verb: "attest",
              title: "Attestation published",
              detail: `${handleOf(first)} · public and signed`,
              subject: { kind: "person", person: first },
            });
            return {
              verb: "attest",
              status: "issued",
              recipientIds: [first.id],
              note: "Public and signed. Others may rely on it.",
            };
          }

          case "scope": {
            if (!command.reach) return null;
            setReach(command.reach as Reach);
            commandToast({
              verb: "scope",
              title: `Reachable by ${command.reach}`,
              detail: "Enforced at your messagebox, not this client",
              subject: { kind: "ecosystem", ecosystem: "nexus" },
            });
            return {
              verb: "scope",
              status: "set",
              scope: command.reach,
              note: "Your messagebox enforces this, not this client.",
            };
          }

          case "trolltoll": {
            if (command.off) {
              setToll(first?.id, null);
              commandToast({
                verb: "trolltoll",
                title: "Toll lifted",
                detail: first
                  ? `for ${handleOf(first)}`
                  : "Per-sender tolls stay in force",
                subject: first
                  ? { kind: "person", person: first }
                  : { kind: "ecosystem", ecosystem: "nexus" },
                tone: "info",
              });
              return {
                verb: "trolltoll",
                status: "lifted",
                ...(first ? { recipientIds: [first.id] } : {}),
                ...(first
                  ? {}
                  : {
                      note: "Per-sender tolls are unaffected and stay in force.",
                    }),
              };
            }
            if (!command.amount) return null;
            setToll(first?.id, command.amount.sats);
            commandToast({
              verb: "trolltoll",
              title: `Toll set to ${formatSats(command.amount.sats)}`,
              detail: "Due every message, never refunded on reply",
              subject: first
                ? { kind: "person", person: first }
                : { kind: "ecosystem", ecosystem: "nexus" },
            });
            return {
              verb: "trolltoll",
              status: "set",
              ...(first ? { recipientIds: [first.id] } : {}),
              amountSats: command.amount.sats,
              ...(command.amount.fiat ? { fiat: command.amount.fiat } : {}),
              note: "Due every message, and not refunded when they reply.",
            };
          }

          case "delegate": {
            if (!first) return null;
            const scope = command.scope ?? "pay";
            const id = serial(`${first.id}${scope}${now}`);
            recordDelegation({
              serial: id,
              personId: first.id,
              scope,
              perActionCapSats: command.amount?.sats ?? null,
              expiry: command.duration ?? null,
            });
            recordCertificate({
              type: "delegation",
              issuer: me.name,
              fields: [
                { label: "Delegate", value: handleOf(first, { qualified: true }) },
                { label: "Scope", value: scope },
                {
                  label: "Per-action cap",
                  value: command.amount
                    ? `${command.amount.sats} sats`
                    : "unset",
                },
                { label: "Expiry", value: command.duration ?? "none" },
                { label: "Serial", value: id },
              ],
            });
            commandToast({
              verb: "delegate",
              title: `Certificate issued · ${id}`,
              detail: `${handleOf(first)} · scope ${scope}`,
              subject: { kind: "person", person: first },
            });
            return {
              verb: "delegate",
              status: "issued",
              recipientIds: [first.id],
              scope,
              ...(command.amount ? { amountSats: command.amount.sats } : {}),
              ...(command.duration ? { duration: command.duration } : {}),
              serial: id,
              capEnforced: false,
            };
          }

          case "revoke": {
            if (!first) return null;
            const existing = delegationsFor(first.id);
            // Section 5.12: with more than one and no serial, list and require
            // a selection rather than guessing which to revoke.
            if (!command.serial && existing.length > 1) {
              return {
                verb: "revoke",
                status: "failed",
                recipientIds: [first.id],
                note: `You have ${existing.length} certificates issued to them (${existing
                  .map((d) => d.serial)
                  .join(", ")}). Name the one you mean, because this client will not guess.`,
              };
            }
            const target = command.serial ?? existing[0]?.serial;
            if (!target) {
              return {
                verb: "revoke",
                status: "failed",
                recipientIds: [first.id],
                note: "No delegation certificate issued to them was found.",
              };
            }
            revokeDelegation(target);
            commandToast({
              verb: "revoke",
              title: `Revoking ${target}`,
              detail: "Detectable, not instant. Treat them as still able to act",
              subject: { kind: "person", person: first },
              tone: "warning",
            });
            return {
              verb: "revoke",
              status: "revoked",
              recipientIds: [first.id],
              serial: target,
              note: "Detectable rather than instant. Treat them as still able to act until the spend confirms.",
            };
          }

          case "handoff": {
            if (!first) return null;
            const scope = `thread:${conversationId}`;
            const id = serial(`${first.id}${scope}${now}`);
            recordDelegation({
              serial: id,
              personId: first.id,
              scope,
              perActionCapSats: command.amount?.sats ?? null,
              expiry: command.duration ?? null,
              threadId: conversationId,
            });
            recordCertificate({
              type: "delegation · thread",
              issuer: me.name,
              fields: [
                { label: "Delegate", value: handleOf(first, { qualified: true }) },
                { label: "Scope", value: scope },
                {
                  label: "Per-action cap",
                  value: command.amount ? `${command.amount.sats} sats` : "unset",
                },
                { label: "Expiry", value: command.duration ?? "none" },
              ],
            });
            commandToast({
              verb: "handoff",
              title: "Thread handed over",
              detail: `${handleOf(first)} · per-action cap`,
              subject: { kind: "person", person: first },
            });
            return {
              verb: "handoff",
              status: "issued",
              recipientIds: [first.id],
              scope,
              ...(command.amount ? { amountSats: command.amount.sats } : {}),
              ...(command.duration ? { duration: command.duration } : {}),
              serial: id,
              capEnforced: false,
            };
          }

          case "sign": {
            /*
             * Three cases, and the card has to say which one happened, because
             * "signed" over a message means something different from "signed"
             * over a message and four files.
             */
            const files = attachments.length;
            const signedText = bound ? bound.text : (command.text ?? "");
            const covered = files
              ? `${files} ${files === 1 ? content.messages.media.signedWith : content.messages.media.signedFiles}`
              : content.messages.media.signedMessageOnly;

            commandToast({
              verb: "sign",
              title: "Signed",
              detail: covered,
              subject: boundSender
                ? { kind: "person", person: boundSender }
                : { kind: "none" },
            });
            return {
              verb: "sign",
              status: "signed",
              ...(bound ? { boundMessageId: bound.id } : {}),
              // The signature commits to the text and every attached file, so
              // it changes if any of them do.
              signature: signatureFor(
                [signedText, ...attachments.map((item) => item.src)].join("|") ||
                  "draft",
              ),
              ...(signedText ? { memo: signedText } : {}),
              note: covered,
              ...(boundSender ? { recipientIds: [boundSender.id] } : {}),
            };
          }

          case "receipt": {
            commandToast({
              verb: "receipt",
              title: "Receipt requested",
              detail: "Voluntary. They may decline",
              ...(boundSender
                ? { subject: { kind: "person" as const, person: boundSender } }
                : {}),
              tone: "info",
            });
            return {
              verb: "receipt",
              status: "pending",
              ...(bound ? { boundMessageId: bound.id } : {}),
              ...(boundSender ? { recipientIds: [boundSender.id] } : {}),
              note: "Voluntary. If none comes back, that is not evidence the message went unread.",
            };
          }

          case "refund": {
            // The payment being returned is the binding, so the amount and the
            // recipient both come from it rather than from the line typed.
            const original = bound?.command;
            if (!bound || !original || original.verb !== "pay") {
              return {
                verb: "refund",
                status: "failed",
                note: "Reply to a payment. A refund has to name the payment it returns, or it is just an unexplained transfer.",
              };
            }
            // Only the side that received the money can send it back. Bound to
            // your own payment there is nothing to return, and asking for one
            // is a `/request`.
            if (bound.senderId === "me") {
              return {
                verb: "refund",
                status: "failed",
                boundMessageId: bound.id,
                note: "This is a payment you sent. Only the person who received it can return it, and asking them to is /request.",
              };
            }
            const payer = boundSender ?? participants[0];
            if (!payer) return null;
            const full = original.amountSats ?? 0;
            const sats = Math.min(command.amount?.sats ?? full, full);
            recordPayment({
              person: payer,
              sats,
              memo: `/refund ${handleOf(payer)}`,
              accountId: account.id,
            });
            commandToast({
              verb: "refund",
              title:
                sats < full
                  ? `Refunded ${formatSats(sats)} of ${formatSats(full)}`
                  : `Refunded ${formatSats(sats)}`,
              detail: `to ${handleOf(payer)}`,
              subject: { kind: "person", person: payer },
            });
            return {
              verb: "refund",
              status: "refunded",
              recipientIds: [payer.id],
              amountSats: sats,
              ...(bound ? { refersToMessageId: bound.id } : {}),
              ...(bound ? { boundMessageId: bound.id } : {}),
              note:
                sats < full
                  ? `Part of ${formatSats(full)}. The original payment stays on chain; this is a second one going the other way.`
                  : "The original payment stays on chain. This is a second one going the other way.",
            };
          }

          case "cancel": {
            const original = bound?.command;
            if (
              !bound ||
              !original ||
              (original.verb !== "request" && original.verb !== "once")
            ) {
              return {
                verb: "cancel",
                status: "failed",
                note: "Reply to a request or a sealed secret you sent. This withdraws that one thing, and nothing else.",
              };
            }
            if (bound.senderId !== "me") {
              return {
                verb: "cancel",
                status: "failed",
                note:
                  original.verb === "once"
                    ? "You can only burn a secret you sealed. Theirs is theirs to burn, and opening it is not the same act."
                    : "You can only withdraw a request you sent. Theirs is theirs to withdraw.",
              };
            }

            /*
             * On a `/once` this burns whatever nobody has opened.
             *
             * What it cannot do is the thing a user hopes for, so the card says
             * so in numbers: a copy somebody already opened has been read, and
             * `/cancel` does not reach into their head. Reporting "burned" flat
             * would claim it did.
             */
            if (original.verb === "once") {
              const copy = content.messages.once;
              if (!original.secretId) return null;
              const { burned, alreadyOpen } = burnSecret(original.secretId);
              commandToast({
                verb: "cancel",
                title: burned ? copy.burnedToast : copy.burnedNothing,
                detail: burned
                  ? `${burned} sealed, ${alreadyOpen} already opened`
                  : copy.burnedAllOpen,
                subject: first
                  ? { kind: "person", person: first }
                  : { kind: "ecosystem", ecosystem: "nexus" },
                tone: burned ? "info" : "warning",
              });
              return {
                verb: "cancel",
                status: burned ? "burned" : "failed",
                ...(original.recipientIds
                  ? { recipientIds: original.recipientIds }
                  : {}),
                refersToMessageId: bound.id,
                boundMessageId: bound.id,
                note: burned
                  ? alreadyOpen
                    ? `Burned ${burned} unopened, but ${alreadyOpen} had already been opened. What those handles read, they still have.`
                    : "Burned before anyone opened it. The payload is gone and nobody read it."
                  : copy.burnedAllOpen,
              };
            }

            withdrawRequest(bound.id);
            commandToast({
              verb: "cancel",
              title: "Request withdrawn",
              detail: "It stops showing as owed on their side",
              subject: first
                ? { kind: "person", person: first }
                : { kind: "ecosystem", ecosystem: "nexus" },
              tone: "info",
            });
            return {
              verb: "cancel",
              status: "withdrawn",
              ...(original.recipientIds
                ? { recipientIds: original.recipientIds }
                : {}),
              refersToMessageId: bound.id,
              boundMessageId: bound.id,
              note: "Nothing had moved, so nothing is returned. The request is simply no longer owed.",
            };
          }

          case "watch": {
            if (!first) return null;
            const on = toggleWatch(first.id);
            commandToast({
              verb: "watch",
              title: on
                ? `Watching ${handleOf(first)}`
                : `Stopped watching ${handleOf(first)}`,
              detail: on
                ? "You will be told if the key changes or the certificate is revoked"
                : "No further checks on this handle",
              subject: { kind: "person", person: first },
              tone: "info",
            });
            return {
              verb: "watch",
              status: on ? "watching" : "lifted",
              recipientIds: [first.id],
              note: on
                ? "Checked by this client, and private to you. They are not told."
                : "This client will no longer check their key.",
            };
          }

          case "agent": {
            if (!first) return null;
            const scope = command.scope ?? "pay";
            const id = serial(`agent${first.id}${scope}${now}`);
            recordDelegation({
              serial: id,
              personId: first.id,
              scope: `agent:${scope}`,
              perActionCapSats: command.amount?.sats ?? null,
              expiry: command.duration ?? null,
              threadId: conversationId,
            });
            recordCertificate({
              type: "delegation",
              issuer: me.name,
              fields: [
                { label: "Agent", value: handleOf(first, { qualified: true }) },
                { label: "Scope", value: `agent:${scope}` },
                { label: "Thread", value: conversationId },
                { label: "Expiry", value: command.duration ?? "none" },
                { label: "Serial", value: id },
              ],
            });
            commandToast({
              verb: "agent",
              title: `Agent declared · ${id}`,
              detail: `${handleOf(first)} · scope ${scope}`,
              subject: { kind: "person", person: first },
            });
            return {
              verb: "agent",
              status: "issued",
              recipientIds: [first.id],
              scope,
              ...(command.duration ? { duration: command.duration } : {}),
              serial: id,
              note: "Announced here on purpose. Everyone in this conversation can now tell when it is the agent answering rather than me.",
            };
          }

          case "send": {
            if (!first || !command.asset) {
              return {
                verb: "send",
                status: "failed",
                ...(first ? { recipientIds: [first.id] } : {}),
                note: "Name a handle and an asset you hold, as #egg69.",
              };
            }
            const moved = recordTransfer(command.asset.id, first.id);
            commandToast({
              verb: "send",
              title: `Sent ${command.asset.name}`,
              detail: `to ${handleOf(first)}`,
              subject: { kind: "person", person: first },
            });
            return {
              verb: "send",
              status: "sent",
              recipientIds: [first.id],
              assetId: command.asset.id,
              txid: moved.txid,
              note: "The asset itself moved, not a claim on it. It is theirs to send on.",
            };
          }

          case "escrow": {
            if (!first) return null;
            if (!command.asset && !command.amount) {
              return {
                verb: "escrow",
                status: "failed",
                recipientIds: [first.id],
                note: "Commit one side: an asset, or an amount. A commitment to nothing is not a side.",
              };
            }
            const hours = /^(\d+)\s*h/i.exec(command.duration ?? "2h");
            const ms = (hours ? Number(hours[1]) : 2) * 3600_000;
            const { side, paired } = recordEscrowSide({
              conversationId,
              fromId: "me",
              agentId: first.id,
              ...(command.asset ? { assetId: command.asset.id } : {}),
              ...(command.amount ? { sats: command.amount.sats } : {}),
              expiresAt: new Date(Date.now() + ms).toISOString(),
            });
            commandToast({
              verb: "escrow",
              title: paired ? "Escrow formed" : "Side committed",
              detail: paired
                ? `${handleOf(first)} decides whether to hold it`
                : `Waiting for the other side · ${command.duration ?? "2h"}`,
              subject: { kind: "person", person: first },
              tone: paired ? "info" : "warning",
            });
            return {
              verb: "escrow",
              status: paired ? "awaiting" : "offered",
              recipientIds: [first.id],
              agentId: first.id,
              escrowId: side.id,
              expiresAt: side.expiresAt,
              ...(command.asset ? { assetId: command.asset.id } : {}),
              ...(command.amount ? { amountSats: command.amount.sats } : {}),
              ...(command.duration ? { duration: command.duration } : {}),
              note: paired
                ? "Both sides are in. Nothing moves until the agent accepts, and nothing is arbitrated if they do not."
                : "Nothing has moved. This lapses on its own if the other side does not commit in time.",
            };
          }

          case "once": {
            const people = command.recipients
              .map((r) => r.person)
              .filter((p): p is MessagePerson => Boolean(p));
            /*
             * Files count as something to seal.
             *
             * Which is the point of letting them in at all: a signed contract or
             * a keystore is the case where "paste it into the thread and ask them
             * to delete it" is worst, and where a verb that only carried a word
             * left the user with nothing better to do.
             */
            const payload = {
              ...(command.secret ? { text: command.secret } : {}),
              ...(attachments.length > 0
                ? {
                    attachment: {
                      kind: "media" as const,
                      items: attachments,
                    },
                  }
                : {}),
            };
            if (people.length === 0 || (!payload.text && !payload.attachment)) {
              return {
                verb: "once",
                status: "failed",
                ...(first ? { recipientIds: [first.id] } : {}),
                note: "Name at least one handle, and give it a secret or attach a file to seal.",
              };
            }
            /*
             * Sealed without keeping a copy, one per addressee.
             *
             * The plaintext is deliberately not passed to the store. `/once`
             * seals to each recipient's key, so a sender who can still read it
             * has not sent a one-time secret — they have sent a normal message
             * with a mask over it, and the mask is on the wrong side of the
             * conversation to be worth anything.
             *
             * A copy each rather than one shared record, because each addressee
             * opens their own once: with one record the first to look would
             * spend everybody's, and the sender would learn that somebody
             * collected without learning who.
             */
            const id = `sec-${serial(`${people.map((p) => p.id).join()}${now}`)}`;
            const expiresAt = expiryFrom(command.duration, now);
            sealSecret({
              secretId: id,
              toIds: people.map((person) => person.id),
              // `rehearsal`, never `payload`: this side cannot open it, and the
              // copy exists only so one device can act out the other side.
              rehearsal: payload,
              ...(expiresAt ? { expiresAt } : {}),
            });
            /*
             * The files leave the draft here, and this is not cosmetic.
             *
             * Anything still staged would ride out on the next ordinary message,
             * in the clear, into the transcript — which is precisely the thing
             * the user just chose to seal them against.
             */
            if (attachments.length > 0) onConsumeAttachments?.();
            commandToast({
              verb: "once",
              title: "Sealed and sent",
              detail:
                people.length === 1
                  ? `${handleOf(people[0]!)} can open it once`
                  : `${people.length} handles, one opening each`,
              subject: { kind: "person", person: people[0]! },
              tone: "info",
            });
            return {
              verb: "once",
              status: "sealed",
              recipientIds: people.map((person) => person.id),
              secretId: id,
              ...(attachments.length > 0
                ? { sealedFiles: attachments.length }
                : {}),
              ...(command.duration ? { duration: command.duration } : {}),
              ...(expiresAt ? { expiresAt } : {}),
              ...(command.text ? { memo: command.text } : {}),
            };
          }

          case "vouch": {
            if (!first) return null;
            recordVouch(first.id, command.text);
            recordCertificate({
              type: "vouch",
              issuer: me.name,
              fields: [
                { label: "Subject", value: handleOf(first, { qualified: true }) },
                { label: "Claim", value: "public reputation" },
                ...(command.text
                  ? [{ label: "Note", value: command.text }]
                  : []),
              ],
            });
            commandToast({
              verb: "vouch",
              title: `Vouched for ${first.name}`,
              detail: "Signed by your identity key · visible in their /whois",
              subject: { kind: "person", person: first },
            });
            return {
              verb: "vouch",
              status: "issued",
              recipientIds: [first.id],
              ...(command.text ? { memo: command.text } : {}),
              note: "Public reputation, not a handle-to-key attestation. Anyone running /whois on them will see it.",
            };
          }

          /* Nothing moves and nothing is sent to a wallet: this shares a
             card. The one thing it must get right is that the card points at a
             real feature, which the parser has already checked. */
          case "roadmap": {
            const feature = command.feature;
            if (!feature) return null;
            commandToast({
              verb: "roadmap",
              title: `Shared ${feature.title}`,
              detail: "Read-only in the thread. Funding happens in Roadmap.",
            });
            return {
              verb: "roadmap",
              status: "sent",
              featureId: feature.id,
              ...(command.text ? { memo: command.text } : {}),
            };
          }

          case "renounce": {
            if (!first) return null;
            const isPublic = Boolean(command.public);
            recordRenounce(first.id, {
              reason: command.text,
              isPublic,
            });
            recordCertificate({
              type: "renounce",
              issuer: me.name,
              fields: [
                { label: "Subject", value: handleOf(first, { qualified: true }) },
                { label: "Claim", value: "withdrawal of regard" },
                {
                  label: "Visibility",
                  value: isPublic ? "signed openly" : "anonymous",
                },
                ...(command.text
                  ? [{ label: "Reason", value: command.text }]
                  : []),
              ],
            });
            commandToast({
              verb: "renounce",
              title: `Renounced ${first.name}`,
              detail: isPublic
                ? "Signed openly · your handle is shown with it"
                : "Anonymous · the reason is shown, your handle is not",
              subject: { kind: "person", person: first },
              tone: "warning",
            });
            return {
              verb: "renounce",
              status: "issued",
              recipientIds: [first.id],
              ...(command.text ? { memo: command.text } : {}),
              note: isPublic
                ? "Signed openly. Your handle and profile are shown beside the reason on their profile."
                : "Anonymous. The reason appears on their profile; your handle and profile do not.",
            };
          }

          default:
            return null;
        }
      }
    },
    [
      attachments,
      conversationId,
      onCard,
      onConsumeAttachments,
      participants,
      pending,
    ],
  );

  return { pending, start, cancel, confirm };
}
