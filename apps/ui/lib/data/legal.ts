/**
 * table: legal — the terms of use and the privacy note, in full.
 *
 * Two documents rather than one, because they answer different questions: what
 * you may do here, and what is known about you while you do it. They are shown
 * as two tabs of one pane for the same reason a licence and a privacy policy
 * usually sit on the same page — nobody goes looking for one without wondering
 * about the other.
 *
 * These are about the *product*. The Open BSV License in ./licence.ts is about
 * the *software*, and the two do not overlap: one governs copying and modifying
 * the code, the other governs running this build of it. The terms below point at
 * the licence rather than restating it, because a paraphrase of a legal
 * instrument is a second instrument that disagrees with the first.
 *
 * Written against what this client actually does. Every claim here has
 * something in the app behind it — keys held on the device, per-workspace
 * permissions, BRC-169 resolution, the chain being public, Sync being off until
 * somebody turns it on and pays for it. If a feature changes so that a sentence
 * stops being true, the sentence is what is wrong.
 */

export interface LegalSection {
  heading: string;
  /** paragraphs, in order */
  body: string[];
}

export interface LegalDocument {
  id: "terms" | "privacy";
  /** the word on the tab */
  tab: string;
  title: string;
  /** one line under the title, before the first heading */
  intro: string;
  sections: LegalSection[];
}

/** When these were last written. Shown once, at the foot of both. */
export const legalUpdated = "August 2026";

