"use client";

import {
  CommandPopover,
  MentionPopover,
} from "@/components/apps/messages/composer-popover";
import { formatDuration } from "@/components/apps/messages/media-attachment";
import {
  EditableField,
  type EditableFieldApi,
} from "@/components/apps/messages/editable-field";
import { Tooltip } from "@/components/hub/tooltip";
import { content, type MediaItem, type MessagePerson } from "@/lib/data";
import {
  argumentSlots,
  remainingSyntax,
  searchCommands,
  type CommandSpec,
} from "@/lib/commands";
import {
  activeToken,
  replaceToken,
  searchMentions,
  type ActiveToken,
} from "@/lib/mentions";
import { handleOf } from "@/lib/messages";
import {
  ImagePlus,
  Mic,
  Paperclip,
  SendHorizontal,
  Slash,
  Smile,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, type ReactNode } from "react";

/**
 * The message composer.
 *
 * Typing `@` opens a mention list drawn from every ecosystem in the inbox,
 * ranked most-recently-messaged first, and narrowing as you type. Typing `/` at
 * the start of a line opens the BRC-218 command list. Both are keyboard-driven
 * and neither ever substitutes a choice the user did not make, which section
 * 4.4 requires of recipient autocomplete.
 */
/** Links the input to its popover for assistive technology. */
const POPOVER_ID = "composer-autocomplete";

