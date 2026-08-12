"use client";

import { Group } from "@/components/apps/settings/blocks";
import { content, shortcutGroups, shortcuts, type Shortcut } from "@/lib/data";
import { setShortcut, useSettings } from "@/lib/settings-store";
import { RotateCcw, Search, TriangleAlert } from "lucide-react";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const copy = content.settings.shortcuts;

/** Glyphs for the keys that have one. Everything else prints its own letter. */
const GLYPHS: Record<string, string> = {
  shift: "⇧",
  alt: "⌥",
  enter: "↵",
  escape: "esc",
  " ": "space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

/** Keys that only ever qualify another one. A binding cannot be just these. */
const MODIFIERS = new Set(["mod", "shift", "alt", "ctrl"]);

function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => navigator.platform.toUpperCase().includes("MAC"),
    () => false,
  );
}

function keyLabel(key: string, mac: boolean): string {
  if (key === "mod") return mac ? "⌘" : "Ctrl";
  if (key === "alt") return mac ? "⌥" : "Alt";
  if (key === "ctrl") return mac ? "⌃" : "Ctrl";
  return GLYPHS[key] ?? key.toUpperCase();
}

/**
 * A keystroke, as the tokens the keymap stores.
 *
 * `mod` rather than Command or Control, so a binding made on either platform
 * reads correctly on the other — which is the whole reason the table stores
 * tokens instead of a printed string. On a Mac the Command key is `mod`; on
 * Windows and Linux it is Control, and Control on a Mac stays its own key.
 */
function tokensFrom(event: KeyboardEvent, mac: boolean): string[] | null {
  const key = event.key.toLowerCase();
  if (["control", "meta", "shift", "alt", "os"].includes(key)) return null;

  const tokens: string[] = [];
  if (mac ? event.metaKey : event.ctrlKey) tokens.push("mod");
  if (mac && event.ctrlKey) tokens.push("ctrl");
  if (event.altKey) tokens.push("alt");
  if (event.shiftKey) tokens.push("shift");
  tokens.push(key === " " ? " " : key);
  return tokens;
}

function sameBinding(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function Keys({
  keys,
  mac,
  tone,
}: {
  keys: string[];
  mac: boolean;
  tone: "normal" | "conflict" | "recording";
}): ReactNode {
  const style =
    tone === "conflict"
      ? "border-negative text-negative"
      : tone === "recording"
        ? "border-accent text-foreground"
        : "border-border text-muted-foreground";
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className={`bg-surface min-w-5 rounded border px-1.5 py-0.5 text-center font-mono text-[10px] leading-4 ${style}`}
        >
          {keyLabel(key, mac)}
        </kbd>
      ))}
    </span>
  );
}

/**
 * One shortcut, recordable.
 *
 * Modelled on the macOS keyboard pane: click the row, it starts listening, the
 * next chord you press becomes the binding. Escape cancels and leaves the old
 * one alone, which matters because the alternative — committing whatever was
 * pressed — makes a mis-click destructive.
 *
 * A bare letter is refused. A shortcut with no modifier would fire while
 * somebody is typing into the message box, which is where most of this
 * product's input goes.
 */
