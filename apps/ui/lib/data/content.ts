/**
 * table: content — UI copy keyed by section. Kept as one typed object for
 * ergonomic access now; migrates to a key/value content table later.
 */
export const content = {
  brand: {
    name: "Nexus",
    /** the short one, for a lockup where a full sentence will not fit */
    slogan: "All the net you need",
    tagline: "Your apps, your keys, your Nexus.",
    description:
      "Nexus is a workspace that bundles a browser, wallet, signing, publishing and transaction tools into one place.",
  },
  library: {
    spaces: {
      title: "Spaces",
      newTab: "New Tab",
      clear: "Clear",
      dragHint: "Drag to add Favorites",
      dragSubHint: "Favorites keep your most used sites and apps close",
    },
    downloads: {
      title: "Downloads",
      empty: "Nothing downloaded in this workspace.",
      profile: "Workspace",
      failed: "Stopped before it finished",
      retry: "Try again",
    },
    /*
     * Two halves of one surface, and the verbs have to keep them apart.
     *
     * "Connect" is the web3 word — the same act Coinbase calls a dapp connection
     * and MetaMask calls a connected site — and it means a grant against this
     * workspace's wallet. It is never a synonym for downloading: a built-in app was
     * already in the binary, and a web app stays on somebody else's server.
     *
     * So nothing here says install, purchase or update. "Add to rail" is the whole
     * promise on the site side, and "Connect" is the whole promise on the app side.
     */
    apps: {
      title: "Apps",
      /* What the store is, in the line under its heading. */
      storeSubtitle:
        "Connect apps to your Nexus. Connected apps appear in the sidebar rail.",
      installedSection: "Connected",
      availableSection: "Available",
      install: "Connect",
      uninstall: "Disconnect",
      essential: "Essential",
      installedBadge: "Connected",
      empty: "No apps connected. Add one below.",
      /*
       * The connected-sites list — the phone's version of the same surface, and
       * the affordance every wallet ships: the sites you have connected, and a
       * way to disconnect each one. Coinbase calls it Dapp Connections,
       * MetaMask calls it Connected sites. See docs/SPEC-design-catchup.md §1.
       */
      sitesTitle: "Connected sites",
      subtitle:
        "Websites you've connected to this workspace. Opening one opens the website.",
      onRail: "On your rail",
      add: "Add to rail",
      remove: "Remove from rail",
      addPlaceholder: "example.com",
      addLabel: "Add a site",
      addInvalid: "That doesn't look like a web address.",
      addDuplicate: "That site is already on your rail.",
      /*
       * This points at the field directly above it, because that field is the
       * only thing in the build that pins a site. It used to say "Open a site in
       * Browser, then add it to your rail", which taught a path that does not
       * exist: there is no Add to rail in the browse chrome, in the page-options
       * sheet, or on the origin chip. When one lands, this string changes with it.
       */
      emptySites:
        "Nothing here yet. Type a web address above to add your first site.",
      rename: "Rename",
    },
  },
  wallet: {
    /* The multi-wallet switcher, shared by the wallet app and Workspaces. */
    switcher: {
      title: "Wallets",
      active: "Spending from this",
      use: "Use",
      switched: "Now spending from this wallet",
      locked: "Locked",
      sealed: "Locked",
      unlock: "Unlock",
      unlocked: "Unlocked, and now active",
      unlockTitle: "Password",
      unlockPlaceholder: "Your wallet password",
      unlockNote:
        "Nothing here checks it. A prototype that pretended to would be teaching a habit it cannot keep.",
      addTitle: "Add a wallet",
      addCreate: "Create a wallet",
      addCreateHint: "A new key, made here and held by you.",
      addPhrase: "Import a recovery phrase",
      addPhraseHint: "Twelve or twenty-four words from another wallet.",
      addKey: "Import a private key",
      addKeyHint: "A single key, in WIF or hex.",
      nameLabel: "Name",
      namePlaceholder: "Everyday, Savings, Shop float…",
      phraseLabel: "Recovery phrase",
      phrasePlaceholder: "word word word…",
      keyLabel: "Private key",
      keyPlaceholder: "L1aW4aubDFB7yfras2S1mN3bqg9…",
      importWarning:
        "Anything typed here can spend everything it holds. Nothing in this prototype is sent anywhere, but that is a habit worth keeping outside it.",
      importAction: "Import",
      added: "Added, and active in this workspace",
      scopeNote:
        "Picking one connects it to this workspace. A workspace uses one wallet at a time.",
    },
    balanceLabel: "Total balance",
    totalValue: "Portfolio value",
    change24h: "past 24 hours",
    noRate: "Exchange rate unavailable",
    assets: "Assets",
    baseCurrency: "Base",
    sections: "Wallet sections",
    filters: "Activity",
    back: "Back",
    loading: "Loading…",
    notFound: "Asset not found",
    protocol: "Protocol",
    issuer: "Issuer",
    independent: "Independent",
    peg: "Peg",
    activityIn: "Activity in",
    noTokenActivity: "No activity in this asset yet.",
    noActivity: "No transactions in this view.",
    noMemo: "No memo",
    memo: "Memo",
    networkFee: "Network fee",
    txid: "Transaction id",
    copyTxid: "Copy transaction id",
    copied: "Copied",
    viewOnChain: "View on chain",
    timeline: {
      submitted: "Submitted",
      delivered: "Delivered to their messagebox",
      confirmed: "Confirmed on chain",
      unbroadcast:
        "Delivered unbroadcast. The recipient decides when it hits the network.",
    },
    collectibles: {
      title: "Collectibles",
      /* The accessible name for the field that replaced the collection's
         heading. The visible watermark is the collection's own name, which says
         where you are but not what the box does. */
      searchCollection: "Search",
      noMatches: "Nothing in here matches that.",
      /* Tab labels, so short enough to sit in a row of three. */
      buckets: {
        permanent: "Permanent",
        finite: "Valid",
        expired: "Expired",
      },
      emptyBucket: "Nothing in this group yet.",
      bucketHints: {
        permanent: "Art, titles and certifications that never lapse.",
        finite: "Tickets and memberships with a date on them.",
        expired:
          "Kept rather than dropped, so a redeemed ticket stays as proof.",
      },
      status: { redeemed: "Redeemed", expired: "Expired", valid: "Valid" },
      noIssuer: "No issuer",
      inCollection: "in this collection",
      traits: "Traits",
      rank: "Rank",
      ofSupply: "of",
      serial: "Serial",
      contract: "Contract",
      attained: "Acquired",
      validThrough: "Valid through",
      issuedBy: "Issued by",
      copySerial: "Copy serial number",
      copyLink: "Copy link",
      viewIssuer: "Issuer site",
      burn: "Burn",
      burnTitle: "Burn this collectible?",
      burnBody:
        "Burning spends the output that holds it. Nobody can restore it, including the issuer.",
      burnConfirm: "Burn it",
      burned: "Burned",
      autoBurn: "Burn when it expires",
      autoBurnHint:
        "Once it lapses, spend it away automatically rather than leaving dead weight in the wallet.",
      spinHint: "Drag to spin · arrow keys work too",
      showingBack: "Showing the back",
      reset: "Reset the view",
    },
    openMarket: "Open Market",
    noCollectibles: "Nothing held yet.",
    links: "Payment links",
    newLink: "New link",
    linksHint:
      "A link anyone can pay, without needing your address. Share it, and payments land against your handle.",
    /* "Active" rather than "Open": a payment link is not a door, and next to
       Closed and Expired the question it answers is whether it still takes
       money. */
    linkStatus: { open: "Active", closed: "Closed", expired: "Expired" },
    linkTabs: { active: "Active", archived: "Archived" },
    archiveLink: "Archive",
    restoreLink: "Restore",
    previewLink: "Preview",
    /* The preview is somebody else's screen, which is the whole reason to look
       at it — you cannot see your own link the way the person paying does. */
    previewTitle: "What the payer sees",
    previewAccepting: "Accepting until",
    previewPay: "Pay",
    previewNote: "A preview. Nothing here is live, and no payment can be made.",
    linkArchived: "Archived",
    linkRestored: "Back in Active",
    noArchivedLinks: "Nothing archived.",
    /*
     * The new-link form.
     *
     * Two kinds of link, because that is what the seeded ones are: one names a
     * price and one lets the payer decide. Everything else — which asset, how
     * long it lasts, what it is for — every link has.
     */
    newLinkPane: {
      title: "New payment link",
      descriptionLabel: "What is it for",
      /* The kinds of thing rather than one of them. The old watermark was a
         seeded link's own description, which read as an instruction to sell
         agricultural sample kits. */
      descriptionPlaceholder: "Deposit, invoice, ticket…",
      descriptionHint: "The payer sees this, so name the thing being paid for.",
      kindLabel: "Amount",
      kindFixed: "Fixed price",
      kindOpen: "Payer chooses",
      kindFixedHint: "Everyone pays the same amount.",
      kindOpenHint: "Each payer decides what to send.",
      amountLabel: "Price per payer",
      assetLabel: "Paid in",
      assetEmpty: "Choose an asset",
      expiryLabel: "Stops accepting",
      expiryDays: "days from now",
      submit: "Create link",
      created: "Payment link created",
      /* Said once, on the form, rather than discovered after sharing it. */
      noBackendNote:
        "Nothing is published. A link made here lasts as long as this session.",
    },
    perPayer: "per payer",
    payerChooses: "Payer chooses the amount",
    collected: "collected",
    copyLink: "Copy link",
    linkCopied: "Link copied",
    linkComingSoon: "Creating links is coming soon",
    contacts: "Contacts",
    searchContacts: "Search name or handle",
    searchActivity: "Search activity",
    favourites: "Favourites",
    allContacts: "All",
    noContacts: "Nobody matches that.",
    requestInMessages: "Requests are sent from Messages",
    actions: {
      message: "Message",
      pay: "Pay",
      request: "Request payment",
      whois: "Look up identity",
    },
    favourite: "Add to favourites",
    unfavourite: "Remove from favourites",
    favourited: "added to favourites",
    unfavourited: "removed from favourites",
    splits: {
      title: "Splits",
      hint: "An amount divided across handles. Shares are independent, so one failing does not undo the others.",
      ways: "ways",
      of: "of",
      settledCount: "settled",
      settled: "Fully settled",
      stillOwed: "still owed to you",
      markPaid: "Mark paid",
      remind: "Send a reminder",
      retry: "Retry this share",
      reminded: "Reminder sent to",
      settledUp: "settled up",
      independentNote:
        "Each share is its own payment. A failed one can be retried without touching the rest.",
    },
    contactsHint:
      "The same people you message. A verified handle is one whose certificate checks out and whose key at least one peer vouches for.",
    verified: "Verified",
    verifiedHint:
      "This handle's certificate is valid and peers have attested to its key, so you are paying the person the handle names.",
    openMessages: "Open Messages",
    billsHint:
      "An amount divided across handles. Shares are independent, so one failing does not undo the others.",
    ofPaid: "of",
    shareStatus: { paid: "Paid", pending: "Pending", failed: "Failed" },
    asset: "Asset",
    amount: "Amount",
    to: "To",
    from: "From",
    toPlaceholder: "Name or @handle",
    max: "Max",
    change: "Change",
    reviewSend: "Review and send",
    sent: "Sent to",
    sentFromWallet: "Sent from Wallet",
    qrLabel: "Payment code",
    yourHandle: "Your handle",
    copyHandle: "Copy handle",
    receiveHintBsv:
      "Anyone can pay this handle in BSV. Amounts arrive unbroadcast, so you choose when to settle.",
    receiveHintToken:
      "Anyone can send this token to your handle. The issuing ecosystem is what makes it redeemable.",
    exchange: "Exchange",
    confirmExchange: "Confirm exchange",
    exchanged: "Exchanged",
    rate: "Rate",
    midMarket: "Mid-market rate",
    noSpread: "No spread added",
    /*
     * The two verbs, and they are the app's own rather than a bank's.
     *
     * Keys stay `send`/`receive` — fourteen call sites read them and renaming
     * those buys nothing — but what a person sees is Pay and Get paid, which is
     * what the app is called and what the act actually is. "Receive" describes
     * something happening to you; getting paid is something you arranged.
     */
    send: "Pay",
    receive: "Get paid",
    historyTitle: "Transaction history",
    pendingBadge: "Pending",
    subscriptionsTitle: "Subscriptions",
    subscriptionsHint:
      "Standing payments your wallet executes. Nobody can pull from you, and cancelling takes effect before the next run.",
    subscriptionCancel: "Cancel",
    subscriptionCancelled: "Subscription cancelled",
    subscriptionVaries: "satoshi amount varies with the rate",
  },
  signer: {
    title: "Documents",
    keysTitle: "Your keys",
    signAction: "Sign document",
    awaiting: "Awaiting signature",
    signed: "Signed",
    verified: "Verified on-chain",
  },
  publisher: {
    title: "Your library",
    uploadAction: "Publish new",
    processing: "Processing",
    draft: "Draft",
    onChain: "On-chain",
  },
  txViewer: {
    listTitle: "Recent transactions",
    detailTitle: "Transaction details",
    overlaysTitle: "Overlay details",
    inputs: "Inputs",
    outputs: "Outputs",
    unconfirmed: "Unconfirmed",
  },
  messages: {
    title: "Messages",
    compose: "New message",
    search: "Search conversations",
    encrypted: "End-to-end encrypted",
    messagePlaceholder: "Message",
    emptyList: "No conversations yet.",
    noUnread: "Nothing unread.",
    noResults: "No conversations found",
    emptyThread: "Select a conversation to start messaging.",
    notFound: "Conversation not found.",
    sayHello: "Say hello to",
    breakIce: "Break the ice with a friendly message.",
    tip: "Send BSV",
    attach: "Attach a photo or video",
    emoji: "Emoji",
    voice: "Voice message",
    send: "Send message",
    back: "Back to conversations",
    viewProfile: "View profile",
    openOnWeb: "Open profile on the web",
    editConversation: "Edit conversation",
    photo: "Photo",
    video: "Video",
    mediaMixed: "Photos and videos",
    download: "Download",
    you: "You",
    someone: "Someone",
    /** ecosystem hovercard, opened from a mark */
    ecosystemCard: {
      about: "about this ecosystem",
      authority: "Authoritative for its handles:",
      peopleHere: "people you talk to here",
      issues: "Issues",
      ownCommands: "Own commands:",
      numeric: "Handles are account numbers, with a name alongside.",
    },
    /** Slack-style profile hovercard */
    hovercard: {
      actions: {
        profile: "Open full profile",
        vouches: "Who vouches for them",
        message: "Message",
        pay: "Pay",
        request: "Request payment",
        vouch: "Vouch for them",
        openOn: "Open profile on",
      },
      members: "Members",
    },
    /** `@`-mention autocomplete */
    mentions: {
      label: "Mention someone",
      noMatches: "No handles match",
      enterKey: "enter",
      recentHint: "Recently messaged, across every ecosystem",
      searchHint: "↑↓ to choose · ⏎ to insert · esc to dismiss",
    },
    /** `/`-command autocomplete */
    commands: {
      label: "Commands",
      open: "Commands",
      noMatches: "No command matches",
      hint: "↑↓ to choose · ⏎ to insert · esc to dismiss",
      reserved: "Reserved",
      reservedHint: "Reserved by BRC-218 §6, not yet specified",
    },
    andYou: "and you",
    startedWith: "Started a conversation with",
    noThreadWith: "No conversation yet with",
    replyingTo: "Replying to",
    clearReply: "Clear reply",
    replyForCommand: "Reply, and bind /tip, /sign or /receipt to this message",
    /** starting a conversation from the sidebar */
    newChat: {
      title: "New conversation",
      hint: "Pick one person for a direct message, or several for a group.",
      search: "Search people",
      start: "Start chat",
      startGroup: "Start group",
      cancel: "Cancel",
      open: "New conversation",
      unread: "Unread",
      unreadHint: "Show only conversations with unread messages",
      /* the New group state, entered from the row above the results */
      newGroup: "New group",
      newGroupHint: "Pick members, then decide who is allowed to join.",
      groupTitle: "New group",
      createGroup: "Create group",
      back: "Back",
      membersLabel: "Members",
      searchMembers: "Search people",
    },
    /** conversation tabs, on the bottom edge of the chat header */
    standing: {
      title: "Still acting for you",
      empty:
        "Nothing is standing. No certificates issued, no subscriptions running, no tolls set, nothing being watched.",
      certificates: "Certificates you issued",
      subscriptions: "Subscriptions you started",
      tolls: "Tolls you set",
      watching: "Handles you are watching",
      lapsed: "No longer standing",
      reach: "Who can reach you",
      reachValue: "Scope is set to",
      perAction: "per action",
      noCap: "no cap",
      expires: "expires in",
      noExpiry: "no expiry",
      thisThreadOnly: "this conversation only",
      every: "every",
      to: "to",
      from: "from",
      fromAnyone: "from anyone not in your contacts",
      perMessage: "per message",
      nextRun: "next run",
      watchBound: "Key and certificate, checked by this client",
      withdrawnNote:
        "Withdrawn by the sender. Nothing moved, and nothing is owed.",
      revokedBound:
        "Revoked. Kept here so you can tell it lapsed rather than never existed.",
      footer:
        "All of this keeps working without asking you again. Revoke a certificate with /revoke, stop a subscription with /subscribe off, and lift a toll with /trolltoll off.",
    },
    /* The escrow lifecycle, from one side committed to both delivered. */
    escrow: {
      waiting: "One side committed",
      awaitingAgent: "Both sides in, awaiting the agent",
      held: "Held by the agent",
      rejected: "Declined by the agent",
      released: "Released to both sides",
      expired: "Window closed, nothing matched",
      until: "until",
      heldBy: "Held by",
      trustWarning:
        "Nothing has moved yet. If the agent accepts, they hold both sides at once, and nothing here can make them hand either one over.",
      heldWarning:
        "The agent is holding both sides. Only they can release them, and only if they choose to.",
      accept: "Accept and hold",
      reject: "Decline",
      release: "Release to both sides",
      acceptedToast: "Holding both sides",
      rejectedToast: "Escrow declined",
      releasedToast: "Released to both sides",
      acceptedPost: "The agent accepted and now holds both sides.",
      rejectedPost: "The agent declined. Nothing moved.",
      releasedPost:
        "The agent released. The asset and the payment have changed hands.",
      rejectedNote:
        "Nothing moved. Either side can commit again to somebody else.",
      releasedNote: "Both halves delivered. The asset is theirs to send on.",
      theirCall: "Only the named agent can accept or decline this.",
    },
    /* The one-time secret `/once` seals, and the single opening it allows. */
    once: {
      /* Five glyphs whatever the payload, on purpose: a mask that grows with
         the secret tells a reader whether they are looking at a PIN or a key,
         which is most of what the seal was hiding. */
      sealedMask: "●●●●●",
      spentMask: "○○○○○",
      sealedLabel: "Sealed secret, not opened yet",
      spentLabel: "Secret already opened",
      voidLabel: "Secret gone, never opened",
      onlyOnce:
        "Sealed to the handles above and no other keys, and each opens exactly once.",
      reveal: "Reveal it once",
      revealCost:
        "Opening it spends it and tells them you opened it. There is no second look.",
      revealedAt: "Opened",
      notRevealed: "Not opened yet",
      /* Per-addressee, where one /once went to several handles. */
      ofOpened: "of",
      openedAddressees: "addressees have opened theirs",
      waitingShort: "waiting",
      burnedShort: "burned",
      lapsedShort: "lapsed",
      openableUntil: "Openable until",
      burnedNote:
        "Burned by the sender before it was opened. Anyone who had already opened theirs still has it.",
      lapsedNote:
        "The window closed with this copy unopened. Nothing was read, and nothing can be now.",
      copy: "Copy",
      copied: "Copied",
      save: "Save",
      fileSealed: "document sealed with it",
      filesSealed: "documents sealed with it",
      keepIt:
        "This is the only time it is shown. Close this and it is gone from here for good.",
      keepItFiles:
        "This is the only time it is shown. Save anything you need before closing — the documents are unreachable after that, here and anywhere else.",
      /* The prototype stand-in for the counterparty, labelled as one. */
      rehearseHint:
        "Prototype: there is only one device here, so you can open it as them. In reality they do this on theirs and you only see the seal go hollow.",
      rehearseAs: "as",
      rehearseToast: "Opened on behalf of",
      rehearseToastNote:
        "Prototype only. A real sender never sees the contents — just that it was collected",
      goneNote:
        "The payload is gone. What stays is that it was opened, and when.",
      goneNoteSender:
        "They opened it. Nothing more can be read from it, by them or by you.",
      sendersView:
        "Sealed to their keys, one opening each. This client cannot open it either, so a mistyped secret cannot be recalled — reply to it with /cancel to burn what nobody has taken yet.",
      theirCall: "Only the handles it was sealed to can open it.",
      revealedToast: "Secret opened",
      revealedToastNote: "Spent. They can see that you opened it",
      /* /cancel on a /once, per §5.18 */
      burnedToast: "Sealed copies burned",
      burnedNothing: "Nothing left to burn",
      burnedAllOpen:
        "Every addressee had already opened theirs. Burning reaches nothing, and what they read they still have.",
    },
    /* The card `/send` leaves in the thread. */
    transfer: {
      asset: "Collectible",
      viewTransaction: "View transaction",
    },
    /* The card `/whois` leaves in the thread. */
    whoisInline: {
      resolving: "Resolving the handle",
      vouchesTitle: "Who vouches for them",
      certified: "Certificate valid",
      keyChanged: "Key changed",
      key: "Identity key",
      messagebox: "Messagebox",
      attestations: "Attestations",
      vouchedBy: "Vouched for by",
      noVouches: "Nobody has vouched for them yet",
      noNote: "Signed without a note.",
      yours: "Your vouch",
      youShort: "You",
      /* the renounce list, under the vouches */
      renouncedBy: "Renounced by",
      renouncedAnon: "Renounced anonymously",
      yourRenounce: "Your renounce",
      renounceNoReason: "No reason given.",
      renounceSignedOpenly: "signed openly",
      renounceNote:
        "Anonymous by default: the claim is signed, but the renouncer chooses whether to be shown.",
    },
    /* The conversation's overflow menu, and the list sections it drives. */
    menu: {
      open: "More actions",
      starredSection: "Starred",
      allSection: "All conversations",
      mutedBadge: "Muted",
      star: "Star conversation",
      unstar: "Remove star",
      starred: "Starred",
      unstarred: "Star removed",
      summarise: "Summarise conversation",
      summariseSoon: "Summaries are coming soon",
      mute: "Mute conversation",
      unmute: "Unmute conversation",
      muted: "Muted. Unread still counts, it just stops shouting.",
      unmuted: "Unmuted",
      toll: "Charge a toll to message you",
      untoll: "Stop charging a toll",
      vouch: "Vouch for them",
      unvouch: "Withdraw your vouch",
      archive: "Archive conversation",
      archived: "Archived",
      unarchive: "Undo",
      delete: "Delete conversation",
      deleteTitle: "Delete this conversation?",
      deleteBody:
        "It leaves your list on this device. Anything already sent stays with the other side, and payments stay on chain.",
      cancel: "Cancel",
      deleteConfirm: "Delete it",
      deleted: "Conversation deleted",
    },
    tabs: {
      messages: "Messages",
      files: "Files & links",
      notes: "Notes",
      add: "Add a tab",
      addSoon: "More plugins SoonTM",
      attachment: "Attachment",
      noFiles: "Nothing has been shared here yet.",
      notesHint:
        "Only you can see these. Markdown as you type: # heading, - list, [] checkbox, > quote, **bold**.",
      notesPlaceholder: "Anything worth remembering about this conversation",
      notesWritten: "This conversation has notes",
    },
    /** images and clips shared in a conversation */
    media: {
      open: "Open",
      viewer: "Media viewer",
      play: "Play",
      pause: "Pause",
      mute: "Mute",
      unmute: "Unmute",
      seek: "Seek",
      fullscreen: "View full screen",
      close: "Close viewer",
      previous: "Previous",
      next: "Next",
      show: "Show item",
      download: "Download",
      more: "More items:",
      attach: "Attach a photo or video",
      attachFile: "Attach a file",
      pickFiles: "Add a file to this conversation",
      pickFilesHint: "Mock library. Nothing leaves your machine.",
      attached: "Attached",
      staged: "Ready to send",
      removeStaged: "Remove attachment",
      signedWith: "signed with this message",
      signedFiles: "files signed with this message",
      signedMessageOnly: "Message text signed. No files were attached.",
      uploading: "Uploading",
      pick: "Add to this conversation",
      pickHint: "Mock library. Nothing leaves your machine.",
      cancel: "Cancel",
      send: "Attach",
    },
    /**
     * What this client puts on chain, from the bar under the conversation list.
     *
     * Written as three consequences rather than three feature names, because the
     * difference between them is what somebody can still do afterwards —
     * delete it, prove it, or neither.
     */
    chain: {
      button: "What goes on chain",
      title: "On chain",
      messages: "Messages on chain",
      messagesHint: "Permanent. Nobody can delete it, you included.",
      /* Renamed off "Receipts": §5.15's /receipt is a voluntary acknowledgment
         the recipient can decline, and this is the sender anchoring proof of
         delivery. One word for two mechanisms was going to be read as one. */
      receipts: "Delivery proofs on chain",
      receiptsHint: "Proof it arrived. The words stay deletable.",
      nothing: "Nothing on chain",
      nothingHint: "Messagebox only. Nothing lasts, nothing is provable.",
      note: "Applies from here on.",
      /* The `/once` caveat only appears where "Messages on chain" can be
         chosen, which is the conversation pane — a caveat about an option that
         is not on screen is a sentence a reader has to hold for nothing. */
      noteConversation:
        "Applies from here on. A sealed /once is never anchored.",
      /* The conversation-level pane, where the global setting is the fallback. */
      forConversation: "This conversation",
      usingDefault: "Following your default",
      overridden: "Set for this conversation",
      reset: "Follow the default",
      /* The inline mark in the thread header — both sides see the same thing. */
      markLabel: "On chain for this conversation",
      /* The composer, where anchoring is about to have a consequence. */
      placeholder: "Write something permanent",
      ackTitle: "This goes on chain for good",
      ackBody:
        "Messages in this conversation are anchored. Once it is written nobody can delete it, you included, and anyone can read the record forever.",
      ackConfirm: "Post it permanently",
      ackCancel: "Not yet",
      ackAgain:
        "Asked once per conversation, and again if the setting changes.",
      bothSides: "Everyone here sees this, and it applies to what you send.",
    },
    /** the saved-messages list, swapped in under the conversation list */
    saved: {
      title: "Saved messages",
      showing: "Saved",
      empty: "Nothing saved yet. Right-click a message to keep it here.",
      remove: "Remove from saved",
      removed: "Removed from saved",
    },
    /** right-click / long-press on a message */
    messageMenu: {
      label: "Message options",
      copyLink: "Copy link",
      linkCopied: "Link copied",
      renderImage: "Render as image",
      save: "Save message",
      unsave: "Remove from saved",
      saved: "Saved",
      unsaved: "Removed from saved",
      viewOnChain: "View on chain",
      mute: "Mute",
      unmute: "Unmute",
      muted: "Muted",
      unmuted: "Unmuted",
    },
    /** the still a message can be turned into, and the two things you do with it */
    messageImage: {
      title: "Render as image",
      hint: "A still of this message, sized for sharing. Only what you see here.",
      copyImage: "Copy image",
      saveImage: "Save image",
      copied: "Image copied",
      /* Clipboard writes for images need a permission and a secure origin, so
         this is a real outcome rather than a defensive string. */
      copyFailed: "Your browser would not let this copy. Save it instead.",
      saved: "Image saved",
    },
    /** `/help` reply — local, ephemeral, never sent */
    help: {
      app: "Nexus",
      onlyYou: "Only you can see this",
      dismiss: "Dismiss this reply",
      title: "Commands you can use here",
      unknown: "No command by that name",
      /* Said plainly, and not once. A card that looks like a message in a shared
         room reads like one, and a room may hold agents as well as people. */
      private:
        "Nexus wrote this to you, not to the conversation. Nothing was sent, and nobody else here sees it, person or agent.",
      intro:
        "Type a command in the message box. Nothing is sent until you confirm it. Open one to read what it does.",
      needsReply: "Reply to a message first.",
      useExample: "Put this in the message box",
      groups: {
        standard: "Standard",
        standardHint:
          "These work the same way in any app that speaks the same language, not just this one. That language is",
        standardHintLink: "BRC-218",
        standardHintHref:
          "https://github.com/bsv-blockchain/BRCs/pull/185/changes",
        local: "Nexus commands",
        localHint: "This ecosystem's own. Other clients will not have them.",
        declined: "Not available here",
        declinedHint: "Specified, but this client does not run them.",
        reserved: "Reserved",
        reservedHint: "Named by BRC-218 with no behaviour defined yet.",
      },
      footer:
        "In a one-to-one chat you can leave the handle out, and the command applies to the person you are talking to.",
    },
    /** in-thread command result card */
    card: {
      status: {
        sent: "Sent",
        pending: "Pending",
        failed: "Failed",
        partial: "Partial",
        set: "Set",
        lifted: "Lifted",
        issued: "Issued",
        revoked: "Revoking",
        cancelled: "Cancelled",
        signed: "Signed",
        resolved: "Resolved",
        declined: "Declined",
        refunded: "Refunded",
        withdrawn: "Withdrawn",
        watching: "Watching",
        offered: "Offered",
        awaiting: "Awaiting agent",
        held: "In escrow",
        released: "Released",
        expired: "Expired",
        sealed: "Sealed",
        revealed: "Revealed",
        burned: "Burned",
      },
      to: "to",
      from: "from",
      sealedFor: "Sealed for",
      plusToll: "plus toll",
      every: "Every",
      varies: "satoshi amount varies with the rate",
      scope: "Scope",
      expires: "expires in",
      serial: "Serial",
      signature: "Signature",
      dismiss: "Dismiss",
      details: "what this did",
      /* quick actions offered inside a command's popover */
      act: {
        liftToll: "Lift this toll",
        cancelSubscription: "Cancel subscription",
        revoke: "Revoke this certificate",
        payRequest: "Pay this request",
        countersign: "Countersign",
        acknowledge: "Send acknowledgment",
        again: "Do it again",
        viewIdentity: "Open full profile",
        nothingToUndo: "Nothing left to undo here.",
        /* toast bodies, written to say what changed for the other person */
        tollLifted: "Toll lifted",
        tollLiftedNote: "They can reach you without paying again",
        subCancelled: "Subscription cancelled",
        subCancelledNote: "No further runs. Nothing already sent is reversed",
        revoked: "Certificate revoked",
        revokedNote:
          "Detectable, not instant, so treat them as able to act until the spend confirms",
        signedTitle: "Countersigned",
        signedNote: "Your signature is over the message you replied to",
        ackTitle: "Acknowledgment sent",
        ackNote:
          "Voluntary on both sides, so it proves receipt and nothing more",
        readyTitle: "Ready to send",
        readyNote: "Confirm the amount in the composer before it moves",
      },
      capNotEnforced:
        "The cap applies per action. Total spend is not bounded unless each action is funded.",
    },
    /** command confirmation sheet — BRC-218 section 4 */
    confirm: {
      title: "Confirm",
      cancel: "Cancel",
      close: "Close",
      confirm: "Confirm",
      confirmVerb: {
        pay: "Send payment",
        request: "Send request",
        tip: "Send tip",
        split: "Send all legs",
        subscribe: "Start subscription",
        attest: "Publish attestation",
        scope: "Set scope",
        trolltoll: "Set toll",
        delegate: "Issue certificate",
        revoke: "Revoke",
        handoff: "Hand off thread",
        sign: "Sign message",
        receipt: "Request receipt",
        message: "Send",
        whois: "Resolve",
        vouch: "Vouch for them",
        renounce: "Renounce them",
        once: "Seal and send",
      },
      effect: {
        pay: "Resolves the handle and sends a payment, delivered unbroadcast inside a signed envelope.",
        message:
          "Sends a message envelope, even if you've never had a thread with them.",
        request: "Asks them to pay you. Takes nothing until they confirm it.",
        tip: "Pays the verified sender of the message you're replying to, with the tip attributed to it.",
        split:
          "Divides the amount and sends each recipient an independent payment.",
        subscribe:
          "Schedules a repeating payment your own wallet executes. They cannot pull funds.",
        whois: "Resolves the handle fresh and shows the attested identity.",
        attest:
          "Publishes a public, signed statement that this handle belongs to this key.",
        scope: "Changes who may reach you, at your messagebox.",
        trolltoll: "Sets what a sender pays you for each message they send.",
        delegate:
          "Issues a certificate letting them act for you within a scope, cap and expiry.",
        revoke: "Spends the revocation outpoint of a certificate you issued.",
        handoff:
          "Issues a certificate scoped to this thread only, with a cap and expiry.",
        sign: "Countersigns the exact content shown, with your identity key.",
        receipt: "Asks for a signed acknowledgment. They may decline.",
        vouch:
          "Adds public reputation to their handle, signed by your identity key. Anyone running /whois on them will see it.",
        renounce:
          "Withdraws your regard for them, signed by your identity key. The reason is shown on their profile; your handle is hidden unless you wrote p or public.",
        once: "Encrypts the secret to their key and sends it. They can open it once, and after that nobody can.",
      },
      secret: "Secret",
      sealing: "Sealed with it",
      secretShow: "Show the secret",
      secretHide: "Hide the secret",
      visibility: "Visibility",
      visibilityPublic: "Signed openly — your handle is shown",
      visibilityAnon: "Anonymous — your handle is hidden",
      reason: "Reason",
      recipient: "To",
      recipientImplied: "To (this conversation)",
      recipients: "Recipients",
      amount: "Amount",
      typedAs: "You typed",
      issuedBy: "Token",
      estimatedValue: "Estimated value",
      toll: "Message toll",
      total: "Total",
      period: "Repeats",
      every: "Every",
      expires: "Expires in",
      scope: "Scope",
      reach: "Reachable by",
      memo: "Memo",
      lifted: "Lifted",
      boundTo: "In reply to",
      certificatesIssued: "certificates issued to them, choose one",
      perAction: "per action",
      noExpiry: "no expiry",
      signing: "Signing exactly this",
      noText: "(no text)",
      unsupported:
        "This client does not implement that verb. It will not guess at what you meant or run something similar.",
      custom:
        "A Nexus command rather than a BRC-218 one. Other clients may not implement it, which is why it is advertised in the ecosystem manifest rather than assumed.",
      reserved:
        "BRC-218 reserves this verb but does not specify it, so no conforming client may implement it. Reserving the name keeps it available for a specification that does the work.",
      wildcard:
        "I understand this grants every verb. A wildcard delegation can do anything you can do, until it expires or you revoke it.",
      caveats: {
        token:
          "A token transfer, not a BSV payment. The estimate is indicative, since a token is worth what its issuer and market say.",
        toll: "The toll and the payment are separate amounts. The toll is due every message and is not refunded if they reply.",
        request:
          "A request confers no authority. Nothing moves unless they explicitly confirm it.",
        split:
          "Legs are independent. If one fails the others still go through, and you'll see a per-leg result.",
        subscribe:
          "Cancellable any time, and cancelling takes effect before the next run without needing their cooperation.",
        subscribeFiat:
          "Because you typed a fiat amount, the satoshi amount will vary at each run as the rate moves.",
        attest:
          "This is public and signed, and others may rely on it. It is checked against a fresh resolution first.",
        renounce:
          "The reason is shown on their profile either way. Anonymity hides your handle from readers; the claim itself is still signed with your key.",
        scope:
          "Your messagebox enforces this, not this client. Success means the messagebox accepted the change.",
        tollLifted:
          "Lifting the general toll does not lift per-sender tolls. Those stay until you lift them individually.",
        perActionCap:
          "The cap applies to each individual action, not to total spend. A cumulative limit is not enforceable unless you fund each action, so it is not described as a maximum here.",
        revoke:
          "Revocation is detectable rather than instantaneous. Until the spend confirms, treat the delegate as still able to act.",
        receipt:
          "Receipts are voluntary. A missing receipt is not evidence that a message was undelivered or unread.",
        once: "Sealed to the handle above and to no other key. This client keeps no copy, so a wrong handle or a mistyped secret cannot be recalled or resent — only sealed again to somebody else.",
        onceRead:
          "You will see when they open it, whether or not they say so. If it shows as opened before they tell you they opened it, treat the secret as compromised and rotate it.",
      },
    },
    /** `/whois` identity card — BRC-218 section 5.7 */
    whois: {
      addresses: "Addresses",
      sameIdentity: "· same identity",
      certificate: "Certificate",
      certValid: "Valid handle certificate, issued by the ecosystem host.",
      certUnverified: "Not verified. Treat this identity with caution.",
      revocationChecked: "Revocation checked",
      revocationCaveat:
        "Revocation is detectable, not instant, so this is an observation rather than a guarantee.",
      identityKey: "Identity key",
      messagebox: "Messagebox",
      toll: "Message toll",
      tollPerMessage: "per message, paid to them",
      attestations: "Attestations",
      attested: "Attested accounts",
      reputation: "Reputation",
      renounced: "Renounced",
      vouches: "people vouch for them",
      noVouches: "Nobody has vouched for them yet",
      vouchNote:
        "Signed by the voucher's identity key, and public. Reputation you can check, not a score somebody keeps.",
      peerAttestations: "peers vouch for this handle-to-key binding",
      noAttestations: "No peer attestations yet",
      inAddressBook: "In your address book",
      notInAddressBook: "Not in your address book",
      organization: "Organisation",
      location: "Location",
      keyChanged:
        "This identity key has changed since you added them. Verify out of band before sending anything of value.",
      unverifiedNote:
        "Display name and avatar are supplied by the ecosystem host and are not attested.",
      localIdentity: "A Nexus identity, with no external profile to open.",
      /* section headings, each divided by a rule */
      about: "About",
      registered: "Registered",
      expertise: "Expertise",
      lastSeen: "Last seen",
      contactInfo: "Contact",
      recentConversations: "Recent conversations",
      showMore: "Show {count} more",
      technical: "Verification",
      seeAllDetails: "See all details",
      hideAllDetails: "Hide details",
      seeAllContact: "See all contact details",
      seeAllConversations: "See all conversations",
      email: "Email",
      phone: "Phone",
      github: "GitHub",
      noContact: "Nothing published.",
      contactNote:
        "Published by the ecosystem host, which does not attest to it. Check another way before acting on it.",
      noConversations: "No conversations yet.",
      noExpertise: "Not stated.",
      /* relative ages, e.g. "4 years 3 months ago" */
      age: {
        year: "year",
        years: "years",
        month: "month",
        months: "months",
        ago: "ago",
        today: "this month",
      },
    },
    /** group settings dialog */
    group: {
      mute: "Mute notifications",
      muteHint: "No alerts from this conversation",
      addIcon: "Add a group picture",
      changeIcon: "Change the group picture",
      removeIcon: "Remove picture",
      iconSet: "Group picture updated",
      iconRemoved: "Group picture removed",
      nameLabel: "Group name",
      renamed: "Conversation renamed",
      mutedOn: "Notifications muted",
      unmuted: "Notifications on",
      removedFrom: "removed from the conversation",
      addedTo: "added to the conversation",
      namePlaceholder: "Group name (optional)",
      membersLabel: "Members",
      searchMembers: "Search members",
      addLabel: "Add people",
      addPlaceholder: "Search people to add",
      remove: "Remove",
      leave: "Leave",
      save: "Save",
      left: "You left",
      updated: "Conversation updated",
      /* the access-gate editor, shared by New group and conversation settings */
      roles: {
        title: "Roles",
        hint: "Read the gate as a ladder, not just a door",
        needsGate: "Set an access gate first — a role is read off one",
        showSettings: "Show role settings",
        hideSettings: "Hide role settings",
        names: {
          admin: "Admin",
          mod: "Mod",
          member: "Member",
        },
        powers: {
          admin:
            "Everything a mod can, plus banning mods, changing the room and closing it",
          mod: "Everything a member can, plus deleting messages and banning members",
          member: "Read the room and post in it",
        },
        byLock: "By lock length",
        lockLadderHint:
          "Time committed, not value held. This ladder does not cap how many can reach a rung.",
        byRarity: "By rarity",
        rarityHint:
          "A band and everything above it. A rarer item never gives less, and the count is the most who can ever hold the role.",
        upTo: "up to",
        byAmount: "By amount held",
        byEntity: "By vouch",
        entitiesAreAdmins: "Gate handles are admins",
        entitiesHint:
          "The handles this room gates on run it. Everyone else is a member.",
        unassigned: "Not set",
        canDo: "What each can do",
        derived: "Held, not granted — it goes when the holding does",
        byCustody: "Holds this room",
        rulesHeldBy: "The rules of this room are held by",
        rulesHeldHint:
          "Roles are read off the gate, so nobody derives the authority to change it. Moderation is yours; the rules are theirs.",
        banned: "Banned from this room",
        ban: "Ban from room",
        banConfirm: "Ban",
        banTitle: "Ban from this room",
        banBody:
          "This writes a statement against them, signed by you and scoped to this room. They will see who banned them, and so will anyone else who looks.",
        bannedToast: "Banned from this room",
        unbannedToast: "Ban lifted",
        cannotBan: "You can only ban below your own role",
        lastAdmin:
          "Nobody would be an admin under this configuration, and a room with no admin cannot appoint one.",
        noneInside:
          "Nobody currently in the room would meet this gate, including you.",
        deleteMessage: "Delete message",
        deletedMessage: "Message deleted by a moderator",
        closeRoom: "Close this room",
        closeTitle: "Close this room",
        closeBody:
          "Conforming clients stop accepting posts and show the room as closed, with your name on it. The history stays readable. Nothing here can delete what people already have.",
        closeConfirm: "Close room",
        closedBy: "Room closed by",
        closedToast: "Room closed",
      },
      gates: {
        master: "Access gate",
        masterHint: "Who is allowed in",
        wouldExclude: "members here no longer meet this gate.",
        wouldExcludeHint:
          "A change that puts somebody out takes effect after notice, not at once.",
        offTitle: "Turn off the access gate?",
        offBody:
          "The room becomes readable by anyone, and this configuration is discarded — the contract, the handles and the minimums all go. Any roles read off the gate go with it.",
        offCancel: "Keep the gate",
        offConfirm: "Turn off",
        showSettings: "Show gate settings",
        hideSettings: "Hide gate settings",
        token: "Token gate",
        tokenHint: "Members must hold a specific token or collectible",
        tokenSearch: "Search tokens and collectibles",
        vouch: "Vouch gate",
        vouchHint: "Only people vouched for by these entities can join",
        renounce: "Renounce gate",
        renounceHint: "People renounced by these entities cannot join",
        entitySearch: "Search entities",
        removeChip: "Remove",
        noMatches: "No matches",
        contract: "Token contract",
        minimum: "Minimum",
        fee: "Charge a daily fee",
        feeHint: "Charged every day to stay in",
        feeAmount: "Per day",
        feeTo: "Paid to",
        feeToPlaceholder: "@handle@ecosystem",
        holdsOnly: "holds",
        shortOf: "does not hold the required",
        timelock: "Timelock gate",
        timelockHint: "Members must hold value locked out of their own reach",
        lockAmount: "Locked",
        lockFor: "For at least",
        lockHint:
          "A rolling requirement: the lock must still have this long left to run. Nobody takes custody \u2014 it returns to its owner.",
        notLocked: "does not meet the lock",
        nothingLocked: "has nothing locked",
        locksOnly: "locks",
        ofRequiredLock: "of the",
        lockTooShort: "lock is shorter than",
        days: "d",
        months: "mo",
        years: "y",
        unchecked: "Could not check this gate",
        ofRequired: "of the",
        locked: "Does not meet this group's access gate",
        collectible: "Collectible",
        gateOn: "Gate enabled",
        gateOff: "Gate disabled",
        notVouchedBy: "not vouched for by",
        renouncedBy: "renounced by",
        missingToken: "does not hold",
        you: "you",
      },
    },
  },
  learn: {
    title: "Your courses",
    browse: "Browse catalog",
    continueAction: "Continue",
    startAction: "Start",
    lessonsLabel: "lessons",
  },
  market: {
    title: "Market",
    buyAction: "Buy",
    sellAction: "List an item",
    viewDetails: "View details",
    search: "Search by name…",
    sortAz: "Sort A–Z",
    sortZa: "Sort Z–A",
    labelName: "Ordinal Name",
    labelApplication: "Application",
    labelCollection: "Collection",
    labelChrono: "Chronological Order",
    labelSale: "Sale Status",
    allApplications: "All applications",
    allCollections: "All collections",
    chronoRecent: "Recent activity",
    chronoOldestActivity: "Oldest activity",
    chronoNewest: "Newest first",
    chronoOldest: "Oldest first",
    saleAll: "All Ordinals",
    salePriceHigh: "Price high to low",
    salePriceLow: "Price low to high",
    saleNotListed: "Not Listed",
    refresh: "Refresh",
    featuredBadge: "Collection",
    notListed: "Not listed",
    empty: "No ordinals match these filters.",
    countLabel: "ordinals",
  },
  vault: {
    title: "Protected items",
    addAction: "Add to vault",
    lastAccessed: "Last accessed",
    encryptedNote: "End-to-end encrypted with your identity key.",
  },
  identity: {
    handles: {
      title: "Handles",
      yoursTitle: "Your handles",
      yoursHint:
        "The names people reach you by. Up to five, and each workspace answers to one of them.",
      active: "Active here",
      useHere: "Use here",
      addTitle: "Claim another",
      marketTitle: "Handles for sale",
      marketHint:
        "Names other people hold and have put a price on. Buying one transfers it to your key.",
      full: "You hold five, which is the limit. Give one up or sell one to make room.",
      giveUp: "Give up",
      sell: "Sell",
      unlist: "Take off the market",
      listedFor: "Listed for",
      sellTitle: "Ask for",
      sellHint:
        "Somebody buying it pays this, and the name transfers with the key.",
      listDone: "is on the market",
      unlisted: "is off the market",
      buyFor: "Buy for {price}",
      forSaleBy: "For sale by {seller}",
      bought:
        "Bought. It is yours, and the workspace you were on now answers to it.",
      onNexus: "On Nexus, and anywhere your handle resolves",
      change: "Change",
      cancel: "Cancel",
      placeholder: "newhandle",
      checkAvailable: "Available.",
      checkTaken: "Somebody already has that one.",
      checkOwned: "You already hold that one.",
      checkShort: "Four characters or more.",
      checkInvalid: "Letters, numbers and underscores only.",
      checkCurrent: "That is already yours.",
      priceNote:
        "Changing costs {price}. The price is why good names are still going: without one, a script takes them all on the first day.",
      claimFor: "Claim for {price}",
      claimed: "Your handle is changed. The old one is free for somebody else.",
      graceTitle: "Your old handle",
      graceBody:
        "is held for you for another {seconds}s. After that anybody can take it.",
      reclaim: "Take it back",
      reclaimed: "Yours again. The other one is in its own grace window now.",
      recoveryTitle: "Getting back in",
      recoveryHint: "Who could vouch you back if you lost this device.",
      recoveryNone:
        "Nobody is named yet. Until somebody is, losing this device loses the handle with it.",
      recoveryPending:
        "Social recovery is funded and not built. These are the people it would ask.",
      recoveryOpen: "See it on the roadmap",
      linkedTitle: "Linked accounts",
      linkedHint:
        "Prove an account people already know you by belongs to the same key. Nothing else is shared.",
      link: "Link",
      notLinked: "Not linked",
      verifying: "Verifying…",
      attested: "Attested",
      linkedToast: "{service} is linked to your key",
      consentTitle: "Let Nexus verify your {service} account?",
      consentBody:
        "Nexus receives your username and nothing else. A signed attestation links it to your identity key, and anybody can check it without asking us.",
      allow: "Allow",
      avatarLabel: "Your picture",
      avatarUpload: "Upload",
      avatarReplace: "Replace",
      avatarRemove: "Remove",
      avatarSaved: "Picture updated",
      avatarRemoved: "Back to the generated one",
      avatarTooBig:
        "That file is {size} kB. Keep it under {max} kB — it is shown at 96 pixels.",
      shareTitle: "Share your handle",
      shareHint: "Anybody can pay you or start a conversation from this.",
      shareAttested: "Backed by {count} attested account{s}",
      shareNone: "No linked accounts yet.",
      copyLink: "Copy link",
      copied: "Link copied",
      /* the full-screen sheet the code opens into */
      sheetOpen: "Show code",
      sheetLabel: "Share your handle",
      sheetSubhead: "Point a camera at it, or send the link.",
      sheetCodeLabel: "Code for {handle}",
      sheetScan: "Scan to pay {handle} or open a conversation.",
      sheetNoAvatar: "Add a picture and it appears in the middle.",
    },
    keysTitle: "Identifiers",
    walletKeysTitle: "Wallet keys",
    walletKeysHint:
      "One per wallet, set when it was made and never again. The name above it is yours to change; this is not.",
    certificatesTitle: "Certificates",
    keysHint:
      "Your identifiers sign your messages and prove who you are on-chain.",
    newBadge: "New identifier",
    retiredTitle: "Retired identifiers",
    retiredLabel: "Retired",
    retiredHint:
      "Retired identifiers are kept for your records but no longer sign or identify you.",
    makePrimary: "Make primary",
    retire: "Retire",
    restore: "Restore",
    rename: "Rename",
    renameTitle: "Rename identifier",
    renameSave: "Save",
    renameCancel: "Cancel",
    certificatesHint:
      "As you go about your life, people and businesses you interact with can give you certificates and credentials. These verify your qualifications and help you establish trust.",
    certificatesEmpty:
      "No certificates found. Register with identity certifiers to receive certificates.",
    primaryBadge: "Primary",
    copyKey: "Copy identifier",
    registerAction: "Find certifiers",
  },
  connect: {
    title: "Connected apps & sites",
    empty: "Nothing is connected yet.",
    permissionsLabel: "Permissions",
    lastUsed: "Last used",
    disconnect: "Disconnect",
    reconnect: "Reconnect",
    /* Past tense, for the toast that confirms it. Deliberately not "Removed":
       the access is gone, the record is not — Settings › Sites still has it. */
    disconnected: "Disconnected. It can no longer reach your wallet.",
  },
  baskets: {
    title: "Output baskets",
    outputs: "outputs",
    newBasket: "New basket",
    subtitle:
      "Baskets group your wallet's outputs by protocol for building apps.",
  },
  appStore: {
    collectionsTitle: "Collections",
    reorderCollections: "Reorder collections",
    enableAll: "Connect all",
    disableAll: "Disconnect all",
    installHint: "Connect",
    moreApps: "More apps",
    searchPlaceholder: "Search apps",
    sortLabel: "Sort",
    sortNewest: "Newest",
    sortOldest: "Oldest",
    sortPopular: "Most popular",
    sortTrending: "Trending",
    filterLabel: "Filter",

    /* The filter pane. Its two headings name what is being narrowed rather
       than what a filter is — "Sources" and "Categories" are answers to
       "narrow by what", which is the only question a reader has here. */
    filterTitle: "Filter apps",
    filterSources: "Sources",
    filterCategories: "Categories",
    filterSourcesHint:
      "Repos you have switched on. Narrowing here hides listings without unsubscribing.",
    filterClear: "Clear filters",
    filterEmptyCategory: "Nothing here yet",
    filterShowing: "{shown} of {total} apps",

    devNexus: "Nexus",
    devBsvAssociation: "BSV Association",
    devOpl: "Open Protocol Labs",
    devHandcash: "HandCash",
    devThirdParty: "Third-party",
    devNexusApps: "Nexus apps",
    devBsvAssociationApps: "BSV Association apps",
    devOplApps: "Open Protocol Labs apps",
    devHandcashApps: "HandCash apps",
    devThirdPartyApps: "Third-party developers",
    noResults: "No apps match your search.",

    /* The repository header the catalogue is grouped under. */
    repoApps: "{n} apps",
    repoReviews: "({n})",
    repoLatest: "latest",
    repoVersion: "Catalogue version",
    repoCollapse: "Collapse",
    repoExpand: "Expand",
    repoHasNew: "Something new since you last looked",
    repoPinned:
      "Showing this source as it stood at {version}. Anything published since is hidden.",
    repoToday: "updated today",
    repoYesterday: "updated yesterday",
    repoDays: "updated {n} days ago",
    repoWeeks: "updated {n} weeks ago",
    repoMonths: "updated {n} months ago",
    repoEmpty: "Nothing in this source matches.",
    newLabel: "New",
    // install permission sheet
    installSubtitle: "Connect to your Nexus",
    permsIntro: "If you add this app, it can:",
    permsIntroCollapsed: "If you add this app, it can use",
    permsIntroCollection: "If you enable these apps, they can:",
    permsIntroCollectionCollapsed: "If you enable these apps, they can use",
    learnMore: "Learn more",
    perm1: "Verify your identity to sign you in",
    perm2: "Request payments, small ones auto-approved, large ones ask you",
    perm3: "Store and access data you share with it",
    // one-word summaries shown when the permissions block is collapsed
    permWords: ["Identity", "Payments", "Data"],
    permsSummaryLabel: "Permissions",
    // in-app purchases block
    iapTitle: "In-app purchases",
    iapFree: "Free",
    iapFreeNote: "This app is free to use.",
    installNote:
      "You can disconnect this app any time from Apps. Payments above $0.10 will ask for your confirmation.",
    optIdentify: "Allow this app to identify you",
    optIdentifyInfo:
      "Shares your public identity so this app can recognise you and sign you in. It never sees your private keys.",
    optOperate: "Allow this app to act without asking each time",
    optOperateInfo:
      "Lets this app request small payments and actions without prompting every time, always within the auto-approve limits you set below.",
    advanced: "Advanced settings",
    advancedNote:
      "You stay in control. Change what this app can do any time from Connect.",
    autoApprove: {
      title: "Auto-approve settings",
      notify: "Always notify me",
      notifyDesc: "Ask for confirmation on every payment from this site",
      perTx: "Per-transaction limit",
      perTxDesc: "Payments under this are auto-approved",
      perSession: "Per-session limit",
      perSessionDesc: "Total spending before requiring approval",
      rate: "Rate limit",
      rateDesc: "Max payment requests per minute",
      maxTx: "Max transactions per session",
      maxTxDesc: "Total payments allowed per session before prompting",
    },
    cancel: "Cancel",
    /* Both carry the name, so the button says what it is about to do and to
       what. A sheet can be opened from a grid of sixteen cards. */
    installConfirm: "Connect {name}",
    successAdded: "It's ready in your sidebar.",
    /* The verb in the confirmation headline, beside the app's name. */
    doneAdded: "connected",
    doneRemoved: "disconnected",
    successRemoved: "Disconnected from your Nexus.",
    // uninstall confirmation sheet
    uninstallSubtitle: "will be disconnected from your Nexus",
    uninstallBody:
      "This takes it out of your sidebar and revokes its permissions. Your data stays on-chain and you can add it back any time.",
    uninstallConfirm: "Disconnect {name}",
    // app detail side sheet
    detail: {
      close: "Collapse",
      expand: "Expand",
      open: "Open",
      preview: "Preview",
      version: "Version",
      updated: "Last updated",
      installs: "Installs",
      stars: "GitHub stars",
      follows: "Followers",
      permissionsTitle: "Permissions",
      permissionsExpand: "Show details",
      permissionsCollapse: "Hide details",
      reviewsTitle: "Reviews",
      overallRating: "Overall rating",
      writeReview: "Write a review",
      allReviews: "All reviews",
      usingApp: "using the app",
      dayAgo: "day ago",
      daysAgo: "days ago",
      weekAgo: "week ago",
      weeksAgo: "weeks ago",
      monthAgo: "month ago",
      monthsAgo: "months ago",
    },
  },
  vote: {
    title: "Proposals",
    submit: "New proposal",
    openColumn: "Open",
    closedColumn: "Closed",
    openBadge: "Open",
    closedBadge: "Closed",
    voteFor: "For",
    voteAgainst: "Against",
    closesLabel: "Closes",
    emptyColumn: "Nothing here yet.",
  },
  newItemMenu: {
    newSpace: "New Workspace",
    newFolder: "New Folder",
    newTab: "New Tab",
  },
  spaceMenu: {
    changeIcon: "Change Workspace Icon",
    rename: "Rename Workspace",
    editTheme: "Edit Theme Color…",
    setProfile: "Set Workspace",
    newFolder: "New Folder",
    liveFolders: "Live Folders",
    shareSpace: "Share Workspace",
    manageSpaces: "Manage Workspaces",
    deleteSpace: "Delete Workspace",
    // sub-panels
    iconPanelTitle: "Change icon",
    themePanelTitle: "Theme color",
    profilePanelTitle: "Set workspace",
    liveFoldersPanelTitle: "Add live folder",
    back: "Back",
    // workspace options
    profilePersonal: "Personal",
    profileWork: "Work",
    profileShared: "Shared",
    // live folder options
    liveRecentDownloads: "Recent Downloads",
    liveTodaysTabs: "Today's Tabs",
    liveFavorites: "Favorites",
    // dialogs
    renameTitle: "Rename workspace",
    renameSave: "Save",
    renameCancel: "Cancel",
    deleteTitle: "Delete this workspace?",
    deleteBody: "Its tabs and folders will be removed. This can't be undone.",
    deleteConfirm: "Delete workspace",
    deleteCancel: "Keep workspace",
    manageTitle: "Manage workspaces",
    manageMoveUp: "Move up",
    manageMoveDown: "Move down",
  },
  commandPalette: {
    placeholder: "Search or Enter URL…",
    switchToTab: "Switch to Tab",
    openNewTab: "Open in New Tab",
    noResults: "No matching tabs.",
  },
  browserSettings: {
    extensions: "Extensions",
    settings: "Settings",
    appearance: "Appearance",
    appearanceDark: "Dark",
    appearanceLight: "Light",
    developerMode: "Developer Mode",
    pip: "Automatic Picture-In-Picture",
    on: "On",
    off: "Off",
    allowed: "Allowed",
    blocked: "Blocked",
    secure: "Secure",
    more: {
      clearCache: "Clear Cache",
      clearCookies: "Clear Cookies",
      manageExtensions: "Manage Extensions…",
      addExtension: "Add Extension…",
      allSiteSettings: "All Site Settings…",
    },
    cert: {
      chain: ["GTS Root R4", "WE1", "bsvblockchain.org"],
      domain: "bsvblockchain.org",
      seal: "Certificate",
      sealSub: "Standard",
      issuedBy: "Issued by: WE1",
      expires:
        "Expires: Friday, 25 September 2026 at 07:53:33 Central European Summer Time",
      valid: "This certificate is valid",
      trustLabel: "Trust",
      trustNote: "When using this certificate: Use System Defaults",
      detailsLabel: "Details",
      details: [
        { label: "Subject Name", value: "bsvblockchain.org" },
        { label: "Issuer Name", value: "WE1" },
        { label: "Serial Number", value: "0A C3 1B 9F 22 E4 77 80 55 21" },
        { label: "Version", value: "3" },
        { label: "Signature Algorithm", value: "SHA-256 with RSA Encryption" },
        { label: "Not Valid Before", value: "27 June 2026 at 07:53:34" },
        { label: "Not Valid After", value: "25 September 2026 at 07:53:33" },
        { label: "Public Key", value: "256-bit ECDSA (P-256)" },
      ],
      help: "Help",
      ok: "OK",
    },
  },
  share: {
    /* gift toggle ON — the BSV hook leads. `{amount}` is the sender's own
       figure, so every line that quotes it stays in step with the input. */
    giftHeadline: "Gift a friend\n{amount} in BSV",
    giftSubhead: "They join Nexus, you both get rewarded.",
    giftMessage:
      "Here's {amount} in BSV to try Nexus, the browser and wallet in one. Claim it here:",
    // gift toggle OFF — plain referral
    plainHeadline: "Share Nexus\nwith a friend",
    plainSubhead: "Send them the browser and wallet in one.",
    plainMessage:
      "Here's Nexus, the browser and wallet I keep telling you about:",
    toggleLead: "Gift",
    toggleTrail: "in BSV",
    amountLabel: "Amount to gift, in dollars",
    copy: "Copy link",
    copied: "Copied!",
  },
  gettingStarted: {
    headingLine1: "Let's settle in!",
    headingLine2: "Here are the basics.",
    learnShortcuts: "Learn Essential Shortcuts",
    helpResources: "Help & Resources",
    helpUrl: "https://bsvassociation.org/education/blockchain-101/",
    steps: [
      /*
       * This step used to say "Open the Apps tab to install a wallet, publisher
       * or explorer" — a promise of software arriving on the device, which is
       * not what the tab does and not something Nexus offers. The Apps tab is a
       * bookmark list: an address goes in, an icon appears on the rail, and the
       * icon opens the website. Naming the address field is deliberate, because
       * it is currently the only thing in the build that pins a site.
       */
      {
        icon: "LayoutGrid",
        title: "Add apps to your Nexus",
        body: "Open the Apps tab to connect a wallet, publisher or explorer. Connected apps live in your sidebar rail.",
      },
      {
        icon: "Layers",
        title: "Organize with Spaces",
        body: "Group your tabs and folders into Spaces for work, life or a project, then switch between them in a click.",
      },
      {
        icon: "Globe",
        title: "Browse the BSV web",
        body: "Type a URL or search from the address bar. Your tabs, favorites and history stay tucked in the sidebar.",
      },
      {
        icon: "Wallet",
        title: "Make your first payment",
        body: "Open Payments from the rail to send BSV, check your balance and browse your full transaction history.",
      },
    ],
    shortcutsTitle: "Essential shortcuts",
    shortcutsPlaceholder: "Keyboard shortcuts",
    shortcuts: [
      { keys: "⌘ T", label: "Search or open a new tab" },
      { keys: "⌘ \\", label: "Toggle the sidebar" },
      { keys: "Esc", label: "Close menus and overlays" },
      { keys: "Drag", label: "Drop a tab onto Favorites to pin it" },
    ],
  },
  mobile: {
    menuLabel: "Open menu",
    backLabel: "Back",
  },

  mobileBrowser: {
    appRail: "Apps",
    /* The pill that stands in for the bottom bar while you are reading. */
    showBar: "Show the bar",
    openTabs: "Open tabs",
    newTab: "New tab",
    urlDetails: "Page options",
    search: "Search…",
    incognito: "Incognito",
    incognitoTitle: "You're browsing Incognito",
    incognitoHint: "Pages you view won't appear in your history.",
    recentTitle: "Recent",
    noTabs: "No open tabs yet.",
    actions: {
      findOnPage: "Find on Page",
      summarize: "Summarize",
      pin: "Pin",
      share: "Share",
    },
    displayOptions: "Display Options",
    siteSettings: "Site Settings",
    hub: "Sync with Nexus Desktop",
    sync: {
      title: "Sync with Nexus Desktop",
      subtitle: "Search, browse, and pin to your workspaces on the go.",
      signIn: "Sign in with Nexus",
      noAccount: "I don't have an account",
    },
    settings: {
      title: "Settings",
      done: "Done",
      downloads: "Downloads",
      archive: "Archive",
      globalSiteSettings: "Global Site Settings",
      setDefault: "Set Nexus as Default Browser",
      changeIcon: "Change App Icon",
      addToHome: "Add to Home Screen",
      searchEngine: "Search Engine",
      searchEngineValue: "MetaSearch",
      languages: "Languages",
      autoKeyboard: "Auto-Open Keyboard",
      archiveInactive: "Archive Inactive Tabs",
      archiveInactiveValue: "After 1 day",
      openLinksIn: "Open App Links in…",
      openLinksInValue: "Native App",
      clearData: "Clear Browsing Data…",
      syncDesktop: "Sync with Nexus Desktop",
      startupTitle: "On launch",
      startupNewTab: "A new tab",
      startupContinue: "Where you left off",
      startupHome: "Your home page",
      restoreProfile: "Reopen the workspace you were last in",
      restoreProfileHint: "Off always starts in your first workspace.",

      /* Rows that used to toast "coming soon". Each is a real setting now, so
         each needs the words for what it does. */
      languagesHint: "What pages are asked for, when they offer a choice.",
      openLinksInHint:
        "A link from another app opens here, or in whatever the system picks.",
      openLinksNexus: "Nexus",
      openLinksNative: "The system's browser",
      setDefaultHint: "Links from anywhere open in Nexus.",
      setDefaultDone: "Nexus is your default browser",
      setDefaultUndo: "Hand it back",
      setDefaultToast: "Nexus is the default browser",
      setDefaultUndone: "No longer the default browser",
      changeIconHint: "The icon on your home screen.",
      iconDefault: "Nexus",
      iconMono: "Monochrome",
      iconRetro: "Retro",
      iconDragon: "Dragon",
      iconToast: "Home screen icon changed",
      addToHomeHint: "Nexus opens full screen, without browser chrome.",
      addToHomeStep1: "Open the share menu in your system browser.",
      addToHomeStep2: "Choose Add to Home Screen.",
      addToHomeStep3: "Confirm the name, and it lands on your home screen.",
      addToHomeNote:
        "Nothing here can do this for you. Adding to a home screen is the operating system's decision, and a button claiming otherwise would be a button that does nothing.",
      archiveInactiveHint:
        "A tab you have not touched for this long is filed away rather than closed.",
      archiveNever: "Never",
      archiveDay: "After a day",
      archiveWeek: "After a week",
      archiveMonth: "After a month",
      archiveEmpty: "Nothing archived yet.",
      archiveEmptyHint:
        "Tabs you stop using appear here rather than disappearing.",

      /* Root list of the mobile sheet. */
      sectionBrowser: "This device",
      sectionSettings: "Settings",
      back: "Back",
    },
  },

  /** the settings surface the rail's gear opens */
  settings: {
    title: "Settings",
    soon: "Coming soon",
    /* Pairing a phone to this Nexus, at the head of General. */
    sync: {
      title: "Sync Nexus by QR code",
      codeLabel: "Pairing code",
      step1: "Open Nexus on your phone",
      step2: "Go to Settings › Devices › Add device",
      step3: "Point your phone at this screen to confirm",
      /* The way past the QR for somebody who already has the app open and
         would rather type a code than hold a phone up to a screen. */
      hasApp: "I have already downloaded Nexus mobile",
    },
    general: {
      title: "General",
      hint: "Sync, search, links and this device.",
      searchTitle: "Search",
      linksTitle: "Links",
      deviceTitle: "This device",
    },
    privacy: {
      title: "Privacy",
      hint: "Who can reach you, what it costs them, and what outlives the chat.",
      reachTitle: "Who can reach you",
      reachHint:
        "Enforced at your messagebox rather than by the sender's client, so somebody who ignores it still gets nowhere. Same setting as /scope.",
      reachEveryone: "Everyone",
      reachEveryoneHint:
        "Anyone who knows your handle, on any ecosystem it resolves through.",
      reachExplainLabel: "What reachability means",
      reachExplain: [
        "A handle under BRC-169 resolves from more than one place. Somebody on Treechat, Twetch or HandCash can address @you without either of you sharing a server, which is the point of it and also the part people do not expect.",
        'So "everyone" is wider than it sounds: it is every ecosystem your handle is registered through, not only the one you are reading this in. Narrowing it does not un-register the handle — it decides who gets through once they have found it.',
      ],
      reachContacts: "Contacts only",
      reachContactsHint: "People already in your address book.",
      reachEcosystem: "Your ecosystem",
      reachEcosystemHint: "Handles registered on the same ecosystem as you.",
      reachToll: "Strangers pay a toll",
      reachTollHint: "Open to anyone willing to attach the amount below.",
      reachSaved: "Reachable by",
      tollTitle: "Message toll",
      tollHint:
        "What a stranger attaches to each message. You keep it whether or not you reply. Same setting as /trolltoll.",
      tollOff: "No toll",
      tollSet: "Toll set",
      tollLifted: "Toll lifted",
      tollPerSenderAdd: "Charge someone",
      tollPerSenderSearch: "Search a name or @handle",
      tollPerSenderNone: "Nobody is being charged individually.",
      tollPerSenderRemove: "Stop charging",
      tollPerSenderRemoved: "no longer pays to reach you",
      tollPerSenderSet: "now pays to reach you",
      tollPerSender: "Tolls you set for one person",
      tollPerSenderHint:
        "Unaffected by the general toll. Lifting this one leaves those exactly as they were.",
      chainTitle: "What goes on chain",
      chainHint: "The default for new conversations.",
      chainSaved: "Default updated",
      chainPerConversation: "Conversations set on their own",
      chainPerConversationHint:
        "Set from a conversation's settings, where the room is in front of you. Anchoring whole messages is only offered there.",
      trackingTitle: "Tracking",
      cookies: "Cookies",
      cookiesHint:
        "Third-party cookies are the ones that follow you between sites.",
      cookiesAllow: "Allow all",
      cookiesThird: "Block third-party",
      cookiesBlock: "Block all",
      trackers: "Block known trackers",
      trackersHint:
        "A list, not magic. It stops the ones that have been named.",
      doNotTrack: "Send a Do Not Track request",
      doNotTrackHint: "Politely asked, freely ignored. Costs nothing to send.",
      quitTitle: "When you quit",
      clearNothing: "Keep everything",
      clearHistory: "Clear history",
      clearEverything: "Clear everything",
      dataTitle: "Data",
      clearDataHint: "History, cookies and cached files on this device.",
      /* the pane the Data row opens, on both surfaces */
      clearTitle: "Clear browsing data",
      clearHint: "This device only, and it cannot be undone.",
      clearHistoryHint: "Pages you visited and what you typed to find them.",
      clearEverythingHint:
        "History, cookies, cached files and every site's saved permission.",
      clearNow: "Clear now",
      clearDone: "Cleared",
    },
    sites: {
      title: "Site settings",
      search: "Search sites",
      empty: "No site has anything set.",
      changed: "changed",
      revoked: "access withdrawn",
      byDefault: "default",
      walletTitle: "Wallet access",
      revoke: "Withdraw access",
      restore: "Restore access",
    },
    permissions: {
      title: "Permissions",
      hint: "What pages and apps are allowed to do.",
      pageTitle: "What a page may ask for",
      pageHint: "The default when a site asks. Ask means you decide each time.",
      walletTitle: "What a page may ask the wallet for",
      walletHint:
        "Sharper than the rest of this page: these spend money and disclose who you are.",
      capAsk: "Ask",
      capAllow: "Allow",
      capBlock: "Block",
      oneClick: "One-click pay",
      oneClickHint:
        "Skip the confirm step for paying actions like likes and branches. The cap below still applies.",
      spendCap: "Most a page may spend without asking again",
      spendCapHint:
        "Only applies once you have allowed a page to spend. Set it to nothing and every payment asks.",
      exceptionsTitle: "Sites you have answered for",
      exceptionsHint: "These override the defaults above.",
      exceptionsNone: "Nothing overridden.",
      exceptionRemove: "Return to the default",
      exceptionRemoved: "back to the default",
      capabilities: {
        camera: "Camera",
        microphone: "Microphone",
        location: "Location",
        notifications: "Notifications",
        clipboard: "Read the clipboard",
        downloads: "Download files",
        midi: "MIDI devices",
      },
      walletCapabilities: {
        spend: "Spend satoshis",
        identity: "Read your handle and certificates",
        baskets: "Read your output baskets",
        certificates: "Ask you to sign a certificate",
      },
    },
    autofill: {
      title: "Autofill & sign-in",
      hint: "What gets filled in for you, and how you prove who you are.",
      keyTitle: "Signing in",
      keyHint: "A key you hold beats a password somebody else stores.",
      preferKey: "Sign in with your identity key where a site offers it",
      preferKeyHint:
        "Nothing to remember, nothing to leak. Sites that only take passwords still take passwords.",
      savePasswords: "Offer to save passwords",
      savePasswordsHint:
        "Off by default. A saved password is a copy of a secret this browser then has to defend.",
      fillTitle: "Filling forms",
      addresses: "Addresses",
      addressesHint: "Name, postal address and phone number.",
      cards: "Payment cards",
      cardsHint:
        "Off by default. You have a wallet; a card number in a browser is the older, worse way to pay.",
      vaultRow: "Manage what is stored",
      vaultRowHint: "Opens the Vault, which is where these actually live.",
    },
    shortcuts: {
      title: "Shortcuts",
      hint: "Every key this client answers to.",
      search: "Search shortcuts",
      noResults: "No shortcut matches that.",
      note: "⌘ on this Mac, Ctrl elsewhere. Typed shortcuts like / go in the message box rather than being held down.",
      recording: "Press the keys you want. Escape to leave it as it was.",
      pressKeys: "Listening",
      reset: "Back to the original",
      conflict: "Another shortcut already answers to this.",
      conflictSummary:
        "Two shortcuts share a binding. Whichever the client reaches first wins, so the other will look broken until one of them changes.",
    },
    browsing: {
      title: "Browsing",
      hint: "Sites, tabs and downloads.",
      sitesTitle: "Sites",
      tabsTitle: "Tabs",
      filesTitle: "Files",
      downloadsHint: "What each workspace has downloaded.",
      devTitle: "Developer",
      devHint: "Off by default. These change what pages can see and do.",
      devToolsLabel: "Developer tools",
      devToolsHint:
        "Inspect a page, read its console, and watch what it asks the wallet for.",
      devToolsOn: "Developer tools are on",
      devToolsOff: "Developer tools are off",
      devToolsShortcut: "⌥⌘I",
      devOverlayLabel: "Overlay network inspector",
      devOverlayHint:
        "Shows every BRC lookup a page makes, and which overlay answered.",
      devUnsafeLabel: "Allow unsigned app repositories",
      devUnsafeHint:
        "Lets a repository serve apps with no signature to check. Nothing vets them, including us.",
      devWarn:
        "A page with developer tools open can be told things by somebody reading over your shoulder. Turn them off when you are done.",
      readingTitle: "Reading",
      zoom: "Page zoom",
      fontSize: "Base font size",
      pdfs: "Open PDFs in Nexus",
      pdfsHint: "Off sends them to whatever your device opens PDFs with.",
      translate: "Offer to translate pages",
      translateHint: "The offer is local; nothing is sent until you accept it.",
    },
    about: {
      title: "About",
      hint: "Version and what changed.",
      versionTitle: "This build",
      version: "Version",
      released: "Released",
      whatsNew: "What's new",
      whatsNewHint: "Every release, and what shipped in it.",
      channelTitle: "Updates",
      /* The live updater's copy. Deliberately states what the app is DOING
         rather than offering a choice: an update downloads on its own, and the
         only decision here is when to restart into it. */
      updateHint: "Nexus keeps itself on the latest release.",
      updateCurrent: "You're on the latest version",
      updateChecking: "Checking for updates…",
      updateFound: "Update available:",
      updateDownloading: "Downloading update…",
      updateReady: "Ready to install:",
      updateRestart: "Restart",
      updateCheck: "Check now",
      updateChecked: "Last checked",
      updateNeverChecked: "Not checked yet",
      updateError: "Couldn't check for updates",
      /* A distro package. electron-updater cannot replace a file apt owns, so
         this half of the panel links out rather than pretending to watch. */
      updateManualHint:
        "This copy was installed by your package manager, so Nexus can't update itself.",
      updateManualLabel: "Get the latest version",
      updateManualRow: "Downloads from GitHub releases.",
      updateOpen: "Open",
      channelStable: "Stable",
      channelBeta: "Beta",
      channelHint: "Beta gets releases early, and gets the ones we get wrong.",
      betaTitle: "Go where\nnobody has been",
      betaSubhead: "Beta builds ship the moment they are ready.",
      betaBody:
        "You will see /once, gates and whatever comes next weeks before anybody else, and you will be the reason the rest of them work. Some builds will be rough.",
      betaWarning:
        "Beta is not tested to the standard Stable is. Keep anything you cannot lose somewhere else.",
      betaConfirm: "Take me up",
      betaCancel: "Stay on Stable",
      betaDone: "You are on Beta, buckle up.",
      stableDone: "Back on Stable, the build we test hardest.",
    },
    footer: {
      copyright: "© 2026",
      association: "BSV Association",
      associationUrl: "https://bsvassociation.org/",
      /* The chain's name comes from the brand setting, so only the lead-in
         lives here. */
      poweredBy: "Powered by",
      networkUrl: "https://bsvblockchain.org/",
      creed: "Free and open source. Your keys, your data.",
      madeWith: "Made with",
      madeIn: "in",
      country: "Switzerland",
      thanksBefore: "Thanks to the",
      thanksLink: "BRC contributors",
      thanksAfter: ".",
      thanksUrl: "https://beersy.dev",
    },
    appearance: {
      title: "Preferences",
      hint: "Theme, colour and what things are called.",
      themeTitle: "Theme",
      themeHint: "Light, dark, or whatever this device is set to.",
      modeLight: "Light",
      modeDark: "Dark",
      modeAuto: "Match this device",
      themeDefault: "Every workspace uses the default styling.",
      themeReset: "Reset workspace colours",
      themeResetDone: "Every workspace is back to the default styling",
      brandTitle: "Name for the chain",
      brandHint: "Two names for one network. Pick the one you use.",
      brandScope:
        "Not the licence, not BSV Association, and not the BSV ticker.",
    },
  },

  /** the per-app onboarding pane, read from lib/data/onboarding.ts */
  onboarding: {
    title: "Getting started with",
    button: "What this app does",
    open: "Open",
  },

  /** the What's new pane, read from lib/data/releases.ts */
  releases: {
    title: "What's new",
    whatsNewIn: "What's new in",
    latest: "Latest release",
    past: "Past releases",
    before: "The release before this",
    update: "update",
    updates: "updates",
  },

  /** the one roadmap: what is wanted, what is paid for, what shipped */
  roadmap: {
    title: "Roadmap",
    fundable: "Fundable",
    fundableHint: "Wanted. Nobody has paid for it yet.",
    funded: "Funded",
    fundedHint: "Paid for. Not built yet.",
    shipped: "Shipped",
    shippedHint: "In your hands, in a numbered release.",
    emptyColumn: "Nothing here.",
    all: "Everything",
    allHint: "All three columns, side by side.",
    search: "Search features",
    sortTitle: "Sort",
    sortTopFunded: "Most funded",
    sortClosest: "Closest to its goal",
    sortNewest: "Newest",
    sortDiscussed: "Most discussed",
    totalsTitle: "This roadmap",
    totalPledged: "Pledged",
    totalGoal: "Asked for",
    totalBackers: "Backers",
    yoursTitle: "Yours",
    yoursHint: "Features you have put satoshis behind.",
    yoursEmpty: "You have not funded anything yet.",
    cancel: "Cancel",
    suggest: "Suggest a feature",
    suggestHint: "Costs 1,000 sats, so the board stays worth reading.",
    fund: "Fund this feature",
    fundCaveat:
      "A signal, not an order. Funding weighs on what gets picked up next; it does not buy the work.",
    fundShort: "Fund",
    fundedAlready: "Fully funded",
    fundAgain: "Add to this",
    amount: "Amount",
    custom: "Another amount",
    complexity: "Complexity",
    complexityLow: "Low",
    complexityMedium: "Medium",
    complexityHigh: "High",
    complexityHint:
      "Risk and unknowns rather than lines of code. High means the shape of it could change once it is started.",
    complexityLevels: [
      {
        label: "Low",
        body: "Understood work. A week or so, and few ways to be surprised.",
      },
      { label: "Medium", body: "Known shape, unknown corners. Up to a month." },
      {
        label: "High",
        body: "Could change shape once it is started. Months, and the estimate is the least reliable part.",
      },
    ],
    devNoteTitle: "From whoever scoped it",
    status: "Status",
    created: "Asked for",
    funded_: "Funded",
    shipped_: "Shipped",
    inRelease: "Shipped in",
    backers: "Backers",
    noBackers: "Nobody yet.",
    comments: "Discussion",
    commentPlaceholder: "Say why this matters",
    commentSend: "Post",
    commentCost: "1,000 sats to post, which is what keeps this readable.",
    commentBackersOnly: "Only backers can post here.",
    commentBackersWhy:
      "Put something behind this feature and the thread opens. Money is a cheap filter and a fair one: it costs the same whether you agree or object.",
    noComments: "Nothing said yet.",
    remaining: "still needed",
    ofGoal: "of",
    openInRoadmap: "Open in Roadmap",
    pledged: "You put {amount} behind this",
    movedTo: "Moved to {column}",
    prototypeMove:
      "Dragged, not funded. On a real board a card reaches Funded by being paid for.",
  },

  /** the developer panel docked under a page */
  inspector: {
    title: "Developer tools",
    console: "Console",
    network: "Network",
    lookups: "Lookups",
    outputs: "outputs",
    mock: "Seeded, not live",
    collapse: "Collapse",
    close: "Close developer tools",
    lookupsOff:
      "Switch on the overlay network inspector in Settings › Browsing to see what a page asks the overlays for.",
  },

  /** the terms this software is granted under */
  licence: {
    grantedBy: "Granted by",
    viewSource: "View the canonical copy",
    row: "Licence",
  },

  /** the ellipsis every app carries, and the second pane it can open */
  appMenu: {
    label: "More",
    openSplit: "Open beside this",
    closeSplit: "Close the second pane",
    pickApp: "Choose an app",
    pickerTitle: "Pick an app for this pane",
    pickerSearch: "Search your apps",
    pickerNoMatch: "Nothing matches that.",
    noneToSplit: "No other app is connected to this workspace.",
    disconnect: "Disconnect from this workspace",
    disconnected: "Disconnected from",
  },

  /** the workspaces manager: what each workspace is connected to */
  profiles: {
    sidebar: {
      title: "Workspaces",
      statProfiles: "workspaces",
      statHandles: "handles",
      statWallets: "wallets",
      allProfiles: "All workspaces",
      current: "You are here",
      rowSummary: "{handle} · {wallet}",
      sharedTitle: "Shared across workspaces",
      sharedHint:
        "Not a mistake, but worth knowing about if you are keeping these apart.",
    },
    tabConnections: "Connections",
    tabBrowsing: "Browsing",
    picker: {
      search: "Filter…",
      recent: "Most recent",
      noMatch: "Nothing matches.",
    },
    connections: {
      handle: "Handle",
      wallet: "Wallet",
      connectHandle: "Connect a handle",
      connectWallet: "Connect a wallet",
      pickHandle: "Handle for this workspace",
      pickWallet: "Wallet for this workspace",
      newHandle: "Claim another handle",
      newWallet: "Add a wallet",
      nowWallet: "Now the wallet for",
      apps: "Apps",
      connectedApps: "Connected apps",
      /* The trigger is a watermark in a 288px column; the popover's label is
         where the whole sentence belongs. */
      addApp: "Connect an app",
      addAppLabel: "Connect an app from another workspace",
      connectedTo: "Connected to",
      morePile: "+{n} more",
      locked: "Locked",
      essential: "Essential",
      unknownRepo: "Unknown source",
      nowOn: "Now the handle for",
      disconnected: "Disconnected from",
      noApps: "No apps connected.",
      /* Apps are still connected for the whole Nexus rather than per workspace,
         and the note says so rather than letting the surrounding switches imply
         otherwise. */
      footnote: "Permissions are scoped to this workspace's wallet.",
    },
  },

  /** shell chrome that is not any one app's */
  hub: {
    collapsePanel: "Close this panel",
    expandPanel: "Open the panel",
    undo: "Undo",
    /*
     * Two lengths for one action, because the row it sits in is narrow.
     * `addSiteShort` is what a tab row has space for once a title has had its
     * turn; the full sentence is the accessible name and the tooltip, where
     * there is no width to lose. A button reading "Add" with no context is fine
     * to look at and useless to a screen reader.
     */
    addSiteShort: "Add",
    addSiteToRail: "Add this site to the rail",
  },

  repositories: {
    button: "App repositories",
    title: "App repositories",
    official: "Official",
    enable: "Enable",
    disable: "Disable",
    remove: "Remove",
    suggested: "Add from a list",
    urlPlaceholder: "Add repository URL…",
    add: "Add",
    invalidUrl: "Enter a valid repository URL.",
    duplicate: "That repository is already added.",
    commonSource: "Common Source",
    commonSourceTag: "Mini app store",
    commonSourceDesc: "app.common-source.org",
    commonSourceToggle: "Common Source mode",
    /* Suggestions offered from the URL field itself, so a reader who has never
       seen a repository URL has something to try rather than a blank box. */
    pickSuggested: "Try one of these",
    pickHint: "Third-party stores. Adding one is a decision, not a setting.",
    /*
     * The warning in front of adding a store, per the design review.
     *
     * Deliberately not a toast after the fact: what a repository does is decide
     * which code the hub is willing to offer you, so the moment to say who
     * vouches for it is before it is added rather than after.
     */
    confirmTitle: "Add an unvetted repository?",
    confirmBody:
      "Nothing in this store has been reviewed by Nexus or the BSV Association. Its apps ask for the same permissions as any other — your keys, your wallet, your identity — and only the operator of this URL decides what appears in it.",
    confirmSource: "Adding",
    confirmCancel: "Cancel",
    confirmAdd: "Add it anyway",
  },

  theme: {
    button: "Theme",
    title: "Theme",
    solid: "Solid",
    gradient2: "2 colors",
    gradient3: "3 colors",
    namePlaceholder: "Theme name",
    save: "Save",
    saved: "Saved",
    reset: "Reset to the default palette",
    mode: "Light or dark",
    light: "Light",
    dark: "Dark",
    /* Said on the way past, because picking a mode also drops a custom
       palette and somebody who spent a minute on theirs deserves the word. */
    modeReset: "Default palette, for this workspace",
    ofTheme: "theme",
    savedTitle: "Saved themes",
    delete: "Delete",
    noneSaved: "No saved themes yet.",
  },
} as const;
