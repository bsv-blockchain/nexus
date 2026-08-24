"use client";

import { ChainPolicyButton } from "@/components/apps/messages/chain-policy";
import { SettingsGuide } from "@/components/apps/settings-app";
import {
  NewPaymentLinkFooter,
  NewPaymentLinkPane,
} from "@/components/apps/wallet/new-payment-link-pane";
import {
  NewSplitFooter,
  NewSplitPane,
} from "@/components/apps/wallet/new-split-pane";
import { removePaymentLink } from "@/lib/payment-links-store";
import { removeSplit } from "@/lib/splits-store";
import { ReleaseDetail, ReleaseList } from "@/components/hub/release-notes";
import { ConversationSettings } from "@/components/apps/messages/conversation-settings";
import { NewConversation } from "@/components/apps/messages/new-conversation";
import { ProfileActionsProvider } from "@/components/apps/messages/profile-hovercard";
import { useProfileQuickActions } from "@/components/apps/messages/use-profile-actions";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { VouchFacepile } from "@/components/apps/messages/whois-inline";
import { WhoisCard } from "@/components/apps/messages/whois-card";
import {
  AppOnboardingFooter,
  AppOnboardingPane,
} from "@/components/hub/app-onboarding";
import { FeatureDetail } from "@/components/apps/roadmap/feature-detail";
import { DownloadsPane } from "@/components/hub/downloads-pane";
import { SiteSettingsPane } from "@/components/hub/site-settings-pane";
import { currentFeature } from "@/lib/roadmap-effects";
import { LicencePane, LicencePaneFooter } from "@/components/hub/licence-pane";
import { LegalPane } from "@/components/hub/legal-pane";
import { useHub, type AppSlug } from "@/components/hub/hub-provider";
import { SidePane } from "@/components/hub/side-pane";
import { ChevronRight, Scale } from "lucide-react";
import { ClearDataPane, LanguagesPane } from "@/components/hub/settings-panes";
import { groupIconOf } from "@/lib/group-icon";
import {
  content,
  getAppOnboarding,
  getChatThread,
  getHubApp,
  getMessagePerson,
  licence,
  type OnboardingSlug,
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

  if (detailPane?.kind === "onboarding") {
    const slug = detailPane.id as OnboardingSlug;
    const app = getHubApp(detailPane.id as AppSlug);
    /* Not every guide is about a mod — the store has one too, and it has no
       store entry to take a name from. Open on the guide rather than on the
       mod, so the one surface without a mod behind it still opens. */
    const guide = getAppOnboarding(slug);
    return (
      <SidePane
        open={Boolean(guide)}
        title={`${content.onboarding.title} ${app?.name ?? guide?.title ?? ""}`.trim()}
        onClose={closeDetailPane}
        /* Docked below the scroll area, so the way into the app is there from
           the moment the pane opens rather than at the end of a scroll. */
        footer={<AppOnboardingFooter slug={slug} />}
      >
        <AppOnboardingPane slug={slug} />
      </SidePane>
    );
  }

  if (detailPane?.kind === "settings-guide") {
    return (
      <SidePane
        open
        title={content.settings.title}
        onClose={closeDetailPane}
      >
        <SettingsGuide />
      </SidePane>
    );
  }

  if (detailPane?.kind === "feature") {
    const feature = currentFeature(detailPane.id);
    return (
      <SidePane
        open={Boolean(feature)}
        title={content.roadmap.title}
        onClose={closeDetailPane}
      >
        {feature && <FeatureDetail feature={feature} />}
      </SidePane>
    );
  }

  if (detailPane?.kind === "sites") {
    return (
      <SidePane
        open
        title={content.settings.sites.title}
        onClose={closeDetailPane}
      >
        <SiteSettingsPane />
      </SidePane>
    );
  }

  if (detailPane?.kind === "languages") {
    return (
      <SidePane
        open
        title={content.mobileBrowser.settings.languages}
        onClose={closeDetailPane}
      >
        <LanguagesPane />
      </SidePane>
    );
  }

  if (detailPane?.kind === "clear-data") {
    return (
      <SidePane
        open
        title={content.settings.privacy.clearTitle}
        onClose={closeDetailPane}
      >
        <ClearDataPane />
      </SidePane>
    );
  }

  if (detailPane?.kind === "new-payment-link") {
    return (
      <SidePane
        open
        title={content.wallet.newLinkPane.title}
        onClose={closeDetailPane}
        footer={<NewPaymentLinkFooter />}
      >
        <NewPaymentLinkPane
          onCreated={(linkId, description) => {
            closeDetailPane();
            toast.success(content.wallet.newLinkPane.created, {
              description,
              action: {
                label: content.hub.undo,
                onClick: () => removePaymentLink(linkId),
              },
            });
          }}
        />
      </SidePane>
    );
  }

  if (detailPane?.kind === "new-split") {
    return (
      <SidePane
        open
        title={content.wallet.splits.newTitle}
        onClose={closeDetailPane}
        footer={<NewSplitFooter />}
      >
        <NewSplitPane
          onCreated={(splitId, description) => {
            closeDetailPane();
            toast.success(content.wallet.splits.raised, {
              description,
              action: {
                label: content.hub.undo,
                onClick: () => removeSplit(splitId),
              },
            });
          }}
        />
      </SidePane>
    );
  }

  if (detailPane?.kind === "downloads") {
    return (
      <SidePane
        open
        title={content.library.downloads.title}
        onClose={closeDetailPane}
      >
        <DownloadsPane />
      </SidePane>
    );
  }

  if (detailPane?.kind === "legal") {
    return (
      <SidePane
        open
        title={content.legal.title}
        onClose={closeDetailPane}
        /* Straight through to the licence, because the terms send you there
           twice and a reader who wants it should not have to remember it lives
           under About. */
        footer={
          <button
            type="button"
            onClick={() => openDetailPane({ kind: "licence", id: "" })}
            className="focus-ring border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold"
          >
            <Scale className="size-4" aria-hidden="true" />
            {content.legal.readLicence}
          </button>
        }
      >
        <LegalPane />
      </SidePane>
    );
  }

  if (detailPane?.kind === "licence") {
    return (
      <SidePane
        open
        title={`${licence.name} ${licence.version}`}
        onClose={closeDetailPane}
        footer={<LicencePaneFooter />}
      >
        <LicencePane />
      </SidePane>
    );
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
                className="focus-ring hover:bg-surface-hover -mx-2 mb-3 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
              >
                <MemberAvatar person={subject} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{subject.name}</p>
                  <Handle
                    person={subject}
                    size={11}
                    className="text-muted-foreground mt-0.5 max-w-full truncate text-[11px]"
                  />
                </div>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
              </button>
              {/* Open on arrival. The pane exists to answer this one question,
                  so making the reader click again to see the answer would be
                  a step that has no other outcome. */}
              <VouchFacepile
                person={subject}
                open
                className="border-border rounded-xl border"
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