function Row({
  shortcut,
  keys,
  mac,
  recording,
  conflict,
  onRecord,
  onCancel,
  onReset,
  rebound,
}: {
  shortcut: Shortcut;
  keys: string[];
  mac: boolean;
  recording: boolean;
  conflict: boolean;
  onRecord: () => void;
  onCancel: () => void;
  onReset: () => void;
  rebound: boolean;
}): ReactNode {
  return (
    /* The row is the target, padding included. A button inset inside the row
       left a dead strip along its edges that looked clickable and was not. */
    <div className={`relative ${conflict ? "bg-negative/10" : ""}`}>
      <button
        type="button"
        onClick={recording ? onCancel : onRecord}
        aria-pressed={recording}
        className="focus-ring hover:bg-surface-hover flex w-full items-start gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{shortcut.label}</span>
          {(recording || conflict || shortcut.note) && (
            <span
              className={`mt-0.5 block text-[11px] text-pretty ${
                conflict ? "text-negative" : "text-muted-foreground"
              }`}
            >
              {recording
                ? copy.recording
                : conflict
                  ? copy.conflict
                  : shortcut.note}
            </span>
          )}
        </span>
        {recording ? (
          <span className="border-accent text-muted-foreground shrink-0 rounded border border-dashed px-2 py-0.5 text-[10px]">
            {copy.pressKeys}
          </span>
        ) : (
          <span className={rebound ? "pr-7" : ""}>
            <Keys keys={keys} mac={mac} tone={conflict ? "conflict" : "normal"} />
          </span>
        )}
      </button>
      {/* Only where there is something to undo, and out of the flow so the
          row underneath stays clickable edge to edge. */}
      {rebound && !recording && (
        <button
          type="button"
          onClick={onReset}
          aria-label={`${copy.reset}: ${shortcut.label}`}
          title={copy.reset}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground absolute top-2 right-2 rounded-md p-1"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Every key this client answers to, and a way to change it.
 *
 * Conflicts are shown rather than prevented. Refusing a clash would leave
 * somebody stuck between two bindings with no way to swap them; marking both in
 * red says what is wrong and leaves them free to fix it in either order.
 */
export function ShortcutsPanel(): ReactNode {
  const mac = useIsMac();
  const settings = useSettings();
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState<string | null>(null);

  const bindingOf = (shortcut: Shortcut): string[] =>
    settings.keymap[shortcut.id] ?? shortcut.keys;

  /* Which bindings more than one shortcut answers to. Computed over the whole
     table rather than the filtered view: a clash does not stop existing because
     somebody typed into the search box. */
  const counts = new Map<string, number>();
  for (const shortcut of shortcuts) {
    const key = bindingOf(shortcut).join("+");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(null);
        return;
      }
      const tokens = tokensFrom(event, mac);
      if (!tokens) return;
      /* A binding has to be more than modifiers, and more than a bare letter —
         a lone key would fire while somebody is typing a message. */
      if (tokens.every((token) => MODIFIERS.has(token))) return;
      if (tokens.length === 1 && !MODIFIERS.has(tokens[0]!)) return;
      const shortcut = shortcuts.find((entry) => entry.id === recording);
      setShortcut(
        recording,
        shortcut && sameBinding(tokens, shortcut.keys) ? null : tokens,
      );
      setRecording(null);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [recording, mac]);

  const needle = query.trim().toLowerCase();
  const groups = shortcutGroups
    .map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter(
        (shortcut) =>
          !needle ||
          shortcut.label.toLowerCase().includes(needle) ||
          bindingOf(shortcut).join(" ").includes(needle),
      ),
    }))
    .filter((group) => group.shortcuts.length > 0);

  const clashes = [...counts.values()].filter((count) => count > 1).length;

  return (
    <>
      <div className="border-border bg-surface-raised mb-4 flex items-center gap-2 rounded-xl border px-3 py-2">
        <Search
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {clashes > 0 && (
        <p className="border-negative/40 bg-negative/10 text-negative mb-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] text-pretty">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {copy.conflictSummary}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">{copy.noResults}</p>
      ) : (
        groups.map((group) => (
          <Group key={group.id} title={group.title}>
            {group.shortcuts.map((shortcut) => {
              const keys = bindingOf(shortcut);
              return (
                <Row
                  key={shortcut.id}
                  shortcut={shortcut}
                  keys={keys}
                  mac={mac}
                  recording={recording === shortcut.id}
                  conflict={(counts.get(keys.join("+")) ?? 0) > 1}
                  rebound={Boolean(settings.keymap[shortcut.id])}
                  onRecord={() => setRecording(shortcut.id)}
                  onCancel={() => setRecording(null)}
                  onReset={() => setShortcut(shortcut.id, null)}
                />
              );
            })}
          </Group>
        ))
      )}

      <p className="text-muted-foreground mt-4 text-[11px] text-pretty">
        {copy.note}
      </p>
    </>
  );
}
