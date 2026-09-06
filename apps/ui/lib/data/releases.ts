/**
 * table: releases — what shipped in each version, newest first.
 *
 * Kept as data rather than prose in a changelog file because the app renders it:
 * the About page shows the current version and the What's new pane reads this
 * list. One release is one entry, and a feature that is not written down here
 * does not appear anywhere in the product — which is the point of it being data.
 *
 * Every release gets its thumbnail from the sigil library, hashed from the
 * version string, so a new entry needs no artwork and two releases never look
 * alike.
 */

export interface ReleaseFeature {
  id: string;
  title: string;
  /** the one line the list row shows */
  summary: string;
  /** what it is and why it works that way */
  body: string;
  /** how to reach it, where it takes more than a sentence */
  steps?: string[];
  /** the specification section behind it, where there is one */
  reference?: string;
}

export interface Release {
  /**
   * Calendar version, `YYYY.SERIES.N` — the year, the series within it, then
   * which release of that series it was. Stored without the `v`, which every
   * surface adds when it prints one.
   *
   * Series `0` is everything before the first stable one, so the whole history
   * so far is `2026.0.N` counting up from the first release. That is the honest
   * reading of where this is: five builds into a year, none of them a `.1` yet.
   *
   * A number that says when rather than how much: nobody has to decide whether
   * a change is major, and a reader can tell how old a build is without a table
   * to look it up in. It follows that `N` restarts when the series does and
   * that the sequence carries no promise about compatibility — the notes do
   * that.
   */
  version: string;
  /** ISO date, so the pane can order and format it */
  date: string;
  /** what the release was about, in one line */
  headline: string;
  features: ReleaseFeature[];
}

