"use client";

import { MENTION_CHIP } from "@/components/apps/messages/mention-text";
import { findMentions } from "@/lib/mentions";
import type { MessagePerson } from "@/lib/data";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * The composer's text field, as a contenteditable rather than an `<input>`.
 *
 * The reason is narrow: a mention should carry the person's avatar, and an
 * `<input>` holds a string. Everything else is unchanged — this still reports a
 * plain-text value and a caret offset, so the composer's parsing, autocomplete
 * and command handling operate on exactly the data they did before.
 *
 * The DOM is the source of truth while you type, and is rebuilt from `value`
 * only when the two disagree: an inserted mention, a seeded command, a clear
 * after send. Rebuilding on every keystroke would fight the caret.
 *
 * Chips are built with plain DOM rather than nested React roots. A root per
 * mention would mean unmount scheduling and lifecycle for something that is an
 * image and two spans.
 */

/**
 * Whether the browser supports `contenteditable="plaintext-only"`.
 *
 * That value is what keeps a paste from carrying markup into the field. Chrome,
 * Safari and Firefox 136+ have it; older Gecko does not, and how it treats the
 * unrecognised value is not something to bet the composer on, so the attribute
 * is corrected to plain `true` after mount and paste is sanitised by hand.
 */
function supportsPlaintextOnly(): boolean {
  const probe = document.createElement("div");
  probe.setAttribute("contenteditable", "plaintext-only");
  return probe.contentEditable === "plaintext-only";
}

export interface EditableFieldApi {
  /** Select a range of the plain text, so the next keystroke replaces it. */
  select: (start: number, end: number) => void;
}

/** Plain text of the field, with each chip contributing the handle it stands for. */
function serialise(root: HTMLElement): string {
  let out = "";
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      continue;
    }
    const el = node as HTMLElement;
    if (el.dataset.hint !== undefined) continue;
    out += el.dataset.text ?? el.textContent ?? "";
  }
  return out;
}

/** Caret position as an offset into the plain text. */
function caretOffset(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return serialise(root).length;
  const range = selection.getRangeAt(0);
  let offset = 0;
  for (const node of Array.from(root.childNodes)) {
    if (node === range.endContainer) return offset + range.endOffset;
    if (node.contains(range.endContainer)) {
      // Inside a chip: the caret sits after it, since a chip is one unit.
      return offset + ((node as HTMLElement).dataset.text?.length ?? 0);
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0;
    } else {
      const el = node as HTMLElement;
      if (el.dataset.hint === undefined) {
        offset += el.dataset.text?.length ?? el.textContent?.length ?? 0;
      }
    }
  }
  return offset;
}

/** The DOM position for a plain-text offset, treating chips as atomic. */
function locate(
  root: HTMLElement,
  target: number,
): { node: Node; offset: number } | { after: HTMLElement } | null {
  let remaining = target;
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) return { node, offset: remaining };
      remaining -= length;
      continue;
    }
    const el = node as HTMLElement;
    if (el.dataset.hint !== undefined) continue;
    const length = el.dataset.text?.length ?? 0;
    if (remaining <= length) return { after: el };
    remaining -= length;
  }
  return null;
}

