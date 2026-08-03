"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { useProfileActions } from "@/components/apps/messages/profile-hovercard";
import { COMMANDS, type CommandSpec } from "@/lib/commands";
import { content, getMessagePerson } from "@/lib/data";
import { ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The `/help` reply: every command this client knows, grouped by whether you can
 * run it.
 *
 * Ephemeral, in the Slack sense. It is the client answering a question, not a
 * message in the conversation, so it says plainly that nobody else in the room
 * receives it and it can be dismissed without leaving a trace. That matters here
 * more than in a normal chat app: a command reference posted into a shared
 * thread would look like the user broadcasting a manual at everyone, and a room
 * with agents in it makes "who else can read this" a real question rather than a
 * rhetorical one.
 *
 * Ecosystem commands come first. A reader is here because they want to know what
 * they can do *in this room*, and the verbs unique to this ecosystem are the ones
 * no other client taught them. The standard set follows, then what this client
 * declines to run, then what the spec has only named. Each group and each command
 * is a disclosure, because twenty commands with a paragraph each is a document,
 * not an answer.
 *
 * Built on `<details>` rather than component state: it opens and closes, takes
 * focus and responds to Enter without a line of JavaScript, and a help card is
 * the last place to reimplement that by hand.
 */
function CommandRow({
  spec,
  open,
  onUse,
}: {
  spec: CommandSpec;
  open?: boolean;
  /** put this example in the composer, ready to edit */
  onUse?: (example: string) => void;
}): ReactNode {
  const copy = content.messages.help;
  return (
    <details
      open={open}
      className="group/cmd border-t border-border/60 first:border-t-0"
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-2 py-1.5 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="relative top-0.5 size-3 shrink-0 text-muted-foreground transition-transform group-open/cmd:rotate-90"
          aria-hidden="true"
        />
        {/* Was the accent colour, which measured 2.79:1 on the raised panel.
            The grammar line is the thing a reader is scanning for; mono and
            weight already mark it as code without paying for it in legibility. */}
        <code className="shrink-0 font-mono text-xs font-semibold text-foreground">
          {spec.usage}
        </code>
        <span className="min-w-0 flex-1 text-xs leading-relaxed text-pretty text-muted-foreground">
          {spec.summary}
        </span>
      </summary>
      <div className="space-y-1.5 pb-2 pl-5">
        <p className="text-xs leading-relaxed text-pretty">{spec.detail}</p>
        {spec.binds === "required" && (
          <p className="text-xs text-muted-foreground">{copy.needsReply}</p>
        )}
        {spec.example && (
          <p>
            {/* An example you can run beats an example you have to retype, and
                retyping is where a reader introduces the typo they then blame
                on the command. */}
            <button
              type="button"
              onClick={() => onUse?.(spec.example ?? "")}
              title={copy.useExample}
              className={`focus-ring inline-block max-w-full truncate rounded bg-surface px-1.5 py-0.5 text-left font-mono text-[11px] ${
                onUse ? "hover:bg-surface-hover" : "cursor-default"
              }`}
            >
              {spec.example}
            </button>
          </p>
        )}
      </div>
    </details>
  );
}

function Group({
  title,
  hint,
  link,
  specs,
  open,
  onUse,
}: {
  title: string;
  hint?: string;
  /** trailing link for the hint, e.g. the specification the group comes from */
  link?: { label: string; href: string };
  specs: CommandSpec[];
  /** the group a reader most likely came for, so it opens with the card */
  open?: boolean;
  onUse?: (example: string) => void;
}): ReactNode {
  if (specs.length === 0) return null;
  return (
    <details
      open={open}
      className="group/grp border-t border-border px-3.5 py-2 first:border-t-0"
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-3 shrink-0 text-muted-foreground transition-transform group-open/grp:rotate-90"
          aria-hidden="true"
        />
        <span className="text-[10px] font-bold tracking-wide text-foreground uppercase">
          {title}
        </span>
        <span className="rounded-full bg-surface px-1.5 text-[10px] font-semibold text-foreground">
          {specs.length}
        </span>
      </summary>
      {hint && (
        <p className="mt-0.5 pl-4.5 text-[11px] text-pretty text-muted-foreground">
          {hint}
          {link && (
            <>
              {" "}
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="focus-ring rounded-sm font-medium text-foreground underline underline-offset-2"
              >
                {link.label}
              </a>
              .
            </>
          )}
        </p>
      )}
      <div className="mt-1 pl-4.5">
        {specs.map((spec) => (
          <CommandRow key={spec.verb} spec={spec} {...(onUse ? { onUse } : {})} />
        ))}
      </div>
    </details>
  );
}

export function HelpCard({
  onDismiss,
  verb,
}: {
  onDismiss: () => void;
  /** when set, describe this one verb instead of listing everything */
  verb?: string | undefined;
}): ReactNode {
  const copy = content.messages.help;
  const bot = getMessagePerson("nexus-bot");
  const seed = useProfileActions()?.seed;
  const onUse = seed ? { onUse: seed } : {};

  const asked = verb ? COMMANDS.find((c) => c.verb === verb) : undefined;
  const local = asked
    ? []
    : COMMANDS.filter((c) => c.custom && !c.reserved && !c.unimplemented);
  const runnable = asked
    ? []
    : COMMANDS.filter((c) => !c.reserved && !c.unimplemented && !c.custom);
  const reserved = asked ? [] : COMMANDS.filter((c) => c.reserved);
  const declined = asked ? [] : COMMANDS.filter((c) => c.unimplemented);

  return (
    <div className="flex items-start gap-2">
      {bot && (
        <span className="mt-0.5 shrink-0">
          <MemberAvatar person={bot} size={28} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-semibold">{bot?.name}</span>
          <span className="rounded bg-surface-hover px-1 py-px text-[9px] font-bold tracking-wide text-muted-foreground uppercase">
            {copy.app}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {copy.onlyYou}
          </span>
        </div>

        <div className="relative mt-1 max-w-[min(100%,44rem)] overflow-hidden rounded-2xl border border-border bg-surface-raised">
          <button
            type="button"
            onClick={onDismiss}
            aria-label={copy.dismiss}
            className="focus-ring absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>

          <div className="px-3.5 pt-3 pr-10">
            <p className="text-sm font-bold">
              {asked ? `/${asked.verb}` : verb ? copy.unknown : copy.title}
            </p>
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
              {copy.private}
            </p>
            {/* The invitation to open a command is only worth making when
                there is a list to open. */}
            {!asked && (
              <p className="mt-1 text-xs text-pretty text-muted-foreground">
                {copy.intro}
              </p>
            )}
          </div>

          {asked ? (
            <div className="mt-2 border-t border-border px-3.5 py-1">
              <CommandRow spec={asked} open {...onUse} />
            </div>
          ) : (
            <div className="mt-2">
              <Group
                title={copy.groups.local}
                hint={copy.groups.localHint}
                specs={local}
                open
                {...onUse}
              />
              <Group
                title={copy.groups.standard}
                hint={copy.groups.standardHint}
                link={{
                  label: copy.groups.standardHintLink,
                  href: copy.groups.standardHintHref,
                }}
                specs={runnable}
                {...onUse}
              />
              <Group
                title={copy.groups.declined}
                hint={copy.groups.declinedHint}
                specs={declined}
                {...onUse}
              />
              <Group
                title={copy.groups.reserved}
                hint={copy.groups.reservedHint}
                specs={reserved}
                {...onUse}
              />
            </div>
          )}

          <p className="border-t border-border px-3.5 py-2 text-[11px] text-pretty text-muted-foreground">
            {copy.footer}
          </p>
        </div>
      </div>
    </div>
  );
}
