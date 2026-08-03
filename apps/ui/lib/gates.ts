/**
 * Group access gates: who may join a gated room, and why someone may not.
 *
 * Three gates, each independent and additive — a candidate has to pass every
 * gate that is on. Vouch and renounce gates read the same reputation store the
 * profile pane shows, so the member picker and the profile never disagree
 * about someone's standing. Token holdings have no live ledger in this
 * prototype, so they are mocked deterministically: the same person either
 * holds a token or does not, on every render and both sides of hydration.
 */
import { getEffects } from "@/lib/command-effects";
import {
  CHAIN_TIP,
  bsvHoldings,
  content,
  getCollectibles,
  lockedStakes,
  NAKA_MOTOR,
  nakaMotorHolders,
  RARE_HAT,
  rareHatHolders,
  getMessagePerson,
  getToken,
  getTokenBalances,
  getTokens,
  type Collectible,
  type GroupGates,
  type Token,
} from "@/lib/data";

/** Amounts read in a sentence, so trailing zeros go. */
function formatUnits(units: number): string {
  return Number(units.toFixed(4)).toLocaleString();
}

/** A fresh, everything-off gate configuration. */
export function emptyGates(): GroupGates {
  return {
    token: { on: false, ids: [], minimums: {} },
    timelock: { on: false },
    vouch: { on: false, entityIds: [] },
    renounce: { on: false, entityIds: [] },
  };
}

/** The prefix marking a gate id as a whole collection rather than one item. */
export const COLLECTION_PREFIX = "collection:";

/** One result in the token-gate search: fungible tokens and collections. */
export interface GateToken {
  id: string;
  kind: "token" | "collectible";
  /** a still to draw for it, where the artwork itself is unsuitable */
  markUrl?: string;
  name: string;
  /** ticker for a token, issuing org for a collectible */
  detail: string;
  token?: Token;
  collectible?: Collectible;
}

/** Search fungible tokens and collectibles by name, symbol or org. */
export function searchGateTokens(query: string): GateToken[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const fungible: GateToken[] = getTokens()
    .filter(
      (token) =>
        token.name.toLowerCase().includes(needle) ||
        token.symbol.toLowerCase().includes(needle),
    )
    .map((token) => ({
      id: token.id,
      kind: "token",
      name: token.name,
      detail: token.symbol,
      token,
    }));
  const seen = new Set<string>();
  const nonFungible: GateToken[] = getCollectibles()
    .filter((item) => {
      // One entry per collection: gating on "a CopeDex ticket" is the useful
      // grain, and thirty serials of the same artwork are one answer.
      const key = `${item.org ?? ""}·${item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return (
        item.name.toLowerCase().includes(needle) ||
        item.org?.toLowerCase().includes(needle)
      );
    })
    .map((item) => ({
      // A door asks for a hat, not for hat number 69. Gating on the contract
      // is the useful grain, and it is the only one that stays true when the
      // holder sells one and buys another.
      id: item.org ? `${COLLECTION_PREFIX}${item.org}` : item.id,
      kind: "collectible",
      name: item.org ?? item.name,
      detail: item.org ? content.messages.group.gates.contract : item.name,
      ...(item.org === RARE_HAT.collection
        ? { markUrl: "/avatars/ecosystemchats/hatsociety.png" }
        : {}),
      ...(item.org === NAKA_MOTOR.collection
        ? { markUrl: "/collectibles/nakamotor/2121.png" }
        : {}),
      collectible: item,
    }));
  return [...fungible, ...nonFungible].slice(0, 6);
}

/** Resolve a gate-token id back to something displayable. */
export function gateTokenById(id: string): GateToken | undefined {
  if (id.startsWith(COLLECTION_PREFIX)) {
    const collection = id.slice(COLLECTION_PREFIX.length);
    const item = getCollectibles().find((c) => c.org === collection);
    return {
      id,
      kind: "collectible",
      name: collection,
      detail: content.messages.group.gates.contract,
      // The Rare Hat's artwork is a clip, which makes a poor 18px chip.
      ...(collection === RARE_HAT.collection
        ? { markUrl: "/avatars/ecosystemchats/hatsociety.png" }
        : {}),
      ...(collection === NAKA_MOTOR.collection
        ? { markUrl: "/collectibles/nakamotor/2121.png" }
        : {}),
      ...(item ? { collectible: item } : {}),
    };
  }
  const token = getToken(id);
  if (token) {
    return { id, kind: "token", name: token.name, detail: token.symbol, token };
  }
  const collectible = getCollectibles().find((item) => item.id === id);
  if (collectible) {
    return {
      id,
      kind: "collectible",
      name: collectible.name,
      detail: collectible.org ?? content.messages.group.gates.collectible,
      collectible,
    };
  }
  return undefined;
}

/**
 * Whether a person holds a token, mocked deterministically.
 *
 * No ledger to ask in a prototype, so a stable hash decides — roughly six in
 * ten hold any given token, which keeps a token-gated member list visibly
 * filtered without emptying it.
 */
export function holdsToken(personId: string, tokenId: string): boolean {
  // Where holdings are actually known, they are not guessed. The Rare Hat
  // contract has a register, so the gate reads it.
  if (tokenId === `${COLLECTION_PREFIX}${RARE_HAT.collection}`) {
    return personId in rareHatHolders;
  }
  if (tokenId === `${COLLECTION_PREFIX}${NAKA_MOTOR.collection}`) {
    return personId in nakaMotorHolders;
  }
  const seed = `${personId}:${tokenId}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash ^ seed.charCodeAt(i)) * 16777619;
  }
  return (hash >>> 0) % 10 < 6;
}

