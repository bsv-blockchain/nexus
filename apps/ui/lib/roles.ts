/**
 * Room roles: who may moderate, derived from the same facts as the door.
 *
 * A role here is never granted. It is read off whatever the room already gates
 * on — a rarity band, a holding, a vouch — which means the room never keeps a
 * list of moderators, and a moderator who sells the thing that made them one
 * stops being one on the next evaluation. That is the same rule the gate runs
 * under, applied one rung further in.
 *
 * The interesting problem is the opposite of exclusion. A ladder derived from
 * holdings can empty itself: the only Exotic holder sells, the thresholds are
 * set above what anybody has, a founder holds a Common. A room whose admin set
 * is empty cannot be repaired from inside, so three separate guards keep it
 * from ever getting there — see `orphanRisk`, the holder exemption in
 * `roleOf`, and the ban rules in `canBan`.
 */
import { roomBan } from "@/lib/command-effects";
import {
  NAKA_MOTOR,
  content,
  getMessagePerson,
  getToken,
  nakaMotorHolders,
  type ChatThread,
  type GroupGates,
  type RoomRole,
  type RoomRoles,
} from "@/lib/data";
import {
  COLLECTION_PREFIX,
  gateVerdict,
  heldUnits,
  lockOf,
  verdictReason,
  type Verdict,
} from "@/lib/gates";

/** Weakest first. Every comparison in this file reads against this order. */
export const ROLE_LADDER: RoomRole[] = ["member", "mod", "admin"];

export function roleRank(role: RoomRole): number {
  return ROLE_LADDER.indexOf(role);
}

/** The stronger of two roles, which is how sources are combined. */
function strongest(a: RoomRole, b: RoomRole): RoomRole {
  return roleRank(a) >= roleRank(b) ? a : b;
}

/**
 * The rarity ladder a contract publishes, rarest last.
 *
 * Only contracts that publish one can be read as a ladder. A client that
 * invented an order would eventually meet a contract whose "Exotic" is its
 * commonest band and would hand that room to everybody.
 */
export function rarityLadder(tokenId: string): readonly string[] | undefined {
  if (tokenId === `${COLLECTION_PREFIX}${NAKA_MOTOR.collection}`) {
    return NAKA_MOTOR.ladder;
  }
  return undefined;
}

/**
 * How many items sit at a band or above it.
 *
 * The ceiling on the role assigned to that band, and the number a room is
 * actually choosing between when it picks Rare over Epic. Deriving it from the
 * contract's own curve rather than asking the room to guess is the difference
 * between "assign mod to Rare" and "appoint up to 555 moderators".
 */
export function bandCeiling(
  tokenId: string,
  band: string,
): number | undefined {
  if (tokenId !== `${COLLECTION_PREFIX}${NAKA_MOTOR.collection}`) return undefined;
  const ladder = NAKA_MOTOR.ladder as readonly string[];
  const from = ladder.indexOf(band);
  if (from < 0) return undefined;
  return ladder
    .slice(from)
    .reduce((total, name) => total + (NAKA_MOTOR.bands[name] ?? 0), 0);
}

/** The band a person holds from a contract, where the contract has bands. */
export function heldRarity(
  personId: string,
  tokenId: string,
): string | undefined {
  if (tokenId !== `${COLLECTION_PREFIX}${NAKA_MOTOR.collection}`) return undefined;
  return nakaMotorHolders[personId]?.rarity;
}

/** Every non-fungible gate id that publishes a ladder. */
export function ladderTokenIds(gates: GroupGates | undefined): string[] {
  return (gates?.token.ids ?? []).filter((id) => rarityLadder(id) !== undefined);
}

/** Every fungible gate id, which is where amount thresholds apply. */
export function fungibleTokenIds(gates: GroupGates | undefined): string[] {
  return (gates?.token.ids ?? []).filter((id) => getToken(id));
}

/**
 * Whether a held band clears a required one.
 *
 * A threshold rather than a match: "Rare is a mod" means Rare and anything
 * above it. The alternative silently demotes the Legendary holder standing
 * next to the Rare, which is not a rule anybody would guess at.
 */
function bandMeets(
  held: string | undefined,
  required: string | undefined,
  ladder: readonly string[],
): boolean {
  if (!required) return false;
  if (!held) return false;
  const h = ladder.indexOf(held);
  const r = ladder.indexOf(required);
  if (h < 0 || r < 0) return false;
  return h >= r;
}

