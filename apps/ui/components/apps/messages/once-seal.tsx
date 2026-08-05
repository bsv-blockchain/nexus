"use client";

import { commandToast } from "@/components/apps/messages/command-toast";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  getEffects,
  getEffectsServerSnapshot,
  rehearseReveal,
  revealSecret,
  subscribeEffects,
  type SealedPayload,
  type SealedSecret,
} from "@/lib/command-effects";
import {
  content,
  getMessagePerson,
  type CommandCard,
  type CommandStatus,
  type MediaItem,
} from "@/lib/data";
import { formatMessageTime, handleOf } from "@/lib/messages";
import {
  Check,
  Copy,
  Download,
  Eye,
  File as FileIcon,
  FileAudio,
  Flame,
  FlaskConical,
  Lock,
  LockOpen,
  Paperclip,
  TriangleAlert,
} from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * How the mask reads.
 *
 * `void` covers burned and lapsed together on purpose: both mean there is
 * nothing behind the dots and nobody took it, and the difference between them is
 * a sentence rather than a glyph.
 */
export type SealState = "sealed" | "opened" | "void";

/** Every addressee's copy of one `/once`. */
export function useSealedCopies(secretId: string | undefined): SealedSecret[] {
  const effects = useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
  if (!secretId) return [];
  return effects.secrets.filter((entry) => entry.secretId === secretId);
}

function copyState(copy: SealedSecret, nowIso: string): SealState {
  if (copy.revealedAt) return "opened";
  if (copy.burnedAt) return "void";
  if (copy.expiresAt && copy.expiresAt <= nowIso) return "void";
  return "sealed";
}

/**
 * What a given reader should be told about a seal.
 *
 * An addressee is shown **their own copy**: the only question they have is
 * whether the secret is still theirs to take. Everyone else — the sender, and
 * anyone else in a room — is shown the aggregate, and the aggregate leads with
 * whether *anyone* has opened it. That is the security-relevant fact, and it is
 * why a seal going hollow before its addressee says they opened it is a
 * compromise notice. Who exactly collected is in the card, per addressee, on the
 * same reasoning as §5.5's per-leg reporting: a total is not an outcome.
 */
export function sealView(
  copies: SealedSecret[],
  nowIso: string,
): {
  state: SealState;
  status: Extract<CommandStatus, "sealed" | "revealed" | "burned" | "expired">;
  /** the reader's own copy, when the reader is an addressee */
  own?: SealedSecret;
  opened: number;
} {
  const own = copies.find((entry) => entry.toId === "me");
  const opened = copies.filter((entry) => entry.revealedAt).length;

  if (own) {
    const state = copyState(own, nowIso);
    const status =
      state === "opened"
        ? ("revealed" as const)
        : state === "sealed"
          ? ("sealed" as const)
          : own.burnedAt
            ? ("burned" as const)
            : ("expired" as const);
    return { state, status, own, opened };
  }

  if (opened > 0) return { state: "opened", status: "revealed", opened };
  if (copies.some((entry) => entry.burnedAt)) {
    return { state: "void", status: "burned", opened };
  }
  if (
    copies.length > 0 &&
    copies.every((entry) => entry.expiresAt && entry.expiresAt <= nowIso)
  ) {
    return { state: "void", status: "expired", opened };
  }
  return { state: "sealed", status: "sealed", opened };
}

const DOTS = [0, 1, 2, 3, 4];

/**
 * The mask, as it reads inside the command pill and at the head of the card.
 *
 * Three glyphs for three facts. `●` there is something here, `○` somebody took
 * it, `○` struck through nobody did and now nobody can. A single mask cannot
 * tell "there is something here for you" apart from "there was", and both sides
 * need that difference for opposite reasons — the recipient is asking whether
 * the secret is still theirs to take, the sender whether it has been taken.
 *
 * Always five, whatever the payload and however many handles it was sealed to. A
 * mask that grows with the secret says whether you are looking at a four-digit
 * PIN or a private key, which is most of what sealing it was for.
 *
 * Sealed, it hops: five dots lifting in turn, resting, and going again, because
 * the one thing the mask cannot say in words is that there is still something
 * live behind it. The emptying animation runs only where this component watched
 * the state change — a card that was already spent when it mounted is static,
 * so scrolling back through a transcript does not replay other people's reveals.
 */
