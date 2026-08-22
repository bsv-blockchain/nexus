"use client";

/**
 * Profiles: yourself, as everybody else gets you.
 *
 * The card on the right is the same `WhoisCard` a stranger opens from your
 * hovercard, rendered live from the fields on the left. That is the point of
 * the layout: a form that describes a profile and a preview that shows one are
 * two chances to disagree, so there is one of each and they are the same
 * object.
 *
 * One tab per persona, because a dropdown of profiles hides the fact that you
 * have more than one — which is the fact this screen exists to make ordinary.
 */

import { Group } from "@/components/apps/settings/blocks";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { WhoisCard } from "@/components/apps/messages/whois-card";
import { TabRow, Tab } from "@/components/hub/tab-row";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import {
  addProfile,
  connectProfile,
  profileFor,
  removeProfile,
  updateProfile,
  useProfiles,
} from "@/lib/profiles-store";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

const copy = content.profilesPanel;

export function ProfilesPanel(): ReactNode {
  const state = useProfiles();
  const { activeSpaceId, spaces } = useHub();
  const connected = profileFor(state, activeSpaceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    state.profiles.find((entry) => entry.id === selectedId) ?? connected;
  const space = spaces.find((entry) => entry.id === activeSpaceId);
  const isConnected = selected.id === connected.id;

  return (
    <>
      {/* The tab row sits above the groups rather than inside one: it chooses
          which profile every group below is about. */}
      <TabRow
        className="border-border/60 -mt-1 border-b"
        action={
          <button
            type="button"
            onClick={() => setSelectedId(addProfile())}
            aria-label={copy.add}
            title={copy.add}
            className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground relative shrink-0 px-3"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        }
      >
        {state.profiles.map((profile) => (
          <Tab
            key={profile.id}
            group="profiles"
            label={profile.name || copy.untitled}
            active={profile.id === selected.id}
            onClick={() => setSelectedId(profile.id)}
          >
            <span className="flex items-center gap-2">
              <MemberAvatar person={profile} size={18} radius={6} />
              {profile.name || copy.untitled}
            </span>
          </Tab>
        ))}
      </TabRow>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Group title={copy.identityTitle} hint={copy.identityHint}>
            <Field
              label={copy.name}
              value={selected.name}
              onChange={(value) => updateProfile(selected.id, { name: value })}
            />
            <Field
              label={copy.handle}
              value={selected.handle}
              prefix="@"
              onChange={(value) =>
                updateProfile(selected.id, {
                  handle: value.replace(/^@/, "").toLowerCase(),
                })
              }
            />
            <Field
              label={copy.role}
              value={selected.role}
              onChange={(value) => updateProfile(selected.id, { role: value })}
            />
            <Field
              label={copy.bio}
              value={selected.bio}
              multiline
              onChange={(value) => updateProfile(selected.id, { bio: value })}
            />
          </Group>

          <Group title={copy.whereTitle} hint={copy.whereHint}>
            <Field
              label={copy.organization}
              value={selected.organization ?? ""}
              onChange={(value) =>
                updateProfile(selected.id, { organization: value || null })
              }
            />
            <Field
              label={copy.city}
              value={selected.city}
              onChange={(value) => updateProfile(selected.id, { city: value })}
            />
            <Field
              label={copy.expertise}
              hint={copy.expertiseHint}
              value={(selected.expertise ?? []).join(", ")}
              onChange={(value) =>
                updateProfile(selected.id, {
                  expertise: value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
          </Group>

          <Group title={copy.contactTitle} hint={copy.contactHint}>
            <Field
              label={copy.email}
              value={selected.contact?.email ?? ""}
              onChange={(value) =>
                updateProfile(selected.id, {
                  contact: { ...selected.contact, email: value },
                })
              }
            />
            <Field
              label={copy.github}
              value={selected.contact?.github ?? ""}
              onChange={(value) =>
                updateProfile(selected.id, {
                  contact: { ...selected.contact, github: value },
                })
              }
            />
          </Group>

          <Group title={copy.useTitle} hint={copy.useHint}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm">
                {isConnected
                  ? copy.connectedHere.replace("{workspace}", space?.name ?? "")
                  : copy.notConnected}
              </span>
              {isConnected ? (
                <span className="text-accent flex shrink-0 items-center gap-1 text-xs font-semibold">
                  <Check className="size-3.5" aria-hidden="true" />
                  {copy.inUse}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => connectProfile(activeSpaceId, selected.id)}
                  className="focus-ring bg-accent text-accent-foreground shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold hover:opacity-90"
                >
                  {copy.connect}
                </button>
              )}
            </div>
            {state.profiles.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  removeProfile(selected.id);
                  setSelectedId(null);
                }}
                className="focus-ring text-muted-foreground hover:text-negative hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
              >
                <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                {copy.remove}
              </button>
            )}
          </Group>
        </div>

        {/*
          The preview. Not a mock-up of the card — the card itself, so what is
          shown here cannot drift from what a stranger sees.
        */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="text-muted-foreground mb-2 text-xs font-semibold">
            {copy.previewTitle}
          </p>
          <div className="border-border bg-surface-raised overflow-hidden rounded-xl border">
            <WhoisCard person={selected} />
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  prefix,
  multiline = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  multiline?: boolean;
}): ReactNode {
  return (
    <label className="block px-3 py-2.5">
      <span className="text-muted-foreground mb-1 block text-[11px] font-semibold">
        {label}
      </span>
      <span className="border-border bg-surface focus-within:border-ring flex items-start gap-1 rounded-lg border px-2.5 py-1.5">
        {prefix && (
          <span className="text-muted-foreground pt-px font-mono text-sm">
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea
            value={value}
            rows={3}
            onChange={(event) => onChange(event.target.value)}
            className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none"
          />
        ) : (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        )}
      </span>
      {hint && (
        <span className="text-muted-foreground mt-1 block text-[11px]">
          {hint}
        </span>
      )}
    </label>
  );
}
