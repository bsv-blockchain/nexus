# Implementation feedback on BRC-169 and BRC-218

Notes from building both specs into a working client (Nexus, `components/apps/messages/`
and `lib/commands.ts`). Written to be folded back into the two proposals.

Every item is one of:

- **CHANGE** — we deliberately did something different from the spec. The spec should change.
- **BUG** — the spec contradicts itself or is unimplementable as written.
- **GAP** — something a conforming client must decide, that the spec does not cover. Two
  conforming clients would disagree.
- **DETAIL** — the spec is right but underspecified; here is the detail an implementer needs.

Section numbers refer to the drafts as reviewed (BRC-169 PR #184, BRC-218 PR #185).

---

## 1. Handle syntax: `@handle@ecosystem`

### 1.1 CHANGE — the ecosystem separator is `@`, not `:`

BRC-169 §2.1 specifies `@handle:ecosystem`. We implemented `@handle@ecosystem`.

`:` reads as a namespace or scope separator — the same character used for ports, for
`scheme:`, and in BRC-169's own §9.2 scope strings (`thread:<id>`). A qualified handle is
not a scoped name; it is one address naming one identity at one authority. `@` says that,
and it matches the shape people already read as "identity at provider".

This is not cosmetic. Two consequences the spec must address:

**Tokenising.** A qualified handle now contains two `@`. Any client that finds the start of
a mention by scanning back to the nearest `@` breaks the moment the user types the
separator — which is exactly when autocomplete is most useful. The rule must be: scan back
to the nearest **whitespace** (or start of input); if that character is `@`, the token runs
to the next whitespace. Our implementation is `activeToken` in `lib/mentions.ts`.

**Paymail disambiguation.** §2.1(7) says paymail input SHOULD be accepted and normalised.
Under `:` the two forms were unambiguous. Under `@` they overlap, and the disambiguation
rule must be stated: *a leading `@` means this is a handle; without one, try paymail.*
Trying paymail first now mis-parses `@alice@example.com`.

Note this second form is not a problem semantically. `@alice@example.com` is a qualified
handle whose ecosystem part contains a dot, so §2.1(5) already resolves it as a domain, and
it names the same identity paymail would. The overlap is only in parse order.

### 1.2 DETAIL — §2.1(5) survives unchanged

The dot rule (a dot means domain, no dot means alias) works exactly as written with the new
separator, and is worth keeping: it is the only part of resolution that needs no registry.

### 1.3 CHANGE — a rendered handle keeps the form it was written in

A client that draws handles as chips will be tempted to normalise them, and we
did: `@thoth` was redrawn as `@23` because both resolve to the same identity.
That edits the message. Whoever wrote `@thoth` chose it, and a reader comparing
the transcript against what they remember writing should find the same words.

The rule is worth stating in §2.4: **resolution may be canonical, display must
not be.** Render the alias that was written, resolve it to the canonical
identity underneath, and put the canonical form where verification happens.

### 1.4 DETAIL — numeric handles need both forms shown

On ecosystems that assign account numbers (Twetch, Treechat), `@23@treechat` and
`@thoth@treechat` are the same identity. §2.4's display rules should **require** that a
profile surface shows both forms, not just the canonical one. Showing only the number makes
the name look like an unverified alias; showing only the name hides the identifier other
people in that ecosystem actually use. We show both on the identity card.

---

## 2. BRC-169 findings

### 2.1 GAP — display MAY omit the ecosystem in context, MUST show it in verification

§2.4 requires the handle be shown with its ecosystem. Taken literally, a thread where every
participant shares one ecosystem repeats the same suffix on every line, and it becomes
noise that readers stop seeing — which defeats the point of showing it.

Proposal: split the rule.

- In conversational context, a client MAY show the bare handle where the ecosystem is
  unambiguous from the surrounding context (a single-ecosystem thread, or a chip that
  already carries the ecosystem's mark).
- In any surface a user would consult **to decide whether to trust an identity** — the
  identity card, a payment confirmation, a delegation certificate — the fully-qualified form
  MUST be shown.

We do exactly this: command pills show `@9823`, the identity card and confirmation sheet
show `@9823@twetch`.

### 2.2 DETAIL — the confusability skeleton needs its fold set written down

§2.3 requires clients detect confusable handles but does not define the skeleton. Two
clients with different fold sets disagree about what is a spoofing risk, which is worse than
no rule. Publish the exact transformation. Ours (`confusabilitySkeleton` in
`lib/messages.ts`) lowercases, strips `.`/`_`/`-`, and folds visually-identical ASCII:
`0↔o`, `1↔l↔i`, `5↔s`, `2↔z`, `8↔b`, `rn↔m`, `vv↔w`.

The accompanying requirement is already right and worth emphasising: **never substitute**.
Make the difference visible and let the user choose.

### 2.3 CHANGE — unattested metadata includes contact details

§2.4 notes the display name and avatar are host-supplied. Any contact metadata an ecosystem
serves (email, phone, code-forge username) belongs in the same category and should be named
explicitly, because it is *more* likely to be acted on than an avatar. We label the whole
group as host-supplied and unattested on the identity card.

### 2.4 GAP — general tolls and per-sender tolls are distinct state

§8.2 describes a per-message toll. In practice a handle needs two independent settings: a
general toll applied to unknown senders, and per-sender overrides. Lifting the general toll
must not silently lift the overrides, and a client that conflates them will surprise its
user in one direction or the other.

Spec should define both, and require that any UI which lifts one states what happened to the
other. Our `/trolltoll off` card says "Per-sender tolls stay in force until lifted
individually."

### 2.5 DETAIL — a per-action cap is not a spend limit

§9.3.3 defines caps per action. Ten thousand actions at a 50-satoshi cap is 500,000
satoshis, and a user reading "capped at 50 sats" will not conclude that. The spec should
require clients to state, on any delegation with a per-action cap and no cumulative cap,
that total spend is unbounded. We render this as a standing caveat on the card
(`capEnforced: false`).

Better still: define an optional cumulative cap in the certificate, so the honest version is
expressible rather than only warnable.

### 2.6 DETAIL — revocation is an observation, not a proof

§4.4 and the revocation model: SPV cannot prove a non-spend. A client can only report *when
it last checked*. The spec should require the age of the check be shown alongside the
status, and should forbid presenting "not revoked" as a guarantee. We show "Revocation
checked 2 minutes ago" plus the caveat.

### 2.7 GAP — attestation and reputation are different claims

§10 covers peer attestations of a handle-to-key binding. That is a *cryptographic* claim:
this key is this handle. It is routinely confused with reputation: I stand behind this
person. Both are signed and public, and conflating them lets reputation be read as
verification.

The spec should name the distinction and keep §10 to key binding. Our client implements
`/attest` for the binding and a separate ecosystem-custom `/vouch` for reputation, and the
identity card lists them under different headings.

### 2.8 GAP — registration age is a trust signal and is not exposed

A handle registered four years ago and one registered last week both resolve identically,
and deserve different amounts of trust. Consider an optional `registeredAt` in the
resolution response. We show it with its age, which is the form that is actually legible
("2 Nov 2019 (6 years 8 months ago)").

---

## 3. BRC-218 findings

### 3.1 BUG — the abstract contradicts the amount grammar

The abstract uses `/trolltoll $0.218`. The normative ABNF for `amount` permits at most two
decimal places for fiat. One of the two must change. We follow the grammar and reject the
third decimal with a message pointing at satoshis ("use satoshis for anything finer: 300
sats rather than $0.218"), but the example in the abstract will be copied by implementers
before they reach the ABNF.

### 3.2 CHANGE — token-denominated amounts

§3 defines `amount = fiat / sats`. Real ecosystems issue tokens, and a payment in one is a
different operation from a BSV payment, not a formatting variant of it. We extended the
grammar to accept a token symbol (`/pay @dan@mycelia 3 nutri`) and treat it as an extension,
flagged as such.

If the spec adopts this, three requirements matter:

- The symbol must resolve within a known token list, not be accepted blindly — otherwise
  `3 nutri` is indistinguishable from a memo beginning "nutri".
- The confirmation MUST show it is a token transfer, not a BSV payment.
- Any fiat equivalent MUST be marked indicative. A token is worth what its issuer and
  market say, and a client quoting it as a rate is making a claim it cannot support.

Unrecognised symbols fall through to memo text in our parser, which keeps the failure mode
harmless.

### 3.3 GAP — `/subscribe` has no way to end

§5.6 defines how a recurring payment starts and says the payer can stop it. No verb
expresses stopping, so every client invents one, and the counterparty sees nothing.

Proposal: `/subscribe <recipient> off`, mirroring `/trolltoll <recipient>|off`, plus a
`cancelled` status for the resulting card. We added the status; the verb form is worth
specifying so the *other* side of the conversation learns the arrangement ended.

### 3.4 DETAIL — `/request` needs a defined accept path

§5.3 defines the request but not the acceptance. The acceptance is the interesting half:
it executes a `/pay` in the opposite direction, and if the request was fiat-denominated the
satoshi amount MUST be re-derived at acceptance time, not carried over from when the request
was made. Otherwise the payer settles at a stale rate.

The spec should also state that a request confers no authority — nothing moves until the
recipient confirms — because the card looks like a charge.

### 3.5 DETAIL — split remainder must be stated, not just deterministic

§5.5 requires a deterministic remainder. Determinism alone is not enough: two clients with
different-but-deterministic rules produce different splits from the same command. Name the
rule. We assign the remainder to the **first-named recipient**, and say so on the card, so
the outcome is checkable by everyone in the room.

Also worth stating explicitly: legs settle independently, and a failed leg MUST NOT be
retried silently. One of our seeded threads shows a four-way split with one failed leg
precisely because that is the case implementers will get wrong.

### 3.6 GAP — bound verbs need a non-hover affordance

§4.9 correctly requires a bound command (`/tip`, `/sign`, `/receipt`) to report an error
rather than guess which message it applies to. What the spec does not say is that the client
must therefore offer a way to *establish* the binding — and if that affordance is
hover-only, those three verbs are unreachable on touch. This is a real defect we hit in our
own client (`opacity-0 group-hover:opacity-100` on the reply control).

Add a note: clients MUST provide a binding affordance that does not require hover.

### 3.7 GAP — quick actions inside a receipt, and their interaction with §4.1

A command's result card is a natural place to offer the obvious next step: lift the toll
this command set, cancel the subscription it started, revoke the certificate it issued, pay
the request it made. §4.1 requires a structured confirmation before value moves, and a
button inside a hovercard is not a structured confirmation.

The workable rule, which we implement:

- Actions that **reverse standing state and move no value** (lift a toll, cancel a
  subscription, revoke a certificate) MAY execute directly from the card.
- Actions that **move value** (pay a request, repeat a payment) MUST route back through the
  normal compose-and-confirm path.

Either way the action SHOULD post its own command into the conversation, so the transcript
records the change rather than it happening invisibly. Our lift-toll button posts
`/trolltoll off` as a message.

### 3.8 CHANGE — a command is a message, not a receipt block

§2.4 and §4 say nothing about how a command should be displayed in a transcript. Our first
implementation rendered each result as a full-width card, and a `/whois` then occupied the
same vertical space as a paragraph; a conversation of twelve messages and six commands read
as a stack of receipts.

What works: the command renders **inline, as the line the user typed** — a compact pill
carrying the verb and its resolved parameters, each with its own mark (avatar for a handle,
coin for an amount) — and the structured card moves into a popover on that pill. The receipt
stays one gesture away without dominating the room.

Recommend the spec add display guidance to this effect, since the alternative is what every
implementer will build first.

### 3.9 GAP — no notion of a local, non-transmitted reply

`/help` has no counterparty. Nor does a parse error, an unsupported-verb report (§2.5), or a
confusability warning (BRC-169 §2.3). All of these are the *client* answering the user
inside a conversation, and none of them should be transmitted or appear to other
participants.

The spec should name this class — an ephemeral local response — and require that it be
visibly distinguished from a message and never sent. We render them as a reply from the
client itself, labelled "Only visible to you", dismissable.

### 3.10 CHANGE — `/help` should be a required baseline verb

§8 allows ecosystem-custom commands, and we added `/help` as one. On reflection it belongs in
the base spec as REQUIRED: it is the only command a user can run without already knowing the
grammar, which makes it the entry point to everything else. A grammar discoverable only by
reading the specification is not discoverable.

Ours lists every verb grouped by whether the client can actually run it — standard, this
ecosystem's own, declined, and reserved — which also gives §2.5 and §6 somewhere to surface.

### 3.11 DETAIL — origin labelling for custom verbs

§8 permits ecosystem-custom commands. Clients will show a provenance line next to each verb,
and the obvious implementation cites a spec section — which produces "BRC-218 §Nexus" for a
custom verb, claiming a reference that does not exist. (We shipped that bug.)

Require that a custom verb be labelled by its **ecosystem**, and a specified verb by its
section, and that the two never share a format.

### 3.12 DETAIL — autocomplete should insert the qualified form

§4.4 correctly forbids autocomplete from substituting one handle for another. Add the
positive requirement: accepting a suggestion inserts the **fully-qualified** handle. This is
what makes the no-substitution rule observable — the user sees exactly which identity was
chosen, in a form they could verify.

### 3.13 CHANGE — `/sign` covers the message and its attachments

§5.14 defines `/sign` as countersigning the message being replied to. That
leaves the ordinary case unaddressed: signing something you are sending right
now, with the files attached to it.

Implemented, and proposed:

- `/sign [text]` binds **optionally**. With a reply it signs that message; with
  no reply it signs the draft it was typed on.
- The signature commits to the message text **and every attachment**, so it
  changes if any of them do. With no attachment it covers the text alone.
- The result MUST state which of those happened. "Signed" over a message means
  something different from "signed" over a message and four files, and a reader
  cannot tell them apart from the word alone. Ours says "2 files signed with
  this message" or "Message text signed. No files were attached."

This also means attachments have to be part of the message *before* it is sent,
which the spec never says outright. A client that posts a file the instant it is
picked cannot offer this at all — there is no draft for the signature to cover.

### 3.14 DETAIL — autocomplete displays short, inserts long

Following on from §4.4: a picker showing fully-qualified handles is unreadable
in a single-ecosystem thread, where every row ends in the same suffix. What
works is displaying the bare handle and inserting the qualified one, so the list
stays scannable and the text that lands in the message is unambiguous.

Worth adding as a note, because the naive reading of "insert the qualified form"
is "show the qualified form", and that makes the list worse.

### 3.16 CHANGE — `/help` takes a command name, and one line per command is not enough

We shipped `/help [verb]` with a one-line summary per command and then watched it fall
short in both directions.

The argument is a **command name**, and calling it `verb` leaks the grammar's vocabulary
into a prompt aimed at someone who does not know the grammar. Worse, our watermark rendered
the argument with the same placeholder we use for free text, so the composer read
`/help [memo]` — an instruction to type the wrong thing. Name it `[command]`, and accept it
with or without the leading slash: a reader who has just been told to type `/pay` will type
`/help /pay`.

One line per command is enough to *find* a command and not enough to *use* one. The line
that fits next to a grammar string cannot also say that a per-action cap is enforced by the
counterparty and a cumulative one generally is not, or that turning off a general toll
leaves a per-sender toll running. Require the listing to make a fuller description reachable
per command, while keeping the list itself scannable. Ours puts each command behind a
disclosure inside a disclosure per group.

### 3.17 GAP — help listings need a defined order, and it is not alphabetical

§5.16(2) requires the listing to distinguish runnable verbs from unsupported ones, and
§5.16(3) requires custom verbs to be labelled by ecosystem. Neither says what order any of
it comes in, so every client will pick its own, and the obvious pick — the order of section
5 — puts the verbs a user can actually run here last.

Lead with what is runnable in this ecosystem, custom verbs first: they are the ones no other
client taught the reader. Then the standard set, then what this client declines under §2.5,
then the reserved verbs of §6. The order is the answer to "what can I do here", narrowing to
"what exists but not here".

### 3.18 CHANGE — "only visible to you" is too weak a label for a room with agents

§9(2) says a local response SHOULD be labelled as visible only to the user. Two problems
surfaced once we built it.

SHOULD is too weak. A local response is rendered inside a shared transcript and looks
exactly like a message in it; the label is the only thing distinguishing "the client
answered me" from "I posted a manual at everyone". That is a MUST.

And "only you" no longer says enough. A conversation may hold automated participants under
§4.7 delegation, and a user who has been told an agent is reading the thread has no way to
know from "only visible to you" whether the agent is included. The label MUST state that the
response was not sent and that no other participant receives it, **human or automated**.
Ours reads: "Nexus wrote this to you, not to the conversation. Nothing was sent, and nobody
else here sees it, person or agent."

### 3.19 GAP — keyboard navigation between arguments must not edit the text

§4.4 forbids autocomplete from substituting a recipient the user did not select. Argument
navigation needs the same rule, and we found out by breaking it.

Cycling a selection through a command's argument positions is the natural keyboard
affordance for a grammar this positional, and Tab is the natural key. In our build Tab was
also consumed by the open mention popover, which completed the handle under the caret,
inserted a space, and moved everything after it — so pressing Tab twice produced a different
command from the one on screen. Separately, re-deriving the mention chips while the caret
sat inside a token rewrote the token: `@31` resolves as a prefix of `@31@treechat`.

State it: a client MAY offer keyboard navigation between argument positions, and doing so
MUST NOT alter the command text. Only an explicit accept, per §4.3, may insert anything.

### 3.20 GAP — the grammar creates obligations and cannot end them

Three holes of the same shape, found by asking what a user does the day *after*
running each verb.

**`/refund` (new, §5.17).** A payment cannot be reversed, so returning one means sending a
second payment the other way. Done as a plain `/pay` it is an unexplained transfer: neither
side can reconcile it against the payment it answers, and the link cannot live in a memo
because §2.4 forbids acting on received text. Bind it to the payment, carry a machine-
readable reference, allow a partial amount, and refuse it on a payment the user *sent* —
asking for money back is `/request`, not a refund.

**`/cancel` (new, §5.18).** §5.3 creates an obligation in the recipient's client with no way
to discharge it but paying. The sender's only remaining move is to ask again. This is the
hole `/subscribe` had before we added `off`, and it wants the same treatment: bind to your
own request, withdraw it, and stop the other side showing it as owed.

**`/standing` (new, §5.19).** Everything §5 hands out keeps acting without asking again — a
certificate signed in March spends in July, a subscription runs whether or not you remember
starting it, a toll charges people you have forgotten you were charging. The spec never
required a way to enumerate any of it. Require the list, require each entry to state its
cap and expiry rather than only naming the thing, and require lapsed authority to be shown
as lapsed: "it expired" and "it was never issued" are different answers, and only one means
the user remembered correctly. The prior art is the authorized-applications list every OAuth
provider eventually had to ship.

All three are implemented in Nexus. `/standing` is a local response under §9, since listing
your own certificates into a shared room would be absurd.

### 3.21 GAP — an agent in the room is invisible to everyone else in it

§4.6 lets an agent execute commands under a delegation certificate. The certificate is
between the user and the agent, and it answers the user's question — how far can this thing
go — but not the counterparty's, which is *whether they are talking to a person at all*.
Nothing in the message stream distinguishes the two.

Added as §4.7: a client supporting non-interactive execution MUST provide a way for the
delegating user to declare in the conversation that an agent is acting for them, with its
scope and expiry. Deliberately a requirement to *provide the means* rather than a mandated
verb, because what an agent is differs by ecosystem; ours is `/agent`, a custom command
under §8. This also gives §9's local-response label something concrete to be about, since
"nobody else sees this, person or agent" is only meaningful if agents can be present.

### 3.22 Ecosystem verbs worth naming as prior art

Two we added under §8, listed here because the next ecosystem will want them and would
otherwise pick different names for the same things.

- **`/watch <handle>`** — tell me when this handle's key changes or its certificate is
  revoked. BRC-169 §4.4 makes a key change a security event, but a client only notices one
  when the user happens to interact. Correctly ecosystem-specific: somebody has to run the
  watcher, and who that is differs.
- **`/agent`** — see 3.21.

Rejected while considering these, with reasons, in case they come up again: `/verify` (a
client should verify automatically; an explicit verb duplicates a badge), `/mute` (local
only, no interoperable meaning), `/rate` (reputation, which BRC-169 §10 deliberately keeps
distinct from attestation), `/tab` (netting needs a multi-party protocol, the bar that put
`/escrow` in §6), `/intro` (attractive, but it turns on an ecosystem's contact model).

### 3.23 CHANGE — a read-only command must not ask for confirmation

§4.1 says what needs a confirmation. It never said what does *not*, so the obvious
implementation routes every verb through the same sheet, and ours did: `/whois` opened a
bottom sheet asking whether you were sure you wanted to look someone up.

Nothing about a lookup warrants it. It moves nothing, sends nothing, and the handle is
never told it happened. Worse, the cost is not zero: a client that puts the same sheet in
front of a read and a payment trains the user to dismiss it, and they carry that habit to
the sheet that mattered. Added as §4.2 as a MUST NOT, with `/whois` and `/help` named.

### 3.24 GAP — where a resolution is shown, and how fast it appears to arrive

Two things §5.7 left to the client, both of which turn out to matter.

**Where.** We first rendered the answer only in a side pane. That makes the command a
navigation step, and leaves the conversation with no record of what was resolved — which
defeats the case people most often run it for, which is showing someone else who a handle
belongs to. Now inline, under the command, with key, domain and certificate state legible
without a further click. Added as §5.7(5) as a SHOULD.

**How fast.** A card painted complete in the same frame the command was issued says
resolution is instant and always works. It is neither: it is a network lookup that can
fail, return a changed key, or come from cache. Drawing it as instantaneous is a small lie
that makes a stale binding easier to miss later, so §5.7(6) asks clients not to. Ours shows
the card's own shape while the lookup is out, for as long as the lookup takes.

### 3.25 GAP — an unattributed reputation count is not evidence (BRC-169 §10)

We built the vouch summary as a count first — "vouched for by 8" — and it was useless in
exactly the way a review score is useless. Eight of whom? A vouch is worth precisely what
its signer is worth, and a reader who cannot see the signers cannot weigh any of it.

Added as BRC-169 §10(5): every peer statement a client surfaces MUST be attributable to the
key that made it, and that key MUST be resolvable to a handle the reader can look up in
turn. The same rule forbids the other tempting shortcut — summing attestations and vouches
into one number. They are claims about different things, and a total covering both means
nothing. Ours lists each voucher with their handle, their ecosystem and the note they
signed, and opens a conversation with them on click.

### 3.26 GAP — a reputation system that only records regard records half of it

We built `/vouch` and used it for weeks before the obvious question landed: what do you do
when you know something bad? Nothing in BRC-169 §10 covers it, so the honest answer was
"nothing", and a reputation surface where nobody can be spoken against is one where the only
signal is enthusiasm.

`/renounce` is the inverse, and building it made clear that a symmetrical design would be
wrong in three specific ways.

**Attribution has to default the other way.** A vouch costs its author almost nothing;
speaking against someone costs them a relationship, sometimes a client. Name the author by
default and the only renouncements you collect are from people with nothing to lose, which
is the least useful sample available. Ours is anonymous unless the author writes `p` or
`public` before the handle.

**The claim still has to be shown.** An anonymous count is a rumour with a number on it. The
reason is what the subject can answer and a reader can weigh, so it is the part that is
always displayed, attributed or not.

**It must not touch verification.** §10(6) already forbids a vouch contributing to a
verified indication; the same has to hold in reverse, or an unattributed sentence becomes a
way to make someone look cryptographically suspect.

Written up as BRC-169 §10(7). Also added §8(6) in BRC-218: where a custom verb has an
argument deciding whether the *user* is exposed, the confirmation must say which way it is
going in words. A single character that decides anonymity is one you mistype once.

We deliberately did not give `/renounce` a button. Every other action on a profile card has
one; this one is available only by typing it, because the effort is part of the design.

### 3.27 GAP — rooms gate on reputation, and nothing said how

§6 reserves `/gate` for "an entry fee for a room or channel", which is the *write* half —
charging admission, with custody and refunds to settle. The half people actually asked us
for first was the read half: let anyone in who holds this, or who someone vouched for, and
keep out anyone a named handle has spoken against. That needs no verb, no custody and no
new on-chain construct, and it was entirely unspecified.

Three gate types, added as BRC-218 §11 and since moved to BRC-190 (see 3.31):

- **Holding** — hold a token or an item of a contract. A minimum quantity is meaningful only
  for a fungible one; asking for 1.5 of a collectible is a question with no answer. Gate on
  the **contract**, never a serial, or the gate stops being true the moment a holder sells
  one item and buys another from the same issue.
- **Vouch** — vouched for by named handles. A gate naming several MUST say whether it means
  any or all: the two produce very different rooms and neither is the obvious default.
- **Renounce** — a renouncement by any named handle closes the door. Alone among the three it
  **admits by default**, which makes it the only one that scales to a room open to strangers.

Four findings that only appeared once it was running:

1. **A gate must hide contents, not the room.** Our first pass hid gated rooms entirely, and
   the result is a room nobody can ask about, join on request, or distinguish from one that
   does not exist. Name and participant *count* are visible; the list and the messages are
   not.
2. **Say which requirement failed.** "You cannot read this" is not actionable. "Holds 12.32
   BSV of the 21.8 required" is.
3. **Gates are continuous, not admission-time.** Balances are spent and vouches withdrawn, so
   a participant can stop satisfying a room they are already in. Surfacing that beats a
   roster that silently disagrees with the door — removing them is the room's decision, not
   the client's.
4. **A gate is presentation, not authorisation.** It decides what this client draws. Nothing
   is encrypted by it, and a room whose confidentiality matters needs the messagebox to
   enforce it, exactly as a toll is enforced there under BRC-169 §8.2 rather than by the
   sender's client.

And one thing worth saying out loud in the spec rather than letting each client discover it:
a holding gate is a wealth test wearing a membership badge. Legitimate — a room may want
participants with something at stake — but it excludes on an axis unrelated to conduct, so a
client should not default a new room to one.

**Gate types considered and not specified**, so the next person does not have to rediscover
them: an **attestation** gate (resolve to a key N peers have attested, ideally from distinct
ecosystems so a mutual-attestation ring costs real coordination); a **stake** gate (hold the
key that paid into the room — unlike a token it cannot be lent, and it is what §6's `/gate`
has been holding the name for); and a **recency** gate (registered before a date, or dormant
under N days — age is the one property a spammer cannot buy, at the cost of being hostile to
newcomers, which is why it should pair with an attestation gate rather than stand alone).

### 3.28 GAP — moving a thing is not moving an amount

Every value verb in §5 moves a quantity. Nothing moved an object, and the moment
collectibles existed in the client the omission was obvious: `/pay` cannot express "this
one, the numbered one, the one in the picture".

`/send` is in as §5.20. Four rules came out of building it.

An asset needs a **reference a person can type from looking at it** — `#egg69`, not a
uuid — and the client must resolve it against what the sender actually holds rather than
near-matching.

The confirmation must show the **artwork and the serial**. Confirming a collectible against
its name and id asks the user to verify from the label on the box, which is the check
everybody skips. This is the one confirmation where the picture is the safety feature.

The record must name **both** parties. "Sent to Randy" is ambiguous as soon as it is quoted
or read by somebody who joined afterwards.

And it should link the transaction, because an asset transfer is the case where a reader
most wants to check rather than take the client's word.

### 3.29 CHANGE — claiming `/escrow`, and only the half we can specify

§6 reserved `/escrow` with a list of what a specification would have to settle: script
template, arbiter selection and discovery, dispute protocol, timeout behaviour. That list is
why it stayed reserved, and it is still mostly unsettled.

But a large part of what people mean by escrow needs none of it: name somebody you both
trust, both commit, they hold and release. No script, no arbiter discovery, no dispute path
— just custody by a named party for a bounded time. That is specifiable today, and §6 says
outright that a reserved verb is a candidate for a BRC that claims the name. So §5.21 claims
it for the named-agent case and says plainly what it leaves out.

Three things in the design as first described would have broken:

**Pairing by agent and amount is ambiguous.** Two offers of 69 to one agent are
indistinguishable; the agent picks, and eventually picks wrong. Pairing has to be
deterministic — earliest unmatched opposite side — and the client has to show what it paired
with.

**Two commands mean two clocks.** Each side names its own duration. The escrow lives by the
earlier one, and a side that lapses lapses alone.

**The card must not read like a receipt.** Nothing has moved when a side commits. The
temptation is to render commitment as achievement, and the fix is to say the uncomfortable
thing in words — the agent can keep both halves and nothing here stops them — for exactly as
long as it is true. §5.21(7) also requires the client to *stop* saying it once settled: a
released escrow claiming nothing has moved is its own kind of lie.

One addition worth noting: §5.21(8) says show the agent's standing at the point of
commitment. Their reputation is the only bond in the arrangement, which makes it the fact
that matters most and the one nobody goes to look up. It is the first place the vouch and
renounce work of 3.26 pays for itself somewhere other than a profile card.

### 3.30 GAP — a room that charges rent is not the same shape as a room with a door

The holding gate of §11.1 asks a question with a yes or no answer: do you hold this much.
Building the minimum field, the next thing asked for was a daily fee on top of it, and the
two look alike enough in a settings pane to be built as one control. They are not the same
thing. A threshold is a predicate over a fact that already exists; a fee is an obligation the
room creates, satisfied by paying, again, for as long as you want to keep reading.

Four constraints fell out of building it, first as BRC-218 §11.4 and now BRC-190 §5:

**A fee needs a threshold under it.** Charging for holding nothing is a subscription, and §5.6
already specifies subscriptions with disclosure rules this screen has none of. So the fee
control only exists once a minimum is non-zero, and zeroing the minimum discards the fee.

**A fee needs a named recipient.** This is the one that changed the UI. An amount alone is a
charge nobody can refuse, audit, or attribute — the room collects and every participant is
party to something they cannot inspect. Naming a handle costs one field and makes the
arrangement legible.

**The room must not be able to pull it.** Enforcement is the gate itself: stop paying, stop
meeting the condition, contents hide under §11.3. Anything stronger is a standing authority,
and standing authority is `/subscribe`, not a room setting.

**It is a harsher filter than it looks.** §11.5(2) already called a holding gate a wealth test.
A fee tests what someone can keep giving up, and it removes people gradually rather than at
the door, where nobody watches. Hence §11.5(3): never on by default.

### 3.31 CHANGE — the sketch outgrew the document it was in

BRC-218 §11 was written in a page while the client was building gates, and it kept growing:
evaluation order, then the fee, then what the excluded reader is told, then what happens to
somebody already in the room who stops qualifying. By the time it had subsections it was a
specification about access control living inside a document about command syntax, and the
two have nothing to do with each other — a gate defines no verbs and §218 defines no gates.

So it is BRC-190 now, `apps/0190.md`, and §11 is a pointer. Four things are new, and three of them came out of re-reading our own
implementation rather than out of writing prose.

**Third-party evaluation leaks balances.** Our member list annotates anyone failing the gate
with the reason, and for a minimum that reason read "holds 12.32 BSV of the 21.8 required".
That is a private quantity about somebody else, rendered to anyone who opens settings — and
an administrator who can edit the minimum can binary-search a member's balance in a few
keystrokes. §3.3 draws the line at quantities rather than at reasons: an absent vouch is an
absence in a public record and costs nothing to name, a balance is not. Fixed in `gates.ts`;
only your own shortfall is quantified now.

**Unattributed statements must never gate.** §169's renounce rules make negative statements
unattributed by default, deliberately, so that speaking against somebody does not require a
reputation big enough to survive it. Wiring that store into an exclusion mechanism would let
an anonymous claimant lock a target out of every room using the gate, with no name to answer.
Both mechanisms are safe alone and dangerous composed, which is the kind of interaction
nobody notices while implementing either one. §4.3.2.

**"Could not check" is not "you do not qualify".** We had no third state. Fail-open is the
obvious hazard and everyone guards against it; fail-closed-and-say-nothing is the one that
sends a reader off to acquire a token they already hold. §3.1.3.

**A quorum gate.** Specified, not built. A vouch gate needs you to already know whose word
you trust, which a room's first members are precisely in the middle of working out. "Any N
distinct handles, from N distinct ecosystems" is the version a new room can actually
configure, and it reads the same attestations. §4.4.

Two further types stay unspecified for the reasons recorded under 3.27 — **stake** needs
custody and belongs with `/gate`, **recency** has no fact to read because §169 publishes no
registration date.

### 3.32 GAP — a gate says who may read, and says nothing about who may act

The Naka Motor Club room made the omission obvious. Its contract publishes rarity bands, and
the moment a room can read a band it can read a ladder — so the question stops being "may
they in" and becomes "what may they do once they are". Nothing in the gates covered it, and
the reflex answer is a list of appointed moderators, which is the administrator-shaped object
gates exist to replace, reintroduced one level down.

BRC-190 §8 derives roles from the same conditions as the door. Three roles, and no way to
name an individual into one. Rarity bands are thresholds — assigning mod to Rare makes
Legendary a mod too, because a rarer item that bought a *lesser* role is a rule nobody would
guess. Currencies use amounts, vouch gates optionally make their named handles admins, and
where several apply the strongest wins.

**A ban is a statement, not a row.** We modelled it on §169 §10.7 rather than as an array on
the room: an author, a time, a claim, scoped to the room so one moderator's decision cannot
follow somebody into every other room gating on the same handle's word. Attribution is
mandatory here, which reverses §10.7's default — that default protects someone speaking
against a peer at their own risk, and a moderator acting inside their own room is in the
opposite position.

**The interesting failure is not exclusion.** A derived ladder can empty itself: the only
Exotic holder sells, the thresholds are set above what anybody holds, the founder holds a
Common. Then there is no admin, and appointing one is a manifest change only an admin can
make. Three guards, each covering what the others cannot:

- **Custody underneath the derivation** (§8.4.1). One holder, admin by custody rather than by
  qualification, and exempt from the room's own gates — otherwise a room can lock out its own
  administrator by naming an attestor who later renounces them. Shown as custody, always,
  because an exemption nobody can see is a backdoor.
- **A refusal at edit time** (§8.4.3). A configuration under which no current participant
  would be an admin is refused, not warned about. It is checkable at the one moment somebody
  can still choose otherwise.
- **Bans strictly downward** (§8.2.4). No role bans its own rank, so no sequence of bans can
  empty the admin set.

And §8.4.5 for abandonment: with no holder present and no derived admin, the longest-standing
participant at the highest role acts as admin. Deterministic, so clients agree, and it means
an abandoned room degrades into a repairable one rather than a sealed one.

**What this costs, said out loud.** A role derived from a transferable band is a role for
sale at the floor price. That is the honest consequence of refusing to keep a list, it is
sometimes the right trade, and Security Considerations says so rather than letting a room
discover it when somebody buys in.

### 3.15 Implemented as specified, no changes needed

Recording these so the next reader knows they were exercised rather than skipped:

- §2.4 received text is never executable. Only locally-composed input is parsed. Nothing is
  parsed from inbound message content, display names, memos or search results.
- §2.6 parsing has no side effects. `parseCommand` is pure; effects happen after
  confirmation.
- §2.5 unsupported verbs are reported as unsupported and never reassigned. We decline
  `/message` but keep it registered so it reports correctly rather than falling through to
  chat.
- §3.4 satoshi amounts are shown alongside fiat everywhere an amount appears.
- §4.2 confirmations show the fully-qualified recipient.
- §5.12 `/revoke` lists the certificates it could revoke and requires a selection; a
  wildcard revocation takes a second confirmation.
- §6 reserved verbs parse and refuse, with a reason.
- §7 precedence.

---

## 4. Smaller notes

- **Fiat that cannot be converted.** A currency the client has no rate for must fail loudly.
  Substituting a stale or undisclosed rate is worse than refusing. We reject with "this
  client quotes USD only".
- **Implicit recipient in a DM.** In a one-to-one conversation the recipient argument is
  redundant, and requiring it makes the grammar feel bureaucratic. We treat it as optional
  there and resolve it to the conversation partner, showing the resolved handle in the
  confirmation. Worth specifying, because the alternative is every client inventing it.
- **Toll quoting.** A toll owed to the recipient should be shown as a separate line in the
  confirmation, not folded into the amount. The payer is agreeing to two different things.
- **Delegation with two certificates.** The case that exposes §5.12 is a delegate holding
  more than one certificate. Worth an example in the spec, since with one certificate the
  selection requirement looks like ceremony.
