/**
 * table: shortcuts — the keymap, grouped by what it acts on.
 *
 * Written down because Nexus has a command palette and twenty-odd chat verbs
 * and, until this existed, no page anywhere that said so. A shortcut nobody can
 * discover is a shortcut for whoever wrote it.
 *
 * Keys are stored as tokens (`mod` meaning Command or Control) so one table
 * serves both platforms rather than two lists drifting apart.
 */

export interface Shortcut {
  id: string;
  label: string;
  /** key tokens; `mod` renders as ⌘ on a Mac and Ctrl elsewhere */
  keys: string[];
  /** what it does, where the label is not enough */
  note?: string;
}

export interface ShortcutGroup {
  id: string;
  title: string;
  shortcuts: Shortcut[];
}

export const shortcutGroups: ShortcutGroup[] = [
  {
    id: "getting-around",
    title: "Getting around",
    shortcuts: [
      { id: "palette", label: "Command palette", keys: ["mod", "k"] },
      { id: "search", label: "Search this app", keys: ["mod", "f"] },
      { id: "apps", label: "App store", keys: ["mod", "shift", "a"] },
      { id: "settings", label: "Settings", keys: ["mod", ","] },
      {
        id: "panel",
        label: "Show or hide the side panel",
        keys: ["mod", "\\"],
      },
      { id: "help", label: "What this app does", keys: ["mod", "/"] },
    ],
  },
  {
    id: "browsing",
    title: "Browsing",
    shortcuts: [
      { id: "new-tab", label: "New tab", keys: ["mod", "t"] },
      { id: "close-tab", label: "Close tab", keys: ["mod", "w"] },
      { id: "reopen", label: "Reopen the last tab", keys: ["mod", "shift", "t"] },
      { id: "address", label: "Focus the address bar", keys: ["mod", "l"] },
      { id: "reload", label: "Reload", keys: ["mod", "r"] },
      {
        id: "devtools",
        label: "Developer tools",
        keys: ["alt", "mod", "i"],
        note: "Only while developer tools are switched on in Settings.",
      },
    ],
  },
  {
    id: "messages",
    title: "Messages",
    shortcuts: [
      {
        id: "commands",
        label: "List every command",
        keys: ["/"],
        note: "Typed into the message box, not held down.",
      },
      { id: "send", label: "Send", keys: ["enter"] },
      { id: "newline", label: "New line without sending", keys: ["shift", "enter"] },
      { id: "next-unread", label: "Next unread conversation", keys: ["mod", "j"] },
      { id: "new-chat", label: "New conversation", keys: ["mod", "n"] },
      {
        id: "save",
        label: "Save the message under the cursor",
        keys: ["mod", "s"],
      },
    ],
  },
  {
    id: "value",
    title: "Money and proof",
    shortcuts: [
      { id: "pay", label: "Pay", keys: ["mod", "shift", "p"] },
      { id: "receive", label: "Receive", keys: ["mod", "shift", "r"] },
      {
        id: "sign",
        label: "Sign the selection",
        keys: ["mod", "shift", "s"],
      },
      { id: "onchain", label: "View on chain", keys: ["mod", "shift", "o"] },
    ],
  },
];

/** Every shortcut, flat — for search and for conflict checks. */
export const shortcuts: Shortcut[] = shortcutGroups.flatMap(
  (group) => group.shortcuts,
);
