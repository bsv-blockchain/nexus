/**
 * BRC-218 chat-native command grammar.
 *
 * Fifteen verbs are fully specified and behave identically in every conforming
 * client; five more are reserved without specification and MUST be reported as
 * unsupported rather than given local behaviour.
 *
 * Two rules from the spec shape this module more than any other:
 *
 *  - **Received text is never executable** (section 2.4). Only input the user
 *    composed locally is ever parsed. Nothing here is applied to inbound
 *    message content, display names, memos or search results, because doing so
 *    would hand every counterparty the ability to spend the recipient's money.
 *  - **Parsing has no side effects** (section 2.6). `parseCommand` is pure; a
 *    command takes effect only after the confirmation step.
 */
import {
  getCollectibles,
  getEcosystems,
  getMessagePeople,
  getTokenBySymbol,
  type Collectible,
  type CommandVerb,
  type CustomVerb,
  type EcosystemId,
  type MessagePerson,
  type ReservedVerb,
} from "@/lib/data";
import { confusabilitySkeleton, fiatToSats } from "@/lib/messages";

/* -------------------------------------------------------------- registry */

export type ArgKind =
  | "recipient"
  | "recipients"
  | "amount"
  | "optional-amount"
  | "duration"
  | "period"
  | "scope"
  | "reach"
  | "text"
  | "serial"
  | "command"
  | "amount-or-off"
  /** an optional `p`/`public` marker, ahead of the recipient — /renounce */
  | "visibility"
  /** `#slug`, naming a collectible the user holds */
  | "asset"
  /**
   * The payload of `/once`: one token, or a quoted run for a passphrase that
   * has spaces in it.
   *
   * The only argument in the grammar that is free text without being the *last*
   * free text — a `/once` carries a secret and a note, and the note is the half
   * that is meant to stay readable. Section 2.3 has no shape for that, which is
   * why quoting exists here and nowhere else.
   */
  | "secret";

export interface CommandSpec {
  verb: CommandVerb | ReservedVerb | CustomVerb;
  /** grammar line as written in BRC-218 */
  usage: string;
  summary: string;
  /** BRC-218 section that defines it */
  section: string;
  /**
   * Moves value, issues or revokes a certificate, or changes a reachability
   * policy — so section 4.1 requires a structured confirmation first.
   */
  confirms: boolean;
  /** applies to the message being replied to (section 4.6) */
  binds?: "required" | "optional";
  /** reserved in section 6: parse it, refuse to run it */
  reserved?: boolean;
  /**
   * Defined by this ecosystem rather than BRC-218. Surfaced as such so nobody
   * mistakes it for a verb every conforming client implements.
   */
  custom?: boolean;
  /**
   * A specified global verb this client declines to implement. Section 5 allows
   * declining; section 2.5 still requires reporting it as unsupported rather
   * than reassigning its meaning, so it stays registered but is not offered.
   */
  unimplemented?: boolean;
  /**
   * What the summary has no room for: how the command behaves, what it costs
   * you, and where it can bite. Shown when a reader opens the command in
   * `/help`, so the one-line summary can stay a one-line summary.
   */
  detail: string;
  /** a realistic invocation, for readers who learn faster from one */
  example?: string;
  args: ArgKind[];
}