/** The role a room's own configuration derives for someone. */
function derivedRole(
  personId: string,
  gates: GroupGates | undefined,
  roles: RoomRoles | undefined,
): RoomRole {
  if (!roles?.on || !gates) return "member";
  let role: RoomRole = "member";

  // Rarity bands, from any gated contract that publishes a ladder.
  if (gates.token.on && roles.rarity) {
    for (const tokenId of ladderTokenIds(gates)) {
      const ladder = rarityLadder(tokenId);
      if (!ladder) continue;
      const held = heldRarity(personId, tokenId);
      for (const candidate of ROLE_LADDER) {
        if (bandMeets(held, roles.rarity[candidate], ladder)) {
          role = strongest(role, candidate);
        }
      }
    }
  }

  // Amounts, for a currency. Same ladder, the only vocabulary a currency has.
  if (gates.token.on && roles.minimums) {
    for (const tokenId of fungibleTokenIds(gates)) {
      const thresholds = roles.minimums[tokenId];
      if (!thresholds) continue;
      const held = heldUnits(personId, tokenId);
      for (const candidate of ROLE_LADDER) {
        const need = thresholds[candidate];
        if (need !== undefined && held >= need) role = strongest(role, candidate);
      }
    }
  }

  /*
   * Commitment in time. Unlike a band or a balance this does not cap how many
   * can reach a rung — any number of people can lock for a year — so it reads
   * willingness rather than scarcity, and it is the only rung whose price is
   * not payable in money alone.
   */
  if (gates.timelock.on && roles.locks) {
    const { blocksLeft } = lockOf(personId);
    for (const candidate of ROLE_LADDER) {
      const need = roles.locks[candidate];
      if (need !== undefined && blocksLeft >= need) {
        role = strongest(role, candidate);
      }
    }
  }

  /*
   * The handles a room gates on are the handles whose judgement it already
   * trusts, so a room may hand them the room as well. It is a switch and not
   * an assumption: wanting somebody's vouch as a door is not the same as
   * wanting them to run the place.
   */
  if (roles.entitiesAreAdmins) {
    const named = [
      ...(gates.vouch.on ? gates.vouch.entityIds : []),
      ...(gates.renounce.on ? gates.renounce.entityIds : []),
    ];
    if (named.includes(personId)) role = strongest(role, "admin");
  }

  return role;
}

/**
 * Whether a room has any condition to derive a role from.
 *
 * A room with no gate has no vocabulary — no band, no amount, no named
 * attestor — so there is nothing to read a ladder off. Inventing one would
 * mean appointing somebody, which is the list this design refuses to keep.
 */
export function isFlat(thread: ChatThread): boolean {
  const gates = thread.group?.gates;
  if (!gates) return true;
  return !gates.token.on && !gates.vouch.on && !gates.renounce.on;
}

/**
 * Someone's role in a room.
 *
 * Custody first. The holder is an admin whatever the gate says, because a room
 * that can derive its way to nobody-in-charge is a room that breaks and cannot
 * be fixed. Everything else is derived, and the strongest source wins — being
 * an admin by vouch and a mod by rarity makes you an admin, since the room said
 * both things and only one of them can be true at a time.
 */
export function roleOf(personId: string, thread: ChatThread): RoomRole {
  const group = thread.group;
  if (!group) return "member";
  if (group.holderId === personId) return "admin";
  /*
   * An ungated room is flat, and flat means everybody at the top rather than
   * everybody at the bottom. A room that admitted anyone and then withheld
   * every power from them would need somebody to hand those powers out, which
   * is the appointment this design exists to avoid — and a group chat with no
   * door has no basis for saying one member outranks another.
   */
  if (isFlat(thread)) return "admin";
  /* A ladder reads the same facts as the door, and the two can disagree: a
     long lock of too small an amount derives a rung while failing the gate.
     A role is what a participant may do, so somebody the room does not admit
     has none — otherwise the roster badges a moderator who cannot read it. */
  if (roomVerdict(personId, thread, group.gates ?? null).outcome !== "qualifies") {
    return "member";
  }
  return derivedRole(personId, group.gates, group.roles);
}

/**
 * Whether one participant may act on another.
 *
 * Rank alone cannot answer this in a flat room, where everybody is an admin
 * and section 8.2.4 therefore lets nobody act on anybody. Custody breaks the
 * tie: the holder is not a rung on the ladder but the floor underneath it, so
 * they may act on anyone, and an ungated room stays moderatable by exactly the
 * person who made it.
 */
export function canActOn(
  actorId: string,
  targetId: string,
  thread: ChatThread,
): boolean {
  if (actorId === targetId) return false;
  // Custody cannot be banned by anything it underwrites.
  if (thread.group?.holderId === targetId) return false;
  if (thread.group?.holderId === actorId) return true;
  return canBan(roleOf(actorId, thread), roleOf(targetId, thread));
}

/** Whether the room's gate applies to someone at all. */
export function gateApplies(personId: string, thread: ChatThread): boolean {
  // The holder is in the room by custody rather than by qualification. Without
  // this a room can lock out its own administrator — by naming an attestor who
  // renounces them, or simply by being founded by somebody holding a Common.
  return thread.group?.holderId !== personId;
}