/** Select a plain-text range, so the next keystroke replaces it. */
function selectRange(root: HTMLElement, from: number, to: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const a = locate(root, from);
  const b = locate(root, to);
  if (!a || !b) return;
  const range = document.createRange();
  if ("after" in a) range.setStartAfter(a.after);
  else range.setStart(a.node, a.offset);
  if ("after" in b) range.setEndAfter(b.after);
  else range.setEnd(b.node, b.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Put the caret at a plain-text offset, treating chips as atomic. */
function placeCaret(root: HTMLElement, target: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let remaining = target;
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(node, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= length;
      continue;
    }
    const el = node as HTMLElement;
    if (el.dataset.hint !== undefined) continue;
    const length = el.dataset.text?.length ?? 0;
    if (remaining <= length) {
      range.setStartAfter(el);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
  }
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The avatar, as DOM — the same photo-or-gradient rule `MemberAvatar` uses. */
function avatarNode(person: MessagePerson, size: number): HTMLElement {
  const radius = Math.max(4, Math.round(size * 0.28));
  if (person.photo) {
    const img = document.createElement("img");
    img.src = person.photo;
    img.alt = "";
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.borderRadius = `${radius}px`;
    img.style.objectFit = "cover";
    img.style.flexShrink = "0";
    return img;
  }
  const tile = document.createElement("span");
  const [from, via, to] = person.avatarColors;
  const stops = [from ?? "#4353ff", via ?? from ?? "#7c3aed", to]
    .filter(Boolean)
    .join(", ");
  tile.style.width = `${size}px`;
  tile.style.height = `${size}px`;
  tile.style.borderRadius = `${radius}px`;
  tile.style.backgroundImage = `linear-gradient(140deg, ${stops})`;
  tile.style.flexShrink = "0";
  return tile;
}

export function EditableField({
  value,
  caret,
  onChange,
  onKeyDown,
  placeholder,
  hint,
  autoFocus,
  focusSignal,
  apiRef,
  className = "",
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
}: {
  value: string;
  caret: number;
  onChange: (value: string, caret: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder: string;
  /** ghost continuation shown after the text, e.g. remaining command syntax */
  hint?: string | undefined;
  autoFocus?: boolean;
  /**
   * Bumped by the caller after it inserts text, e.g. picking a command from the
   * popover. Choosing with the mouse can leave the field unfocused, and landing
   * back at the wrong offset means the next keystroke goes somewhere unexpected.
   */
  focusSignal?: number;
  /**
   * Imperative handle, for selecting a range of the text.
   *
   * A ref rather than a prop: a selection is an action, not a state, and
   * routing it through state made it land a render late — the field reports a
   * fresh caret on key-up, which raced whatever the caller had just asked for.
   */
  apiRef?: { current: EditableFieldApi | null };
  className?: string;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const plaintextOnly = useRef(true);

  // Corrected after mount rather than during render: the server has no way to
  // probe, so rendering anything but the markup below would mismatch on
  // hydration.
  useLayoutEffect(() => {
    plaintextOnly.current = supportsPlaintextOnly();
    if (!plaintextOnly.current && ref.current) {
      ref.current.contentEditable = "true";
    }
  }, []);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (serialise(root) === value) return;

    const focused = root.contains(document.activeElement) ||
      document.activeElement === root;
    root.replaceChildren();

    /*
     * The mention under the caret stays plain text. On a numeric ecosystem a
     * prefix of a handle resolves on its own — `@31` is valid while you are
     * still typing `@31@treechat` — so chipping eagerly rebuilds the DOM
     * underneath the caret mid-token and mangles what follows.
     */
    const spans = findMentions(value).filter(
      (span) => !(caret > span.start && caret <= span.end),
    );

    let cursor = 0;
    for (const span of spans) {
      if (span.start > cursor) {
        root.append(document.createTextNode(value.slice(cursor, span.start)));
      }
      const chip = document.createElement("span");
      chip.contentEditable = "false";
      chip.dataset.text = value.slice(span.start, span.end);
      // Same geometry as a mention rendered in a message, so what you type
      // looks like what gets posted.
      chip.className = `${MENTION_CHIP} bg-accent/15 font-medium text-accent`;
      const at = document.createElement("span");
      at.textContent = "@";
      chip.append(at, avatarNode(span.person, 14));
      const label = document.createElement("span");
      label.textContent = span.label;
      chip.append(label);
      root.append(chip);
      cursor = span.end;
    }
    if (cursor < value.length) {
      root.append(document.createTextNode(value.slice(cursor)));
    }
    if (focused) placeCaret(root, caret);
  }, [value, caret]);

  useLayoutEffect(() => {
    if (focusSignal === undefined) return;
    const root = ref.current;
    if (!root) return;
    root.focus();
    placeCaret(root, caret);
    // `caret` is deliberately not a dependency: this runs when the caller asks
    // for focus, not every time the caret moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  useLayoutEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      select: (start, end) => {
        const root = ref.current;
        if (!root) return;
        root.focus();
        selectRange(root, start, end);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  /*
   * The ghost hint is a trailing node inside the field rather than an overlay.
   * With chips in the line there is nothing to align an overlay against, and a
   * node that simply flows after the content is always in the right place.
   * Managed on its own so it can update without rebuilding the text.
   */
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelector("[data-hint]")?.remove();
    if (!hint) return;
    const ghost = document.createElement("span");
    ghost.dataset.hint = "";
    ghost.contentEditable = "false";
    ghost.className = "pointer-events-none text-muted-foreground/70 select-none";
    ghost.textContent = `${value.endsWith(" ") ? "" : " "}${hint}`;
    root.append(ghost);
  }, [hint, value]);

  const report = (): void => {
    const root = ref.current;
    if (!root) return;
    onChange(serialise(root), caretOffset(root));
  };

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      {value.length === 0 && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-sm text-muted-foreground select-none">
          {placeholder}
        </span>
      )}
      <div
        ref={ref}
        role="combobox"
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded ?? false}
        aria-controls={ariaControls}
        autoFocus={autoFocus}
        onInput={report}
        onPaste={(event) => {
          // Only reached on the fallback: insert the clipboard's plain text,
          // never its markup. execCommand fires `input`, so `report` still runs.
          if (plaintextOnly.current) return;
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
        }}
        onKeyUp={report}
        onClick={report}
        onKeyDown={onKeyDown}
        className={`min-w-0 flex-1 py-1.5 text-sm whitespace-pre-wrap outline-none ${className}`}
      />
    </div>
  );
}