export const COMMANDS: CommandSpec[] = [
  {
    verb: "pay",
    usage: "/pay <recipient…> <amount> [memo]",
    summary: "Send satoshis, fiat or a token. Several handles divide the amount.",
    section: "5.1",
    confirms: true,
    detail:
      "One amount to one handle, or to several. Name more than one and the amount divides between them, as a separate payment each — the amount you type is what leaves your wallet either way, which is the point: you are budgeting, not multiplying. Division that does not come out even puts the remainder on the first handle you wrote, so both sides can work out who got the extra satoshi. The amount can be satoshis, a fiat figure your wallet converts, or a token, and nothing moves until you confirm the sheet.",
    example: "/pay @nexus 5000 sats for the venue deposit",
    args: ["recipients", "amount", "text"],
  },
  {
    verb: "message",
    usage: "/message <recipient> <text>",
    summary: "Send a message, including first contact across ecosystems.",
    section: "5.2",
    confirms: false,
    unimplemented: true,
    detail:
      "Opens a conversation with a handle you have never messaged, across ecosystems. Nexus does not run it: you already have a composer, and a second way to start a chat would be a second place for it to go wrong. Typing it reports it as unsupported rather than quietly doing something else.",
    args: ["recipient", "text"],
  },
  {
    verb: "request",
    usage: "/request <recipient> <amount> [memo]",
    summary: "Ask someone to pay you. Nothing moves until they confirm it.",
    section: "5.3",
    confirms: true,
    detail:
      "An invoice, not a charge. The recipient sees what you are asking for and why, and decides. Nothing moves on your say-so, so a request costs the other side nothing but attention.",
    example: "/request @nexus 25000 sats annex printing",
    args: ["recipient", "amount", "text"],
  },
  {
    verb: "tip",
    usage: "/tip [amount]",
    summary: "Pay the sender of the message you replied to.",
    section: "5.4",
    confirms: true,
    binds: "required",
    detail:
      "Pays whoever wrote the message you replied to, so you never have to type their handle or worry about tipping the wrong person. Reply to a message first: without one there is no recipient, and guessing at the last speaker is exactly the wrong guess to make with money.",
    example: "/tip 500 sats",
    args: ["optional-amount"],
  },
  {
    verb: "split",
    usage: "/split <recipient> <recipient…> <amount>",
    summary: "Divide one amount between several handles, as a payment each.",
    section: "5.5",
    confirms: true,
    detail:
      "One amount divided between the handles you name, sent as a separate payment to each. Division that does not come out even puts the remainder on the first recipient, in the order you wrote them, so both sides can work out who got the extra satoshi.",
    example: "/split @nexus @nexus2 9000 sats",
    args: ["recipients", "amount"],
  },
  {
    verb: "subscribe",
    usage: "/subscribe <recipient> <amount> <period>|off",
    summary: "Pay someone on a schedule. Your wallet runs it, and you can stop it.",
    section: "5.6",
    confirms: true,
    // `off` ends one. Without an interoperable form for stopping, every client
    // invents its own gesture and the counterparty learns nothing.
    detail:
      "A standing payment your own wallet runs on a schedule. Nobody pulls from you: the wallet pushes, and `off` in place of the amount stops it. Your client is where a subscription lives and dies, which is the difference between this and handing someone a card number.",
    example: "/subscribe @nexus 2000 sats /month",
    args: ["recipient", "amount-or-off", "period"],
  },
  {
    verb: "whois",
    usage: "/whois <recipient>",
    summary: "Look up who a handle really is, without paying or messaging them.",
    section: "5.7",
    confirms: false,
    detail:
      "Everything the network will say about a handle: which key it resolves to, who attests to that, when it was registered, whether the key has changed since you last saw it. Reads only. No payment, no message, and nothing tells them you looked.",
    example: "/whois @nexus",
    args: ["recipient"],
  },
  {
    verb: "attest",
    usage: "/attest <recipient>",
    summary: "Publicly confirm that a handle belongs to the key it claims.",
    section: "5.8",
    confirms: true,
    detail:
      "Your signature on one narrow claim: this handle resolves to this key, and I checked. It says nothing about whether they are worth dealing with. Your key is on it, so a careless attestation is a cost you carry.",
    example: "/attest @nexus",
    args: ["recipient"],
  },
  {
    verb: "scope",
    usage: "/scope everyone|contacts|ecosystem|toll [subhandle]",
    summary: "Choose who is allowed to message you at all.",
    section: "5.9",
    confirms: true,
    detail:
      "Who may reach you at all. `everyone` is open, `contacts` is your address book, `ecosystem` is your own ecosystem, and `toll` charges anyone outside it. Enforced at your messagebox rather than by the sender's client, so a sender who ignores it still gets nowhere.",
    example: "/scope contacts",
    args: ["reach", "recipient"],
  },
  {
    verb: "trolltoll",
    usage: "/trolltoll [recipient] <amount>|off",
    summary: "Charge strangers to message you, or turn the charge off.",
    section: "5.10",
    confirms: true,
    detail:
      "A price on your attention. Strangers attach it to every message, each time, and you keep it whether or not you reply. Setting a toll for one sender and setting the general toll are separate switches: turning one off leaves the other exactly as it was.",
    example: "/trolltoll 1000 sats",
    args: ["recipient", "amount-or-off"],
  },
  {
    verb: "delegate",
    usage: "/delegate <recipient> [scope] [amount] [duration]",
    summary: "Let someone act for you, within a scope, amount and time you set.",
    section: "5.11",
    confirms: true,
    // Grammar brackets every argument after the recipient.
    detail:
      "A signed certificate letting another key act as you, bounded by what you write into it: which commands, how much, for how long. Anything you leave out is a bound you did not set, so set them.",
    example: "/delegate @nexus pay 50000 sats 30d",
    args: ["recipient", "scope", "optional-amount", "duration"],
  },
  {
    verb: "revoke",
    usage: "/revoke <recipient> [serial]",
    summary: "Take back a certificate you issued to someone.",
    section: "5.12",
    confirms: true,
    detail:
      "Withdraws a certificate you issued. The serial picks one out when you have issued several to the same handle; without it the client asks which. Revocation is a claim you publish, not a switch you flip on their device, so it takes effect as fast as the other side checks.",
    example: "/revoke @nexus",
    args: ["recipient", "serial"],
  },
  {
    verb: "handoff",
    usage: "/handoff <recipient> [amount] [duration]",
    summary: "Hand this one conversation to someone while you are away.",
    section: "5.13",
    confirms: true,
    detail:
      "Hands one conversation to someone else while you are away, and only that one. They answer in your place under a certificate that expires. Scope it in time, because a handoff nobody remembers to end is a standing impersonation.",
    example: "/handoff @nexus 24h",
    args: ["recipient", "optional-amount", "duration"],
  },
  {
    verb: "sign",
    usage: "/sign [text]",
    summary:
      "Sign this message. Any files you attach are signed with it, or reply to sign that message instead.",
    section: "5.14",
    confirms: true,
    binds: "optional",
    detail:
      "Puts your key on what you are about to send. With no attachment it signs the message text; with one attachment it signs the file and the text together; with several it signs all of them and the text. Reply to a message instead and it signs that message, which is how you endorse something someone else wrote.",
    example: "/sign",
    args: ["text"],
  },
  {
    verb: "receipt",
    usage: "/receipt",
    summary: "Ask for proof they received it. They can decline, and silence proves nothing.",
    section: "5.15",
    confirms: false,
    binds: "optional",
    detail:
      "Asks the recipient's client to confirm delivery. They can decline, and a client that says nothing has not told you anything: no receipt is not evidence a message was missed.",
    args: [],
  },

  {
    verb: "refund",
    usage: "/refund [amount]",
    summary: "Send a payment back, linked to the one it returns.",
    section: "5.17",
    confirms: true,
    binds: "required",
    detail:
      "Nothing reverses on chain, so a refund is a new payment going the other way. Sent as a plain /pay it would be an unexplained transfer that neither side can reconcile; bound to the payment it returns, both clients can mark that one refunded. Leave the amount out to return all of it, or name one to return part.",
    example: "/refund 2000 sats",
    args: ["optional-amount"],
  },
  {
    verb: "cancel",
    usage: "/cancel",
    summary: "Withdraw a request you sent, or burn a secret nobody has opened.",
    section: "5.18",
    confirms: true,
    binds: "required",
    detail:
      "Takes back something of yours that is still outstanding. A request you sent sits in the other side's list until they pay it, and without this the only exits are paying and nagging. On a /once it burns the copies nobody has opened yet — the sealed wrong password is otherwise openable forever, and this is the only way to kill it. Anything already opened stays opened; nothing here reaches into somebody else's head.",
    args: [],
  },
  {
    verb: "standing",
    usage: "/standing",
    summary: "Show what is still acting for you. Only you see the reply.",
    section: "5.19",
    confirms: false,
    detail:
      "Every certificate you have signed, subscription you have started, toll you have set and handle you are watching, with the caps and expiry on each. These keep working without asking you again, which is exactly why they are easy to forget. Answered locally: nothing is sent and nobody else in the conversation sees it.",
    args: [],
  },
  {
    verb: "send",
    usage: "/send <recipient> #asset",
    summary: "Transfer a collectible you hold to another handle.",
    section: "5.20",
    confirms: true,
    detail:
      "Moves the thing itself, not a claim on it. The confirmation shows the artwork and the number so you are looking at what you are about to part with rather than reading its id, and the transfer settles as its own transaction you can open on chain. Name the asset with a hash and the start of its name: #egg69.",
    example: "/send @nexus #egg69",
    args: ["recipient", "asset"],
  },
  {
    verb: "escrow",
    usage: "/escrow <agent> [#asset] [amount] <duration>",
    summary: "Commit one side of a trade to a named agent, for a set time.",
    section: "5.21",
    confirms: true,
    detail:
      "You name someone to hold both sides. Commit the asset, or commit the payment, and the escrow forms when the other side commits the matching half to the same agent before either window closes. The agent then accepts, holds both, and releases. Nothing is arbitrated: if the agent absconds both sides lose, which is why the confirmation shows you what the network says about them before you commit.",
    example: "/escrow @nexus #egg69 69 bsv 2h",
    args: ["recipient", "asset", "optional-amount", "duration"],
  },
  {
    verb: "once",
    usage: "/once <recipient…> <secret> [duration] [note]",
    summary:
      "Seal a secret or a document each handle can open exactly once. Nobody opens it twice.",
    section: "5.22",
    confirms: true,
    detail:
      "A credential, a key, a passphrase, a contract, a recording: anything the transcript has no business keeping. Attach files and they go inside the seal rather than into the thread, which is the case that matters most — a document pasted into a room stays there forever. With something attached the secret becomes optional, and quoting it is what marks it as the secret rather than the start of the note. It is sealed to each recipient's key, so this client cannot open it either, which means a mistake cannot be resent, only burned and sealed again. Name several handles and each gets their own copy to open once, tracked separately, so you can see who has collected theirs. Five dots until it is opened and five hollow ones afterwards, on both sides, so opening it tells you it was opened whether they mention it or not. A duration bounds how long it stays openable; reply to your own /once with /cancel to burn whatever nobody has taken yet.",
    example: '/once @nexus "correct horse battery staple" 24h rotate it once you are in',
    args: ["recipients", "secret", "duration", "text"],
  },

  /* Nexus's own verbs, advertised per section 8. `/help` is listed first
     because it is the one command you can run without already knowing the
     grammar, and it answers locally: nothing is sent and nobody else sees it. */
  {
    verb: "help",
    usage: "/help [command]",
    summary: "List every command. Only shown to you.",
    section: "5.16",
    confirms: false,
    detail:
      "Lists every command this client knows, grouped by whether you can run it here. The reply is written by Nexus into this chat for you alone. It is not sent, nobody else in the conversation receives it, and no agent in the room can read it. Name a command to get just that one.",
    example: "/help trolltoll",
    args: ["command"],
  },

  /* Nexus's own verb, advertised per section 8. Reputation is a different
     claim from BRC-169 attestation: /attest says "this key is this handle",
     /vouch says "I stand behind this person". Both are public and signed. */
  {
    verb: "vouch",
    usage: "/vouch <recipient> [note]",
    summary: "Publicly stand behind someone, signed with your key.",
    section: "Nexus",
    confirms: true,
    custom: true,
    detail:
      "A public, signed statement that you stand behind someone. Nexus's own verb, not a BRC-218 one, so other clients will not have it. Deliberately separate from /attest: one is about a key, this one is about a person, and letting the two look alike would let regard pass for verification.",
    example: "/vouch @nexus steady through the whole pilot",
    args: ["recipient", "text"],
  },

  /* The opposite of /vouch, and anonymous by default: a renunciation is the
     kind of statement that invites retaliation, so hiding the renouncer is the
     default and showing them is the opt-in. The claim itself is still signed —
     anonymity here is about display, not about accountability to the network. */
  {
    verb: "renounce",
    usage: "/renounce [p|public] <recipient> [reason]",
    summary: "Publicly withdraw your regard for someone. Anonymous by default.",
    section: "Nexus",
    confirms: true,
    custom: true,
    detail:
      "The opposite of /vouch: a signed statement that you do not stand behind this person. Your handle and profile are hidden by default; write p or public before the handle to sign it openly. The reason you give is shown either way, so make it one you would defend. Like /vouch, it is Nexus's own verb rather than a BRC-218 one.",
    example: "/renounce p @nexus for scamming people",
    args: ["visibility", "recipient", "text"],
  },

  /* Watching a key is a service somebody has to run, and who runs it differs
     by ecosystem, so it is ours rather than BRC-218's. */
  {
    verb: "watch",
    usage: "/watch <recipient>",
    summary: "Tell me if their key changes or their certificate is revoked.",
    section: "Nexus",
    confirms: false,
    custom: true,
    detail:
      "A key change is a security event, but a client only notices one when you happen to interact. Watching asks Nexus to check on your behalf and tell you when it changes. Private to you, and it tells them nothing. Run it again to stop.",
    example: "/watch @nexus",
    args: ["recipient"],
  },
  {
    verb: "agent",
    usage: "/agent <recipient> [scope] [duration]",
    summary: "Say in the room that an agent is acting for you, and how far it can go.",
    section: "Nexus",
    confirms: true,
    custom: true,
    detail:
      "An agent already acts under a delegation certificate. What nobody else in the room can see is that it is doing so, which leaves them unable to tell whether they are talking to you. This issues the certificate and announces it here, bounded by the scope and time you set, so the other participants know who they are dealing with.",
    example: "/agent @nexus pay 24h",
    args: ["recipient", "scope", "duration"],
  },

  /* Section 6 — reserved, deliberately unimplemented. */
  {
    verb: "bounty",
    usage: "/bounty",
    summary: "An open, claimable payment addressed to a room.",
    section: "6",
    confirms: false,
    reserved: true,
    detail:
      "Named by BRC-218 with no behaviour defined yet. Parsed and refused.",
    args: [],
  },
  {
    verb: "poll",
    usage: "/poll",
    summary: "Payment-gated voting.",
    section: "6",
    confirms: false,
    reserved: true,
    detail:
      "Named by BRC-218 with no behaviour defined yet. Parsed and refused.",
    args: [],
  },
  {
    verb: "gate",
    usage: "/gate",
    summary: "An entry fee for a room or channel.",
    section: "6",
    confirms: false,
    reserved: true,
    detail:
      "Named by BRC-218 with no behaviour defined yet. Parsed and refused.",
    args: [],
  },
  {
    verb: "contract",
    usage: "/contract",
    summary: "Multi-party document signing and anchoring.",
    section: "6",
    confirms: false,
    reserved: true,
    detail:
      "Named by BRC-218 with no behaviour defined yet. Parsed and refused.",
    args: [],
  },
];