export const legalDocuments: LegalDocument[] = [
  {
    id: "terms",
    tab: "Terms of use",
    title: "Terms of use",
    intro:
      "What you agree to by running Nexus, in the plainest words we can put it in.",
    sections: [
      {
        heading: "What this is",
        body: [
          "Nexus is a client you run on your own device. It is a browser, a wallet, an identity, an inbox, a vault and whatever apps you connect to it, arranged into workspaces that keep their own tabs, balances and names.",
          "It is not a bank, not a custodian, not an exchange and not a publisher. Nothing here holds your money or your keys on your behalf, and nothing here reviews what you or anybody else says through it.",
        ],
      },
      {
        heading: "The software, and the licence over it",
        body: [
          "The software is granted under the Open BSV License Version 6 by BSV Association. That licence, not this page, governs copying, modifying and redistributing it, and it carries one condition worth knowing before you build on it: the software and anything derived from it may only be used on the BSV Blockchain.",
          "The copy that applies to you is the one shipped with the build you are running. It is in the app, in full, and you can read it from here.",
        ],
      },
      {
        heading: "Your keys are yours, and so is the loss",
        body: [
          "Keys are generated on your device and stay there. There is no account to reset, no support line that can sign for you, and no copy of your recovery phrase anywhere but where you put it.",
          "The Vault locks things away and seals itself when you leave. It does not escrow them. If you lose the phrase and the device, what they opened is gone, and that is a property of holding your own keys rather than a gap in this product.",
        ],
      },
      {
        heading: "You are responsible for what you send",
        body: [
          "Messages, posts, payments and signatures made with your key are yours. We do not write them, approve them or edit them, and we accept no responsibility for what they say or what follows from them.",
          "Anything anchored to the chain is permanent. Deleting a post removes it from this client's view of the world; it does not remove it from the chain, and it does not remove it from anybody who already read it.",
        ],
      },
      {
        heading: "What you may not do here",
        body: [
          "Anything that would be a crime somewhere else is still a crime here. In particular: planning or committing crimes, threatening violence, harassing people, child sexual abuse material, intimate images shared without consent, fraud, infringing copyright, publishing other people's private information, pretending to be somebody you are not, and interfering with the network or with other people's use of it.",
          "Being pseudonymous is not being anonymous, and a key that signed something is evidence that it signed it.",
        ],
      },
      {
        heading: "You are responsible for what you receive",
        body: [
          "The web is the web. Pages you open here are the pages their authors wrote, and a page that can talk to a wallet is still just a page asking. Read what it is asking for before you agree.",
          "The same goes for apps. Repositories are lists somebody else maintains, signatures say who published something rather than that it is any good, and turning on unsigned repositories means accepting apps nobody has checked, including us.",
        ],
      },
      {
        heading: "Apps you connect are not ours",
        body: [
          "An app you connect gets what its permissions allow and nothing else, scoped to the workspace you connected it in. What it does with that is between you and whoever wrote it, under their terms rather than these.",
          "You can see every connection, narrow what it may do, set a ceiling on what it may spend, and withdraw its access at any time. Withdrawing access stops it from asking again; it does not undo what it already did.",
        ],
      },
      {
        heading: "Payments are final",
        body: [
          "A confirmed transaction cannot be reversed, by us or by anybody. There is no chargeback, no dispute process and no way to recall a payment sent to the wrong handle. Check the name before you confirm.",
          "A payment link is a bearer instrument: whoever opens it can pay it, and whoever can pay it can be anybody you sent it to. Tokens and collectibles are worth what somebody will give you for them, which is not a number this app is promising.",
        ],
      },
      {
        heading: "Your handle",
        body: [
          'A handle under BRC-169 resolves from more than one place, so somebody on another ecosystem can address you without either of you sharing a server. That is the point of it, and it means "reachable by everyone" is wider than one app.',
          "A handle is a name, not a trademark, and holding one here does not settle anybody else's claim to it. Giving one up starts a short grace window before it can be taken, so a change of mind a second later is survivable and somebody waiting to wear your name is not rewarded for watching.",
        ],
      },
      {
        heading: "Nexus Sync is optional, and paid",
        body: [
          "Sync is off until you turn it on. Everything above is true whether or not you do, and nothing about running this client requires it.",
          "Turning it on is a subscription. What is due, how often, and what happens if you stop paying are shown before you confirm, and a card subscription renews until you cancel it from Settings. Paying from the wallet buys a fixed span up front and does not renew.",
        ],
      },
      {
        heading: "No warranty, and no liability",
        body: [
          "The software is provided as it is, with no warranty of any kind. We do not promise it is free of faults, that it will be available, or that it is fit for what you intend to do with it.",
          "We are not liable for losses arising from using it or from anything anyone else does through it, except where the law does not permit that to be excluded.",
        ],
      },
      {
        heading: "Ending things",
        body: [
          "You can stop at any time by closing it. Your keys, your vault and your local data are on your device and stay there.",
          "Access to the parts we run, which is Sync and the catalogues we publish, can be withdrawn without notice. That does not reach into the parts that are yours: the chain does not need us, and neither does a key.",
        ],
      },
    ],
  },

  {
    id: "privacy",
    tab: "Privacy",
    title: "Privacy",
    intro:
      "What is known about you while you use Nexus, and by whom. Mostly the answer is nobody.",
    sections: [
      {
        heading: "What is collected",
        body: [
          "By us, in a plain install: nothing. There is no account, no email address, no password, no analytics and no advertising identifier. We do not know that you installed this, and we do not know that you are reading this.",
          "What exists is what your device holds so the app can work: your keys, your vault, your workspaces and their tabs, your settings, your handles and your message history.",
        ],
      },
      {
        heading: "Where it is kept",
        body: [
          "On this device. Settings and workspace state live in this browser profile's own storage; keys and vault contents live behind the lock you set for them.",
          "Clearing this site's data, or clearing a workspace, removes it. There is no copy on a server to ask us to delete, because there is no server holding one.",
        ],
      },
      {
        heading: "Handles, and the ecosystems they resolve through",
        body: [
          "Resolving a BRC-169 handle means asking a registry, which is a third party with its own terms. What it learns is that somebody asked about a handle.",
          "Who may reach you is enforced at your messagebox rather than by the sender's client, so narrowing it actually narrows it. It does not unregister the handle, and it does not reach into ecosystems that already resolve it.",
        ],
      },
      {
        heading: "What goes on chain",
        body: [
          "The chain is public and it is permanent. Anything anchored to it can be read by anyone, now and later, and it stays readable after you stop using this client.",
          "Each conversation decides for itself what it anchors, and the setting for new ones is in Privacy. Payments are on chain by their nature: the amount and the addresses are visible even when the names either side of them are not.",
        ],
      },
      {
        heading: "Pages you visit",
        body: [
          "Browsing here is browsing. Sites see your IP address, can set cookies and can try to follow you between pages, exactly as they would anywhere else. Tracker blocking and the cookie policy are in Browsing, and per-site permissions in Permissions.",
          "Where you go is not sent to us. There is no history sync, no telemetry and no safe-browsing lookup that reports a URL to anybody.",
        ],
      },
      {
        heading: "Apps you connect",
        body: [
          "An app sees what you granted it, in the workspace you granted it in. A second workspace is a second set of answers, which is most of the reason to keep more than one.",
          "What an app does with what it sees is its own business, under its own privacy terms. Connected Apps lists every one of them and lets you take it back.",
        ],
      },
      {
        heading: "Nexus Sync, if you turn it on",
        body: [
          "Sync is opt-in and off by default, and this is the only section that describes anything leaving your device on our account. Nothing here applies until you switch it on.",
          "What it moves is encrypted before it leaves, with a key we do not hold, so what the service stores is a blob it cannot read. What it can see is the shape of the traffic: that a device checked in, roughly when, and roughly how much there was.",
          "Paying for it involves a payment processor, who needs what a payment processor needs. Paying from the wallet is a transaction on chain like any other. Turning Sync off stops the copying; deleting the stored blob is a separate act, and it is offered.",
        ],
      },
      {
        heading: "Getting rid of it",
        body: [
          "Clear on quit decides what goes each time you close the app. Clearing site data removes the rest, and deleting a workspace removes what belonged to it.",
          "Two things survive all of that, and neither is ours to remove: whatever is on the chain, and whatever somebody else already has a copy of.",
        ],
      },
    ],
  },
];
