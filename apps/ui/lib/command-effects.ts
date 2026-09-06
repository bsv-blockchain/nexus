/**
 * Side effects a command leaves outside Messages.
 *
 * A payment that only appears in a chat bubble is a chat bubble. `/pay` shows
 * up in Wallet, `/attest` and `/delegate` show up as certificates in Identity,
 * `/subscribe` becomes a standing schedule, and `/scope` and `/trolltoll`
 * change the reachability policy the whole app reports.
 *
 * Module-level store read through `useSyncExternalStore`, matching how the hub
 * already reads what each profile has connected — both the apps and the sites.
 * Nothing here is written to disk: these are the effects of the current
 * session's commands.
 */
import { storageKeys } from "@/lib/config";
import { getChatMessages, mediaItems } from "@/lib/data";
import type {
  IdentityCertificate,
  MessageAttachment,
  MessagePerson,
  WalletTransaction,
} from "@/lib/data";

export type Reach = "everyone" | "contacts" | "ecosystem" | "toll";

/**
 * What this client writes to the chain for the messages you send.
 *
 * Lives beside {@link Reach} because it is the same kind of thing: a messaging
 * policy the whole app has to report accurately, set once and then quietly in
 * force. It is not a command effect, but keeping the two apart would mean two
 * stores answering "how does this client behave" and no guarantee they agree.
 *
 *  - `messages` — content anchored, encrypted and permanent. Nobody can remove
 *    it afterwards, the sender included.
 *  - `receipts` — only the fact of delivery is anchored. The words stay in the
 *    messagebox, where they can be deleted.
 *  - `nothing` — delivery only. Nothing outlives the messagebox, and nothing is
 *    provable later.
 *
 * A sealed `/once` is exempt under every setting. Anchoring a one-time secret
 * would make it permanent, which is the opposite of what the verb promises, and
 * a policy that could quietly override a guarantee is not a policy worth having.
 */
export type ChainPolicy = "messages" | "receipts" | "nothing";

export interface Subscription {
  id: string;
  personId: string;
  amountSats: number;
  fiat?: { currency: string; amount: number };
  period: "day" | "week" | "month";
  nextRunAt: string;
  createdAt: string;
}

export interface DelegationRecord {
  serial: string;
  personId: string;
  scope: string;
  perActionCapSats: number | null;
  expiry: string | null;
  threadId?: string;
  revokedAt?: string;
  createdAt: string;
}

/**
 * Public reputation added to a handle from the user's identity key. Distinct
 * from a BRC-169 attestation: attesting says "this key belongs to this handle",
 * vouching says "I stand behind this person". Both are public and signed, and
 * both surface in `/whois`.
 */
export interface Vouch {
  /** who is being vouched for */
  personId: string;
  /**
   * Who signed it. Absent means the current user, which is every vouch this
   * client issues; peers' vouches carry theirs, because "who stands behind
   * this person" is only worth reading when you can see who is saying it.
   */
  byPersonId?: string;
  note?: string;
  createdAt: string;
}

/**
 * The opposite claim to a {@link Vouch}: this person does not stand behind
 * that one. Anonymous by default — the renouncer's identity is recorded (the
 * network still holds a signed claim) but only *displayed* when they opted in
 * with `p`/`public`. The reason is shown either way; a warning with no reason
 * is noise, and a reason with no name is still a warning.
 */
export interface Renounce {
  /** who is being renounced */
  personId: string;
  /** who signed it; absent means the current user */
  byPersonId?: string;
  /** whether the renouncer chose to be shown alongside the claim */
  public: boolean;
  reason?: string;
  /**
   * The room this statement is confined to, as `room:<conversationId>`.
   *
   * A ban is a statement against somebody, so it is one of these rather than a
   * list on the room — it has an author, a time, and a claim the subject can
   * answer. Scoping is what keeps it from becoming a claim about the person
   * everywhere: being unwelcome in one room is not a reputation, and an
   * unscoped statement would follow them into every other room that gates on
   * the same handle's word.
   */
  scope?: string;
  createdAt: string;
}

/** The scope string for a room-confined statement. */
export function roomScope(conversationId: string): string {
  return `room:${conversationId}`;
}

/**
 * One side of a trade, committed to a named agent for a window of time.
 *
 * Two of these make an escrow: one carrying the asset, one carrying the money,
 * both naming the same agent. Nothing is arbitrated — the agent is trusted
 * with both halves and could keep them — so the design puts everything a
 * committer needs to decide that in front of them and then gets out of the
 * way.
 */
export interface EscrowSide {
  id: string;
  conversationId: string;
  /** who committed it */
  fromId: string;
  /** who will hold both halves */
  agentId: string;
  /** the collectible, on the asset side */
  assetId?: string;
  /** satoshis, on the money side */
  sats?: number;
  expiresAt: string;
  /** the opposite side this one paired with */
  pairedWith?: string;
  status: "open" | "paired" | "accepted" | "rejected" | "released" | "expired";
  createdAt: string;
}

/** A collectible that has changed hands, per `/send` or a released escrow. */
export interface AssetTransfer {
  assetId: string;
  fromId: string;
  toId: string;
  txid: string;
  createdAt: string;
}

/**
 * One side of a trade, committed to a named agent for a window of time.
 *
 * Two of these make an escrow: one carrying the asset, one carrying the money,
 * both naming the same agent. Nothing is arbitrated — the agent is trusted
 * with both halves and could keep them — so the design puts everything a
 * committer needs to decide that in front of them and then gets out of the
 * way.
 */
export interface EscrowSide {
  id: string;
  conversationId: string;
  /** who committed it */
  fromId: string;
  /** who will hold both halves */
  agentId: string;
  /** the collectible, on the asset side */
  assetId?: string;
  /** satoshis, on the money side */
  sats?: number;
  expiresAt: string;
  /** the opposite side this one paired with */
  pairedWith?: string;
  status: "open" | "paired" | "accepted" | "rejected" | "released" | "expired";
  createdAt: string;
}

/** A collectible that has changed hands, per `/send` or a released escrow. */
export interface AssetTransfer {
  assetId: string;
  fromId: string;
  toId: string;
  txid: string;
  createdAt: string;
}

/**
 * What is actually behind the seal.
 *
 * Text, documents, or both. A credential is often a file — a keystore, a signed
 * contract, a recording of a call — and a verb that could only carry a word
 * would leave every one of those cases back where it started, pasted into a
 * thread that keeps things forever.
 */
export interface SealedPayload {
  text?: string;
  /** whatever was staged on the draft, sealed rather than sent */
  attachment?: MessageAttachment;
}

/**
 * One addressee's copy of a one-time secret.
 *
 * A copy per handle rather than one shared record, because each addressee opens
 * their own and opens it once: three people sharing one "revealed" flag would
 * mean the first to look spends everybody's, and the sender would learn that
 * *somebody* collected without learning who. Every copy of the same `/once`
 * shares its `secretId`; the addressee is what tells them apart.
 *
 * The plaintext lives here and nowhere else — never on the card, because a card
 * is transcript and a transcript that holds the secret has already broken the
 * only promise `/once` makes. {@link revealSecret} hands it out once and drops
 * it in the same breath, so "only once" is a property of the store rather than
 * a rule the UI is trusted to follow.
 */
