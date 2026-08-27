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
import type { ProfileLink } from "@/lib/data/types";
import {
  addProfile,
  connectProfile,
  profileFor,
  removeProfile,
  updateProfile,
  useProfiles,
} from "@/lib/profiles-store";
import { Check, Plus, Trash2, X } from "lucide-react";
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
            <LinksField
              links={selected.links ?? []}
              onChange={(links) => updateProfile(selected.id, { links })}
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

/**
 * The link-in-bio rows, and the button that adds one.
 *
 * A label and a URL together, because they are one fact: a bare address is a
 * thing to read rather than a thing to press. Rows are added rather than a
 * fixed number offered — most people have one and some have five, and a form
 * with five empty pairs in it reads as five things you have failed to fill in.
 *
 * A row with neither field filled is dropped on the way out, so adding one and
 * changing your mind costs nothing and leaves nothing behind.
 */
function LinksField({
  links,
  onChange,
}: {
  links: ProfileLink[];
  onChange: (next: ProfileLink[]) => void;
}): ReactNode {
  const copy = content.profilesPanel;
  const rows = links.length > 0 ? links : [{ label: "", url: "" }];

  const write = (next: ProfileLink[]): void =>
    onChange(next.filter((row) => row.label.trim() || row.url.trim()));

  return (
    <div className="px-3 py-2.5">
      <p className="text-sm font-medium">{copy.linksLabel}</p>
      <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
        {copy.linksHint}
      </p>
      {/*
        One block per link, rather than two fields on a row.

        Side by side, a label and a URL read as two settings that happen to be
        adjacent — and the URL, which is the longer of the two by far, gets
        whatever width the label leaves. Stacked inside a box they read as what
        they are: one thing, with a name and a destination.
      */}
      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="border-border bg-surface space-y-2 rounded-lg border p-2.5"
          >
            <div className="flex items-center gap-2">
              <input
                value={row.label}
                onChange={(event) =>
                  write(
                    rows.map((entry, i) =>
                      i === index
                        ? { ...entry, label: event.target.value }
                        : entry,
                    ),
                  )
                }
                placeholder={copy.linkLabel}
                aria-label={copy.linkLabel}
                className="focus-ring border-border bg-background min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
              />
              {/* Beside the label rather than under both fields: it removes the
                  block, and the top of a block is where you look to be rid of
                  it. */}
              <button
                type="button"
                onClick={() => write(rows.filter((_, i) => i !== index))}
                aria-label={copy.linkRemove}
                title={copy.linkRemove}
                className="focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            <input
              value={row.url}
              onChange={(event) =>
                write(
                  rows.map((entry, i) =>
                    i === index ? { ...entry, url: event.target.value } : entry,
                  ),
                )
              }
              placeholder={copy.linkUrl}
              aria-label={copy.linkUrl}
              inputMode="url"
              className="focus-ring border-border bg-background w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...links, { label: "", url: "" }])}
        className="focus-ring text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1.5 rounded-md text-xs font-semibold"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {copy.linkAdd}
      </button>
    </div>
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
