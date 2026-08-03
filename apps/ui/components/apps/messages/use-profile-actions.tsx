"use client";

import type { ProfileActions } from "@/components/apps/messages/profile-hovercard";
import { useHub } from "@/components/hub/hub-provider";
import { addChatThread, content, getChatThreadForPerson } from "@/lib/data";
import { handleOf } from "@/lib/messages";
import { toast } from "sonner";

/**
 * The actions a profile card offers, wherever it is drawn.
 *
 * One hook rather than a set per app, because the same card appears in the
 * Messages hovercard, the identity pane beside any app, and the wallet's
 * contact list — and when each surface built its own set they drifted. The
 * wallet's Pay opened a transfer sheet while the hovercard's wrote a command;
 * Request and Vouch were missing from the wallet entirely, because the wallet
 * has no composer of its own and nobody had asked what should happen there.
 *
 * The answer is that these are all commands, and commands live in a
 * conversation. Every one of them opens Messages and writes the line, which
 * also keeps BRC-218 section 4.1 honest: a payment is agreed to at the
 * confirmation, never at the button that produced it.
 */
export function useProfileQuickActions(): ProfileActions {
  const { openApp, setMessageThread, bumpConversations, seedComposer, openDetailPane, navigateActiveTab } =
    useHub();

  return {
    message: (person) => {
      openApp("messages");
      const thread = getChatThreadForPerson(person.id);
      if (thread) {
        setMessageThread(thread.id);
        return;
      }
      // No conversation yet is a reason to start one. Messaging a handle you
      // have never messaged is the case BRC-169 exists for, and refusing is
      // the least useful thing the client could do with the request.
      const id = `thread-${Date.now()}`;
      addChatThread({
        id,
        personId: person.id,
        createdAt: new Date().toISOString(),
      });
      bumpConversations();
      setMessageThread(id);
      toast.success(`${content.messages.startedWith} ${person.name}`);
    },
    prefill: (person, verb) => {
      openApp("messages");
      const thread = getChatThreadForPerson(person.id);
      // Write it where it can be sent. A command seeded into no conversation
      // goes nowhere, so the one with this person is the obvious place.
      if (thread) setMessageThread(thread.id);
      seedComposer(`/${verb} ${handleOf(person)}`);
    },
    seed: (text) => {
      openApp("messages");
      seedComposer(text);
    },
    whois: (person) => openDetailPane({ kind: "person", id: person.id }),
    // Replaces whatever the pane was showing. There is one pane, and a second
    // one opening beside it would be two answers to "who is this".
    vouches: (person) => openDetailPane({ kind: "vouches", id: person.id }),
    openWeb: (person) => {
      if (person.profileUrl) navigateActiveTab(person.profileUrl);
    },
  };
}