/**
 * The serial a person holds from a gated contract, where the contract keeps a
 * register the client can read.
 *
 * A token gate is satisfied by an item, not by a permission, and saying which
 * item is the difference between "allowed" and "holds hat 13". Only the Rare
 * Hat contract publishes its register here; everything else answers yes or no.
 */
export function heldSerial(
  personId: string,
  tokenId: string,
): number | undefined {
  if (tokenId === `${COLLECTION_PREFIX}${NAKA_MOTOR.collection}`) {
    return nakaMotorHolders[personId]?.number;
  }
  if (tokenId !== `${COLLECTION_PREFIX}${RARE_HAT.collection}`) return undefined;
  return rareHatHolders[personId];
}

/**
 * How much of a fungible token someone holds.
 *
 * Ours is the wallet's actual balance. Nobody else's balance is knowable from
 * here, so it is mocked from a stable hash — but mocked over a wide range,
 * because a minimum that everyone clears tests nothing and a gate nobody
 * clears looks broken.
 */
export function heldUnits(personId: string, tokenId: string): number {
  if (personId === "me") {
    return getTokenBalances().find((b) => b.token.id === tokenId)?.units ?? 0;
  }
  if (tokenId === "bsv" && personId in bsvHoldings) {
    return bsvHoldings[personId] as number;
  }
  const seed = `units:${personId}:${tokenId}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash ^ seed.charCodeAt(i)) * 16777619;
  }
  return ((hash >>> 0) % 6000) / 100;
}

/**
 * What somebody has locked, and for how much longer.
 *
 * A lock is a script anybody can read, which is what makes another person's
 * commitment checkable at all — unlike a balance, which the prototype has to
 * guess at, a lock is public by construction.
 */
export function lockOf(
  personId: string,
): { units: number; blocksLeft: number } {
  const lock = lockedStakes[personId];
  if (!lock) return { units: 0, blocksLeft: 0 };
  return {
    units: lock.units,
    blocksLeft: Math.max(0, lock.unlocksAt - CHAIN_TIP),
  };
}

/** Blocks as something a person can read. ~144 blocks to the day. */
export function blocksAsTime(blocks: number): string {
  const copy = content.messages.group.gates;
  const days = Math.round(blocks / 144);
  if (days >= 365) return `${Math.round(days / 365)}${copy.years}`;
  if (days >= 30) return `${Math.round(days / 30)}${copy.months}`;
  return `${days}${copy.days}`;
}

/** The display name of a gate entity, with "you" for the current user. */
function entityName(entityId: string): string {
  return (
    getMessagePerson(entityId)?.name ?? content.messages.group.gates.you
  );
}

/**
 * A verdict, as data.
 *
 * Produced as a structure and rendered afterwards, never produced as a
 * sentence: an agent cannot act on prose, and a client that built the sentence
 * first has to parse its own English back into numbers to do anything else
 * with it. BRC-190 §3.4.
 */
export interface Verdict {
  outcome: "qualifies" | "fails" | "indeterminate";
  /** which condition decided it */
  condition?:
    | "ban"
    | "renounce"
    | "vouch"
    | "quorum"
    | "token"
    | "timelock"
    | "fee";
  /** which entry of that condition, where it names several */
  index?: number;
  /** the handles or assets the condition named, for rendering */
  named?: string[];
  /**
   * Only ever the reader's own numbers.
   *
   * Omitted for anybody else, because a verdict object is the easiest place to
   * forget §3.3.2 and the easiest place to leak it from. BRC-190 §3.4.4.
   */
  shortfall?: { held: number; required: number; symbol: string };
  /** the reader's own lock against what was asked; omitted for anybody else */
  lock?: { units: number; blocksLeft: number; need: number; needBlocks: number };
}

/** The verdict rendered for a person to read. */
export function verdictReason(verdict: Verdict): string | undefined {
  if (verdict.outcome === "qualifies") return undefined;
  const copy = content.messages.group.gates;
  if (verdict.outcome === "indeterminate") return copy.unchecked;
  const named = verdict.named?.join(", ") ?? "";
  if (verdict.condition === "renounce") return `${copy.renouncedBy} ${named}`;
  if (verdict.condition === "vouch") return `${copy.notVouchedBy} ${named}`;
  if (verdict.shortfall) {
    const { held, required, symbol } = verdict.shortfall;
    return `${copy.holdsOnly} ${formatUnits(held)} ${symbol} ${copy.ofRequired} ${formatUnits(required)}`;
  }
  if (verdict.condition === "timelock") {
    const l = verdict.lock;
    /* Without the reader's own figures the only honest thing to say is that
       the lock does not meet the requirement. "Nothing locked" would be a
       specific claim, and usually a false one. */
    if (!l) return copy.notLocked;
    if (l.units === 0) return copy.nothingLocked;
    if (l.units < l.need) {
      return `${copy.locksOnly} ${formatUnits(l.units)} ${copy.ofRequiredLock} ${formatUnits(l.need)}`;
    }
    return `${copy.lockTooShort} ${blocksAsTime(l.needBlocks)}`;
  }
  if (verdict.condition === "token") return `${copy.missingToken} ${named}`;
  return copy.unchecked;
}

/**
 * Whether a person passes a room's gates, and the first reason they do not.
 *
 * The reason is a fragment ("not vouched for by Randy Cox"), ready to sit
 * after the person's name in the picker. A gate that is on with nothing
 * configured yet gates nobody — half-built configuration should not lock the
 * door on everyone while it is being typed.
 *
 * **Quantities are only ever our own.** Who has vouched for whom is a public
 * claim, so naming it costs nothing the reader could not read elsewhere. A
 * balance is not: annotating a roster with "holds 12.32 of the 21.8 required"
 * turns a settings screen into a balance oracle over everyone in the room, and
 * an administrator who can edit the minimum can binary-search a member's
 * holdings in a few keystrokes. So a shortfall against somebody else says only
 * that the holding is short. BRC-190 §3.3.
 */
export function gateVerdict(
  personId: string,
  gates: GroupGates | undefined,
): Verdict {
  if (!gates) return { outcome: "qualifies" };
  const effects = getEffects();

  if (gates.renounce.on && gates.renounce.entityIds.length > 0) {
    const renouncedBy = effects.renounces.find(
      (r) =>
        r.personId === personId &&
        gates.renounce.entityIds.includes(r.byPersonId ?? "me"),
    );
    if (renouncedBy) {
      return {
        outcome: "fails",
        condition: "renounce",
        named: [entityName(renouncedBy.byPersonId ?? "me")],
      };
    }
  }

  if (gates.vouch.on && gates.vouch.entityIds.length > 0) {
    const vouched = effects.vouches.some(
      (v) =>
        v.personId === personId &&
        gates.vouch.entityIds.includes(v.byPersonId ?? "me"),
    );
    if (!vouched) {
      return {
        outcome: "fails",
        condition: "vouch",
        named: gates.vouch.entityIds.map(entityName),
      };
    }
  }

  if (gates.timelock.on && gates.timelock.amount !== undefined) {
    /* Two ways to fail and they are not the same failure: holding too little,
       or holding enough and not having committed it. Saying which is the
       difference between "buy more" and "lock what you already have". */
    const need = gates.timelock.amount;
    const needBlocks = gates.timelock.minBlocks ?? 0;
    const { units, blocksLeft } = lockOf(personId);
    if (units < need || blocksLeft < needBlocks) {
      return {
        outcome: "fails",
        condition: "timelock",
        ...(personId === "me"
          ? {
              lock: { units, blocksLeft, need, needBlocks },
            }
          : {}),
      };
    }
  }

  if (gates.token.on && gates.token.ids.length > 0) {
    // Any one of the listed holdings opens the door, so a failure has to be a
    // failure of all of them — and the reason names the shortfall on the one
    // the reader came closest on, which is the actionable one.
    let failed: Verdict | undefined;
    const holds = gates.token.ids.some((tokenId, index) => {
      const minimum = gates.token.minimums?.[tokenId];
      const token = getToken(tokenId);
      if (minimum !== undefined && token) {
        const held = heldUnits(personId, tokenId);
        if (held >= minimum) return true;
        failed ??= {
          outcome: "fails",
          condition: "token",
          index,
          named: [token.name],
          // Quantities are only ever our own. BRC-190 §3.4.4.
          ...(personId === "me"
            ? {
                shortfall: { held, required: minimum, symbol: token.symbol },
              }
            : {}),
        };
        return false;
      }
      if (holdsToken(personId, tokenId)) return true;
      failed ??= {
        outcome: "fails",
        condition: "token",
        index,
        named: [gateTokenById(tokenId)?.name ?? tokenId],
      };
      return false;
    });
    if (!holds && failed) return failed;
  }

  return { outcome: "qualifies" };
}