export interface SealedSecret {
  /** the `/once` that created it, shared across its addressees */
  secretId: string;
  /** whose copy this is. `me` on one that arrived */
  toId: string;
  /**
   * The payload, until it is opened. Absent on one the user sent: `/once` seals
   * to each recipient's key, so the sender's own client cannot open it either,
   * and keeping a copy to show them would make that claim a lie.
   */
  payload?: SealedPayload;
  /**
   * The same payload, held **only** so that one device can act out the other
   * side of the exchange.
   *
   * A prototype crutch with a label on it, kept separate from `payload` rather
   * than folded into it so that nothing can read it by accident: `revealSecret`,
   * the path a real recipient takes, does not look at this field. In a
   * deployment the sending client holds nothing at all, which is the whole basis
   * of the guarantee — see {@link rehearseReveal}.
   */
  rehearsal?: SealedPayload;
  /** when it was opened. Set once, and never unset */
  revealedAt?: string;
  /** when it stops being openable, where the sender bounded it */
  expiresAt?: string;
  /** when the sender burned it unopened, per BRC-218 §5.18 */
  burnedAt?: string;
  createdAt: string;
}

/**
 * A message set aside, as a snapshot rather than a pointer.
 *
 * Kept as its own record because the thing being saved may not exist in the data
 * layer at all: a message the user sent this session lives in the thread's local
 * state, so a saved list built from ids alone would show four rows and a hole
 * where the fifth should be. Copying the line at save time also means the saved
 * list never re-reads a conversation to draw itself.
 */
export interface SavedMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  /** the line the row shows, already resolved from text, command or attachment */
  preview: string;
  createdAt: string;
  savedAt: string;
}

export interface TollRule {
  /** absent means "everyone in scope" */
  personId?: string;
  sats: number;
}

interface EffectsState {
  /** person ids the user has starred in Contacts */
  favourites: string[];
  walletTransactions: WalletTransaction[];
  certificates: IdentityCertificate[];
  subscriptions: Subscription[];
  delegations: DelegationRecord[];
  vouches: Vouch[];
  renounces: Renounce[];
  /** messages a moderator removed; the record of removal stays */
  deletedMessages: string[];
  /** rooms an admin has closed, keyed by conversation */
  closedRooms: Record<string, { byId: string; at: string }>;
  escrows: EscrowSide[];
  transfers: AssetTransfer[];
  /** one-time secrets, sealed until opened and empty afterwards */
  secrets: SealedSecret[];
  tolls: TollRule[];
  reach: Reach;
  /** what this client anchors for the messages you send */
  chainPolicy: ChainPolicy;
  /**
   * Per-conversation overrides of {@link chainPolicy}.
   *
   * A room and a one-to-one are not the same kind of record — a trade may want
   * its words provable where a group chat wants nothing kept — so the global
   * setting is a default rather than a rule. Absent means "follow the default",
   * which is why clearing an override deletes the key instead of writing the
   * default into it: a copied value would stop tracking the default silently.
   */
  conversationChainPolicy: Record<string, ChainPolicy>;
  /** messages the user has put aside to come back to */
  savedMessages: SavedMessage[];
  /**
   * Conversations where the user has agreed to write permanently, and the policy
   * they agreed under.
   *
   * The policy is stored rather than a bare flag so the agreement cannot outlive
   * what it was about: turn anchoring off and back on and the room asks again,
   * because "yes, permanently" said about last week's setting is not consent to
   * this week's.
   */
  permanenceAck: Record<string, ChainPolicy>;
  /**
   * People whose messages are muted, wherever they appear.
   *
   * Distinct from muting a conversation: one is "stop shouting about this room",
   * the other is "stop shouting about this person", and in a busy room they are
   * very different requests.
   */
  mutedPeople: string[];
  /** person ids whose key and certificate this client is watching */
  watches: string[];
  /** ids of messages carrying a `/request` the sender has withdrawn */
  withdrawnRequests: string[];
  /** ids of `/whois` cards whose lookup is still in flight */
  resolving: string[];
}

/**
 * Delegations matching the seeded `/delegate` and `/handoff` cards, so
 * `/revoke` has real certificates to choose between. Samir holds two, which is
 * the case BRC-218 section 5.12 cares about: the client must list them and
 * require a selection rather than guessing.
 */
const SEEDED_DELEGATIONS: DelegationRecord[] = [
  {
    serial: "9F2C41AB",
    personId: "hc-nadia",
    scope: "pay",
    perActionCapSats: 50,
    expiry: "30d",
    createdAt: "2026-07-30T11:47:00.000Z",
    revokedAt: "2026-07-30T12:04:00.000Z",
  },
  {
    serial: "44D1E0F7",
    personId: "hc-samir",
    scope: "thread:group-handcash-rails",
    perActionCapSats: 5000,
    expiry: "7d",
    threadId: "group-handcash-rails",
    createdAt: "2026-07-30T12:12:00.000Z",
  },
  {
    serial: "C81A5B34",
    personId: "hc-samir",
    scope: "pay,receipt",
    perActionCapSats: 2000,
    expiry: "14d",
    createdAt: "2026-07-30T12:16:00.000Z",
  },
  {
    serial: "7B03C9E1",
    personId: "sanne-verhoeven",
    scope: "thread:group-common-source",
    perActionCapSats: 13793103,
    expiry: "30d",
    threadId: "group-common-source",
    createdAt: "2026-07-26T11:35:00.000Z",
  },
];

/**
 * Messages worth having put aside, seeded so the list is not empty on arrival.
 *
 * Chosen as the two things people actually save: a date somebody committed to,
 * and an answer they will need again and would otherwise scroll for. Held as ids
 * and resolved below, so the text lives in one place and cannot drift from the
 * conversation it came from.
 */
const SAVED_SEED: { id: string; conversationId: string; savedAt: string }[] = [
  {
    id: "m-treechad-2",
    conversationId: "dm-tc-treechad",
    savedAt: "2026-07-29T11:20:00.000Z",
  },
  {
    id: "m-hcr-2",
    conversationId: "group-handcash-rails",
    savedAt: "2026-07-29T14:02:00.000Z",
  },
  {
    id: "m-austin-3",
    conversationId: "dm-austin",
    savedAt: "2026-07-30T08:41:00.000Z",
  },
  {
    id: "m-myc-9",
    conversationId: "group-mycelia-brixit",
    savedAt: "2026-07-31T16:15:00.000Z",
  },
  {
    id: "m-cs-7",
    conversationId: "group-common-source",
    savedAt: "2026-08-01T09:05:00.000Z",
  },
];

