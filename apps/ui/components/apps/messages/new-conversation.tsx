"use client";

import { GroupGatesEditor } from "@/components/apps/messages/group-gates";
import { PersonRow } from "@/components/apps/messages/person-row";
import { SidePane } from "@/components/hub/side-pane";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import {
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import {
  addChatThread,
  content,
  getChatThreadForPerson,
  getMessagePeople,
  type GroupGates,
  type MessagePerson,
} from "@/lib/data";
import { gateVerdict, verdictReason } from "@/lib/gates";
import { handleOf } from "@/lib/messages";
import { Check, Search, UsersRound } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Start a conversation.
 *
 * Picking one person you already have a thread with opens it rather than
 * creating a second one — two conversations with the same handle is a bug the
 * user has to clean up, not a feature. Anyone else, or any group of two or
 * more, gets a new thread.
 *
 * "New group", above the results, is the deliberate way to build a room: pick
 * members against a live check of the room's access gates, so someone a gate
 * would reject is visibly rejected while you are choosing, not after you have
 * created the room around them.
 */
export function NewConversation({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const copy = content.messages.newChat;
  const { setMessageThread, bumpConversations } = useHub();
  const [mode, setMode] = useState<"start" | "group">("start");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<MessagePerson[]>([]);
  const [gates, setGates] = useState<GroupGates | null>(null);
  // Re-render when a vouch or renounce lands, so the verdicts below are live.
  useSyncExternalStore(subscribeEffects, getEffects, getEffectsServerSnapshot);

  const needle = query.trim().toLowerCase();
  const people = getMessagePeople().filter(
    (person) =>
      !needle ||
      person.name.toLowerCase().includes(needle) ||
      handleOf(person).toLowerCase().includes(needle) ||
      /* Attested accounts are searchable too: people are far likelier to know
         somebody by the name they use on X than by a Nexus handle they have
         never seen. Only attested ones, so a search cannot be gamed by
         claiming a name you have not proved. */
      (person.socials ?? []).some((social) =>
        social.handle.toLowerCase().includes(needle),
      ),
  );

  const grouping = mode === "group";

  const reset = (): void => {
    setChosen([]);
    setQuery("");
    setGates(null);
    setMode("start");
  };

  const close = (): void => {
    reset();
    onClose();
  };

  /** Gates changed: drop anyone already picked whom the new gates reject. */
  const changeGates = (next: GroupGates | null): void => {
    setGates(next);
    setChosen((current) =>
      current.filter(
        (person) =>
          gateVerdict(person.id, next ?? undefined).outcome === "qualifies",
      ),
    );
  };

  const start = (): void => {
    if (chosen.length === 0) return;
    const solo = !grouping && chosen.length === 1 ? chosen[0] : undefined;

    if (solo) {
      const existing = getChatThreadForPerson(solo.id);
      if (existing) {
        setMessageThread(existing.id);
        close();
        return;
      }
    }

    const id = `thread-${Date.now()}`;
    addChatThread({
      id,
      createdAt: new Date().toISOString(),
      ...(solo
        ? { personId: solo.id }
        : {
            group: {
              title: chosen.map((person) => person.name.split(" ")[0]).join(", "),
              memberIds: chosen.map((person) => person.id),
              ecosystem: chosen[0]?.ecosystem ?? "nexus",
              ...(grouping && gates ? { gates } : {}),
            },
          }),
    });
    bumpConversations();
    setMessageThread(id);
    close();
  };

  return (
    <SidePane
      open={open}
      title={grouping ? copy.groupTitle : copy.title}
      onClose={close}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (grouping ? setMode("start") : close())}
            className="focus-ring flex-1 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            {grouping ? copy.back : copy.cancel}
          </button>
          <button
            type="button"
            onClick={start}
            disabled={chosen.length === 0}
            className={`focus-ring flex-1 rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${PRIMARY_CTA}`}
          >
            {grouping
              ? copy.createGroup
              : chosen.length > 1
                ? copy.startGroup
                : copy.start}
          </button>
        </div>
      }
    >
      <div className="p-4">
        {/* The pane's own header carries the title, so this only has to say
            what the current mode does. */}
        <p className="text-xs text-pretty text-muted-foreground">
          {grouping ? copy.newGroupHint : copy.hint}
        </p>

        {/* The gates come before the member list because they change what the
            list means: a row greys out the moment a gate would reject them. */}
        {grouping && (
          <div className="mt-3">
            <GroupGatesEditor gates={gates} onChange={changeGates} />
          </div>
        )}

        {grouping && (
          <p className="mt-4 mb-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            {copy.membersLabel}
            {chosen.length > 0 ? ` (${chosen.length})` : ""}
          </p>
        )}

        <div className={`${grouping ? "" : "mt-3 "}flex items-center gap-2 rounded-xl bg-surface px-3`}>
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={grouping ? copy.searchMembers : copy.search}
            aria-label={grouping ? copy.searchMembers : copy.search}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <ul className="mt-2">
          {/* The way into the group state, above the first handle result. */}
          {!grouping && (
            <li>
              <button
                type="button"
                onClick={() => setMode("group")}
                className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <UsersRound className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {copy.newGroup}
                </span>
              </button>
            </li>
          )}

          {people.map((person) => {
            const selected = chosen.some((c) => c.id === person.id);
            const verdict = grouping
              ? gateVerdict(person.id, gates ?? undefined)
              : ({ outcome: "qualifies" } as const);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={verdict.outcome !== "qualifies"}
                  onClick={() =>
                    setChosen((current) =>
                      selected
                        ? current.filter((c) => c.id !== person.id)
                        : [...current, person],
                    )
                  }
                  aria-pressed={selected}
                  className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors ${
                    selected ? "bg-accent/15" : "hover:bg-surface-hover"
                  } ${verdict.outcome === "qualifies" ? "" : "cursor-not-allowed opacity-45 hover:bg-transparent"}`}
                >
                  <PersonRow
                    person={person}
                    trailing={
                      selected ? (
                        <Check
                          className="ml-auto size-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                      ) : undefined
                    }
                  />
                </button>
                {/* Why the gate said no, in the gate's own words. Outside the
                    disabled button so it stays legible at full contrast. */}
                {verdict.outcome !== "qualifies" && (
                  <p className="-mt-0.5 px-2 pb-1 pl-11 text-[11px] text-warning">
                    {verdictReason(verdict)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </SidePane>
  );
}
