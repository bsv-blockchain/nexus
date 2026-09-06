"use client";

/**
 * `@handle` and `/command` autocomplete, for a plain textarea.
 *
 * The Messages composer has had this since it shipped, built around its own
 * `EditableField` — a contenteditable that draws resolved mentions as chips and
 * a ghost continuation after the caret. The Timeline's three composers are
 * ordinary textareas and have no use for chips, but the *lists* should be the
 * same lists: a handle that completes in a DM and not in a post is a handle the
 * reader has to remember two rules about.
 *
 * So this shares the parts that are about language — `activeToken`,
 * `searchMentions`, `searchCommands`, `replaceToken` and both popovers — and
 * leaves the field alone. Nothing here knows what it is attached to beyond
 * "something with a selection".
 */

import {
  CommandPopover,
  MentionPopover,
} from "@/components/apps/messages/composer-popover";
import { handleOf } from "@/lib/messages";
import type { MessagePerson } from "@/lib/data";
import { searchCommands, type CommandSpec } from "@/lib/commands";
import { activeToken, replaceToken, searchMentions } from "@/lib/mentions";
import { caretLineTop, lineHeightOf } from "@/lib/caret-position";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ComposerTokens {
  /** put on the textarea, so the hook can restore the caret after an insert */
  ref: React.RefObject<HTMLTextAreaElement | null>;
  /** arrows, Enter and Tab while the list is open; call yours after it */
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** the caret moved without the text changing */
  onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  /** call from the textarea's onChange, before your own setState */
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** true while the list is showing — swallow your own Enter-to-send */
  open: boolean;
  /** render inside a `relative` wrapper round the field; hangs below it */
  popover: ReactNode;
}

export function useComposerTokens({
  draft,
  setDraft,
}: {
  draft: string;
  setDraft: (value: string) => void;
}): ComposerTokens {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(draft.length);
  const [activeIndex, setActiveIndex] = useState(0);
  /* Escape closes the list without closing the composer. Cleared on the next
     keystroke, because typing is when the list is wanted. */
  const [dismissed, setDismissed] = useState(false);
  /* Bumped on insert. The effect below restores the caret from it rather than
     from `draft`, so an insert that happens not to change the length still
     moves the caret. */
  const [inserted, setInserted] = useState(0);
  /*
   * Where to hang the list, in pixels below the field's top.
   *
   * Measured in the event handlers rather than during render or in an effect:
   * it needs the live DOM node, and the handlers are the only place that has
   * one at a moment when it is safe to write state.
   */
  const [anchorTop, setAnchorTop] = useState<number | undefined>(undefined);

  const measure = (field: HTMLTextAreaElement): void => {
    setAnchorTop(caretLineTop(field) + lineHeightOf(field) + 6);
  };

  const token = dismissed ? null : activeToken(draft, caret);
  const mentions = token?.kind === "mention" ? searchMentions(token.query) : [];
  const commands = token?.kind === "command" ? searchCommands(token.query) : [];
  const options: unknown[] = token?.kind === "mention" ? mentions : commands;
  const open = Boolean(token) && options.length > 0;

  /* The caret is set on the DOM node, not through React: a textarea's selection
     is not a prop, and setting it during render would be a write to something
     React is about to overwrite. */
  useEffect(() => {
    if (inserted === 0) return;
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(caret, caret);
  }, [inserted, caret]);

  const insert = (text: string): void => {
    if (!token) return;
    const next = replaceToken(draft, token, text);
    setDraft(next.value);
    setCaret(next.caret);
    setActiveIndex(0);
    setInserted((n) => n + 1);
  };

  const chooseMention = (person: MessagePerson): void =>
    insert(handleOf(person));
  const chooseCommand = (spec: CommandSpec): void => insert(`/${spec.verb}`);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!open) {
      /* Any key other than Escape means the list should come back — otherwise
         one Escape silences autocomplete for the rest of the draft. */
      if (dismissed && event.key !== "Escape") setDismissed(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (token?.kind === "mention") {
        const person = mentions[activeIndex];
        if (person) chooseMention(person);
      } else {
        const spec = commands[activeIndex];
        if (spec) chooseCommand(spec);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
    }
  };

  const onSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>): void => {
    setCaret(event.currentTarget.selectionStart ?? 0);
    measure(event.currentTarget);
  };

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setCaret(event.currentTarget.selectionStart ?? 0);
    setActiveIndex(0);
    setDismissed(false);
    measure(event.currentTarget);
  };

  const popover =
    open && token ? (
      /*
        Under the line being typed, not under the box.

        `top-full` was still wrong on a composer that is three rows tall while
        you are on the first of them: the list opened most of a paragraph below
        the word it was completing. `offsetTop` is the caret's own line,
        measured off a mirror of the field.

        The popover positions itself against the nearest positioned ancestor,
        so there is no wrapper here — an earlier one was a second absolutely
        positioned box around a box that already places itself, which left the
        list floating with a zero-height parent.
      */
      token.kind === "mention" ? (
        <MentionPopover
          people={mentions}
          activeIndex={activeIndex}
          onSelect={chooseMention}
          prequery={token.query.length === 0}
          placement="below"
          offsetTop={anchorTop}
        />
      ) : (
        <CommandPopover
          commands={commands}
          activeIndex={activeIndex}
          onSelect={chooseCommand}
          placement="below"
          offsetTop={anchorTop}
        />
      )
    ) : null;

  return { ref, onKeyDown, onSelect, onChange, open, popover };
}