export const releases: Release[] = [
  {
    version: "2026.0.6",
    date: "2026-08-23",
    headline: "Arriving, and being asked what you are here for.",
    features: [
      {
        id: "first-run",
        title: "A welcome that asks a question",
        summary: "Five cards, a handle, and then the setup you pick.",
        body: "Opening a client with everything switched on is a wall of apps nobody chose. The welcome opens on the four people the presets are named for, says what this is over three more pictures, asks for a handle, and then asks what you are here for — Thinker, Maker, Developer, Gamer, as many as you like. The answer is not a theme: it lays out the rail, connects the apps, switches on the catalogues those apps come from, and turns on Developer Tools if you asked for them.",
        steps: [
          "Pick as many presets as you like, or none — the plain setup is a real answer.",
          "Setting one moves the strip on to the next you have not answered.",
          "Run it again whenever you like from Preferences, under Onboarding.",
        ],
      },
      {
        id: "guided-tour",
        title: "A guided tour that points",
        summary:
          "Cards built from the presets you chose, over the real screen.",
        body: "Ten cards at most, assembled from your answer rather than a fixed script: four everybody gets — your handle, your inbox, getting paid, the vault — and one for each preset, about the thing that preset is for. Each card puts the screen it is describing behind itself and points at the piece of interface it means, scrolling it into view first so the pointer always lands on something you can see.",
        steps: [
          "It offers itself a couple of seconds after the welcome ends.",
          "Restart it any time from the help circle, bottom right.",
        ],
      },
      {
        id: "timeline",
        title: "A Timeline to read",
        summary:
          "The feed, with saved posts, lists, mutes and your own activity.",
        body: "Posts open into threads, replies and reposts and likes are yours to make, and everything you do lands in Activity with a date range and a filter by app. Timestamps carry the block height they were written at, so a post can be checked against the chain rather than taken on trust.",
      },
      {
        id: "workspaces",
        title: "Workspaces, and a strip that names them",
        summary:
          "Profiles are Workspaces, and the desktop shell says which you are in.",
        body: "A workspace keeps its own tabs, wallet, name and connected apps. The desktop shell now carries a strip above the app with an Update button when one is waiting, Home, every workspace by name, and a plus that opens Workspaces with its own control brought into sight. macOS keeps its traffic lights, Windows keeps its own buttons and Snap Layouts, and Linux is frameless with the three drawn here.",
        steps: [
          "Workspaces columns scroll under the rail rather than stopping at its edge.",
          "The rail's Workspaces button is optional — see Preferences.",
        ],
      },
      {
        id: "app-store",
        title: "The store's column is the setups you chose",
        summary: "Nexus Presets and the sources worth featuring, as cards.",
        body: "The column used to carry its own personas, which were the same idea as the presets and had drifted from them. It is the presets themselves now, reading the answer you gave on the way in, so a card here is already on if you picked it there. Below them, three catalogues wearing their own banner; their switch adds a source and installs nothing.",
        steps: [
          "Tapping a card scopes the store to what it holds.",
          "The switch applies the whole setup, and takes it away again.",
        ],
      },
      {
        id: "add-to-rail",
        title: "Add to rail",
        summary: "Keep the page you are on, with its own name and mark.",
        body: "Connecting a web listing has always meant pinning its address; this is the same act reached from the page itself, in the address bar and in the phone's sheet. The name is the site's own, cut back from its page title, and the mark is the largest icon that origin publishes rather than a 16px favicon stretched to fit. It appears in Connected Apps like any other connection, and removing it there takes it off the rail.",
        steps: ["Hold any rail tile to reveal a cross that disconnects it."],
      },
      {
        id: "live-rate",
        title: "Bitcoin priced at what it costs",
        summary:
          "One live rate and a real chart, from the chain's own explorer.",
        body: "Three different prices for BSV were written into this build, all of them stale, and one of them was printed to the reader as the rate they were being charged at. Every figure now reads a single live rate. The line beside the balance is real too — a month of daily closes, and a percentage measured against the last one rather than invented, which is why it says today rather than claiming a 24-hour window nothing here could measure. An asset's own page draws that month properly: a smoothed curve over a gradient, and dragging across it answers what your balance was worth on any day in it. The invented tokens keep their fixture prices, because those are the only prices they can have; their lines are now scaled to their own move, so a stablecoin that did not move draws flat.",
      },
      {
        id: "splits",
        title: "Splits you can actually raise",
        summary:
          "Divide an amount, chase it, pay your share of somebody else's.",
        body: "Splits was a list of four invented bills with a Mark paid button that forgot itself on reload. You can raise one now — what it is for, a total, handles from your contacts, evenly or a figure each — and it is written down, so what has settled is still true tomorrow. A reminder opens the conversation with the line already written and leaves the sending to you, starting the conversation if there is not one yet. And a split has two ends: one somebody else raised shows up under You owe, with your own share and a button that pays it. The share is marked when the money leaves, not when the sheet opens.",
        steps: [
          "Payments, then Splits, then New split.",
          "The total is what you are owed back — your own share is not part of it.",
          "Shares are independent: one failing can be retried without touching the rest.",
        ],
      },
      {
        id: "settings-persist",
        title: "Settings that remember",
        summary: "What you change survives a reload.",
        body: "A preference that forgets itself on every launch is not a preference. Everything Settings can change is written down, versioned so a future rename is a discarded blob rather than a crash, and coalesced so a slider does not write sixty times a second.",
      },
      {
        id: "legal",
        title: "Terms and privacy, in the app",
        summary: "Two tabs, written against what this client actually does.",
        body: "Keys held on your device with no recovery path, per-workspace app permissions, handles that resolve across ecosystems, payments that cannot be reversed, and Nexus Sync being off until you turn it on. The software licence is a separate document about a separate question, and these point at it rather than paraphrasing it.",
        steps: ["Help and resources, bottom right, then Legal summary."],
      },
      {
        id: "vault-doors",
        title: "A vault that shuts on its own",
        summary: "Keys, recovery phrases and private files behind a door.",
        body: "Nothing is escrowed and nothing leaves the device; the only thing that opens it is a passphrase you hold. The door seals itself the moment you leave the app rather than waiting to be told.",
      },
    ],
  },
  {
    version: "2026.0.5",
    date: "2026-08-05",
    headline: "Secrets that do not stay in the transcript.",
    features: [
      {
        id: "once",
        title: "Seal a secret with /once",
        summary: "A credential or document each handle can open exactly once.",
        body: "Every other payload in a chat is meant to be readable later — that is what a transcript is for. A password is the opposite. /once seals text, files, or both to each recipient's key, hands the payload over once, and drops it. This client cannot open what it sent, so a mistake cannot be resent, only burned and sealed again.",
        steps: [
          "Type /once, name one or more handles, then the secret. Quote it if it has spaces.",
          "Attach files and they go inside the seal rather than into the thread.",
          "Add a duration to bound how long it stays openable.",
          "Reply to your own /once with /cancel to burn whatever nobody has taken.",
        ],
        reference: "BRC-218 §5.22",
      },
      {
        id: "saved",
        title: "Saved messages",
        summary: "Put a line aside and jump straight back to it.",
        body: "A date somebody committed to, or an answer you would otherwise scroll for. Saving copies the line at the moment you save it, so a message you sent this session is still there afterwards, and the list says which room it came from — a line you kept a week ago is unplaceable without it.",
        steps: [
          "Right-click a message and choose Save message.",
          "Open the bookmark in the bar under the conversation list.",
          "Click a row to open that conversation at that message.",
        ],
      },
      {
        id: "message-options",
        title: "Message options",
        summary: "Copy a link, render a still, save it, or open it on chain.",
        body: "Right-click a message, or long-press on a touch screen. What is offered depends on the message: View on chain appears only where there is a transaction to open, because a link to a transaction that does not exist teaches you to distrust every other one.",
      },
      {
        id: "render-image",
        title: "Render a message as an image",
        summary: "A shareable still, composed rather than screenshotted.",
        body: "The bubble is built for a narrow column with hover states and live popovers, none of which survive being flattened. The still is its own layout at its own size, drawn on a canvas so what you copy is exactly what you see.",
      },
    ],
  },
  {
    version: "2026.0.4",
    date: "2026-08-04",
    headline: "Deciding what outlives a conversation.",
    features: [
      {
        id: "chain-policy",
        title: "What goes on chain",
        summary: "Messages, delivery proofs, or nothing.",
        body: "Three settings that differ in what somebody can still do afterwards: delete it, prove it, or neither. Delivery proofs is the default — anchoring everything makes an irreversible choice for you, and anchoring nothing leaves you unable to prove a delivery you may need to.",
        steps: [
          "Set the default in Settings, under Privacy.",
          "Override it for one room from that conversation's settings.",
          "Anchoring whole messages is offered per conversation only.",
        ],
      },
      {
        id: "permanence",
        title: "A confirmation before the first permanent message",
        summary:
          "Asked once per conversation, and again if the setting changes.",
        body: "Where a room anchors messages, the composer says so and the first post asks — showing the message itself, because the agreement should be about those words rather than about the idea of permanence. Cancelling leaves the draft exactly as typed.",
      },
      {
        id: "settings",
        title: "Settings",
        summary: "One place for sync, privacy, browsing and appearance.",
        body: "Reachability and message tolls were commands you could only reach by typing them into a thread, which meant nobody who had not read the grammar would ever find them. They live here now, alongside what this client writes to the chain.",
      },
      {
        id: "repositories",
        title: "A warning before an unvetted app store",
        summary: "Adding a repository is a decision, not a setting.",
        body: "A repository decides which code the hub is willing to offer you, so it is closer to a permission than a preference. Every path to adding one now states plainly that nothing in it has been reviewed, and by whom it has not.",
      },
    ],
  },
  {
    version: "2026.0.3",
    date: "2026-08-01",
    headline: "Moving a thing, and holding both halves of a trade.",
    features: [
      {
        id: "send",
        title: "Transfer a collectible with /send",
        summary: "Moves the thing itself, not a claim on it.",
        body: "Every value verb before this moved a quantity. /pay cannot express 'this one, the numbered one, the one in the picture'. The confirmation shows the artwork and the serial, because confirming a collectible against its name and id asks you to verify from the label on the box.",
        reference: "BRC-218 §5.20",
      },
      {
        id: "escrow",
        title: "Commit one side of a trade with /escrow",
        summary: "A named agent holds both halves for a bounded time.",
        body: "No script, no arbiter discovery, no dispute path — just custody by somebody you both name. Nothing is arbitrated, so the card says the uncomfortable thing in words for exactly as long as it is true: the agent can keep both halves and nothing here stops them.",
        reference: "BRC-218 §5.21",
      },
    ],
  },
  {
    version: "2026.0.2",
    date: "2026-07-31",
    headline: "Rooms with doors, and roles nobody appoints.",
    features: [
      {
        id: "gates",
        title: "Access gates",
        summary: "Hold a token, a lock, or somebody's word to get in.",
        body: "Each gate is independent and additive, and a candidate has to pass every one that is on. An on gate with an empty list gates nobody rather than everybody, because configuration in progress should not lock a room.",
        reference: "BRC-190",
      },
      {
        id: "roles",
        title: "Roles derived from the door",
        summary: "Nobody is made a moderator; they hold something.",
        body: "A list of appointed moderators is the administrator-shaped object gates exist to replace, reintroduced one level down. Roles read the same conditions as the door — which means selling the item takes the role with it, and the product says so rather than letting a room find out.",
        reference: "BRC-190 §8",
      },
      {
        id: "timelock",
        title: "A gate on value nobody takes custody of",
        summary: "Locked to your own key, and it comes back.",
        body: "A holding can be borrowed for the moment of the check; a lock cannot. Nobody takes custody, which is what makes it specifiable — there is no counterparty, no refund path, and nothing to arrange when the room ends.",
      },
    ],
  },
  {
    version: "2026.0.1",
    date: "2026-07-29",
    headline: "Standing behind somebody, and withdrawing it.",
    features: [
      {
        id: "vouch",
        title: "/vouch",
        summary: "Publicly stand behind someone, signed with your key.",
        body: "Deliberately separate from /attest: one says this handle is this key, the other says I stand behind this person. Letting the two look alike would let regard pass for verification.",
      },
      {
        id: "renounce",
        title: "/renounce",
        summary: "Withdraw your regard. Anonymous by default.",
        body: "A renunciation invites retaliation, so hiding the renouncer is the default and showing them is the opt-in. The claim is still signed — anonymity here is about display, not about accountability to the network. Unattributed statements never gate a room.",
      },
    ],
  },
];

/** The version this build is. */
export const currentRelease: Release = releases[0]!;

export function getRelease(version: string): Release | undefined {
  return releases.find((release) => release.version === version);
}