/**
 * Whether somebody may read a room, and why not.
 *
 * Three questions in the order they can each end the matter: has a moderator
 * banned them, do they hold the room, does the gate open. The ban comes first
 * because it is the only one of the three a person in the room decided, and a
 * reader told "does not hold a Naka Motor" when the truth is "Krambo banned
 * you" has been given a reason they cannot act on.
 */
export function roomVerdict(
  personId: string,
  thread: ChatThread,
  gates: GroupGates | null | undefined,
): Verdict {
  const ban = roomBan(thread.id, personId);
  if (ban) {
    const by = ban.byPersonId ?? "me";
    return {
      outcome: "fails",
      condition: "ban",
      named: [
        by === "me"
          ? content.messages.group.gates.you
          : (getMessagePerson(by)?.name ?? by),
      ],
    };
  }
  if (!gateApplies(personId, thread)) return { outcome: "qualifies" };
  return gateVerdict(personId, gates ?? undefined);
}

/** A room verdict rendered for a person, ban included. */
export function roomVerdictReason(verdict: Verdict): string | undefined {
  if (verdict.condition === "ban") {
    const copy = content.messages.group.roles;
    return `${copy.banned} — ${verdict.named?.[0] ?? ""}`;
  }
  return verdictReason(verdict);
}

/** What each role may do, in the order a person would ask about them. */
export interface Capabilities {
  post: boolean;
  deleteMessages: boolean;
  ban: boolean;
  closeRoom: boolean;
}

export function capabilities(role: RoomRole): Capabilities {
  return {
    post: true,
    deleteMessages: role !== "member",
    ban: role !== "member",
    closeRoom: role === "admin",
  };
}

/**
 * Whether someone may change the room's rules.
 *
 * Custody, not role. A role is derived from a holding, and a holding carries no
 * authority to rewrite the rule that derived it — an admin who could sign a
 * successor manifest could name themselves holder and keep the room.
 * BRC-190 §2.4.1.
 */
export function canEditManifest(personId: string, thread: ChatThread): boolean {
  return thread.group?.holderId === personId;
}

/**
 * Whether one role may ban another.
 *
 * Strictly downward, and never sideways. An admin banning an admin is the one
 * move that can empty a room's admin set in a single action, and a room with
 * no admin cannot appoint one — there is nobody left with the power to change
 * the configuration that would derive a new one.
 */
export function canBan(actor: RoomRole, target: RoomRole): boolean {
  if (actor === "member") return false;
  return roleRank(actor) > roleRank(target);
}

/**
 * Who is in the room now and would not be under a proposed configuration.
 *
 * The cost of a change is measured by who it costs, which is what makes
 * upgrading an ordinary group chat cheap and tightening an established one
 * expensive — a first gate is usually chosen to fit the people already there
 * and excludes nobody, while a later one is usually made precisely because
 * somebody should not be here. BRC-190 §2.5.
 */
export function newlyExcluded(
  thread: ChatThread,
  next: GroupGates | null,
): string[] {
  const group = thread.group;
  if (!group) return [];
  const everyone = ["me", ...group.memberIds];
  return everyone.filter((id) => {
    if (group.holderId === id) return false;
    const before = roomVerdict(id, thread, group.gates ?? null);
    if (before.outcome !== "qualifies") return false;
    const after = gateVerdict(id, next ?? undefined);
    return after.outcome !== "qualifies";
  });
}

/**
 * Why a room would be left unmanageable, or undefined when it would not.
 *
 * Checked before a configuration is saved rather than after. The derived layer
 * can empty itself at runtime for reasons no client controls — somebody sells
 * the only Exotic — which is exactly why custody sits underneath it and why
 * this check exists for the part that *is* under a client's control.
 */
export function orphanRisk(
  thread: ChatThread,
  next: { gates?: GroupGates | null; roles?: RoomRoles | null },
): "no-admin" | "no-members" | undefined {
  const group = thread.group;
  if (!group) return undefined;
  const gates =
    next.gates === undefined ? group.gates : (next.gates ?? undefined);
  const roles =
    next.roles === undefined ? group.roles : (next.roles ?? undefined);
  const everyone = ["me", ...group.memberIds];

  // Custody answers this on its own, so a room with a holder cannot orphan.
  if (!group.holderId) {
    const admins = everyone.filter(
      (id) => derivedRole(id, gates, roles) === "admin",
    );
    if (admins.length === 0) return "no-admin";
  }

  const inside = everyone.filter(
    (id) =>
      group.holderId === id ||
      gateVerdict(id, gates).outcome === "qualifies",
  );
  if (inside.length === 0) return "no-members";
  return undefined;
}