export function SecretMask({ state }: { state: SealState }): ReactNode {
  const copy = content.messages.once;
  /* The state at mount, held in state whose setter is never called: the
     initialiser runs once, so this is the one value that can answer "did this
     change while I was watching" and still be legal to read while rendering. */
  const [atMount] = useState(state);
  const emptying = atMount === "sealed" && state !== "sealed";

  const label =
    state === "sealed"
      ? copy.sealedLabel
      : state === "opened"
        ? copy.spentLabel
        : copy.voidLabel;

  return (
    <span
      className={`inline-flex items-center gap-[0.12em] align-middle font-mono ${
        state === "sealed" ? "font-semibold" : "opacity-60"
      } ${state === "void" ? "line-through" : ""}`}
      aria-label={label}
      title={label}
      role="img"
    >
      {DOTS.map((index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{ "--seal-index": index } as React.CSSProperties}
          className={`nexus-seal-dot ${
            state === "sealed"
              ? "nexus-seal-dot--sealed"
              : emptying
                ? "nexus-seal-dot--emptying"
                : ""
          }`}
        >
          {state === "sealed" ? "●" : "○"}
        </span>
      ))}
    </span>
  );
}

/**
 * `1/3`, beside the mask, where a `/once` went to more than one handle.
 *
 * The mask carries one bit and the aggregate needs two. Hollow means somebody
 * has opened it — which is the fact that matters, and is why it leads — but on
 * its own it reads as "everybody has", and a sender glancing at a seal two of
 * three people have not yet collected would conclude the opposite of the truth.
 * The tally is the cheapest thing that fixes it, and the addressee count is
 * already public: their handles are in the same pill.
 */
export function SealTally({
  secretId,
}: {
  secretId: string | undefined;
}): ReactNode {
  const copies = useSealedCopies(secretId);
  if (copies.length < 2) return null;
  const opened = copies.filter((entry) => entry.revealedAt).length;
  return (
    <span
      className="font-medium tabular-nums"
      aria-label={`${opened} ${content.messages.once.ofOpened} ${copies.length} ${content.messages.once.openedAddressees}`}
    >
      {opened}/{copies.length}
    </span>
  );
}

function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    // clipboard unavailable
  }
}

