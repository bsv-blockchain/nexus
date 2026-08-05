"use client";

import { ChainPolicyButton } from "@/components/apps/messages/chain-policy";
import {
  ReleaseDetail,
  ReleaseList,
} from "@/components/hub/release-notes";
import { ConversationSettings } from "@/components/apps/messages/conversation-settings";
import { NewConversation } from "@/components/apps/messages/new-conversation";
import { ProfileActionsProvider } from "@/components/apps/messages/profile-hovercard";
import { useProfileQuickActions } from "@/components/apps/messages/use-profile-actions";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { VouchFacepile } from "@/components/apps/messages/whois-inline";
import { WhoisCard } from "@/components/apps/messages/whois-card";
import { useHub } from "@/components/hub/hub-provider";
import { SidePane } from "@/components/hub/side-pane";
import { ChevronRight } from "lucide-react";
import { groupIconOf } from "@/lib/group-icon";
import {
  content,
  getChatThread,
  getMessagePerson,
} from "@/lib/data";
import { toast } from "sonner";
import type { ReactNode } from "react";

/**
 * The actions the pane offers, expressed in hub terms.
 *
 * The pane renders at hub level, outside whichever app's
 * `ProfileActionsProvider` supplied the hovercard's handlers, so it needs its
 * own — without them its action row rendered empty. These are deliberately the
 * navigational ones: open the conversation, start a transfer, open their web
 * profile. Nothing here depends on a composer that may not be on screen.
 */

/**
 * Whatever the hub's reference pane is currently showing.
 *
 * One pane at a time: opening a second replaces the first, rather than stacking,
 * so the app column is never squeezed twice and there is no back stack to reason
 * about.
 */
export function DetailPane(): ReactNode {
  const {
    detailPane,
    closeDetailPane,
    openDetailPane,
    conversationTitles,
    renameConversation,
    conversationMembers,
    setConversationMembers,
    conversationIcons,
    setConversationIcon,
    conversationGates,
    conversationRoles,
    setConversationRoles,
    setConversationGates,
    setMessageThread,
  } = useHub();
  const actions = useProfileQuickActions();

  if (detailPane?.kind === "new") {
    return <NewConversation open onClose={closeDetailPane} />;
  }

  if (detailPane?.kind === "releases" || detailPane?.kind === "release") {
    /* One pane for both, so stepping from the list into a release and back does
       not animate the whole panel out and in again. */
    const version = detailPane.kind === "release" ? detailPane.id : null;
    return (
      <SidePane
        open
        title={
          version
            ? `${content.releases.whatsNewIn} v${version}`
            : content.releases.title
        }
        onClose={closeDetailPane}
        {...(version
          ? {
              actions: (
                <button
                  type="button"
                  onClick={() => openDetailPane({ kind: "releases", id: "" })}
                  className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-md px-2 py-1 text-[11px] font-semibold"
                >
                  {content.releases.past}
                </button>
              ),
            }
          : {})}
      >
        {version ? <ReleaseDetail version={version} /> : <ReleaseList />}
      </SidePane>
    );
  }

  if (detailPane?.kind === "vouches") {
    const subject = getMessagePerson(detailPane.id);
    return (
      <SidePane
        open={Boolean(subject)}
        title={content.messages.whoisInline.vouchesTitle}
        onClose={closeDetailPane}
      >
        {subject && (
          <ProfileActionsProvider actions={actions}>
            <div className="p-4">
              {/* The way back to the whole person. This pane answers one
                  question about them, and the obvious next one is the rest. */}
              <button
                type="button"
                onClick={() =>
                  openDetailPane({ kind: "person", id: subject.id })
                }
                aria-label={`${subject.name} — ${content.messages.viewProfile}`}
                className="focus-ring mb-3 -mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover"
              >
                <MemberAvatar person={subject} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{subject.name}</p>
                  <Handle
                    person={subject}
                    size={11}
                    className="mt-0.5 max-w-full truncate text-[11px] text-muted-foreground"
                  />
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
              {/* Open on arrival. The pane exists to answer this one question,
                  so making the reader click again to see the answer would be
                  a step that has no other outcome. */}
              <VouchFacepile
                person={subject}
                open
                className="rounded-xl border border-border"
              />
            </div>
          </ProfileActionsProvider>
        )}
      </SidePane>
    );
  }

  if (detailPane?.kind === "conversation") {
    const thread = getChatThread(detailPane.id);
    const group = thread?.group;
    if (!group) return null;
    const title = conversationTitles[detailPane.id] ?? group.title;
    const memberIds = conversationMembers[detailPane.id] ?? group.memberIds;
    const icon = groupIconOf(thread, conversationIcons);
    // Hub edit wins over the seed; an explicit null means "switched off".
    const gates =
      detailPane.id in conversationGates
        ? (conversationGates[detailPane.id] ?? null)
        : (group.gates ?? null);
    const roles =
      detailPane.id in conversationRoles
        ? (conversationRoles[detailPane.id] ?? null)
        : (group.roles ?? null);
    return (
      <SidePane
        open
        title={content.messages.editConversation}
        onClose={closeDetailPane}
        /* Conversation-level, so it belongs to the conversation's own settings
           rather than to the list's bar — which is the default it falls back
           to when this one is left alone. */
        actions={<ChainPolicyButton conversationId={detailPane.id} />}
      >
        <ConversationSettings
          thread={thread}
          title={title}
          memberIds={memberIds}
          gates={gates}
          roles={roles}
          onRename={(next) => renameConversation(detailPane.id, next)}
          {...(icon ? { icon } : {})}
          onMembersChange={(next) =>
            setConversationMembers(detailPane.id, next)
          }
          onIconChange={(next) => setConversationIcon(detailPane.id, next)}
          onGatesChange={(next) => setConversationGates(detailPane.id, next)}
          onRolesChange={(next) => setConversationRoles(detailPane.id, next)}
          onLeave={() => {
            closeDetailPane();
            setMessageThread(null);
            toast.success(content.messages.group.left);
          }}
        />
      </SidePane>
    );
  }

  const person = detailPane ? getMessagePerson(detailPane.id) : undefined;
  return (
    <SidePane
      open={Boolean(person)}
      title={content.messages.viewProfile}
      onClose={closeDetailPane}
    >
      {person && (
        <ProfileActionsProvider actions={actions}>
          <WhoisCard person={person} />
        </ProfileActionsProvider>
      )}
    </SidePane>
  );
}
