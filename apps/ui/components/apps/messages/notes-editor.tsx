"use client";

import { content } from "@/lib/data";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extensions";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { ReactNode } from "react";

/**
 * The conversation's notes, as a document rather than a text box.
 *
 * Notes about a conversation are the same shape as any other working document —
 * headings, a checklist, a link to the thing you keep reopening — and a plain
 * textarea makes you spell that structure out in punctuation and then reread it
 * as punctuation. TipTap gives the markdown you would have typed anyway: `#`,
 * `-`, `1.`, `[] `, `>`, backticks and `**bold**` all become the thing they
 * describe as you type them.
 *
 * Measured and centred, the way a document is, rather than run to the full width
 * of the pane. Long lines are read badly whatever the app is.
 *
 * `immediatelyRender: false` because the editor builds a DOM the server cannot;
 * without it the first client render disagrees with the markup and React throws
 * out the tree it just hydrated.
 */
/**
 * Ceiling on a note's length.
 *
 * A note is a scratchpad for one conversation, not a document store. The cap
 * is enforced inside the editor rather than checked after the fact, so typing
 * simply stops instead of text appearing and then vanishing.
 */
export const NOTE_LIMIT = 2180;
/** How close to the ceiling before the count is worth showing. */
const WARN_AT = 200;

export function NotesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}): ReactNode {
  const copy = content.messages.tabs;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Link ships inside StarterKit in v3; adding the extension again would
      // register the name twice.
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      // Not in StarterKit, and the first thing anyone writes in a note about a
      // conversation is what they still owe the other person.
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: copy.notesPlaceholder }),
      CharacterCount.configure({ limit: NOTE_LIMIT }),
    ],
    content: value,
    // Opening the tab should put you where you left off writing, which is the
    // end of what you wrote. On an empty note this is just focus.
    autofocus: "end",
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: {
        class: "notes-prose focus:outline-none",
        "aria-label": copy.notes,
      },
    },
  });

  const used = editor?.storage.characterCount.characters() ?? 0;

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[44rem] px-6 pt-4 pb-24 sm:px-12">
        <EditorContent editor={editor} />
      </div>
      {/* Only once it matters. A counter on an empty note is a word limit
          announcing itself before anyone has written anything. */}
      {used > NOTE_LIMIT - WARN_AT && (
        <p
          aria-live="polite"
          className={`sticky bottom-3 mr-4 ml-auto w-fit rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[11px] tabular-nums ${
            used >= NOTE_LIMIT ? "text-warning" : "text-muted-foreground"
          }`}
        >
          {used} / {NOTE_LIMIT}
        </p>
      )}
    </div>
  );
}

/** Whether a note holds anything, for the dot on the Notes tab. */
export function noteHasContent(html: string | undefined): boolean {
  if (!html) return false;
  // An empty TipTap document still serialises to a paragraph, so the tags
  // cannot be the test. Text is content, and so is a structure someone built
  // and has not filled in yet.
  if (/<(hr|img|li)\b/.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}
