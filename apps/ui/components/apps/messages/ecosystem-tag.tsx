import { getEcosystem, type EcosystemId, type MessagePerson } from "@/lib/data";
import { handleOf } from "@/lib/messages";
import type { ReactNode } from "react";

/**
 * An ecosystem's mark. Some are full-colour logos that stand on their own;
 * others (Twetch) are a bare monochrome glyph that needs a plate behind it,
 * which `iconPlate` supplies.
 */
export function EcosystemMark({
  ecosystem,
  size = 12,
  className = "",
}: {
  ecosystem: EcosystemId;
  size?: number;
  className?: string;
}): ReactNode {
  const eco = getEcosystem(ecosystem);
  if (!eco) return null;

  if (!eco.icon) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-[3px] bg-muted font-bold text-muted-foreground ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.7 }}
      >
        {eco.name[0]}
      </span>
    );
  }

  if (eco.iconPlate) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-[3px] ${className}`}
        style={{ width: size, height: size, background: eco.iconPlate }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={eco.icon}
          alt=""
          style={{ width: size * 0.72, height: size * 0.72 }}
        />
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={eco.icon}
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-[3px] object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Ecosystem mark plus name, as a compact tag. The local ecosystem carries no
 * tag — BRC-169 section 2.4(1) asks for the mark and name when the handle is
 * *foreign*, and tagging every local handle is noise.
 */
export function EcosystemTag({
  ecosystem,
  className = "",
}: {
  ecosystem: EcosystemId;
  className?: string;
}): ReactNode {
  const eco = getEcosystem(ecosystem);
  if (!eco || eco.local) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-border py-px pr-1.5 pl-1 text-[10px] font-semibold text-muted-foreground ${className}`}
    >
      <EcosystemMark ecosystem={ecosystem} size={11} />
      {eco.name}
    </span>
  );
}

/**
 * A handle rendered as the address it is: `@handle@ecosystem`, per BRC-169
 * section 2.2. A foreign handle reads as `@23@treechat` — the exact string you
 * could type into the composer or a `/pay` — with the ecosystem's mark set
 * between the separator and the suffix so a foreign namespace is still obvious
 * at a glance. The local ecosystem keeps its shorthand: `@handle`, no suffix.
 */
export function Handle({
  person,
  size = 12,
  className = "",
  showEcosystem = true,
}: {
  person: MessagePerson;
  size?: number;
  className?: string;
  /** force-hide the suffix where the surrounding context already states it */
  showEcosystem?: boolean;
}): ReactNode {
  const eco = getEcosystem(person.ecosystem);
  const foreign = Boolean(eco && !eco.local);

  if (!foreign || !showEcosystem) {
    return (
      <span className={`font-mono ${className}`}>{`@${person.handle}`}</span>
    );
  }

  return (
    <span className={`inline-flex items-center font-mono ${className}`}>
      {`@${person.handle}@`}
      <EcosystemMark
        ecosystem={person.ecosystem}
        size={size}
        className="mx-0.5"
      />
      {eco?.alias ?? person.ecosystem}
    </span>
  );
}

/**
 * `Name:Ecosystem` for a group-message sender label, where the avatar already
 * identifies the person and the ecosystem is the extra fact worth surfacing.
 */
export function SenderLabel({
  person,
  className = "",
}: {
  person: MessagePerson;
  className?: string;
}): ReactNode {
  const eco = getEcosystem(person.ecosystem);
  const first = person.name.split(" ")[0] ?? person.name;
  if (!eco || eco.local) {
    return <span className={className}>{first}</span>;
  }
  return (
    // `whitespace-nowrap`: "Dan:Common Source" was folding onto two lines and
    // reading as two separate labels.
    <span
      className={`inline-flex items-center whitespace-nowrap ${className}`}
    >
      {first}
      <span className="mr-1 opacity-50">:</span>
      <EcosystemMark ecosystem={person.ecosystem} size={11} />
      <span className="ml-1">{eco.name}</span>
    </span>
  );
}

/** Plain-text handle, for `aria-label`s, titles and confirmation copy. */
export function handleText(person: MessagePerson, qualified = false): string {
  return handleOf(person, { qualified });
}