export function Composer({
  placeholder,
  onSend,
  beforeSend,
  onAttach,
  onAttachFile,
  attachments = [],
  onRemoveAttachment,
  onCommand,
  implicitRecipient = false,
  seed,
  focusOnOpen = false,
}: {
  placeholder: string;
  onSend: (text: string) => void;
  /**
   * Last word before a plain message is sent. Return false to hold it back and
   * leave the draft untouched — used where the conversation wants an explicit
   * agreement first, and only for chat: a command has its own confirmation.
   */
  beforeSend?: (text: string) => boolean;
  onAttach: () => void;
  /** open the file picker, as distinct from pictures and clips */
  onAttachFile?: () => void;
  /**
   * Files chosen but not yet sent. They ride along with the next message, which
   * is what lets `/sign` cover them: a signature over "this message" has to be
   * able to include what is attached to it.
   */
  attachments?: MediaItem[];
  onRemoveAttachment?: (index: number) => void;
  /** a locally-composed command line, to be parsed and confirmed */
  onCommand: (input: string) => void;
  /** true in a DM, where the recipient argument may be left out */
  implicitRecipient?: boolean;
  /**
   * Text to start from, e.g. `/pay @23@treechat ` after choosing Pay on a
   * profile card. Keyed by the caller so a fresh seed remounts the composer
   * with it as the initial draft — no effect syncing props into state.
   */
  seed?: string;
  /**
   * Take focus on mount. Set when a thread opens on a pointer device, where
   * the composer is the only thing you can do next; never on touch, where it
   * would throw up the keyboard over the conversation you came to read.
   */
  focusOnOpen?: boolean;
}): ReactNode {
  const [draft, setDraft] = useState(seed ?? "");
  const [caret, setCaret] = useState((seed ?? "").length);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  // Bumped on insert, so the field takes focus and the caret lands after it.
  const [focusSignal, setFocusSignal] = useState(0);
  // The far end of a selection to restore alongside `caret`, for Tab stepping.
  const fieldApi = useRef<EditableFieldApi | null>(null);
  /**
   * Which argument slot Tab last landed on.
   *
   * Tracked rather than derived from the caret: the field reports a fresh caret
   * on key-up, so a caret-derived slot moves under us between one Tab and the
   * next. Reset whenever the text changes, since the slots have.
   */
  const [slotIndex, setSlotIndex] = useState(-1);
  const copy = content.messages;

  const token: ActiveToken | null = dismissed
    ? null
    : activeToken(draft, caret);
  // Left to the React Compiler to memoize — a manual useMemo here narrows the
  // dependency to `token.query`, which it cannot verify and so bails out.
  const mentions = token?.kind === "mention" ? searchMentions(token.query) : [];
  const commands = token?.kind === "command" ? searchCommands(token.query) : [];
  const options = token?.kind === "mention" ? mentions : commands;
  const open = Boolean(token) && options.length > 0;

  /*
   * What is still to be typed, shown as a ghost continuation after the caret.
   *
   * Staged files change the hint, because for `/once` they change the grammar:
   * the files are the payload, so the secret becomes an optional quoted extra
   * rather than the required first argument.
   */
  const hint = remainingSyntax(draft, {
    implicitRecipient,
    hasAttachment: attachments.length > 0,
  });

  const update = (value: string, nextCaret: number): void => {
    setDraft(value);
    setCaret(nextCaret);
    setActiveIndex(0);
    // Only typing reopens a dismissed popover, and only typing invalidates the
    // slot positions. Moving the caret does neither — and the field reports on
    // every key-up, including the Tab that just dismissed it.
    if (value !== draft) {
      setDismissed(false);
      setSlotIndex(-1);
    }
  };

  const insert = (text: string): void => {
    if (!token) return;
    const next = replaceToken(draft, token, text);
    // The field rebuilds from `value` and restores the caret from `caret`, so
    // both go through state rather than being poked into the DOM here.
    setDraft(next.value);
    setCaret(next.caret);
    setActiveIndex(0);
    setFocusSignal((n) => n + 1);
  };

  const chooseMention = (person: MessagePerson): void =>
    insert(handleOf(person));
  const chooseCommand = (spec: CommandSpec): void => insert(`/${spec.verb}`);

  const submit = (): void => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    // A leading `/` is a command; `//` is chat with a literal slash.
    if (text.startsWith("/") && !text.startsWith("//")) {
      onCommand(text);
    } else {
      const body = text.startsWith("//") ? text.slice(1) : text;
      /*
       * The thread may want to ask something before this goes anywhere.
       *
       * It answers false and the draft is left exactly as typed — which is the
       * whole reason this is a veto rather than the thread clearing up
       * afterwards: somebody who cancels a confirmation has not agreed to lose
       * what they wrote.
       */
      if (beforeSend && !beforeSend(body)) return;
      onSend(body);
    }
    setDraft("");
    setCaret(0);
    setDismissed(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + options.length) % options.length
        );
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
        return;
      }
    }
    /*
     * Tab walks the argument slots the ghost hint is describing, selecting each
     * so the next keystroke replaces it. Without it the hint tells you the
     * grammar but gives you no way to move through it, and correcting the
     * second of three arguments means arrowing past the third.
     */
    if (
      event.key === "Tab" &&
      draft.startsWith("/") &&
      !draft.startsWith("//")
    ) {
      // Never let Tab move focus out of a half-written command.
      event.preventDefault();
      const slots = argumentSlots(draft);
      if (slots.length > 0) {
        const step = event.shiftKey ? -1 : 1;
        // Cycles rather than stopping at either end: the line is short, and
        // running off the last argument with nowhere to go is the annoying part.
        const next =
          slotIndex === -1
            ? event.shiftKey
              ? slots.length - 1
              : 0
            : (slotIndex + step + slots.length) % slots.length;
        const slot = slots[next]!;
        setSlotIndex(next);
        /*
         * Landing on a recipient puts the caret inside a mention token, which
         * would open the autocomplete — and then the *next* Tab is taken by the
         * list instead of moving on, re-inserting the handle. Dismiss it; the
         * next keystroke reopens it, because typing is when it is wanted.
         */
        setDismissed(true);
        fieldApi.current?.select(slot.start, slot.end);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-border relative shrink-0 border-t p-3">
      {attachments.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {attachments.map((item, index) => (
            <li key={`${item.src}-${index}`} className="group/att relative">
              <span className="border-border bg-surface block size-14 overflow-hidden rounded-lg border">
                {item.poster || item.kind === "image" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.poster ?? item.src}
                    alt={item.alt ?? ""}
                    className="size-full object-cover object-top"
                  />
                ) : (
                  <span className="text-muted-foreground grid size-full place-items-center px-1 text-center text-[8px] leading-tight">
                    {item.fileName ?? item.src.split("/").pop()}
                  </span>
                )}
              </span>
              {item.kind === "video" && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-medium text-white"
                >
                  {item.duration ? formatDuration(item.duration) : ""}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoveAttachment?.(index)}
                aria-label={copy.media.removeStaged}
                /* Always reachable on touch, where there is no hover to
                   reveal it; only on hover where there is. */
                className="focus-ring border-border bg-surface-raised text-muted-foreground hover:text-foreground absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover/att:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-center gap-1"
      >
        <button
          type="button"
          onClick={onAttach}
          aria-label={copy.attach}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-full p-2"
        >
          <ImagePlus className="size-5" aria-hidden="true" />
        </button>

        {onAttachFile && (
          <Tooltip label={copy.media.attachFile} className="shrink-0">
            <button
              type="button"
              onClick={onAttachFile}
              aria-label={copy.media.attachFile}
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-full p-2"
            >
              <Paperclip className="size-5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}

        {/* The popovers anchor to the input rather than to the composer, so the
            list lines up with the text it is completing instead of starting out
            under the attachment buttons. */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {open &&
            (token?.kind === "mention" ? (
              <MentionPopover
                id={POPOVER_ID}
                people={mentions}
                activeIndex={activeIndex}
                onSelect={chooseMention}
                prequery={token.query.length === 0}
              />
            ) : (
              <CommandPopover
                id={POPOVER_ID}
                commands={commands}
                activeIndex={activeIndex}
                onSelect={chooseCommand}
              />
            ))}
          <div className="bg-surface flex min-w-0 flex-1 items-center gap-1 rounded-full px-4 py-1.5">
            <EditableField
              value={draft}
              caret={caret}
              onChange={update}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              {...(hint ? { hint } : {})}
              /* A seeded composer is the tail of a deliberate action, so it takes
               focus on mount — otherwise you must click before pressing Enter.
               Safe because a fresh seed remounts the field. */
              autoFocus={Boolean(seed) || focusOnOpen}
              focusSignal={focusSignal}
              apiRef={fieldApi}
              aria-label={copy.messagePlaceholder}
              aria-expanded={open}
              aria-controls={POPOVER_ID}
            />
            {/* Commands live inside the field, beside emoji — they compose text,
              so they belong with the other text affordances. */}
            <Tooltip label={copy.commands.open} className="shrink-0">
              <button
                type="button"
                onClick={() => update("/", 1)}
                aria-label={copy.commands.open}
                className="focus-ring text-muted-foreground hover:text-foreground rounded-full p-1.5"
              >
                <Slash className="size-5" aria-hidden="true" />
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => toast.info("Coming soon")}
              aria-label={copy.emoji}
              className="focus-ring text-muted-foreground hover:text-foreground hidden shrink-0 rounded-full p-1.5 sm:inline-flex"
            >
              <Smile className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => toast.info("Coming soon")}
              aria-label={copy.voice}
              className="focus-ring text-muted-foreground hover:text-foreground hidden shrink-0 rounded-full p-1.5 sm:inline-flex"
            >
              <Mic className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!draft.trim() && attachments.length === 0}
          aria-label={copy.send}
          className="focus-ring text-accent hover:bg-accent/10 shrink-0 rounded-full p-2 disabled:opacity-40"
        >
          <SendHorizontal className="size-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