/** One revealed document: look at it, or keep it, because there is no second go. */
function SealedFile({ item }: { item: MediaItem }): ReactNode {
  const copy = content.messages.once;
  const thumb = item.kind === "image" ? item.src : item.poster;
  const name = item.fileName ?? item.alt ?? item.src.split("/").pop();
  return (
    <li className="border-border/60 bg-background/40 flex items-center gap-2 rounded-lg border p-1.5">
      {thumb ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumb}
          alt={item.alt ?? ""}
          className="size-9 shrink-0 rounded object-cover"
        />
      ) : (
        <span
          className="bg-surface grid size-9 shrink-0 place-items-center rounded"
          aria-hidden="true"
        >
          {item.kind === "audio" ? (
            <FileAudio className="size-4 opacity-70" />
          ) : (
            <FileIcon className="size-4 opacity-70" />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold">{name}</span>
        {item.fileSize && (
          <span className="text-muted-foreground block text-[10px]">
            {item.fileSize}
          </span>
        )}
      </span>
      {/*
        A real download rather than a "coming soon".
        Everywhere else in the app a file can be fetched again from the thread it
        was posted in. This is the one place it cannot: close the panel and the
        bytes are unreachable, so an affordance that only pretends to save it
        would be the difference between a demo and a data-loss bug.
      */}
      <a
        href={item.src}
        download
        className="focus-ring border-border hover:bg-surface-hover inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      >
        <Download className="size-3" aria-hidden="true" />
        {copy.save}
      </a>
    </li>
  );
}

/**
 * The revealed payload, and the one chance to keep it.
 *
 * Text and documents both, because a seal can carry either or both: a keystore
 * and the passphrase that opens it belong in one envelope, and splitting them
 * across a sealed secret and a plain attachment would put half of it in the
 * transcript forever.
 */
function Revealed({ payload }: { payload: SealedPayload }): ReactNode {
  const copy = content.messages.once;
  const [copied, setCopied] = useState(false);
  const items =
    payload.attachment?.kind === "media" ? payload.attachment.items : [];
  return (
    <div className="border-accent/40 bg-accent/10 space-y-1.5 rounded-lg border p-2">
      {payload.text && (
        <>
          <p className="font-mono text-xs break-all select-all">
            {payload.text}
          </p>
          {/* A one-time value with no way to capture it is a design that loses
              people their credentials, and then they stop using the verb. */}
          <button
            type="button"
            onClick={() => {
              copyToClipboard(payload.text ?? "");
              setCopied(true);
            }}
            className="focus-ring border-border hover:bg-surface-hover inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          >
            {copied ? (
              <Check className="text-positive size-3" aria-hidden="true" />
            ) : (
              <Copy className="size-3" aria-hidden="true" />
            )}
            {copied ? copy.copied : copy.copy}
          </button>
        </>
      )}
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item) => (
            <SealedFile key={item.src} item={item} />
          ))}
        </ul>
      )}
      {/* Said in the revealed state rather than before it, because this is the
          moment the warning is actionable: it is on screen now and it will not
          be again. */}
      <p className="text-muted-foreground text-[11px] text-pretty">
        {items.length > 0 ? copy.keepItFiles : copy.keepIt}
      </p>
    </div>
  );
}

/**
 * Who collected theirs and who has not, one row each.
 *
 * Shown only where a `/once` went to more than one handle. Modelled on `/split`'s
 * legs for the same reason §5.5 gives: the addressees succeed and fail
 * independently, so a single aggregate state would report an outcome none of them
 * actually had.
 */