function seededSaved(): SavedMessage[] {
  return SAVED_SEED.flatMap(({ id, conversationId, savedAt }) => {
    const message = getChatMessages(conversationId).find(
      (entry) => entry.id === id,
    );
    // A seed naming a message that no longer exists is dropped rather than
    // rendered as an empty row: the transcript is the source of truth.
    if (!message) return [];
    return [
      {
        messageId: message.id,
        conversationId,
        senderId: message.senderId,
        preview: message.text,
        createdAt: message.createdAt,
        savedAt,
      },
    ];
  });
}

const INITIAL: EffectsState = {
  walletTransactions: [],
  certificates: [],
  subscriptions: [],
  delegations: SEEDED_DELEGATIONS,
  // Seeded so `/whois` shows reputation before the user vouches for anyone.
  vouches: [
    /* The BitCoin room gates on these three, so the people in it are people
       they have actually spoken for. A room whose own members fail its own
       vouch gate is a seed contradicting itself, not a demonstration. */
    ...["asgeir-oskarsson", "mohammad-jaber", "austin-rappaport", "oli-oskarsson", "me"].flatMap(
      (personId) =>
        ["siggi-oskarsson", "darren-kellenschwiler", "connor-murray"].map(
          (byPersonId) => ({
            personId,
            byPersonId,
            createdAt: "2026-06-02T09:00:00.000Z",
          }),
        ),
    ),
    { personId: "siggi-oskarsson", byPersonId: "darren-kellenschwiler", createdAt: "2026-06-02T09:00:00.000Z" },
    { personId: "darren-kellenschwiler", byPersonId: "siggi-oskarsson", createdAt: "2026-06-02T09:00:00.000Z" },
    { personId: "connor-murray", byPersonId: "siggi-oskarsson", createdAt: "2026-06-02T09:00:00.000Z" },
    { personId: "tc-treechad", createdAt: "2026-07-29T11:40:00.000Z" },
    { personId: "dan-kittredge", createdAt: "2026-07-27T14:49:00.000Z" },
    { personId: "tw-shruggr", createdAt: "2026-07-28T16:31:00.000Z" },
    /* Peers' vouches, so `/whois` shows reputation that is not just your own
       opinion reflected back at you. Notes are what the voucher actually
       stood behind, which is the part worth reading. */
    {
      personId: "tw-shruggr",
      byPersonId: "tw-randy",
      note: "Ran his indexer against mine for a month. Never once disagreed on a topic.",
      createdAt: "2026-06-18T10:12:00.000Z",
    },
    {
      personId: "tw-shruggr",
      byPersonId: "tc-treechad",
      note: "Answers the awkward questions in public. That is the whole test.",
      createdAt: "2026-07-02T08:41:00.000Z",
    },
    {
      personId: "tw-shruggr",
      byPersonId: "hc-brandon",
      note: "Shipped the overlay work he said he would, on the date he said.",
      createdAt: "2026-07-19T13:05:00.000Z",
    },
    {
      personId: "tc-kuro",
      byPersonId: "tc-treechad",
      note: "Charges a toll and is worth it.",
      createdAt: "2026-07-11T19:20:00.000Z",
    },
    {
      personId: "dan-kittredge",
      byPersonId: "marcel-van-silfhout",
      note: "Forty years of soil work behind every number he quotes.",
      createdAt: "2026-05-30T09:15:00.000Z",
    },
    {
      personId: "dan-kittredge",
      byPersonId: "isa-van-den-berg",
      note: "The grower network trusts him, which took a decade to earn.",
      createdAt: "2026-06-25T16:48:00.000Z",
    },
    {
      personId: "hc-brandon",
      byPersonId: "hc-nadia",
      note: "Wrote the cap rules we all argue from.",
      createdAt: "2026-07-05T11:30:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      note: "for saving bitcoin",
      createdAt: "2026-07-30T09:38:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "oli-oskarsson",
      note: "Teranode does what he said it would, at the numbers he said.",
      createdAt: "2026-06-03T10:15:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "mohammad-jaber",
      note: "Took the scaling problem apart and handed back something operable.",
      createdAt: "2026-06-17T14:20:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "connor-murray",
      note: "Held the line on unbounded blocks when it was unfashionable to.",
      createdAt: "2026-05-08T09:40:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "dylan-murray",
      note: "Gave dates for Teranode and then met them.",
      createdAt: "2026-07-01T11:05:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "tc-treechad",
      note: "Answers node questions from people outside the association, unpaid.",
      createdAt: "2026-06-24T16:30:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "hc-brandon",
      note: "The throughput work is why our per-action pricing is even arguable.",
      createdAt: "2026-07-09T13:12:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "austin-rappaport",
      note: "Reviewed my consensus code line by line and was right twice.",
      createdAt: "2026-07-18T08:55:00.000Z",
    },
    {
      personId: "siggi-oskarsson",
      byPersonId: "rhea-mensah",
      note: "Reads the paper before the roadmap, every time.",
      createdAt: "2026-05-29T15:45:00.000Z",
    },
    {
      personId: "darren-kellenschwiler",
      note: "for building the doorway to the metanet",
      createdAt: "2026-07-30T11:33:00.000Z",
    },
    {
      personId: "darren-kellenschwiler",
      byPersonId: "austin-rappaport",
      note: "The SDK is the reason our team shipped in weeks rather than quarters.",
      createdAt: "2026-06-11T10:05:00.000Z",
    },
    {
      personId: "darren-kellenschwiler",
      byPersonId: "hc-nadia",
      note: "Made cross-ecosystem payments a function call instead of a project.",
      createdAt: "2026-06-28T12:40:00.000Z",
    },
    {
      personId: "darren-kellenschwiler",
      byPersonId: "tw-shruggr",
      note: "Ships libraries other people can read, which is rarer than it sounds.",
      createdAt: "2026-07-06T09:20:00.000Z",
    },
    {
      personId: "darren-kellenschwiler",
      byPersonId: "rhea-mensah",
      note: "Turns a spec into something a developer can call without reading it.",
      createdAt: "2026-07-13T14:55:00.000Z",
    },
    {
      personId: "darren-kellenschwiler",
      byPersonId: "kenji-watanabe",
      note: "Fixed my integration on a Sunday and refused payment for it.",
      createdAt: "2026-07-20T17:10:00.000Z",
    },
    {
      personId: "asgeir-oskarsson",
      byPersonId: "connor-murray",
      note: "Gets businesses to sign, which is the only adoption metric that survives contact.",
      createdAt: "2026-05-15T09:30:00.000Z",
    },
    {
      personId: "asgeir-oskarsson",
      byPersonId: "mark-frederiks",
      note: "Understood our cooperative in one meeting and did not sell us anything we did not need.",
      createdAt: "2026-06-05T11:25:00.000Z",
    },
    {
      personId: "asgeir-oskarsson",
      byPersonId: "hc-samir",
      note: "Explains this to merchants without once saying the word blockchain.",
      createdAt: "2026-06-20T13:50:00.000Z",
    },
    {
      personId: "asgeir-oskarsson",
      byPersonId: "dylan-murray",
      note: "Brings back what customers actually said, not what we hoped they said.",
      createdAt: "2026-07-02T10:40:00.000Z",
    },
    {
      personId: "asgeir-oskarsson",
      byPersonId: "els-verheijen",
      note: "The only person in this space who has read a procurement process.",
      createdAt: "2026-07-11T15:15:00.000Z",
    },
    {
      personId: "asgeir-oskarsson",
      byPersonId: "tomas-lindqvist",
      note: "Turned a pilot into a contract twice this year.",
      createdAt: "2026-07-23T09:05:00.000Z",
    },
    {
      personId: "connor-murray",
      note: "for setting bitcoin in stone",
      createdAt: "2026-07-28T15:44:00.000Z",
    },
    {
      personId: "connor-murray",
      byPersonId: "siggi-oskarsson",
      note: "Argued for a fixed protocol when it cost him something to.",
      createdAt: "2026-05-02T10:10:00.000Z",
    },
    {
      personId: "connor-murray",
      byPersonId: "darren-kellenschwiler",
      note: "Kept the case coherent through the split, in public, for years.",
      createdAt: "2026-05-19T14:35:00.000Z",
    },
    {
      personId: "connor-murray",
      byPersonId: "tw-randy",
      note: "Stood up for Bitcoin Cash and for BSV when both were unpopular.",
      createdAt: "2026-06-08T16:20:00.000Z",
    },
    {
      personId: "connor-murray",
      byPersonId: "tw-utxo",
      note: "Wrote the arguments the rest of us quote.",
      createdAt: "2026-06-22T11:50:00.000Z",
    },
    {
      personId: "connor-murray",
      byPersonId: "tc-thoth",
      note: "Governance work nobody thanks you for, done anyway.",
      createdAt: "2026-07-04T09:45:00.000Z",
    },
    {
      personId: "connor-murray",
      byPersonId: "asgeir-oskarsson",
      note: "Protects the thing the business case depends on.",
      createdAt: "2026-07-15T13:25:00.000Z",
    },
    {
      personId: "connor-murray",
      byPersonId: "amara-okonkwo",
      note: "Made the stewardship argument to regulators in language they accepted.",
      createdAt: "2026-07-26T10:30:00.000Z",
    },
    {
      personId: "mohammad-jaber",
      byPersonId: "oli-oskarsson",
      note: "Alerts on lag rather than liveness, which caught the outage nobody else saw.",
      createdAt: "2026-06-14T08:30:00.000Z",
    },
    {
      personId: "mohammad-jaber",
      byPersonId: "dylan-murray",
      note: "Infra that is up when nobody is looking at it.",
      createdAt: "2026-06-30T12:15:00.000Z",
    },
    {
      personId: "mohammad-jaber",
      byPersonId: "siggi-oskarsson",
      note: "Made the Teranode test harness reproducible, which doubled its worth.",
      createdAt: "2026-07-12T15:40:00.000Z",
    },
    {
      personId: "mohammad-jaber",
      byPersonId: "kenji-watanabe",
      note: "Restored an index from cold in under an hour.",
      createdAt: "2026-07-22T09:55:00.000Z",
    },
    {
      personId: "austin-rappaport",
      byPersonId: "darren-kellenschwiler",
      note: "Keeps interfaces boring on purpose, which is a discipline.",
      createdAt: "2026-06-09T10:45:00.000Z",
    },
    {
      personId: "austin-rappaport",
      byPersonId: "rhea-mensah",
      note: "The identity helpers throw on a key change instead of swallowing it.",
      createdAt: "2026-06-26T14:05:00.000Z",
    },
    {
      personId: "austin-rappaport",
      byPersonId: "dylan-murray",
      note: "Wrote the migration and then wrote the rollback.",
      createdAt: "2026-07-10T11:30:00.000Z",
    },
    {
      personId: "austin-rappaport",
      byPersonId: "tw-shruggr",
      note: "Reviewed my overlay client without being asked.",
      createdAt: "2026-07-19T16:50:00.000Z",
    },
    {
      personId: "dylan-murray",
      byPersonId: "asgeir-oskarsson",
      note: "Gives dates and then holds himself to them in public.",
      createdAt: "2026-06-12T09:25:00.000Z",
    },
    {
      personId: "dylan-murray",
      byPersonId: "mohammad-jaber",
      note: "Ships the unglamorous half that makes the rest usable.",
      createdAt: "2026-07-03T13:40:00.000Z",
    },
    {
      personId: "dylan-murray",
      byPersonId: "austin-rappaport",
      note: "Ran my migration against a copy of mainnet before it went near production.",
      createdAt: "2026-07-17T10:20:00.000Z",
    },
    {
      personId: "dylan-murray",
      byPersonId: "lena-fischer",
      note: "Turned a roadmap into something the certificate work could plan around.",
      createdAt: "2026-07-24T15:10:00.000Z",
    },
    {
      personId: "oli-oskarsson",
      byPersonId: "siggi-oskarsson",
      note: "Fixes the cause at three in the morning rather than the symptom at nine.",
      createdAt: "2026-06-18T07:50:00.000Z",
    },
    {
      personId: "oli-oskarsson",
      byPersonId: "mohammad-jaber",
      note: "Caught a lying dashboard by going and looking.",
      createdAt: "2026-07-07T12:35:00.000Z",
    },
    {
      personId: "oli-oskarsson",
      byPersonId: "connor-murray",
      note: "Runs nodes the way you would want nodes run.",
      createdAt: "2026-07-14T14:45:00.000Z",
    },
    {
      personId: "oli-oskarsson",
      byPersonId: "tc-kuro",
      note: "Answered a reorg question from a stranger, thoroughly, for nothing.",
      createdAt: "2026-07-21T11:15:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tc-thoth",
      note: "Runs the manifest the rest of us resolve against.",
      createdAt: "2026-04-02T09:10:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tc-kuro",
      note: "Answered three of my questions before I asked the third.",
      createdAt: "2026-04-18T14:22:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tc-cranker",
      note: "Never once traded on being early.",
      createdAt: "2026-05-04T08:55:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tc-smartwatch",
      note: "Fixed my board without being asked and told nobody.",
      createdAt: "2026-05-21T17:40:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tc-j1pelaez",
      note: "Reads the spec before arguing about it, which is rare.",
      createdAt: "2026-06-02T12:05:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tw-randy",
      note: "Kept a promise that cost him something.",
      createdAt: "2026-06-14T10:30:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tw-shruggr",
      note: "The account number is his, and so is the work behind it.",
      createdAt: "2026-06-27T15:12:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tw-utxo",
      note: "Ships. Says when he has not.",
      createdAt: "2026-07-08T11:44:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "tw-mikey",
      note: "Called me wrong in public and was right.",
      createdAt: "2026-07-16T18:03:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "hc-brandon",
      note: "Cross-ecosystem work that just resolved, first try.",
      createdAt: "2026-07-21T09:26:00.000Z",
    },
    {
      personId: "tc-treechad",
      byPersonId: "hc-samir",
      note: "Explained tolls to a merchant better than I could.",
      createdAt: "2026-07-25T13:37:00.000Z",
    },
  ],
  /* Seeded so the renounce section, and the renounce-gate, have something to
     show before the user renounces anyone. Lin's key changed mid-quarter and
     the two claims read differently on purpose: one signed openly, one not. */
  deletedMessages: [],
  closedRooms: {},
  renounces: [
    {
      personId: "hc-lin",
      byPersonId: "tw-randy",
      public: true,
      reason: "Key changed mid-payment and no explanation since.",
      createdAt: "2026-07-24T10:05:00.000Z",
    },
    {
      personId: "hc-lin",
      byPersonId: "hc-nadia",
      public: false,
      reason: "Reissued the team's certificates quietly after the key change.",
      createdAt: "2026-07-26T15:40:00.000Z",
    },
    {
      personId: "tc-kuro",
      byPersonId: "tw-mikey",
      public: false,
      reason: "Took the toll and answered in one word, twice.",
      createdAt: "2026-07-18T09:22:00.000Z",
    },
  ],
  /*
   * A paired escrow with the user as the named agent.
   *
   * Both halves of an escrow need two people, and a prototype has one. Seeding
   * the case where we were asked to hold makes the half of the lifecycle that
   * cannot otherwise be reached — accept, hold, release — something you can
   * actually walk through.
   */
  escrows: [
    {
      id: "esc-seed-asset",
      conversationId: "group-hat-society",
      fromId: "tw-krambo",
      agentId: "me",
      assetId: "rare-hat-69",
      expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
      pairedWith: "esc-seed-money",
      status: "paired",
      createdAt: new Date(Date.now() - 600_000).toISOString(),
    },
    {
      id: "esc-seed-money",
      conversationId: "group-hat-society",
      fromId: "tw-elonmoist",
      agentId: "me",
      sats: 6_900_000_000,
      expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
      pairedWith: "esc-seed-asset",
      status: "paired",
      createdAt: new Date(Date.now() - 300_000).toISOString(),
    },
  ],
  transfers: [],
  /*
   * Both sides of `/once`, because each one shows something the other cannot.
   *
   * The inbound secret still holds its plaintext, so the reveal is walkable —
   * it is the only state the user can reach without a second device, since a
   * secret you sealed yourself is sealed to somebody else's key. The outbound
   * one carries no plaintext and a reveal time, which is the sender's half:
   * you learn that it was opened, and that is all you learn.
   */
  secrets: [
    {
      secretId: "sec-seed-inbound",
      toId: "me",
      payload: { text: "hc_sbx_9f2c41ab7e0d4a68" },
      createdAt: "2026-07-29T15:41:00.000Z",
    },
    /* A passphrase and the file it opens, in one seal. The case that makes the
       verb worth having for anything larger than a password: the document is
       the secret, and a thread is the last place it should live. */
    {
      secretId: "sec-seed-doc",
      toId: "me",
      payload: {
        text: "annex-4-draft-2f1a",
        attachment: {
          kind: "media",
          items: mediaItems("annexDraft", "fieldRecording"),
        },
      },
      createdAt: "2026-07-29T16:20:00.000Z",
    },
    {
      secretId: "sec-seed-outbound",
      toId: "hc-brandon",
      revealedAt: "2026-07-29T16:07:00.000Z",
      createdAt: "2026-07-29T15:58:00.000Z",
    },
    /* Three addressees, one collected. The state a single record could not
       represent, and the reason `/cancel` on a `/once` has to report what it
       could not reach: Lin has it, and burning the other two does not change
       that. Still openable, so it is also the walkable multi-handle case. */
    {
      secretId: "sec-seed-room",
      toId: "hc-lin",
      revealedAt: "2026-07-30T12:31:00.000Z",
      createdAt: "2026-07-30T12:22:00.000Z",
    },
    /* `rehearsal` rather than `payload` on the two still waiting: this is the
       user's own seal, so the real path cannot open it, and these exist only so
       the far side is demonstrable on one device. */
    {
      secretId: "sec-seed-room",
      toId: "hc-nadia",
      rehearsal: { text: "hc_stg_4d81c0b7a2e95f36" },
      createdAt: "2026-07-30T12:22:00.000Z",
    },
    {
      secretId: "sec-seed-room",
      toId: "hc-samir",
      rehearsal: { text: "hc_stg_4d81c0b7a2e95f36" },
      createdAt: "2026-07-30T12:22:00.000Z",
    },
  ],
  /* Two per-sender tolls, seeded. A row that only ever says "none" cannot
     teach what the feature is, and these are the case it exists for: someone
     persistent, and someone who once cost you an afternoon. */
  tolls: [
    { personId: "tw-elonmoist", sats: 5000 },
    { personId: "tc-cranker", sats: 1000 },
  ],
  // Seeded from the handles with the most peer attestations — the people you
  // would actually transact with.
  favourites: ["tc-treechad", "tw-utxo", "tw-randy", "hc-brandon", "mark-frederiks"],
  /*
   * A toll, not an open door.
   *
   * "Everyone" is the answer a messaging app gives when it has nothing to charge
   * with, and this one does — a stranger attaching a cent is the whole argument
   * for a messagebox that settles on chain. Shipping open by default made the
   * feature something you had to go and find, and left the default inbox the
   * same inbox everybody already has.
   */
  reach: "toll",
  /* Receipts rather than messages: a default that anchors everything you say
     makes an irreversible choice on the user's behalf, and one that anchors
     nothing leaves them unable to prove a delivery they may need to. */
  chainPolicy: "receipts",
  conversationChainPolicy: {},
  savedMessages: seededSaved(),
  permanenceAck: {},
  mutedPeople: [],
  watches: [],
  withdrawnRequests: [],
  resolving: [],
};

