"use client";

/**
 * Your profiles, and which one each workspace is wearing.
 *
 * Connected per workspace, the way a handle or a wallet is: switching in one
 * workspace leaves the others alone, which is the whole point of having them.
 * The alternative — one global persona — would make the switcher a rename
 * button with side effects everywhere.
 *
 * Editable copies live here rather than in `lib/data/profiles`, because that
 * file is a fixture and this is state somebody is changing. The fixture seeds
 * it once and is never written to.
 */

import { profiles as seed } from "@/lib/data/profiles";
import { getMessagePerson, type MessagePerson } from "@/lib/data";
import { useSyncExternalStore } from "react";

export interface ProfilesState {
  profiles: MessagePerson[];
  /** workspace id → profile id; absent means the first profile */
  connected: Record<string, string>;
}

const INITIAL: ProfilesState = {
  profiles: seed,
  connected: {},
};

let state: ProfilesState = INITIAL;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<ProfilesState>): void {
  state = { ...state, ...patch };
  emit();
}

export function useProfiles(): ProfilesState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL
  );
}

/**
 * The profile a workspace is wearing.
 *
 * Falls back to the first rather than to null: every workspace has a face,
 * and a caller that has to handle "no profile" would be handling a state this
 * store never produces.
 */
export function profileFor(
  { profiles, connected }: ProfilesState,
  spaceId: string
): MessagePerson {
  const id = connected[spaceId];
  return profiles.find((entry) => entry.id === id) ?? profiles[0]!;
}

export function connectProfile(spaceId: string, profileId: string): void {
  set({ connected: { ...state.connected, [spaceId]: profileId } });
}

export function updateProfile(id: string, patch: Partial<MessagePerson>): void {
  set({
    profiles: state.profiles.map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry
    ),
  });
}

/**
 * Start another one, and return its id so the caller can select it.
 *
 * Blank rather than a copy of the current profile: a new persona that arrives
 * wearing the old one's name and bio is a duplicate somebody then has to
 * remember to finish editing, and the half-edited ones are indistinguishable
 * from the real thing.
 */
export function addProfile(): string {
  const id = `profile-${state.profiles.length}-${Date.now()}`;
  const fresh: MessagePerson = {
    id,
    name: "",
    handle: "",
    ecosystem: "nexus",
    role: "",
    bio: "",
    organization: null,
    city: "",
    photo: null,
    avatarColors: ["#4353ff", "#8b5cf6", "#ec4899"],
    expertise: [],
    contact: {},
  };
  set({ profiles: [...state.profiles, fresh] });
  return id;
}

export function removeProfile(id: string): void {
  if (state.profiles.length <= 1) return;
  const connected = { ...state.connected };
  for (const [space, profileId] of Object.entries(connected)) {
    if (profileId === id) delete connected[space];
  }
  set({
    profiles: state.profiles.filter((entry) => entry.id !== id),
    connected,
  });
}

/**
 * Look a person up, profiles first.
 *
 * A post authored by one of your own profiles has an id `lib/data/messages`
 * has never heard of, so a bare `getMessagePerson` returns nothing and the row
 * renders as blank. Everything that resolves an author goes through this.
 */
export function usePersonLookup(): (id: string) => MessagePerson | undefined {
  const { profiles } = useProfiles();
  return (id) =>
    profiles.find((entry) => entry.id === id) ?? getMessagePerson(id);
}
