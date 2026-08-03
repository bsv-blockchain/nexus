"use client";

import { EcosystemMark } from "@/components/apps/messages/ecosystem-tag";
import { Handle } from "@/components/apps/messages/ecosystem-tag";
import { GroupAvatar } from "@/components/apps/messages/group-avatar";
import { GroupGatesEditor } from "@/components/apps/messages/group-gates";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import {
  content,
  getCurrentMessageUser,
  getMessagePeople,
  getMessagePerson,
  type ChatThread,
  type GroupGates,
  type RoomRoles,
  type MessagePerson,
} from "@/lib/data";
import { Tooltip } from "@/components/hub/tooltip";
import { heldSerial } from "@/lib/gates";
import { RoleBadge, RoomRolesEditor } from "@/components/apps/messages/room-roles";
import {
  canActOn,
  canEditManifest,
  capabilities,
  newlyExcluded,
  roomVerdictReason,
  isFlat,
  orphanRisk,
  roleOf,
  roomVerdict,
} from "@/lib/roles";
import {
  getEffects,
  getEffectsServerSnapshot,
  roomBan,
  setRoomBan,
  subscribeEffects,
  closeRoom,
  roomClosure,
} from "@/lib/command-effects";
import {
  Check,
  EyeOff,
  ImagePlus,
  LogOut,
  Search,
  Trash2,
  DoorClosed,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Edit-conversation, as a side pane rather than a modal sheet.
 *
 * Every change applies as you make it: the rename commits on blur, the mute
 * switch and member changes take effect at once. There is no Save, because the
 * pane is not modal — you can click straight back into the thread, and a staged
 * edit sitting behind a Save button would be lost silently when you did.
 *
 * Leaving is the one thing that does not happen inline, since it is the only
 * action here that cannot be undone by doing the opposite.
 */
export function ConversationSettings({
  thread,
  title,
  memberIds,
  icon,
  gates,
  roles,
  onRename,
  onMembersChange,
  onIconChange,
  onGatesChange,
  onRolesChange,
  onLeave,
}: {
  /** the room itself, for its custody and its id */
  thread: ChatThread;
  title: string;
  memberIds: string[];
  /** the room's picture, or undefined for the member mosaic */
  icon?: string | undefined;
  /** the room's access gates, or null while the gate is off */
  gates: GroupGates | null;
  /** how the gate maps onto roles, or null while roles are off */
  roles: RoomRoles | null;
  onRename: (next: string) => void;
  onMembersChange: (next: string[]) => void;
  onIconChange: (icon: string | null) => void;
  onGatesChange: (gates: GroupGates | null) => void;
  onRolesChange: (roles: RoomRoles | null) => void;
  onLeave: () => void;
}): ReactNode {
  const copy = content.messages.group;
  const me = getCurrentMessageUser();
  useSyncExternalStore(subscribeEffects, getEffects, getEffectsServerSnapshot);

  /* The room as it currently stands, so a role is read against the edits in
     this pane rather than against the seed underneath them. */
  const live: ChatThread = thread.group
    ? {
        ...thread,
        group: {
          ...thread.group,
          memberIds,
          ...(gates ? { gates } : {}),
          ...(roles ? { roles } : {}),
        },
      }
    : thread;
  const myRole = roleOf("me", live);
  const can = capabilities(myRole);
  const closure = roomClosure(thread.id);

  // Local only while the field has focus; committed on blur.
  const [name, setName] = useState(title);
  const [muted, setMuted] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  /** Why a member cannot read the room, or undefined when they can. */
  const memberVerdict = (personId: string): string | undefined => {
    return roomVerdictReason(roomVerdict(personId, live, gates));
  };

  /** The gating contract's serial for a member, when there is one to show. */
  const serialOf = (personId: string): number | undefined =>
    gates?.token.on
      ? gates.token.ids
          .map((id) => heldSerial(personId, id))
          .find((serial) => serial !== undefined)
      : undefined;
  const [addQuery, setAddQuery] = useState("");

  const members = memberIds
    .map((id) => getMessagePerson(id))
    .filter((person): person is MessagePerson => Boolean(person));
  const shownMembers = members.filter((member) =>
    member.name.toLowerCase().includes(memberQuery.trim().toLowerCase())
  );

  const needle = addQuery.trim().toLowerCase();
  const addResults = needle
    ? getMessagePeople()
        .filter(
          (person) =>
            !memberIds.includes(person.id) &&
            (person.name.toLowerCase().includes(needle) ||
              person.handle.toLowerCase().includes(needle))
        )
        .slice(0, 6)
    : [];

  const commitName = (): void => {
    const next = name.trim() || title;
    if (next !== title) {
      onRename(next);
      toast.success(copy.renamed);
    }
  };

  return (
    <div className="p-4">
      <div className="border-border mb-4 flex items-center gap-3 rounded-xl border px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{copy.mute}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs text-pretty">
            {copy.muteHint}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={muted}
          aria-label={copy.mute}
          onClick={() =>
            setMuted((value) => {
              toast.success(value ? copy.unmuted : copy.mutedOn);
              return !value;
            })
          }
          className={`focus-ring relative h-6 w-10 shrink-0 rounded-full transition-colors ${
            muted ? "bg-accent" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
              muted ? "left-5" : "left-1"
            }`}
          />
        </button>
      </div>

      <p className="text-muted-foreground mb-1 text-[11px] font-bold tracking-wide uppercase">
        {copy.nameLabel}
      </p>
      {/* The picture and the name are the room's identity, so they are edited
          side by side. The field gives up the width the picture needs, which
          it was not using: a group name is short. */}
      <div className="mb-4 flex items-start gap-2.5">
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={icon ? copy.changeIcon : copy.addIcon}
            title={icon ? copy.changeIcon : copy.addIcon}
            className="focus-ring group/icon border-border relative grid size-10 place-items-center overflow-hidden rounded-lg border"
          >
            {icon ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={icon} alt="" className="size-full object-cover" />
            ) : (
              <GroupAvatar members={members} size={38} />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover/icon:opacity-100">
              <ImagePlus className="size-4 text-white" aria-hidden="true" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              // Read into the page rather than uploaded anywhere: this is a
              // prototype, and a picture that only exists in this session is
              // honest about that.
              const reader = new FileReader();
              reader.onload = () => {
                onIconChange(String(reader.result));
                toast.success(copy.iconSet);
              };
              reader.readAsDataURL(file);
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <input
            id="conversation-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder={copy.namePlaceholder}
            className="focus-ring border-border h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none"
          />
          {icon && (
            <button
              type="button"
              onClick={() => {
                onIconChange(null);
                toast.success(copy.iconRemoved);
              }}
              className="focus-ring text-muted-foreground hover:text-negative mt-1 rounded text-[11px] font-medium"
            >
              {copy.removeIcon}
            </button>
          )}
        </div>
      </div>

      {/* The same editor the New group state uses, so the gates a room was
          created with stay editable for as long as the room exists. */}
      <div className="mt-4">
        {/* The rules are custody's, not a role's: an admin who could sign a
            successor manifest could name themselves holder and keep the room.
            BRC-190 §2.4.1. A disabled control with no reason beside it reads
            as a broken one, so the reason is stated rather than implied. */}
        {!canEditManifest("me", live) && thread.group?.holderId && (
          <p className="bg-surface text-muted-foreground mt-4 rounded-xl px-3 py-2.5 text-[11px] text-pretty">
            {copy.roles.rulesHeldBy}{" "}
            {getMessagePerson(thread.group.holderId)?.name ??
              thread.group.holderId}
            . {copy.roles.rulesHeldHint}
          </p>
        )}
        <GroupGatesEditor
          readOnly={!canEditManifest("me", live)}
          gates={gates}
          excludes={newlyExcluded(live, gates)}
          onChange={(next) => {
            onGatesChange(next);
            /* Roles are read off the gate. Switching the gate off leaves a
               ladder with nothing under it, so it goes at the same time. */
            if (!next && roles) onRolesChange(null);
          }}
        />
        {/*
          A sibling, not a child of the token gate.

          A room gated on a vouch has a role question too, and burying the
          answer inside the token panel makes it unreachable in every other
          configuration. What this section offers depends on which gates are
          on; where it sits does not.
        */}
        <RoomRolesEditor
          readOnly={!canEditManifest("me", live)}
          gates={gates}
          roles={roles}
          onChange={onRolesChange}
          warning={
            orphanRisk(live, { roles }) === "no-admin"
              ? copy.roles.lastAdmin
              : orphanRisk(live, { gates }) === "no-members"
                ? copy.roles.noneInside
                : undefined
          }
        />
      </div>

      <p className="text-muted-foreground mt-5 mb-1 text-[11px] font-bold tracking-wide uppercase">
        {copy.addLabel}
      </p>
      <div className="border-border flex items-center gap-2 rounded-lg border px-3">
        <UserPlus
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          type="search"
          value={addQuery}
          onChange={(event) => setAddQuery(event.target.value)}
          placeholder={copy.addPlaceholder}
          aria-label={copy.addLabel}
          className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {addResults.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {addResults.map((person) => {
            // The gates apply while adding, not only while creating: a room
            // that filters its founders but not its latecomers has no gate.
            const verdict = roomVerdict(person.id, live, gates);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={verdict.outcome !== "qualifies"}
                  onClick={() => {
                    onMembersChange([...memberIds, person.id]);
                    setAddQuery("");
                    toast.success(`${person.name} ${copy.addedTo}`);
                  }}
                  className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left ${
                    verdict.outcome === "qualifies"
                      ? "hover:bg-surface-hover"
                      : "cursor-not-allowed opacity-45"
                  }`}
                >
                  <MemberAvatar person={person} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block min-w-0 truncate text-sm font-semibold">
                      {person.name}
                    </span>
                    <Handle
                      person={person}
                      size={11}
                      className="text-muted-foreground max-w-full truncate text-xs"
                    />
                  </span>
                  <Check
                    className="text-accent size-4 shrink-0"
                    aria-hidden="true"
                  />
                </button>
                {verdict.outcome !== "qualifies" && (
                  <p className="text-warning -mt-0.5 px-1.5 pb-1 pl-11 text-[11px]">
                    {roomVerdictReason(verdict)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-muted-foreground mt-5 mb-1 text-[11px] font-bold tracking-wide uppercase">
        {copy.membersLabel} ({members.length + 1})
      </p>
      <div className="border-border mb-2 flex items-center gap-2 rounded-lg border px-3">
        <Search
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          type="search"
          value={memberQuery}
          onChange={(event) => setMemberQuery(event.target.value)}
          placeholder={copy.searchMembers}
          aria-label={copy.searchMembers}
          className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <ul className="mb-4 space-y-0.5">
        <li className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <MemberAvatar person={me} size={28} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {me.name}{" "}
            <span className="text-muted-foreground font-normal">(you)</span>
          </span>
          <RoleBadge
            role={myRole}
            byCustody={thread.group?.holderId === "me"}
            flat={isFlat(live)}
          />
          {serialOf("me") !== undefined && (
            <span className="bg-surface text-muted-foreground shrink-0 rounded px-1 font-mono text-[10px]">
              #{serialOf("me")}
            </span>
          )}
        </li>
        {shownMembers.map((member) => (
          <li
            key={member.id}
            className="hover:bg-surface-hover flex items-center gap-2.5 rounded-lg px-1.5 py-1.5"
          >
            <MemberAvatar person={member} size={28} />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-semibold">
                  {member.name}
                </span>
                {/* The mark alone: a 340px column has no room for the
                    ecosystem's name beside every member. */}
                <EcosystemMark ecosystem={member.ecosystem} size={12} />
                <RoleBadge
                  role={roleOf(member.id, live)}
                  byCustody={thread.group?.holderId === member.id}
                  flat={isFlat(live)}
                />
                {/* Which item of the gating contract they hold. A gate passed
                    is a fact about a specific thing they own, and naming it is
                    what separates "let in" from "holds number 13". */}
                {serialOf(member.id) !== undefined && (
                  <span className="bg-surface text-muted-foreground shrink-0 rounded px-1 font-mono text-[10px]">
                    #{serialOf(member.id)}
                  </span>
                )}
                {/*
                  A member who no longer clears the gate.

                  Gates are evaluated live, and standing changes after someone
                  is already in: a vouch can be withdrawn, a balance spent, a
                  renouncement written. Saying so beats a list that silently
                  disagrees with the door, and the reason is the actionable
                  part — "not vouched for by Darren" is something a person can
                  do something about.
                */}
                {memberVerdict(member.id) && (
                  <Tooltip label={memberVerdict(member.id) ?? ""}>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`${member.name}: ${memberVerdict(member.id)}`}
                      className="focus-ring text-warning shrink-0 rounded"
                    >
                      <EyeOff className="size-3.5" aria-hidden="true" />
                    </span>
                  </Tooltip>
                )}
              </span>
            </span>
            {/*
              Banning is downward only, and it writes a signed statement
              rather than adding a row to a hidden list. An admin cannot ban
              an admin: it is the one move that can empty a room's admin set
              in a single click, and a room with none cannot appoint one.
            */}
            {can.ban && canActOn("me", member.id, live) && (
              <button
                type="button"
                onClick={() => {
                  const banned = Boolean(roomBan(thread.id, member.id));
                  setRoomBan(thread.id, member.id, !banned);
                  toast.success(
                    banned
                      ? `${member.name} — ${copy.roles.unbannedToast}`
                      : `${member.name} — ${copy.roles.bannedToast}`,
                  );
                }}
                aria-label={`${copy.roles.ban} ${member.name}`}
                title={copy.roles.banBody}
                className={`focus-ring hover:bg-surface-hover flex size-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                  roomBan(thread.id, member.id)
                    ? "text-negative"
                    : "text-muted-foreground hover:text-negative"
                }`}
              >
                <UserMinus className="size-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onMembersChange(memberIds.filter((id) => id !== member.id));
                toast.success(`${member.name} ${copy.removedFrom}`);
              }}
              aria-label={`${copy.remove} ${member.name}`}
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-negative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {/*
        Closing, for an admin, and worded as what it is.

        Nothing here un-delivers a message. A closure is a signed statement
        that conforming clients honour by refusing new posts — a convention
        with a name on it, which is the strongest thing a room can offer and
        weaker than the word "delete" implies.
      */}
      {can.closeRoom && !closure && (
        <button
          type="button"
          onClick={() => {
            closeRoom(thread.id, "me");
            toast.success(copy.roles.closedToast);
          }}
          className="focus-ring border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground mt-5 flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
        >
          <DoorClosed className="size-4" aria-hidden="true" />
          {copy.roles.closeRoom}
        </button>
      )}
      {closure && (
        <p className="bg-surface text-muted-foreground mt-5 rounded-xl px-3 py-2.5 text-xs text-pretty">
          {copy.roles.closedBy}{" "}
          {closure.byId === "me"
            ? copy.gates.you
            : (getMessagePerson(closure.byId)?.name ?? closure.byId)}
          . {copy.roles.closeBody}
        </p>
      )}

      <button
        type="button"
        onClick={onLeave}
        className="focus-ring border-border text-negative hover:bg-negative/10 mt-5 flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
      >
        <LogOut className="size-4" aria-hidden="true" />
        {copy.leave}
      </button>
    </div>
  );
}
