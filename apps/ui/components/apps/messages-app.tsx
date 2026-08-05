"use client";

import {
  ConversationList,
  useConversationRows,
} from "@/components/apps/messages/conversation-list";
import { DmThread } from "@/components/apps/messages/dm-thread";
import { GroupThread } from "@/components/apps/messages/group-thread";
import { MessagesProfileProvider } from "@/components/apps/messages/profile-view";
import { ProfileActionsProvider } from "@/components/apps/messages/profile-hovercard";
import { useProfileQuickActions } from "@/components/apps/messages/use-profile-actions";
import { useHub } from "@/components/hub/hub-provider";
import { content, getChatThread } from "@/lib/data";
import { MessageSquare, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { useSyncExternalStore, type ReactNode } from "react";

/** Tracks the md breakpoint, which is where the contextual sidebar appears. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 768px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );
}

/** Renders whichever thread kind the active conversation is. */
function Thread({
  conversationId,
  seed,
  seedKey,
  focusOnOpen,
}: {
  conversationId: string;
  seed?: string | undefined;
  seedKey?: number;
  focusOnOpen?: boolean;
}): ReactNode {
  const thread = getChatThread(conversationId);

  if (thread?.group) {
    return (
      <GroupThread
        key={thread.id}
        thread={thread as typeof thread & { group: NonNullable<typeof thread.group> }}
        {...(seed ? { seed } : {})}
        {...(seedKey !== undefined ? { seedKey } : {})}
        {...(focusOnOpen ? { focusOnOpen } : {})}
      />
    );
  }
  if (thread?.personId) {
    return (
      <DmThread
        key={thread.id}
        conversationId={thread.id}
        personId={thread.personId}
        {...(seed ? { seed } : {})}
        {...(seedKey !== undefined ? { seedKey } : {})}
        {...(focusOnOpen ? { focusOnOpen } : {})}
      />
    );
  }
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {content.messages.notFound}
    </div>
  );
}

/**
 * Messages.
 *
 * Desktop: the conversation list lives in the hub's contextual sidebar, so this
 * canvas only renders the active thread.
 * Mobile: there is no sidebar, so the list is shown inline until a conversation
 * is picked, and the thread then takes the full canvas with a back button.
 */
export function MessagesApp(): ReactNode {
  const {
    composerSeed: seed,
    messageThread,
  } = useHub();
  const isDesktop = useIsDesktop();
  /*
   * Opening Messages lands you in the most recent conversation.
   *
   * An empty canvas asking you to pick a conversation is a step that has one
   * obvious answer nine times out of ten. Derived rather than stored, so the
   * mobile branch above still sees a null thread and shows the list, and going
   * back there does not immediately bounce you into a thread again.
   */
  const rows = useConversationRows();
  const opened = messageThread ?? rows[0]?.id ?? null;
  const copy = content.messages;

  const actions = useProfileQuickActions();

  return (
    <MessagesProfileProvider>
    <ProfileActionsProvider actions={actions}>
      {/* Mobile keeps a fixed bottom bar over the canvas, so reserve its height
          — otherwise the composer and the end of the list sit underneath it. */}
      <div className="flex h-full min-h-0 flex-col pb-16 md:pb-0">
      {!isDesktop && !messageThread ? (
        /* The mobile root sits on the app canvas, not the sidebar surface. */
        <div className="flex h-full min-h-0 flex-col p-3 [--list-bg:var(--background)]">
          <div className="flex items-center justify-between gap-2 px-1 pb-3">
            <h1 className="text-lg font-bold">{copy.title}</h1>
            <button
              type="button"
              onClick={() => toast.info("Coming soon")}
              aria-label={copy.compose}
              className="focus-ring flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <SquarePen className="size-4.5" aria-hidden="true" />
            </button>
          </div>
          <ConversationList />
        </div>
      ) : opened ? (
        <Thread
          conversationId={opened}
          {...(seed ? { seed: seed.text, seedKey: seed.nonce } : {})}
          {...(isDesktop ? { focusOnOpen: true } : {})}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface">
            <MessageSquare className="size-8" aria-hidden="true" />
          </span>
          <p className="text-sm">{copy.emptyThread}</p>
        </div>
      )}
      </div>

    </ProfileActionsProvider>
    </MessagesProfileProvider>
  );
}