let state: EffectsState = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeEffects(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEffects(): EffectsState {
  return state;
}

/** Server render sees no session effects, which keeps hydration stable. */
export function getEffectsServerSnapshot(): EffectsState {
  return INITIAL;
}

function nextPeriodRun(period: Subscription["period"], from: Date): string {
  const next = new Date(from);
  if (period === "day") next.setUTCDate(next.getUTCDate() + 1);
  if (period === "week") next.setUTCDate(next.getUTCDate() + 7);
  if (period === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

/** Deterministic-looking txid for a prototype transaction. */
function fakeTxid(seed: string): string {
  let hash = 2166136261;
  let out = "";
  for (let i = 0; out.length < 64; i += 1) {
    hash = (hash ^ (seed.charCodeAt(i % seed.length) + i)) * 16777619;
    out += (hash >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

export function recordPayment({
  person,
  sats,
  memo,
  accountId,
  token,
}: {
  person: MessagePerson;
  sats: number;
  memo: string;
  accountId: string;
  /** set for a token transfer; absent means BSV */
  token?: { id: string; units: number } | undefined;
}): WalletTransaction {
  const now = new Date().toISOString();
  const tx: WalletTransaction = {
    id: `cmd-tx-${listeners.size}-${now}`,
    accountId,
    txid: fakeTxid(`${person.id}${sats}${now}`),
    direction: "outgoing",
    amountSatoshis: sats,
    ...(token ? { tokenId: token.id, amountUnits: token.units } : {}),
    // The network fee is always paid in satoshis, even for a token transfer.
    feeSatoshis: 1,
    counterparty: person.name,
    memo,
    // Unbroadcast on delivery per BRC-169 section 6, so it starts pending.
    status: "pending",
    confirmations: 0,
    createdAt: now,
  };
  state = { ...state, walletTransactions: [tx, ...state.walletTransactions] };
  emit();
  return tx;
}

export function recordCertificate(
  certificate: Omit<IdentityCertificate, "id" | "issuedAt">,
): IdentityCertificate {
  const now = new Date().toISOString();
  const record: IdentityCertificate = {
    ...certificate,
    id: `cmd-cert-${state.certificates.length}-${now}`,
    issuedAt: now,
  };
  state = { ...state, certificates: [record, ...state.certificates] };
  emit();
  return record;
}

export function recordSubscription({
  personId,
  amountSats,
  fiat,
  period,
}: {
  personId: string;
  amountSats: number;
  fiat?: { currency: string; amount: number };
  period: Subscription["period"];
}): Subscription {
  const now = new Date();
  const record: Subscription = {
    id: `sub-${personId}-${now.toISOString()}`,
    personId,
    amountSats,
    ...(fiat ? { fiat } : {}),
    period,
    nextRunAt: nextPeriodRun(period, now),
    createdAt: now.toISOString(),
  };
  state = { ...state, subscriptions: [record, ...state.subscriptions] };
  emit();
  return record;
}

export function cancelSubscription(id: string): void {
  state = {
    ...state,
    subscriptions: state.subscriptions.filter((s) => s.id !== id),
  };
  emit();
}

export function recordDelegation(
  record: Omit<DelegationRecord, "createdAt">,
): DelegationRecord {
  const full: DelegationRecord = {
    ...record,
    createdAt: new Date().toISOString(),
  };
  state = { ...state, delegations: [full, ...state.delegations] };
  emit();
  return full;
}

/**
 * Mark a delegation revoked. The spend is what actually revokes it and that is
 * only *detectable*, so callers must not report the delegate as unable to act.
 */
export function revokeDelegation(serial: string): void {
  const now = new Date().toISOString();
  state = {
    ...state,
    delegations: state.delegations.map((d) =>
      d.serial === serial ? { ...d, revokedAt: now } : d,
    ),
  };
  emit();
}

export function recordVouch(personId: string, note?: string): Vouch {
  const vouch: Vouch = {
    personId,
    ...(note ? { note } : {}),
    createdAt: new Date().toISOString(),
  };
  state = { ...state, vouches: [vouch, ...state.vouches] };
  emit();
  return vouch;
}

/** How many vouches this handle carries, for `/whois` to report. */
export function vouchesFor(personId: string): Vouch[] {
  return state.vouches.filter((v) => v.personId === personId);
}

export function recordRenounce(
  personId: string,
  { reason, isPublic }: { reason?: string | undefined; isPublic: boolean },
): Renounce {
  const renounce: Renounce = {
    personId,
    public: isPublic,
    ...(reason ? { reason } : {}),
    createdAt: new Date().toISOString(),
  };
  state = { ...state, renounces: [renounce, ...state.renounces] };
  emit();
  return renounce;
}

/**
 * Who has renounced this handle, for the profile pane and the renounce gate.
 *
 * Room-scoped statements are excluded. A ban from one room says nothing about
 * a person in general, and letting it show on their profile — or gate them out
 * of an unrelated room — would turn one moderator's decision into a reputation
 * they carry everywhere.
 */
export function renouncesFor(personId: string): Renounce[] {
  return state.renounces.filter((r) => r.personId === personId && !r.scope);
}

/** The ban against someone in a room, where one has been written. */
export function roomBan(
  conversationId: string,
  personId: string,
): Renounce | undefined {
  const scope = roomScope(conversationId);
  return state.renounces.find(
    (r) => r.personId === personId && r.scope === scope,
  );
}

/** Everyone banned from a room, most recent first. */
export function roomBans(conversationId: string): Renounce[] {
  const scope = roomScope(conversationId);
  return state.renounces.filter((r) => r.scope === scope);
}

/**
 * Ban someone from a room, or lift the ban.
 *
 * Attributed always. Section 10.7.1 of BRC-169 makes a general statement
 * unattributed by default because speaking against somebody carries a risk;
 * a moderator acting inside a room they moderate is in the opposite position,
 * and an anonymous ban is an exclusion nobody can be held to.
 */
export function setRoomBan(
  conversationId: string,
  personId: string,
  banned: boolean,
  reason?: string,
): void {
  const scope = roomScope(conversationId);
  const without = state.renounces.filter(
    (r) => !(r.personId === personId && r.scope === scope),
  );
  state = {
    ...state,
    renounces: banned
      ? [
          {
            personId,
            byPersonId: "me",
            public: true,
            scope,
            ...(reason ? { reason } : {}),
            createdAt: new Date().toISOString(),
          },
          ...without,
        ]
      : without,
  };
  emit();
}

/** Messages a moderator has removed, by id. */
export function deletedMessages(): string[] {
  return state.deletedMessages;
}

export function deleteMessage(messageId: string): void {
  if (state.deletedMessages.includes(messageId)) return;
  state = {
    ...state,
    deletedMessages: [...state.deletedMessages, messageId],
  };
  emit();
}

/** A room an admin has closed, with who closed it. */
export function roomClosure(
  conversationId: string,
): { byId: string; at: string } | undefined {
  return state.closedRooms[conversationId];
}

export function closeRoom(conversationId: string, byId: string): void {
  state = {
    ...state,
    closedRooms: {
      ...state.closedRooms,
      [conversationId]: { byId, at: new Date().toISOString() },
    },
  };
  emit();
}

export function delegationsFor(personId: string): DelegationRecord[] {
  return state.delegations.filter(
    (d) => d.personId === personId && !d.revokedAt,
  );
}

/**
 * Set or lift a toll. Lifting the general toll leaves per-sender tolls in
 * place, which BRC-218 section 5.10(3) requires the client to say out loud.
 */
export function setToll(personId: string | undefined, sats: number | null): void {
  const others = state.tolls.filter((t) => t.personId !== personId);
  state = {
    ...state,
    tolls: sats === null ? others : [...others, { ...(personId ? { personId } : {}), sats }],
  };
  emit();
}

export function toggleFavourite(personId: string): boolean {
  const has = state.favourites.includes(personId);
  state = {
    ...state,
    favourites: has
      ? state.favourites.filter((id) => id !== personId)
      : [...state.favourites, personId],
  };
  emit();
  return !has;
}

/**
 * Start or stop watching a handle for a key change or a revoked certificate.
 *
 * BRC-169 section 4.4 makes a key change a security event, but a client only
 * notices one when the user happens to interact. A watch is this client
 * checking on their behalf, which is why it is an ecosystem command rather
 * than a global one: who runs the watcher differs by ecosystem.
 */
export function toggleWatch(personId: string): boolean {
  const has = state.watches.includes(personId);
  state = {
    ...state,
    watches: has
      ? state.watches.filter((id) => id !== personId)
      : [...state.watches, personId],
  };
  emit();
  return !has;
}

/** Withdraw a request, by the id of the message that carries it. */
export function withdrawRequest(messageId: string): void {
  if (state.withdrawnRequests.includes(messageId)) return;
  state = {
    ...state,
    withdrawnRequests: [...state.withdrawnRequests, messageId],
  };
  emit();
}

/**
 * Mark a `/whois` card as still resolving, and clear it when the lookup would
 * have landed.
 *
 * Held here rather than in the component because the answer is "when was this
 * issued", and a component may not read the clock while rendering. It also
 * means a card scrolled back to tomorrow shows what it found rather than
 * pretending to look it up again.
 */
export function beginResolving(messageId: string, ms: number): void {
  state = { ...state, resolving: [...state.resolving, messageId] };
  emit();
  setTimeout(() => {
    state = {
      ...state,
      resolving: state.resolving.filter((id) => id !== messageId),
    };
    emit();
  }, ms);
}

/** Hand a collectible to someone, settling as its own transaction. */
export function recordTransfer(
  assetId: string,
  toId: string,
  fromId = "me",
): AssetTransfer {
  const entry: AssetTransfer = {
    assetId,
    fromId,
    toId,
    txid: fakeTxid(`${assetId}${toId}${state.transfers.length}`),
    createdAt: new Date().toISOString(),
  };
  state = { ...state, transfers: [...state.transfers, entry] };
  emit();
  return entry;
}

/**
 * Commit one side of an escrow, pairing it with a waiting opposite if there is
 * one.
 *
 * Pairing is deterministic: the **earliest** unmatched opposite side to the
 * same agent, for the same amount. Two offers of 69 sats to one agent are
 * otherwise indistinguishable, and an agent left to guess which payment
 * answers which asset is an agent who will eventually guess wrong.
 */
export function recordEscrowSide(
  side: Omit<EscrowSide, "id" | "status" | "createdAt" | "pairedWith">,
): { side: EscrowSide; paired?: EscrowSide } {
  const now = new Date();
  const wantsAsset = side.assetId === undefined;
  const match = state.escrows
    .filter(
      (other) =>
        other.status === "open" &&
        other.agentId === side.agentId &&
        other.fromId !== side.fromId &&
        new Date(other.expiresAt) > now &&
        // One side carries the thing, the other the money.
        (other.assetId === undefined) !== wantsAsset &&
        (other.sats ?? side.sats) === (side.sats ?? other.sats),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  const entry: EscrowSide = {
    ...side,
    id: `esc-${state.escrows.length + 1}-${now.getTime()}`,
    status: match ? "paired" : "open",
    createdAt: now.toISOString(),
    ...(match ? { pairedWith: match.id } : {}),
  };
  const escrows = state.escrows.map((other) =>
    match && other.id === match.id
      ? { ...other, status: "paired" as const, pairedWith: entry.id }
      : other,
  );
  state = { ...state, escrows: [...escrows, entry] };
  emit();
  return match ? { side: entry, paired: { ...match, status: "paired" } } : { side: entry };
}

/** Move an escrow and its partner to a new state. */
export function setEscrowStatus(id: string, status: EscrowSide["status"]): void {
  const side = state.escrows.find((e) => e.id === id);
  if (!side) return;
  const ids = new Set([id, side.pairedWith].filter(Boolean) as string[]);
  state = {
    ...state,
    escrows: state.escrows.map((e) => (ids.has(e.id) ? { ...e, status } : e)),
  };
  emit();
}

export function escrowById(id: string): EscrowSide | undefined {
  return state.escrows.find((e) => e.id === id);
}

/** Sides whose window has closed without ever pairing. */
export function expiredEscrows(nowIso: string): EscrowSide[] {
  return state.escrows.filter(
    (e) => e.status === "open" && e.expiresAt <= nowIso,
  );
}

/**
 * Seal a one-time secret to one or more handles, a copy each.
 *
 * `plaintext` is omitted for one the user sent. Nothing here encrypts anything
 * — this is a prototype — but the shape has to match what the verb promises,
 * because a store that quietly keeps the sender a copy would let the UI grow an
 * affordance to show it, and then `/once` would mean something else.
 */
export function sealSecret({
  secretId,
  toIds,
  payload,
  rehearsal,
  expiresAt,
}: {
  secretId: string;
  toIds: string[];
  payload?: SealedPayload | undefined;
  rehearsal?: SealedPayload | undefined;
  expiresAt?: string | undefined;
}): SealedSecret[] {
  const createdAt = new Date().toISOString();
  const copies: SealedSecret[] = toIds.map((toId) => ({
    secretId,
    toId,
    ...(payload ? { payload } : {}),
    ...(rehearsal ? { rehearsal } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    createdAt,
  }));
  state = { ...state, secrets: [...state.secrets, ...copies] };
  emit();
  return copies;
}

/**
 * Spend one addressee's copy, and drop both the payload and the rehearsal of it.
 *
 * The two callers differ only in which field they are allowed to read, so the
 * dropping happens in one place: whichever door the secret leaves by, nothing
 * behind it survives.
 */
function openCopy(
  secretId: string,
  toId: string,
  from: "payload" | "rehearsal",
): SealedPayload | null {
  const secret = secretCopy(secretId, toId);
  if (!secret || secret.revealedAt || secret.burnedAt) return null;
  if (secret.expiresAt && secret.expiresAt <= new Date().toISOString()) {
    return null;
  }
  const value = secret[from];
  if (!value) return null;
  state = {
    ...state,
    secrets: state.secrets.map((entry) =>
      entry.secretId === secretId && entry.toId === toId
        ? {
            secretId: entry.secretId,
            toId: entry.toId,
            createdAt: entry.createdAt,
            ...(entry.expiresAt ? { expiresAt: entry.expiresAt } : {}),
            revealedAt: new Date().toISOString(),
          }
        : entry,
    ),
  };
  emit();
  return value;
}

/** Everything sealed by one `/once`, one entry per addressee. */
export function secretsFor(secretId: string): SealedSecret[] {
  return state.secrets.filter((entry) => entry.secretId === secretId);
}

/** One addressee's copy. */
export function secretCopy(
  secretId: string,
  toId: string,
): SealedSecret | undefined {
  return state.secrets.find(
    (entry) => entry.secretId === secretId && entry.toId === toId,
  );
}

/**
 * Open one addressee's copy, and spend it.
 *
 * Returns the plaintext on the first call and `null` on every call after,
 * because the plaintext is dropped here rather than merely hidden. The caller
 * therefore holds the only copy that exists, for as long as it keeps it in
 * memory — which is why the reveal lives in a panel that unmounts.
 *
 * A burned or lapsed copy returns `null` too. Both are checked here rather than
 * trusted to the button being hidden: the store is the thing that has to be
 * unable to serve the secret, not the UI that has to remember not to ask.
 */
export function revealSecret(
  secretId: string,
  toId: string,
): SealedPayload | null {
  return openCopy(secretId, toId, "payload");
}

/**
 * Open a copy **as its addressee would**, because there is only one device here.
 *
 * Reads `rehearsal` rather than `payload`, so it can only ever open a seal this
 * client sent — which is the case a real recipient's client could never be in.
 * It exists to make the far side of the exchange demonstrable, and every caller
 * has to say so on screen: the sender learning the contents is the one thing
 * `/once` is built to prevent, and an affordance that does it silently would
 * teach the wrong lesson about what the verb guarantees.
 */
export function rehearseReveal(
  secretId: string,
  toId: string,
): SealedPayload | null {
  return openCopy(secretId, toId, "rehearsal");
}

/**
 * Burn whatever nobody has opened yet, per BRC-218 §5.18.
 *
 * Returns how many copies it caught and how many were already open, because
 * that is the only honest thing to report: a `/cancel` on a secret two of three
 * people have already read has not undone anything for those two, and a card
 * saying "burned" full stop would say it had.
 */
export function burnSecret(secretId: string): {
  burned: number;
  alreadyOpen: number;
} {
  const copies = secretsFor(secretId);
  const burnedAt = new Date().toISOString();
  const open = copies.filter((entry) => entry.revealedAt).length;
  const target = copies.filter((entry) => !entry.revealedAt && !entry.burnedAt);
  if (target.length === 0) return { burned: 0, alreadyOpen: open };
  state = {
    ...state,
    secrets: state.secrets.map((entry) =>
      entry.secretId === secretId && !entry.revealedAt && !entry.burnedAt
        ? {
            // Payload and rehearsal both gone: burning has to mean burned, and
            // a demo affordance that outlived it would say otherwise.
            secretId: entry.secretId,
            toId: entry.toId,
            createdAt: entry.createdAt,
            burnedAt,
          }
        : entry,
    ),
  };
  emit();
  return { burned: target.length, alreadyOpen: open };
}

export function setReach(reach: Reach): void {
  state = { ...state, reach };
  emit();
}

/*
 * The one thing in this store that outlives the session.
 *
 * Everything else here is the effect of a command you ran a moment ago, and
 * resetting on reload is honest about that. What you anchor is not an effect,
 * it is a preference — and one that silently reverted to the default after a
 * refresh would be worse than not offering it, because the user would go on
 * believing their choice was in force.
 */
interface StoredChainPolicy {
  global: ChainPolicy;
  perConversation: Record<string, ChainPolicy>;
}

const POLICIES: ChainPolicy[] = ["messages", "receipts", "nothing"];
const isPolicy = (value: unknown): value is ChainPolicy =>
  POLICIES.includes(value as ChainPolicy);

function writeChainPolicy(): void {
  try {
    const payload: StoredChainPolicy = {
      global: state.chainPolicy,
      perConversation: state.conversationChainPolicy,
    };
    window.localStorage.setItem(
      storageKeys.chainPolicy,
      JSON.stringify(payload),
    );
  } catch {
    /* storage unavailable — the session's choice still stands */
  }
}

let hydrated = false;

/**
 * Load the saved policy, once, after mount.
 *
 * Deliberately not read at module load: the server snapshot has no localStorage
 * to read, so an initial state that depended on it would differ between the two
 * renders and React would report a hydration mismatch. Applying it in an effect
 * costs one extra render of a single icon and is impossible to get wrong.
 */
export function hydrateChainPolicy(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(storageKeys.chainPolicy);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<StoredChainPolicy>;
    const perConversation = Object.fromEntries(
      Object.entries(saved.perConversation ?? {}).filter(([, value]) =>
        isPolicy(value),
      ),
    ) as Record<string, ChainPolicy>;
    state = {
      ...state,
      ...(isPolicy(saved.global) ? { chainPolicy: saved.global } : {}),
      conversationChainPolicy: perConversation,
    };
    emit();
  } catch {
    /* unreadable payload — the default stands rather than throwing */
  }
}

export function setChainPolicy(chainPolicy: ChainPolicy): void {
  state = { ...state, chainPolicy };
  writeChainPolicy();
  emit();
}

/** Set a conversation's own policy, or `null` to follow the default again. */
export function setConversationChainPolicy(
  conversationId: string,
  policy: ChainPolicy | null,
): void {
  const next = { ...state.conversationChainPolicy };
  if (policy === null) delete next[conversationId];
  else next[conversationId] = policy;
  state = { ...state, conversationChainPolicy: next };
  writeChainPolicy();
  emit();
}

/**
 * Whether this conversation still owes an agreement before it writes for good.
 *
 * Only ever true where messages are being anchored: the other two settings are
 * reversible, and asking somebody to confirm something they can undo is how a
 * confirmation stops being read.
 */
export function needsPermanenceAck(conversationId: string): boolean {
  const policy = chainPolicyFor(conversationId);
  if (policy !== "messages") return false;
  return state.permanenceAck[conversationId] !== "messages";
}

export function acknowledgePermanence(conversationId: string): void {
  state = {
    ...state,
    permanenceAck: {
      ...state.permanenceAck,
      [conversationId]: chainPolicyFor(conversationId),
    },
  };
  emit();
}

/** What is actually in force for a conversation: its own policy, or the default. */
export function chainPolicyFor(conversationId?: string): ChainPolicy {
  if (conversationId && state.conversationChainPolicy[conversationId]) {
    return state.conversationChainPolicy[conversationId]!;
  }
  return state.chainPolicy;
}

export function isMessageSaved(messageId: string): boolean {
  return state.savedMessages.some((entry) => entry.messageId === messageId);
}

/** Put a message aside, or take it back off the list. Returns the new state. */
export function toggleSavedMessage(
  message: Omit<SavedMessage, "savedAt">,
): boolean {
  const has = isMessageSaved(message.messageId);
  state = {
    ...state,
    savedMessages: has
      ? state.savedMessages.filter(
          (entry) => entry.messageId !== message.messageId,
        )
      : // Newest first, so the list reads like the order they were put aside in
        // rather than the order the conversations happened in.
        [{ ...message, savedAt: new Date().toISOString() }, ...state.savedMessages],
  };
  emit();
  return !has;
}

export function unsaveMessage(messageId: string): void {
  state = {
    ...state,
    savedMessages: state.savedMessages.filter(
      (entry) => entry.messageId !== messageId,
    ),
  };
  emit();
}

export function togglePersonMute(personId: string): boolean {
  const has = state.mutedPeople.includes(personId);
  state = {
    ...state,
    mutedPeople: has
      ? state.mutedPeople.filter((id) => id !== personId)
      : [...state.mutedPeople, personId],
  };
  emit();
  return !has;
}

/**
 * The transaction a message is anchored in, where the policy anchors messages.
 *
 * Derived from the id rather than stored, because in a prototype there is no
 * chain to ask — but it has to be stable, or the same message would offer a
 * different transaction every render and the link would be visibly fictional.
 */
export function anchorTxid(messageId: string): string {
  return fakeTxid(`anchor-${messageId}`);
}

/** Reset between tests or profile switches. */
export function resetEffects(): void {
  state = INITIAL;
  emit();
}
