"use client";

import { useHub } from "@/components/hub/hub-provider";
import type { MessagePerson } from "@/lib/data";
import { createContext, useContext, type ReactNode } from "react";

const OpenProfileContext = createContext<
  ((person: MessagePerson) => void) | null
>(null);

/**
 * Opens a person's identity card in the hub's reference pane.
 *
 * The pane used to be a modal sheet owned by this file. It now lives at hub
 * level, beside the app canvas, so it can narrow the app instead of covering it
 * and every app can open the same panel. This hook is what is left: the gesture,
 * decoupled from where the panel is rendered.
 */
export function useOpenProfile(): (person: MessagePerson) => void {
  const openProfile = useContext(OpenProfileContext);
  if (!openProfile) {
    throw new Error(
      "useOpenProfile must be used inside MessagesProfileProvider",
    );
  }
  return openProfile;
}

/**
 * Routes every profile gesture in Messages — a DM header, a group header, a
 * sender label, a member list, a command card's person chip — to the hub pane.
 */
export function MessagesProfileProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { openDetailPane } = useHub();
  return (
    <OpenProfileContext.Provider
      value={(person) => openDetailPane({ kind: "person", id: person.id })}
    >
      {children}
    </OpenProfileContext.Provider>
  );
}