/**
 * Where a verb comes from, for display. Custom verbs carry an ecosystem name in
 * `section` rather than a number, so citing them as "BRC-218 §Nexus" claimed a
 * spec reference that does not exist.
 */
export function originLabel(spec: CommandSpec): string {
  return spec.custom ? spec.section : `BRC-218 §${spec.section}`;
}

/**
 * The `#slug` a collectible answers to.
 *
 * Letters and digits of its name, lowercased: "Egg 69" is `#egg69`. A serial
 * would be unmemorable and a full id unpronounceable, and the point of the
 * reference is that somebody can type it from looking at the thing.
 */
export function assetSlug(item: Collectible): string {
  return item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Find a held collectible by its `#slug`, ignoring the hash. */
export function findAsset(token: string): Collectible | undefined {
  const slug = token.replace(/^#/, "").toLowerCase();
  return getCollectibles().find((item) => assetSlug(item) === slug);
}

export function getCommand(verb: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.verb === verb.toLowerCase());
}

/** Verbs offered in autocomplete, specified ones first. */
export function searchCommands(query: string): CommandSpec[] {
  const needle = query.replace(/^\//, "").toLowerCase();
  const matches = COMMANDS.filter(
    (c) => c.verb.startsWith(needle) && !c.unimplemented,
  );
  return [
    // `/help` first: it is the way in for anyone who does not know the grammar.
    ...matches.filter((c) => c.verb === "help"),
    ...matches.filter((c) => c.verb !== "help" && !c.reserved),
    ...matches.filter((c) => c.reserved),
  ];
}

/* ---------------------------------------------------------------- amounts */

export interface Amount {
  /** satoshis, when the amount is BSV-denominated. Zero for other tokens. */
  sats: number;
  /** the fiat the user typed, where they typed fiat */
  fiat?: { currency: string; amount: number };
  /**
   * Set when the amount is denominated in a token rather than BSV or fiat.
   * BRC-218 section 3 defines `amount = fiat / sats` only, so this is an
   * extension: the symbol is matched against the known token list, and
   * anything unrecognised falls through to be treated as memo text.
   */
  token?: { id: string; symbol: string; units: number };
  /** set when a fiat amount could not be converted — section 3.5 */
  unconvertible?: boolean;
}

const SATS_RE = /^(\d+)\s*(?:sat|sats)$/i;
const TOKEN_RE = /^(\d+(?:\.\d{1,8})?)\s+([A-Za-z][A-Za-z0-9]{1,11})$/;
const FIAT_SYMBOL_RE = /^(?:([A-Z]{3})\s+)?\$(\d+(?:\.\d{1,2})?)$/;
const FIAT_CODE_RE = /^([A-Z]{3})\s+(\d+(?:\.\d{1,2})?)$/;
/**
 * More decimal places than the grammar allows. Worth its own message because
 * BRC-218's own abstract uses `/trolltoll $0.218`, which its normative ABNF
 * (`1*DIGIT [ "." 1*2DIGIT ]`) does not admit — so users will type it.
 */
const OVERPRECISE_FIAT_RE = /^(?:[A-Z]{3}\s+)?\$?\d+\.\d{3,}$/;

/** True when a token is a fiat amount with too many decimal places. */
export function isOverpreciseFiat(token: string): boolean {
  return OVERPRECISE_FIAT_RE.test(token.trim());
}

/** Parse an amount token per BRC-218 section 3. */
export function parseAmount(token: string): Amount | null {
  const trimmed = token.trim();

  const sats = SATS_RE.exec(trimmed);
  if (sats) return { sats: Number(sats[1]) };

  // A token amount, if the symbol is one we recognise. BSV resolves to
  // satoshis so it stays a first-class BSV amount rather than a token.
  const tokenMatch = TOKEN_RE.exec(trimmed);
  if (tokenMatch) {
    const token = getTokenBySymbol(tokenMatch[2]!);
    if (token) {
      const units = Number(tokenMatch[1]);
      if (token.base) {
        return { sats: Math.round(units * 100_000_000) };
      }
      return {
        sats: 0,
        token: { id: token.id, symbol: token.symbol, units },
      };
    }
  }

  const symbol = FIAT_SYMBOL_RE.exec(trimmed);
  if (symbol) {
    const currency = symbol[1] ?? "USD";
    const amount = Number(symbol[2]);
    const converted = fiatToSats(amount, currency);
    return converted === null
      ? { sats: 0, fiat: { currency, amount }, unconvertible: true }
      : { sats: converted, fiat: { currency, amount } };
  }

  const code = FIAT_CODE_RE.exec(trimmed);
  if (code) {
    const currency = code[1]!;
    const amount = Number(code[2]);
    const converted = fiatToSats(amount, currency);
    return converted === null
      ? { sats: 0, fiat: { currency, amount }, unconvertible: true }
      : { sats: converted, fiat: { currency, amount } };
  }

  return null;
}

/* ------------------------------------------------------------- recipients */

export interface ParsedRecipient {
  raw: string;
  handle: string;
  /** subhandle tag, per BRC-169 section 3 */
  tag?: string;
  /** as typed: an alias, a domain, or absent for same-ecosystem shorthand */
  ecosystem?: string;
  person?: MessagePerson;
  /** filled in from the DM partner rather than typed */
  implicit?: boolean;
  /** an address-book handle whose confusability skeleton collides with this */
  confusableWith?: MessagePerson;
}

/**
 * `@handle[+tag][@ecosystem]`.
 *
 * The ecosystem separator is `@`, not `:`. That makes a qualified handle read
 * as one address rather than a scoped name, and it matches how people already
 * write federated identities elsewhere. The cost is that a handle now contains
 * two `@`, which the tokeniser and the paymail branch both have to allow for.
 */
const RECIPIENT_RE =
  /^@([a-z0-9][a-z0-9._-]*)(?:\+([a-z0-9][a-z0-9._-]*))?(?:@([a-z0-9][a-z0-9.-]*))?$/i;
const PAYMAIL_RE = /^([a-z0-9][a-z0-9._-]*)@([a-z0-9][a-z0-9.-]*\.[a-z]{2,})$/i;

/** True when a token looks like it was meant to be a recipient. */
export function looksLikeRecipient(token: string): boolean {
  return token.startsWith("@") || PAYMAIL_RE.test(token);
}

/**
 * Resolve a recipient token against the seeded directory. Handles the
 * fully-qualified form, the dotless alias, same-ecosystem shorthand, and
 * paymail input, which section 2.1(7) says SHOULD be accepted and normalised.
 */
export function parseRecipient(token: string): ParsedRecipient | null {
  let handle: string | undefined;
  let tag: string | undefined;
  let ecosystem: string | undefined;

  // Order matters now that both forms contain `@`: a leading `@` means this is
  // a handle, so paymail is only considered for tokens that do not have one.
  const paymail = token.startsWith("@") ? null : PAYMAIL_RE.exec(token);
  if (paymail) {
    handle = paymail[1]!.toLowerCase();
    ecosystem = paymail[2]!.toLowerCase();
  } else {
    const match = RECIPIENT_RE.exec(token);
    if (!match) return null;
    handle = match[1]!.toLowerCase();
    tag = match[2]?.toLowerCase();
    ecosystem = match[3]?.toLowerCase();
  }

  const ecosystems = getEcosystems();
  // Section 2.1(5): a dot means domain, no dot means alias.
  const ecoId: EcosystemId | undefined = ecosystem
    ? ecosystems.find((e) =>
        ecosystem.includes(".") ? e.domain === ecosystem : e.alias === ecosystem,
      )?.id
    : ecosystems.find((e) => e.local)?.id;

  const people = getMessagePeople();
  const person = people.find(
    (p) =>
      (p.handle.toLowerCase() === handle ||
        p.username?.toLowerCase() === handle) &&
      (ecoId ? p.ecosystem === ecoId : true),
  );

  // Section 2.3: warn when an unknown handle's skeleton collides with a known
  // one. Never substitute — just make the difference visible.
  let confusableWith: MessagePerson | undefined;
  if (!person) {
    const skeleton = confusabilitySkeleton(handle);
    confusableWith = people.find(
      (p) =>
        confusabilitySkeleton(p.handle) === skeleton ||
        (p.username && confusabilitySkeleton(p.username) === skeleton),
    );
  }

  return {
    raw: token,
    handle,
    ...(tag ? { tag } : {}),
    ...(ecosystem ? { ecosystem } : {}),
    ...(person ? { person } : {}),
    ...(confusableWith ? { confusableWith } : {}),
  };
}

/* ---------------------------------------------------------------- parsing */

export type Reach = "everyone" | "contacts" | "ecosystem" | "toll";
const REACH_VALUES: Reach[] = ["everyone", "contacts", "ecosystem", "toll"];
const DURATION_RE = /^(\d+)([mhd])$/;
const PERIOD_RE = /^\/(day|week|month)$/;
const SECRET_MISSING =
  "/once needs something to seal. Put the secret after the handle, in quotes if it has spaces in it.";

export interface ParsedCommand {
  verb: string;
  spec?: CommandSpec;
  recipients: ParsedRecipient[];
  amount?: Amount;
  /** `off`, for /trolltoll */
  off?: boolean;
  duration?: string;
  period?: "day" | "week" | "month";
  reach?: Reach;
  /** the collectible named by a `#slug` argument */
  asset?: Collectible;
  /**
   * The payload of a `/once`, unquoted.
   *
   * Held apart from `text` on purpose. `text` is the note, which is meant to
   * survive in the transcript; this is the half that must not, and keeping them
   * in one field would mean every renderer had to remember which end to hide.
   */
  secret?: string;
  scope?: string;
  serial?: string;
  /** `p`/`public` on /renounce: sign it openly rather than anonymously */
  public?: boolean;
  text?: string;
  /** blocking problems, surfaced at confirmation time */
  errors: string[];
}

export type ParseResult =
  | { kind: "chat"; text: string }
  | { kind: "command"; command: ParsedCommand };

/**
 * Parse a locally-composed input line.
 *
 * A line beginning with `//` is chat whose first character is a literal `/`,
 * with the leading `//` reduced to `/` before display (section 2.1).
 */
export function parseCommand(
  input: string,
  /**
   * The conversation partner in a one-to-one thread. BRC-218 writes the
   * recipient as required, but in a DM there is exactly one counterparty and
   * making the user retype their handle is friction with no safety benefit —
   * the confirmation still shows the fully-qualified handle before anything
   * moves, which is what section 4.2 actually asks for.
   */
  implicitRecipient?: MessagePerson,
  /**
   * Whether the draft carries staged files.
   *
   * The one place a verb's grammar depends on something outside the line. With
   * files attached the payload of a `/once` is the files, so an unquoted first
   * token is prose rather than a secret — otherwise "/once @a the contract is
   * signed" would seal the word "the" and file the rest as a memo. Still pure:
   * this is an input, not a lookup.
   *
   * BRC-218 §5.14 set the precedent by making `/sign` mean something different
   * with an attachment; it just never said the grammar could shift with one.
   */
  hasAttachment = false,
): ParseResult {
  if (input.startsWith("//")) return { kind: "chat", text: input.slice(1) };
  if (!input.startsWith("/")) return { kind: "chat", text: input };

  const [head, ...rest] = input.slice(1).split(/\s+/);
  const verb = (head ?? "").toLowerCase();
  const spec = getCommand(verb);
  const command: ParsedCommand = { verb, recipients: [], errors: [] };
  if (spec) command.spec = spec;

  if (!verb) return { kind: "command", command };

  // Section 2.5: an unimplemented verb is reported, never reinterpreted.
  if (!spec) {
    command.errors.push(`/${verb} is not a command this client implements.`);
    return { kind: "command", command };
  }
  if (spec.unimplemented) {
    command.errors.push(
      `/${verb} is a BRC-218 section ${spec.section} global verb, but this client does not implement it. It will not be reassigned to anything else.`,
    );
    return { kind: "command", command };
  }
  if (spec.reserved) {
    command.errors.push(
      `/${verb} is reserved by BRC-218 section 6 but not yet specified, so this client reports it as unsupported rather than inventing behaviour.`,
    );
    return { kind: "command", command };
  }

  const takesFreeText = spec.args.includes("text");
  const tokens = rest.filter(Boolean);
  let index = 0;

  // The visibility marker sits ahead of the recipient, so a bare `p` is never
  // mistaken for a handle. Only the exact words count: anything else falls
  // through to the recipient slot and fails loudly there.
  if (spec.args.includes("visibility") && index < tokens.length) {
    const token = tokens[index]!.toLowerCase();
    if (token === "p" || token === "public") {
      command.public = true;
      index += 1;
    }
  }

  // Recipients come first wherever the grammar expects them.
  const wantsMany = spec.args.includes("recipients");
  const wantsOne = spec.args.includes("recipient");
  if (wantsMany || wantsOne) {
    while (index < tokens.length && looksLikeRecipient(tokens[index]!)) {
      const parsed = parseRecipient(tokens[index]!);
      if (parsed) command.recipients.push(parsed);
      else command.errors.push(`${tokens[index]} is not a valid recipient.`);
      index += 1;
      if (!wantsMany) break;
    }
  }

  /*
   * The secret of a `/once`, which is one token unless it is quoted.
   *
   * Quoting is confined to this slot rather than done in the tokeniser. A
   * quote-aware split would change what every other verb does with a memo that
   * happens to contain an apostrophe, and "don't" is a much more common thing
   * to type than a passphrase is.
   */
  if (spec.args.includes("secret")) {
    const token = tokens[index];
    const opener = token?.[0];
    const quoted = opener === '"' || opener === "'";
    if (hasAttachment && !quoted) {
      // The files are the payload. Anything here is the note, which the
      // free-text branch below will pick up untouched.
    } else if (!token) {
      command.errors.push(SECRET_MISSING);
    } else if (opener === '"' || opener === "'") {
      let end = index;
      let joined = token;
      const closed = (value: string): boolean =>
        value.length > 1 && value.endsWith(opener);
      while (end < tokens.length && !closed(joined)) {
        end += 1;
        if (end < tokens.length) joined += ` ${tokens[end]}`;
      }
      if (!closed(joined)) {
        // Silently taking the first word instead would send a fragment of a
        // passphrase and report it as sent.
        command.errors.push(
          `The quoted secret is never closed. Finish it with a matching ${opener}, or write it as one word.`,
        );
        index = tokens.length;
      } else {
        const inner = joined.slice(1, -1);
        if (inner) command.secret = inner;
        else command.errors.push(SECRET_MISSING);
        index = end + 1;
      }
    } else {
      command.secret = token;
      index += 1;
    }
  }

  // Reachability keyword for /scope.
  if (spec.args.includes("asset")) {
    const at = tokens.findIndex(
      (token, i) => i >= index && token.startsWith("#"),
    );
    if (at !== -1) {
      const found = findAsset(tokens[at]!);
      if (found) command.asset = found;
      else command.errors.push(`You do not hold ${tokens[at]}.`);
      // Assets are named, not positional: `#egg69` reads the same wherever it
      // sits, and demanding a slot for it would make the line order-sensitive
      // for no gain.
      tokens.splice(at, 1);
    }
  }

  if (spec.args.includes("reach") && index < tokens.length) {
    const token = tokens[index]!.toLowerCase();
    if ((REACH_VALUES as string[]).includes(token)) {
      command.reach = token as Reach;
      index += 1;
    }
  }
  // /scope takes its keyword before an optional subhandle, so re-check.
  if (spec.verb === "scope" && command.recipients.length === 0) {
    while (index < tokens.length && looksLikeRecipient(tokens[index]!)) {
      const parsed = parseRecipient(tokens[index]!);
      if (parsed) command.recipients.push(parsed);
      index += 1;
    }
  }

  // Scope string for /delegate, e.g. `pay,message` or `*`.
  if (
    spec.args.includes("scope") &&
    index < tokens.length &&
    !parseAmount(tokens.slice(index, index + 2).join(" ")) &&
    !parseAmount(tokens[index]!) &&
    !DURATION_RE.test(tokens[index]!)
  ) {
    command.scope = tokens[index]!;
    index += 1;
  }

  // Amounts may be one token (`$2.18`, `30d`) or two (`500 sats`, `CHF 5`).
  const wantsAmount =
    spec.args.includes("amount") ||
    spec.args.includes("optional-amount") ||
    spec.args.includes("amount-or-off");
  if (wantsAmount && index < tokens.length) {
    if (
      spec.args.includes("amount-or-off") &&
      tokens[index]!.toLowerCase() === "off"
    ) {
      command.off = true;
      index += 1;
    } else {
      const pair = tokens.slice(index, index + 2).join(" ");
      const two = parseAmount(pair);
      const one = parseAmount(tokens[index]!);
      if (two) {
        command.amount = two;
        index += 2;
      } else if (one) {
        command.amount = one;
        index += 1;
      } else if (isOverpreciseFiat(tokens[index]!) || isOverpreciseFiat(pair)) {
        command.errors.push(
          `${tokens[index]} has more than two decimal places. Fiat amounts are limited to two, so use satoshis for anything finer: 300 sats rather than $0.218.`,
        );
        index += 1;
      }
    }
  }

  if (spec.args.includes("period") && index < tokens.length) {
    const period = PERIOD_RE.exec(tokens[index]!.toLowerCase());
    if (period) {
      command.period = period[1] as "day" | "week" | "month";
      index += 1;
    }
  }

  if (spec.args.includes("duration") && index < tokens.length) {
    if (DURATION_RE.test(tokens[index]!)) {
      command.duration = tokens[index]!.toLowerCase();
      index += 1;
    }
  }

  if (spec.args.includes("serial") && index < tokens.length) {
    command.serial = tokens[index]!;
    index += 1;
  }

  // A command name, as `/help pay` takes. One token, and the leading slash is
  // optional because a reader who has just been told to type `/pay` will type
  // `/help /pay`.
  if (spec.args.includes("command") && index < tokens.length) {
    command.text = tokens[index]!.replace(/^\//, "");
    index += 1;
  }

  // Section 2.3: free text is the last argument and runs to end of line.
  if (takesFreeText && index < tokens.length) {
    command.text = tokens.slice(index).join(" ");
    index = tokens.length;
  }

  // Fill in the DM partner where a recipient was expected but not given.
  if (
    implicitRecipient &&
    command.recipients.length === 0 &&
    (spec.args.includes("recipient") || spec.args.includes("recipients")) &&
    !["trolltoll", "scope"].includes(spec.verb)
  ) {
    command.recipients.push({
      raw: `@${implicitRecipient.handle}`,
      handle: implicitRecipient.handle,
      person: implicitRecipient,
      implicit: true,
    });
  }

  validate(command, spec);
  return { kind: "command", command };
}

function validate(command: ParsedCommand, spec: CommandSpec): void {
  const needsRecipient =
    (spec.args.includes("recipient") || spec.args.includes("recipients")) &&
    !["trolltoll", "scope"].includes(spec.verb);
  if (needsRecipient && command.recipients.length === 0) {
    command.errors.push(`/${spec.verb} needs a recipient.`);
  }
  /* Two-or-more is /split's own requirement rather than a property of the
     `recipients` slot: /pay accepts many and is perfectly happy with one. */
  if (spec.verb === "split" && command.recipients.length < 2) {
    command.errors.push("/split needs at least two recipients.");
  }
  for (const recipient of command.recipients) {
    if (!recipient.person) {
      command.errors.push(
        `${recipient.raw} could not be resolved. Resolution failures block a value-moving command until acknowledged.`,
      );
    } else if (recipient.person.keyChanged) {
      command.errors.push(
        `${recipient.person.name}'s identity key has changed since you added them. Verify out of band before sending value.`,
      );
    }
  }
  if (spec.args.includes("amount") && !command.amount) {
    command.errors.push(`/${spec.verb} needs an amount, like $2.18 or 21545 sats.`);
  }
  if (command.amount?.token && command.recipients[0]?.person) {
    // Nothing to check against a balance in a prototype, but the confirmation
    // has to name the issuer so a same-symbol token from elsewhere is obvious.
  }
  if (command.amount?.unconvertible) {
    command.errors.push(
      `${command.amount.fiat?.currency} cannot be converted. This client quotes USD only, and substituting a stale or undisclosed rate is not permitted.`,
    );
  }
  // `off` ends a subscription and takes no amount or period, so the tail
  // requirements only apply when one is being set up.
  if (spec.args.includes("period") && !command.period && !command.off) {
    command.errors.push("/subscribe needs a period: /day, /week or /month.");
  }
  if (spec.verb === "scope" && !command.reach) {
    command.errors.push(
      "/scope needs one of everyone, contacts, ecosystem or toll.",
    );
  }
  if (spec.verb === "trolltoll" && !command.amount && !command.off) {
    command.errors.push("/trolltoll needs an amount, or off to lift it.");
  }
}

/**
 * The part of a verb's grammar still to be typed, for the ghost hint behind the
 * composer. Driven by the parser rather than by counting words, because
 * `500 sats` is two words but one argument — counting would eat the memo slot.
 *
 * `implicitRecipient` covers a DM, where the recipient may be omitted and the
 * conversation partner is meant.
 */
export function remainingSyntax(
  input: string,
  {
    implicitRecipient = false,
    hasAttachment = false,
  }: { implicitRecipient?: boolean; hasAttachment?: boolean } = {},
): string {
  if (!input.startsWith("/") || input.startsWith("//")) return "";
  const verb = input.slice(1).split(/\s/)[0] ?? "";
  const spec = getCommand(verb);
  if (!spec || spec.reserved || spec.unimplemented) return "";
  // Only hint once the verb itself is complete and followed by a space, or is
  // exactly a known verb — otherwise it fights with the autocomplete list.
  const typedVerb = input.slice(1);
  if (typedVerb !== verb && !/^\S+\s/.test(typedVerb)) return "";

  const parsed = parseCommand(input, undefined, hasAttachment);
  if (parsed.kind !== "command") return "";
  const c = parsed.command;
  const out: string[] = [];

  /*
   * Which arguments already carry a value.
   *
   * An optional argument sitting before one the user has filled in has been
   * skipped, not forgotten: the grammar is positional, so there is no longer
   * anywhere to type it. Leaving its placeholder in the hint asks for something
   * that can no longer be given, and worse, shows it after the argument it was
   * supposed to precede — `/pay 500 sats [recipient]`.
   */
  const filled = spec.args.map((arg) => {
    switch (arg) {
      case "recipient":
      case "recipients":
        return c.recipients.length > 0;
      case "asset":
        return Boolean(c.asset);
      case "amount":
      case "optional-amount":
        return Boolean(c.amount);
      case "amount-or-off":
        return Boolean(c.amount) || Boolean(c.off);
      case "duration":
        return Boolean(c.duration);
      case "period":
        return Boolean(c.period);
      case "reach":
        return Boolean(c.reach);
      case "scope":
        return Boolean(c.scope);
      case "serial":
        return Boolean(c.serial);
      case "visibility":
        return Boolean(c.public);
      case "secret":
        return Boolean(c.secret);
      case "text":
      case "command":
        return Boolean(c.text);
    }
  });
  const lastFilled = filled.lastIndexOf(true);
  /** An optional argument the user has typed past. Required ones still show. */
  const skipped = (index: number): boolean => index < lastFilled;

  for (const [index, arg] of spec.args.entries()) {
    switch (arg) {
      case "recipient":
        if (c.recipients.length === 0 && !["trolltoll", "scope"].includes(spec.verb)) {
          // Optional only in a one-to-one, where the partner is meant.
          if (implicitRecipient && skipped(index)) break;
          out.push(implicitRecipient ? "[recipient]" : "<recipient>");
        } else if (c.recipients.length === 0 && !skipped(index)) {
          out.push("[subhandle]");
        }
        break;
      case "recipients":
        if (c.recipients.length === 0) {
          /* A one-to-one supplies the first handle, so what is left to type is
             optional extras. Not for /split, which needs two of its own and
             would be hinting that none are required. */
          if (implicitRecipient && spec.verb !== "split") out.push("[recipient…]");
          else out.push("<recipient>", "<recipient…>");
        } else if (c.recipients.length === 1) out.push("<recipient…>");
        break;
      case "amount":
        if (!c.amount) out.push("<amount>");
        break;
      case "optional-amount":
        if (!skipped(index) && !c.amount) out.push("[amount]");
        break;
      case "amount-or-off":
        if (!c.amount && !c.off) out.push("<amount>|off");
        break;
      case "duration":
        if (!skipped(index) && !c.duration) out.push("[30d]");
        break;
      case "period":
        if (!c.period) out.push("/day|/week|/month");
        break;
      case "reach":
        if (!c.reach) out.push("everyone|contacts|ecosystem|toll");
        break;
      case "scope":
        if (!skipped(index) && !c.scope) out.push("[scope]");
        break;
      case "serial":
        if (!skipped(index) && !c.serial) out.push("[serial]");
        break;
      case "visibility":
        if (!skipped(index) && !c.public) out.push("[p|public]");
        break;
      case "command":
        if (!c.text) out.push("[command]");
        break;
      case "text":
        if (!c.text) out.push("[memo]");
        break;
      case "asset":
        if (!c.asset) out.push("#asset");
        break;
      case "secret":
        /* With files staged the payload is the files, so the secret becomes
           optional — and the placeholder carries its own quotes, because
           quoting is exactly what distinguishes "this word is the secret" from
           "this word is the start of the note". */
        if (!c.secret) out.push(hasAttachment ? '["secret"]' : "<secret>");
        break;
    }
  }
  return out.join(" ");
}

/** Equal division with a deterministic remainder, per BRC-218 section 5.5(2). */
export function splitLegs(
  total: number,
  count: number,
): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  let remainder = total - base * count;
  return Array.from({ length: count }, () => {
    // One satoshi at a time, to recipients in the order given.
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

/**
 * The argument slots of a command line, as ranges into the text.
 *
 * Tab steps between these. Slots are whitespace-separated tokens after the
 * verb, except that a trailing free-text argument is one slot to the end of the
 * line rather than one per word — `for the local-inference write-up` is a memo,
 * not five arguments.
 */
export function argumentSlots(input: string): { start: number; end: number }[] {
  if (!input.startsWith("/") || input.startsWith("//")) return [];
  const verb = input.slice(1).split(/\s/)[0] ?? "";
  const spec = getCommand(verb);
  if (!spec) return [];

  const slots: { start: number; end: number }[] = [];
  const re = /\S+/g;
  let match = re.exec(input);
  // Skip the verb itself.
  if (match) match = re.exec(input);

  // Where free text begins, everything after it is one slot.
  const freeAt = spec.args.findIndex((arg) => arg === "text");
  const positional = freeAt === -1 ? spec.args.length : freeAt;

  let index = 0;
  while (match) {
    if (index === positional && freeAt !== -1) {
      slots.push({ start: match.index, end: input.length });
      break;
    }
    let end = match.index + match[0].length;
    // A satoshi amount is two tokens and one argument; selecting "500" without
    // "sats" makes Tab-then-type produce a bare number.
    if (spec.args[index] === "amount" || spec.args[index] === "amount-or-off") {
      const unit = /^\s+(sats?|BSV)\b/i.exec(input.slice(end));
      if (unit) end += unit[0].length;
    }
    // A quoted secret is one argument however many words it holds, so Tab
    // selects the whole passphrase rather than its first word.
    if (spec.args[index] === "secret") {
      const opener = input[match.index];
      if (opener === '"' || opener === "'") {
        const close = input.indexOf(opener, match.index + 1);
        if (close !== -1) end = close + 1;
      }
    }
    slots.push({ start: match.index, end });
    if (end > match.index + match[0].length) re.lastIndex = end;
    index += 1;
    match = re.exec(input);
  }
  return slots;
}
