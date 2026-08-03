"use client";

import { EcosystemMark } from "@/components/apps/messages/ecosystem-tag";
import { PersonRow } from "@/components/apps/messages/person-row";
import { content, getEcosystem, type MessagePerson } from "@/lib/data";
import type { CommandSpec } from "@/lib/commands";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * The composer's autocomplete list, anchored above the input. Shared shell for
 * both `@`-mentions and `/`-commands so keyboard behaviour and geometry match.
 *
 * The active row is scrolled into view rather than the list jumping, and the
 * whole thing is a listbox so arrow keys and Enter read correctly to a screen
 * reader while focus stays in the text input.
 */
function PopoverShell({
  id,
  label,
  children,
  footer,
}: {
  id?: string | undefined;
  label: string;
  children: ReactNode;
  footer?: string;
}): ReactNode {
  return (
    <div
      {...(id ? { id } : {})}
      role="listbox"
      aria-label={label}
      className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl"
    >
      <div className="max-h-64 overflow-y-auto p-1.5">{children}</div>
      {footer && (
        <p className="border-t border-border px-3 py-2 text-[11px] text-foreground/70">
          {footer}
        </p>
      )}
    </div>
  );
}

function Row({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}): ReactNode {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={active}
      // Chosen on mousedown so the input never loses focus first.
      onMouseDown={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors ${
        active
          ? "bg-accent/15 ring-1 ring-accent/30 ring-inset"
          : "hover:bg-surface-hover"
      }`}
    >
      {children}
      {/*
        The key that would take this row, on the row it would take. Enter
        already completed the top entry, but nothing said so, and the tint alone
        reads as hover rather than as "this one is armed".
      */}
      {active && (
        <span
          aria-hidden="true"
          className="ml-auto shrink-0 rounded border border-border px-1.5 py-px font-mono text-[10px] leading-4 text-muted-foreground"
        >
          {content.messages.mentions.enterKey}
        </span>
      )}
    </button>
  );
}

/** `@`-mention suggestions, drawn from every ecosystem in the inbox. */
export function MentionPopover({
  id,
  people,
  activeIndex,
  onSelect,
  prequery,
}: {
  id?: string | undefined;
  people: MessagePerson[];
  activeIndex: number;
  onSelect: (person: MessagePerson) => void;
  /** true when nothing has been typed after `@` yet */
  prequery: boolean;
}): ReactNode {
  const copy = content.messages.mentions;
  if (people.length === 0) {
    return (
      <PopoverShell id={id} label={copy.label}>
        <p className="px-2 py-3 text-center text-sm text-muted-foreground">
          {copy.noMatches}
        </p>
      </PopoverShell>
    );
  }

  return (
    <PopoverShell
      id={id}
      label={copy.label}
      footer={prequery ? copy.recentHint : copy.searchHint}
    >
      {people.map((person, index) => (
        <Row
          key={person.id}
          active={index === activeIndex}
          onSelect={() => onSelect(person)}
        >
          <PersonRow person={person} />
        </Row>
      ))}
    </PopoverShell>
  );
}

/**
 * `/`-command suggestions. Reserved verbs are listed but visibly inert: BRC-218
 * section 6 requires a client report them as unsupported, and hiding them
 * entirely would make the reservation invisible to anyone exploring.
 */
export function CommandPopover({
  id,
  commands,
  activeIndex,
  onSelect,
}: {
  id?: string | undefined;
  commands: CommandSpec[];
  activeIndex: number;
  onSelect: (spec: CommandSpec) => void;
}): ReactNode {
  const copy = content.messages.commands;
  if (commands.length === 0) {
    return (
      <PopoverShell id={id} label={copy.label}>
        <p className="px-2 py-3 text-center text-sm text-muted-foreground">
          {copy.noMatches}
        </p>
      </PopoverShell>
    );
  }

  return (
    <PopoverShell id={id} label={copy.label} footer={copy.hint}>
      {commands.map((spec, index) => (
        <Row
          key={spec.verb}
          active={index === activeIndex}
          onSelect={() => onSelect(spec)}
        >
          <span className="min-w-0 flex-1">
            {/* The grammar on one line, what it does on the next. The section
                citation that used to sit here told you where the verb was
                specified, which is not a thing anyone needs while typing. */}
            <span className="flex items-baseline gap-1.5">
              <code
                className={`shrink-0 font-mono text-sm font-bold ${
                  spec.reserved ? "text-muted-foreground" : ""
                }`}
              >
                /{spec.verb}
              </code>
              <code className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                {spec.usage.replace(`/${spec.verb}`, "").trim()}
              </code>
              {spec.reserved && (
                <span className="shrink-0 rounded-full border border-border px-1.5 py-px text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {copy.reserved}
                </span>
              )}
            </span>
            <span
              className={`mt-0.5 block text-xs text-pretty ${
                spec.reserved ? "text-muted-foreground" : "text-foreground/70"
              }`}
            >
              {spec.summary}
            </span>
          </span>
        </Row>
      ))}
    </PopoverShell>
  );
}

/** Small ecosystem legend, shown under the mention list on first open. */
export function EcosystemLegend({
  ids,
}: {
  ids: MessagePerson["ecosystem"][];
}): ReactNode {
  const unique = [...new Set(ids)];
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {unique.map((id) => {
        const eco = getEcosystem(id);
        if (!eco) return null;
        return (
          <span key={id} className="inline-flex items-center gap-1">
            <EcosystemMark ecosystem={id} size={10} />
            {eco.name}
          </span>
        );
      })}
    </span>
  );
}