function Addressees({
  copies,
  nowIso,
}: {
  copies: SealedSecret[];
  nowIso: string;
}): ReactNode {
  const copy = content.messages.once;
  return (
    <ul className="space-y-1">
      {copies.map((entry) => {
        const person = getMessagePerson(entry.toId);
        if (!person) return null;
        const state = copyState(entry, nowIso);
        return (
          <li
            key={entry.toId}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <MemberAvatar person={person} size={16} />
              <Handle person={person} size={10} className="truncate text-[11px]" />
            </span>
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[10px]">
              {state === "opened" ? (
                <>
                  <LockOpen className="size-3" aria-hidden="true" />
                  {entry.revealedAt ? formatMessageTime(entry.revealedAt) : ""}
                </>
              ) : state === "void" ? (
                <>
                  <Flame className="size-3" aria-hidden="true" />
                  {entry.burnedAt ? copy.burnedShort : copy.lapsedShort}
                </>
              ) : (
                <>
                  <Lock className="text-accent size-3" aria-hidden="true" />
                  {copy.waitingShort}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The `/once` payload inside the command card: sealed, opening, or spent.
 *
 * The reveal lives here rather than in the card's action row so that the button
 * and the value it produces are the same component. That component is mounted
 * by the hovercard and unmounted when it closes, which is what makes "only
 * once" true of the screen as well as of the store — the plaintext is held in
 * local state that dies with the panel, and {@link revealSecret} has already
 * dropped the store's copy by then.
 *
 * There is no second confirmation in front of the button. BRC-218 §4.2 would
 * ask for one, since opening the secret discloses to the sender that it was
 * opened, but a modal stacked on a hovercard is a worse place to read a warning
 * than the line directly above the button. So the cost is stated in place, and
 * the click is the confirmation.
 */
export function OnceSeal({
  card,
  /** the card sits on the user's own message, so the user sealed it */
  mine,
}: {
  card: CommandCard;
  mine: boolean;
}): ReactNode {
  const copy = content.messages.once;
  const copies = useSealedCopies(card.secretId);
  const [revealed, setRevealed] = useState<SealedPayload | null>(null);

  /* Read once per render, like the escrow card does with its window: expiry is
     a fact about the clock, and the alternative is a card that claims a lapsed
     secret is still openable until something else happens to re-render it. */
  const nowIso = new Date().toISOString();
  const { state, own, opened } = sealView(copies, nowIso);
  const canReveal = !mine && Boolean(own) && state === "sealed";
  const expiresAt = own?.expiresAt ?? copies[0]?.expiresAt;
  /** Whether anything here is still there to be taken, by anybody. */
  const anySealed = copies.some((entry) => copyState(entry, nowIso) === "sealed");
  /*
   * Whether every addressee ended up in the same place.
   *
   * A summary sentence is only worth writing when there is one thing to
   * summarise. One handle opened theirs and two were burned unopened is three
   * different outcomes, and any single sentence about it is wrong for two of
   * them — so the per-addressee rows are left to say it instead.
   */
  const uniform =
    new Set(copies.map((entry) => copyState(entry, nowIso))).size <= 1;
  /** Copies this device can act out the far side of — prototype only. */
  const rehearsable = copies.filter(
    (entry) => copyState(entry, nowIso) === "sealed" && entry.rehearsal,
  );

  return (
    <div className="space-y-2">
      {revealed ? (
        <Revealed payload={revealed} />
      ) : (
        <div className="bg-surface flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span
            className={state === "sealed" ? "text-accent" : "text-muted-foreground"}
            aria-hidden="true"
          >
            {state === "sealed" ? (
              <Lock className="size-3.5" />
            ) : state === "opened" ? (
              <LockOpen className="size-3.5" />
            ) : (
              <Flame className="size-3.5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <SecretMask state={state} />
          </span>
          <span className="text-muted-foreground shrink-0 text-[10px]">
            {/* The aggregate gets a count, because "opened" said of three
                handles does not say which of the three. */}
            {copies.length > 1 && !own
              ? `${opened} ${copy.ofOpened} ${copies.length}`
              : state === "opened" && own?.revealedAt
                ? `${copy.revealedAt} ${formatMessageTime(own.revealedAt)}`
                : state === "opened" && copies[0]?.revealedAt
                  ? `${copy.revealedAt} ${formatMessageTime(copies[0].revealedAt)}`
                  : state === "void"
                    ? copies.some((entry) => entry.burnedAt)
                      ? copy.burnedShort
                      : copy.lapsedShort
                    : copy.notRevealed}
          </span>
        </div>
      )}

      {/* What is in the envelope, without saying what is in the documents. The
          difference between a password and a signed contract changes whether
          you go and find your machine, so it belongs on the sealed side. */}
      {card.sealedFiles !== undefined && card.sealedFiles > 0 && !revealed && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <Paperclip className="size-3 shrink-0" aria-hidden="true" />
          {card.sealedFiles}{" "}
          {card.sealedFiles === 1 ? copy.fileSealed : copy.filesSealed}
        </p>
      )}

      {copies.length > 1 && <Addressees copies={copies} nowIso={nowIso} />}

      {/* Openable until when, while that is still ahead of us. */}
      {expiresAt && anySealed && (
        <p className="text-muted-foreground text-[11px]">
          {copy.openableUntil} {formatMessageTime(expiresAt)}
        </p>
      )}

      {/* The card already names the handles above, qualified. What it does not
          say is that those handles are the only keys this opens under. Not on
          the sender's own card, where `sendersView` below says it and more. */}
      {!mine && anySealed && !revealed && (
        <p className="text-muted-foreground text-[11px] text-pretty">
          {copy.onlyOnce}
        </p>
      )}

      {canReveal && (
        <>
          <p className="text-muted-foreground flex items-start gap-1.5 text-[11px] text-pretty">
            <TriangleAlert
              className="text-warning mt-px size-3 shrink-0"
              aria-hidden="true"
            />
            {copy.revealCost}
          </p>
          <button
            type="button"
            onClick={() => {
              const value = revealSecret(card.secretId ?? "", "me");
              if (!value) return;
              setRevealed(value);
              commandToast({
                verb: "once",
                title: copy.revealedToast,
                detail: copy.revealedToastNote,
                tone: "warning",
              });
            }}
            className="focus-ring bg-accent text-accent-foreground inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            {copy.reveal}
          </button>
        </>
      )}

      {/*
        Standing in for the other side, because there is only one device.

        Deliberately not styled like the real reveal: dashed and muted, under a
        heading that says what it is. The sender learning the contents is the one
        thing `/once` exists to prevent, so an affordance that did it without
        saying so would teach exactly the wrong lesson about the verb — hence the
        toast on every use, and hence {@link rehearseReveal} reading a field the
        real path cannot see.
      */}
      {/* Only where there is something to act out. A seal whose rehearsal copy
          has already been spent must not offer a button that does nothing. */}
      {mine && anySealed && !revealed && rehearsable.length > 0 && (
        <div className="border-border/70 space-y-1.5 rounded-lg border border-dashed p-2">
          <p className="text-muted-foreground flex items-start gap-1.5 text-[10px] text-pretty">
            <FlaskConical className="mt-px size-3 shrink-0" aria-hidden="true" />
            {copy.rehearseHint}
          </p>
          <div className="flex flex-wrap gap-1">
            {rehearsable.map((entry) => {
                const person = getMessagePerson(entry.toId);
                return (
                  <button
                    key={entry.toId}
                    type="button"
                    onClick={() => {
                      const value = rehearseReveal(
                        card.secretId ?? "",
                        entry.toId,
                      );
                      if (!value) return;
                      setRevealed(value);
                      commandToast({
                        verb: "once",
                        title: person
                          ? `${copy.rehearseToast} ${handleOf(person)}`
                          : copy.rehearseToast,
                        detail: copy.rehearseToastNote,
                        ...(person
                          ? { subject: { kind: "person" as const, person } }
                          : {}),
                        tone: "info",
                      });
                    }}
                    className="focus-ring border-border hover:bg-surface-hover inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  >
                    <Eye className="size-3" aria-hidden="true" />
                    {copy.rehearseAs}{" "}
                    {person ? handleOf(person) : entry.toId}
                  </button>
              );
            })}
          </div>
        </div>
      )}

      {/*
        The states with nothing to click still have to say why.

        Gated on `anySealed` rather than on the headline state, because a seal
        two of three people have not yet collected is still live: "the payload
        is gone" would be false for those two, and the aggregate mask leads with
        the reveal precisely because that is the fact it cannot afford to bury.
        The two sides also get different sentences — "gone" is news to the reader
        who had it and nonsense to the one who never could.
      */}
      {uniform && !anySealed && !canReveal && !revealed && state === "opened" && (
        <p className="text-muted-foreground text-[11px] text-pretty">
          {mine ? copy.goneNoteSender : copy.goneNote}
        </p>
      )}
      {uniform && !anySealed && !revealed && state === "void" && (
        <p className="text-muted-foreground text-[11px] text-pretty">
          {copies.some((entry) => entry.burnedAt) ? copy.burnedNote : copy.lapsedNote}
        </p>
      )}
      {mine && anySealed && (
        <p className="text-muted-foreground text-[11px] text-pretty">
          {copy.sendersView}
        </p>
      )}
      {!mine && !own && anySealed && (
        <p className="text-muted-foreground text-[11px] text-pretty">
          {copy.theirCall}
        </p>
      )}
    </div>
  );
}
