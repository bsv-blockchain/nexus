"use client";

import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { ProfileHovercard } from "@/components/apps/messages/profile-hovercard";
import { Tooltip } from "@/components/hub/tooltip";
import {
  content,
  getWalletContacts,
  type MessagePerson,
} from "@/lib/data";
import { toggleFavourite } from "@/lib/command-effects";
import { useCommandEffects } from "@/lib/use-command-effects";
import { handleOf, whoisFor } from "@/lib/messages";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  MessageSquare,
  Search,
  Star,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

/** Underline-animated text tabs, matching Vela's contacts and home screens. */
function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (id: string) => void;
  tabs: { id: string; label: string }[];
}): ReactNode {
  return (
    <div className="flex gap-4 border-b border-border">
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={active}
            className={`focus-ring relative pb-2 text-sm font-semibold transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent transition-transform duration-200 ${
                active ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Address book.
 *
 * The same people you message — one directory — with the favourites/all split
 * Vela uses, since the handful you actually pay should not be buried under
 * everyone you have ever spoken to. Verification is the gold check on its own:
 * the word "Verified" beside every name is noise once the icon means something.
 */
export function Contacts({
  onSend,
  onRequest,
  onMessage,
  onWhois,
}: {
  onSend: (personId: string) => void;
  onRequest: (personId: string) => void;
  onMessage: (personId: string) => void;
  onWhois: (person: MessagePerson) => void;
}): ReactNode {
  const copy = content.wallet;
  const [tab, setTab] = useState<"favourites" | "all">("favourites");
  const [query, setQuery] = useState("");

  const all = getWalletContacts();
  const { favourites: starred } = useCommandEffects();
  const favourites = all.filter((person) => starred.includes(person.id));

  const needle = query.trim().toLowerCase();
  const base = tab === "favourites" ? favourites : all;
  const shown = base.filter(
    (person) =>
      !needle ||
      person.name.toLowerCase().includes(needle) ||
      handleOf(person).toLowerCase().includes(needle),
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="mb-1 text-lg font-bold">{copy.contacts}</h2>
      <p className="mb-3 text-sm text-pretty text-muted-foreground">
        {copy.contactsHint}
      </p>

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-3">
        <Search
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchContacts}
          aria-label={copy.searchContacts}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <Tabs
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: "favourites", label: `${copy.favourites} (${favourites.length})` },
          { id: "all", label: `${copy.allContacts} (${all.length})` },
        ]}
      />

      {shown.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {copy.noContacts}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl bg-surface">
          {shown.map((person) => {
            const who = whoisFor(person);
            const verified =
              who.certificate === "valid" && who.attestations > 0;
            const favourite = starred.includes(person.id);

            const actions = [
              {
                key: "message",
                label: copy.actions.message,
                /* The Messages app's own mark, not an envelope: this opens a
                   conversation in Nexus, and nothing here sends email. */
                icon: <MessageSquare className="size-4" />,
                onClick: () => onMessage(person.id),
              },
              {
                key: "pay",
                label: copy.actions.pay,
                icon: <ArrowUpRight className="size-4" />,
                onClick: () => onSend(person.id),
              },
              {
                key: "request",
                label: copy.actions.request,
                /* Same arrow as Get paid in Payments, so one act has one mark
                   wherever it appears. */
                icon: <ArrowDownLeft className="size-4" />,
                onClick: () => onRequest(person.id),
              },
              {
                key: "whois",
                label: copy.actions.whois,
                icon: <UserRoundSearch className="size-4" />,
                onClick: () => onWhois(person),
              },
              {
                key: "favourite",
                label: favourite ? copy.unfavourite : copy.favourite,
                icon: (
                  <Star
                    className={`size-4 ${
                      favourite ? "fill-warning text-warning" : ""
                    }`}
                  />
                ),
                onClick: () => {
                  const now = toggleFavourite(person.id);
                  toast.success(
                    `${person.name} ${now ? copy.favourited : copy.unfavourited}`,
                  );
                },
              },
            ];

            return (
              <li key={person.id} className="flex items-center gap-3 px-3 py-2.5">
                <ProfileHovercard
                  person={person}
                  className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                >
                  <span className="relative shrink-0">
                    <MemberAvatar person={person} size={34} />
                    {favourite && (
                      <span
                        className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-surface"
                        aria-hidden="true"
                      >
                        <Star className="size-2.5 fill-warning text-warning" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-sm font-semibold">
                        {person.name}
                      </span>
                      {/* The icon alone — the word was noise on every row. */}
                      {verified && (
                        <Tooltip label={copy.verifiedHint}>
                          <BadgeCheck
                            className="size-3.5 shrink-0 text-warning"
                            aria-label={copy.verified}
                          />
                        </Tooltip>
                      )}
                    </span>
                    <Handle
                      person={person}
                      size={11}
                      className="max-w-full truncate text-xs text-muted-foreground"
                    />
                  </span>
                </ProfileHovercard>

                {/* `ml-auto` because the growing sibling does not grow:
                    ProfileHovercard puts the `flex-1` it is handed on its inner
                    button, while the flex child of this row is its `inline-flex`
                    wrapper, which sizes to content. Pushing from this side is
                    independent of that. */}
                <span className="ml-auto flex shrink-0 items-center gap-0.5">
                  {actions.map((action) => (
                    <Tooltip key={action.key} label={action.label}>
                      <button
                        type="button"
                        onClick={action.onClick}
                        aria-label={`${action.label} — ${person.name}`}
                        className="focus-ring grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        {action.icon}
                      </button>
                    </Tooltip>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
