"use client";

import { FloatingPanel, useDismissOnOutside } from "@/components/apps/messages/floating-panel";
import { EcosystemMark } from "@/components/apps/messages/ecosystem-tag";
import {
  content,
  getEcosystem,
  getMessagePeople,
  getTokens,
  type EcosystemId,
} from "@/lib/data";
import { Globe, KeyRound, Terminal, Users } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

function Row({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <p className="flex items-start gap-2 text-[11px] text-foreground/70">
      <span className="mt-px shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * What an ecosystem is, for the mark on a conversation row.
 *
 * An icon alone is only useful once you know what it stands for, so it carries
 * its own card: the name, what the ecosystem is, the domain that is authoritative
 * for its handles, how many people from it you talk to, and anything it issues.
 */
function Card({ ecosystem }: { ecosystem: EcosystemId }): ReactNode {
  const copy = content.messages.ecosystemCard;
  const eco = getEcosystem(ecosystem);
  if (!eco) return null;

  const people = getMessagePeople().filter((p) => p.ecosystem === ecosystem);
  const tokens = getTokens().filter((t) => t.ecosystem === ecosystem);

  return (
    <div className="w-64 max-w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface-raised text-foreground p-4 shadow-2xl">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface">
          <EcosystemMark ecosystem={ecosystem} size={22} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{eco.name}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {eco.domain}
          </p>
        </div>
      </div>

      {eco.description && (
        <p className="mt-3 text-xs leading-relaxed text-pretty text-foreground/80">
          {eco.description}
        </p>
      )}

      <div className="mt-3 space-y-1.5 border-t border-border pt-3">
        <Row icon={<KeyRound className="size-3.5" />}>
          {copy.authority} <span className="font-mono">{eco.domain}</span>
        </Row>
        <Row icon={<Users className="size-3.5" />}>
          {people.length} {copy.peopleHere}
        </Row>
        {tokens.length > 0 && (
          <Row icon={<Globe className="size-3.5" />}>
            {copy.issues} {tokens.map((t) => t.symbol).join(", ")}
          </Row>
        )}
        {eco.commands && eco.commands.length > 0 && (
          <Row icon={<Terminal className="size-3.5" />}>
            {copy.ownCommands}{" "}
            {eco.commands.map((command) => `/${command.verb}`).join(", ")}
          </Row>
        )}
        {eco.numericHandles && (
          <Row icon={<KeyRound className="size-3.5" />}>{copy.numeric}</Row>
        )}
      </div>
    </div>
  );
}

/** Anchors an ecosystem card to its mark. Opens on hover and on click. */
export function EcosystemHovercard({
  ecosystem,
  children,
  className = "",
  align = "start",
}: {
  ecosystem: EcosystemId;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}): ReactNode {
  const [open, setOpen] = useState(false);

  /*
   * Closing is delayed so the pointer can cross the gap between the trigger and
   * the panel, which is portalled and therefore not a child that would keep the
   * trigger's hover alive. Entering either cancels the pending close.
   */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeSoon = (): void => {
    keepOpen();
    closeTimer.current = setTimeout(() => setOpen(false), 400);
  };
  /**
   * Which way the panel opens. Measured when it opens rather than fixed, since
   * the same component is used in a header (no room above) and low in a
   * transcript (no room below) — hard-coding one direction breaks the other.
   */
  const ref = useRef<HTMLSpanElement>(null);

  const show = (): void => setOpen(true);
  const eco = getEcosystem(ecosystem);

  useDismissOnOutside(open, ref, setOpen);

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onPointerEnter={() => {
        keepOpen();
        show();
      }}
      onPointerLeave={closeSoon}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`${eco?.name ?? ecosystem} — ${content.messages.ecosystemCard.about}`}
        onClick={(event) => {
          // Never activate the conversation row this sits inside.
          event.preventDefault();
          event.stopPropagation();
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            if (open) setOpen(false);
            else show();
          }
        }}
        onFocus={show}
        onBlur={() => setOpen(false)}
        className={`focus-ring cursor-help rounded ${className}`}
      >
        {children}
      </span>
      {open && (
        <FloatingPanel
          anchor={ref}
          onPointerEnter={keepOpen}
          onPointerLeave={closeSoon}
          align={align}
          label={`${eco?.name ?? ecosystem} — ${content.messages.ecosystemCard.about}`}
        >
          <Card ecosystem={ecosystem} />
        </FloatingPanel>
      )}
    </span>
  );
}

/**
 * The ecosystems present in a conversation, as marks alone.
 *
 * A group whose members span several ecosystems gets a facepile of marks, since
 * that mix is the interesting fact about it. Nexus is omitted — it is the local
 * ecosystem, and badging every local handle says nothing.
 */
export function EcosystemMarks({
  ecosystems,
  size = 13,
}: {
  ecosystems: EcosystemId[];
  size?: number;
}): ReactNode {
  const foreign = [...new Set(ecosystems)].filter(
    (id) => !getEcosystem(id)?.local,
  );
  if (foreign.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center -space-x-1">
      {foreign.slice(0, 3).map((id) => (
        <EcosystemHovercard key={id} ecosystem={id} align="end">
          <span className="grid place-items-center rounded-[4px] bg-surface-raised p-px ring-1 ring-border">
            <EcosystemMark ecosystem={id} size={size} />
          </span>
        </EcosystemHovercard>
      ))}
    </span>
  );
}
