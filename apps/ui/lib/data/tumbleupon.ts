import type { TumbleInboxItem } from "./types";

/**
 * The people you tumble with.
 *
 * Ids from `messagePeople`, not a roster of its own. Somebody who sends you a
 * site here is the same person who appears in Messages, in a whois card and on
 * a contact row — one identity, seen from another screen. A separate social
 * graph would be a second version of a person to keep in step, and the first
 * time the two disagreed about a handle it would be this one that looked wrong.
 */
export const tumbleConnections: string[] = [
  "bitcoinbeyond",
  "deggen",
  "mo",
  "austin",
  "oli",
  "icellan",
];

/**
 * What is waiting in the inbox.
 *
 * One, unread, from somebody who found something and thought of you — which is
 * the whole of what TumbleUpon's inbox is for. A stack of five would make it a
 * feed, and a feed is the thing this is an alternative to.
 */
export const tumbleInbox: TumbleInboxItem[] = [
  {
    id: "tumble-in-1",
    fromPersonId: "bitcoinbeyond",
    appSlug: "hexacities",
    message:
      "Claimed a hexagon on the north ridge and put my homepage on it — the whole tile is mine on chain. Go three rings out from the centre and you will see it.",
    minutesAgo: 26,
    read: false,
  },
];
