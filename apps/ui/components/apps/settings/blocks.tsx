"use client";

/**
 * The pieces every settings panel is built from.
 *
 * Lifted out of `settings-app` once a second file needed them: a panel that
 * carries its own copy of the group wrapper is a panel whose padding will
 * eventually disagree with everything around it.
 */

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

export function Group({
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
      {/* A card, not an outline. Transparent groups let the canvas show
          through, which made a settings page read as a list of rules drawn on
          the wall rather than a stack of cards you can pick up. */}
      <div className="border-border divide-border/60 bg-surface-raised mt-2.5 divide-y overflow-hidden rounded-xl border">
        {children}
      </div>
    </section>
  );
}

/** A row that states a setting and its current value. */
export function Row({
  label,
  hint,
  value,
  onClick,
}: {
  label: string;
  hint?: string;
  value?: string;
  onClick?: () => void;
}): ReactNode {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
            {hint}
          </span>
        )}
      </span>
      {value && (
        <span className="text-muted-foreground shrink-0 text-xs">{value}</span>
      )}
    </>
  );
  if (!onClick) {
    return <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring hover:bg-surface-hover flex w-full items-center gap-3 px-3 py-2.5 text-left"
    >
      {body}
    </button>
  );
}

/**
 * A setting that is simply on or off.
 *
 * Settings had rows that state a value and rows that open a picker, and nothing
 * for the commonest kind of all. The switch is the control rather than the whole
 * row being pressable: a row you can click anywhere on is fine for navigating
 * and wrong for a toggle, where a stray click changes something.
 */
export function Toggle({
  label,
  hint,
  value,
  badge,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  /** a keyboard shortcut or similar, shown alongside the label */
  badge?: string;
  onChange: (next: boolean) => void;
}): ReactNode {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          {badge && (
            <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px]">
              {badge}
            </span>
          )}
        </span>
        {hint && (
          <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`focus-ring relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? "bg-accent" : "bg-muted-foreground/40"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
            value ? "left-4.5" : "left-0.5"
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

/**
 * An exclusive choice, one row per option.
 *
 * The same shape as the on-chain popover in Messages, because it is the same
 * kind of decision: a handful of mutually exclusive settings whose consequences
 * differ enough that each one needs a sentence rather than a label.
 */
export function Choice<T extends string>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: {
    id: T;
    label: string;
    hint: string;
    icon?: ReactNode;
    /** an explainer, placed beside the row rather than inside it */
    info?: ReactNode;
  }[];
  onPick: (next: T) => void;
}): ReactNode {
  return (
    <div role="radiogroup" className="p-1">
      {options.map((option) => {
        const selected = option.id === value;
        const row = (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(option.id)}
            className={`focus-ring flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors ${
              selected ? "bg-accent/10" : "hover:bg-surface-hover"
            }`}
          >
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {selected && <span className="bg-current size-1.5 rounded-full" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {/* The radio dot is the only accent in a row: the leading icon
                    is a label for the option, not a second selection marker. */}
                {option.icon && (
                  <span className="text-muted-foreground" aria-hidden="true">
                    {option.icon}
                  </span>
                )}
                {option.label}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px] text-pretty">
                {option.hint}
              </span>
            </span>
          </button>
        );
        /* The explainer sits over the row rather than in it: an interactive
           element inside a radio is neither valid nor separately clickable. */
        return option.info ? (
          <div key={option.id} className="relative">
            {row}
            <span className="absolute top-2.5 right-2.5">{option.info}</span>
          </div>
        ) : (
          row
        );
      })}
    </div>
  );
}

/**
 * A number from a short list of sensible ones.
 *
 * Steps rather than a slider. A slider invites a value nobody wants — 93% zoom,
 * 17px text — and gives no way to hit the one you meant on a touch screen.
 */
export function Steps({
  label,
  value,
  options,
  format,
  onPick,
}: {
  label: string;
  value: number;
  options: number[];
  format: (value: number) => string;
  onPick: (next: number) => void;
}): ReactNode {
  return (
    <div className="px-3 py-2.5">
      <p className="text-sm font-medium">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="mt-2 flex flex-wrap gap-1.5"
      >
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(option)}
              className={`focus-ring rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors ${
                active
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * An amount in satoshis: a couple of common ones, and a box for anything else.
 *
 * The presets are shortcuts, not the range. A toll is a number somebody has an
 * opinion about — enough to deter a stranger, not so much that a real message
 * bounces — and no list of three guesses covers that, so the field is the
 * control and the pills are conveniences beside it.
 *
 * Typing takes effect as you type. There is no Save, because there is nothing
 * to lose by being wrong for a moment: the value is read the next time somebody
 * writes to you, not at the instant you set it.
 */
export function SatsAmount({
  value,
  presets,
  offLabel,
  label,
  onPick,
}: {
  value: number;
  presets: number[];
  /** shown as a leading pill meaning "no toll"; omit to require an amount */
  offLabel?: string;
  label: string;
  onPick: (next: number) => void;
}): ReactNode {
  const pill = (active: boolean): string =>
    `focus-ring rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors ${
      active
        ? "border-accent bg-accent/15 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {offLabel !== undefined && (
        <button
          type="button"
          aria-pressed={value === 0}
          onClick={() => onPick(0)}
          className={pill(value === 0)}
        >
          {offLabel}
        </button>
      )}
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={value === preset}
          onClick={() => onPick(preset)}
          className={pill(value === preset)}
        >
          {preset.toLocaleString("en-GB")}
        </button>
      ))}
      {/* Grows with what is typed, so the field is the width of the number
          rather than a box sized for the longest amount anybody might pick. */}
      <span
        className={`focus-within:ring-accent inline-flex items-baseline gap-1 rounded-full border px-3 py-1 transition-shadow focus-within:ring-2 ${
          value !== 0 && !presets.includes(value)
            ? "border-accent bg-accent/15"
            : "border-border"
        }`}
      >
        {/* A pencil, because a bordered field full of digits still reads as a
            value rather than a control until something says you may type. */}
        <Pencil
          className="text-muted-foreground size-3 shrink-0 self-center"
          aria-hidden="true"
        />
        <input
          value={value === 0 ? "" : String(value)}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/g, "").slice(0, 12);
            onPick(digits === "" ? 0 : Number(digits));
          }}
          inputMode="numeric"
          aria-label={label}
          placeholder="0"
          size={Math.max(String(value === 0 ? "" : value).length, 4)}
          className="field-sizing-content min-w-[4ch] bg-transparent text-xs font-semibold tabular-nums outline-none"
        />
        <span className="text-muted-foreground text-[10px]">sats</span>
      </span>
    </div>
  );
}
