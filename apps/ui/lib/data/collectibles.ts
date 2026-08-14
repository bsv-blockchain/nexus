/**
 * table: collectibles — on-chain items the wallet holds.
 *
 * Three buckets, because a collectible's lifetime is the thing that decides how
 * you treat it: `permanent` never expires (art, titles, certifications),
 * `finite` runs out (tickets, memberships), and `expired` is kept rather than
 * silently dropped so a redeemed ticket stays as proof it existed.
 *
 * Attribute keys carry their own colour so a Row, a Seat and a Valid Through
 * read as different kinds of fact at a glance. Only the small chip uses that
 * hex — every surface around it is a theme token, so the grid recolours with
 * the rest of the app.
 */
import type { Collectible } from "./types";

/** Attribute-key tints, matching the reference wallet's own palette. */
export const attributeColors: Record<string, string> = {
  Event: "#3b82f6",
  Prize: "#f59e0b",
  Date: "#8b5cf6",
  Location: "#10b981",
  "Valid Through": "#ef4444",
  Row: "#06b6d4",
  Seat: "#ec4899",
  Membership: "#f97316",
  Benefits: "#14b8a6",
  Status: "#6366f1",
  Rareness: "#a855f7",
  Domain: "#0ea5e9",
  Venue: "#64748b",
};

/**
 * The Rare Hat contract.
 *
 * Ninety-nine were issued and each is a different number, so holding one is a
 * fact about a key rather than a balance — which is what makes it usable as a
 * door. Gating is on the contract, never on a serial: the room wants holders,
 * not one particular hat.
 */
export const RARE_HAT = {
  /** the `org` every item in the contract carries, and the gate's identity */
  collection: "Rare Hat",
  issuance: 99,
  contract: "1RareHatXwq7m2sV8kP4dT6bN9cF3gJ5hL",
} as const;

/**
 * Who holds which number, for the members of the room the contract gates.
 *
 * Their hats are not in this wallet — these are other people's holdings, and
 * the only reason the client knows about them is that the contract is public.
 * Ours is in `collectibles` below, like anything else we hold.
 */
export const rareHatHolders: Record<string, number> = {
  me: 69,
  "tw-krambo": 13,
  "tw-elonmoist": 1,
  "tw-randy": 7,
  "tw-utxo": 2,
  "tw-a": 42,
};

/**
 * The Naka Motor Club contract.
 *
 * 2,222 cars, each with a rarity band the contract publishes alongside its
 * traits. That band is what makes this contract usable for more than a door:
 * a room can read it as a ladder and hand out roles by it, which a contract
 * with no bands cannot.
 *
 * The ladder is the contract's own, in its own order. Nothing here invents a
 * ranking — a client that guessed one would eventually guess a contract whose
 * "Exotic" is its commonest tier.
 */
export const NAKA_MOTOR = {
  collection: "Naka Motor Club",
  issuance: 2222,
  contract: "4449436086e3cd58b73508aa498d886f62a5e88a049d3e27d49d2c9b90add05a",
  /** rarest last, which is the order every threshold below reads against */
  ladder: [
    "Common",
    "Uncommon",
    "Rare",
    "Epic",
    "Legendary",
    "Exotic",
  ] as const,
  /**
   * How many items sit in each band, as minted.
   *
   * A room assigning a role to a band is choosing a ceiling — twenty-two
   * Exotics is at most twenty-two admins — and the ceiling is invisible
   * unless the contract's curve is. BRC-190 §8.5.4.
   */
  bands: {
    Common: 1112,
    Uncommon: 555,
    Rare: 333,
    Epic: 134,
    Legendary: 66,
    Exotic: 22,
  } as Record<string, number>,
} as const;

/**
 * Who in the room holds which car, and at what band.
 *
 * Other people's holdings, known because the contract is public. The room's
 * roles are read straight off this: it is the same fact answering "may they
 * read" and "may they moderate", which is the point of deriving one from the
 * other rather than keeping a list.
 */
export const nakaMotorHolders: Record<
  string,
  { number: number; rarity: string }
> = {
  "tw-mikey": { number: 822, rarity: "Common" },
  "tw-elonmoist": { number: 510, rarity: "Uncommon" },
  "tw-utxo": { number: 585, rarity: "Rare" },
  "tw-randy": { number: 1872, rarity: "Epic" },
  "tw-krambo": { number: 329, rarity: "Legendary" },
  me: { number: 2121, rarity: "Exotic" },
};

/**
 * The height everything in this prototype is evaluated against.
 *
 * A real client asks a node. A constant keeps every render and both sides of
 * hydration agreeing on the same answer, which a clock would not.
 */
export const CHAIN_TIP = 921_600;

/**
 * Value locked out of its owner's reach, and the height it unlocks at.
 *
 * Other people's locks, known because a timelock is a script anybody can read
 * — which is the property that makes this gateable at all. Ours is in the
 * wallet like any other balance, held under a lock we cannot spend around.
 */
/**
 * BSV balances for people the seed makes claims about.
 *
 * `heldUnits` guesses from a hash for anybody it does not know, which is fine
 * for filling a picker and wrong for a room whose own members are supposed to
 * satisfy its own gate. Where the seed says somebody belongs in a room, their
 * balance is stated rather than rolled.
 */
export const bsvHoldings: Record<string, number> = {
  "siggi-oskarsson": 64.2,
  "darren-kellenschwiler": 38.9,
  "connor-murray": 27.4,
  "asgeir-oskarsson": 24.1,
  "oli-oskarsson": 22.6,
  "mohammad-jaber": 23.3,
  "austin-rappaport": 25.8,
  "dylan-murray": 12.1,
};

export const lockedStakes: Record<
  string,
  { units: number; unlocksAt: number }
> = {
  me: { units: 12.5, unlocksAt: CHAIN_TIP + 26_280 },
  "siggi-oskarsson": { units: 40, unlocksAt: CHAIN_TIP + 52_560 },
  "darren-kellenschwiler": { units: 22, unlocksAt: CHAIN_TIP + 13_140 },
  "connor-murray": { units: 9.4, unlocksAt: CHAIN_TIP + 8_640 },
  "oli-oskarsson": { units: 7, unlocksAt: CHAIN_TIP + 6_000 },
  "asgeir-oskarsson": { units: 6.2, unlocksAt: CHAIN_TIP + 4_400 },
  /* Three failures, one of each kind, so the reasons are distinguishable:
     locked long enough but too little, enough but not for long enough, and
     nothing locked at all. */
  "austin-rappaport": { units: 1.1, unlocksAt: CHAIN_TIP + 30_000 },
  "mohammad-jaber": { units: 5.5, unlocksAt: CHAIN_TIP + 900 },
  "dylan-murray": { units: 0, unlocksAt: 0 },
};

export const collectibles: Collectible[] = [
  {
    id: "naka-329",
    bucket: "permanent",
    name: "Naka Motor Club #329",
    org: NAKA_MOTOR.collection,
    serialNumber: "329",
    contract: NAKA_MOTOR.contract,
    url: "https://twetch.com/market/4449436086e3cd58b73508aa498d886f62a5e88a049d3e27d49d2c9b90add05a?token=329",
    venue: "Naka Motor Club",
    attained: "2026-02-08",
    imageUrl: "/collectibles/nakamotor/329.png",
    rarity: "Legendary",
    rank: 82,
    traits: [
      {
        name: "Background",
        value: "Shooting Star",
        count: 50,
        rarity: "Uncommon",
      },
      {
        name: "Windows",
        value: "Black Window",
        count: 1211,
        rarity: "Common",
      },
      {
        name: "Headlights",
        value: "Outline Blue Lights",
        count: 70,
        rarity: "Common",
      },
      {
        name: "Paint",
        value: "Metallic Light",
        count: 8,
        rarity: "Legendary",
      },
      {
        name: "Decal",
        value: "Side Banner",
        count: 116,
        rarity: "Common",
      },
      {
        name: "Wheels",
        value: "Spiky Wheels",
        count: 32,
        rarity: "Rare",
      },
      {
        name: "Underglow",
        value: "Red Underglow",
        count: 88,
        rarity: "Rare",
      },
      {
        name: "Feature",
        value: "Fire",
        count: 22,
        rarity: "Epic",
      },
    ],
    attributes: {
      Rareness: "Legendary",
      Rank: "82 of 2222",
      Number: "329 of 2222",
    },
  },
  {
    id: "naka-1872",
    bucket: "permanent",
    name: "Naka Motor Club #1872",
    org: NAKA_MOTOR.collection,
    serialNumber: "1872",
    contract: NAKA_MOTOR.contract,
    url: "https://twetch.com/market/4449436086e3cd58b73508aa498d886f62a5e88a049d3e27d49d2c9b90add05a?token=1872",
    venue: "Naka Motor Club",
    attained: "2026-03-02",
    imageUrl: "/collectibles/nakamotor/1872.png",
    rarity: "Epic",
    rank: 89,
    traits: [
      {
        name: "Background",
        value: "Rekt Mode",
        count: 11,
        rarity: "Legendary",
      },
      {
        name: "Windows",
        value: "Shattered Window",
        count: 82,
        rarity: "Rare",
      },
      {
        name: "Headlights",
        value: "X White Lights",
        count: 39,
        rarity: "Rare",
      },
      {
        name: "Paint",
        value: "Yellow",
        count: 63,
        rarity: "Common",
      },
      {
        name: "Decal",
        value: "Rust",
        count: 54,
        rarity: "Rare",
      },
      {
        name: "Wheels",
        value: "Safu Wheels",
        count: 30,
        rarity: "Rare",
      },
      {
        name: "Underglow",
        value: "No Underglow",
        count: 1703,
        rarity: "Common",
      },
      {
        name: "Feature",
        value: "Rug'd",
        count: 45,
        rarity: "Rare",
      },
    ],
    attributes: {
      Rareness: "Epic",
      Rank: "89 of 2222",
      Number: "1872 of 2222",
    },
  },
  {
    id: "naka-2121",
    bucket: "permanent",
    name: "The Guardian",
    org: NAKA_MOTOR.collection,
    serialNumber: "2121",
    contract: NAKA_MOTOR.contract,
    url: "https://twetch.com/market/4449436086e3cd58b73508aa498d886f62a5e88a049d3e27d49d2c9b90add05a?token=2121",
    venue: "Naka Motor Club",
    attained: "2026-04-11",
    imageUrl: "/collectibles/nakamotor/2121.png",
    videoUrl: "/collectibles/nakamotor/2121.mp4",
    rarity: "Exotic",
    rank: 10,
    traits: [
      {
        name: "Background",
        value: "Dragon",
        count: 20,
        rarity: "Epic",
      },
      {
        name: "Windows",
        value: "Green Window",
        count: 164,
        rarity: "Uncommon",
      },
      {
        name: "Headlights",
        value: "X White Lights",
        count: 39,
        rarity: "Rare",
      },
      {
        name: "Paint",
        value: "Wave White",
        count: 35,
        rarity: "Uncommon",
      },
      {
        name: "Decal",
        value: "Sponsored",
        count: 32,
        rarity: "Epic",
      },
      {
        name: "Wheels",
        value: "Hover Turquoise Wheels",
        count: 15,
        rarity: "Epic",
      },
      {
        name: "Underglow",
        value: "Turquoise Underglow",
        count: 116,
        rarity: "Rare",
      },
      {
        name: "Feature",
        value: "The Guardian",
        count: 58,
        rarity: "Rare",
      },
      {
        name: "Signature Series",
        value: "1 of 1",
        count: 1,
        rarity: "Exotic",
      },
    ],
    attributes: {
      Rareness: "Exotic",
      Rank: "10 of 2222",
      Number: "2121 of 2222",
    },
  },
  {
    id: "naka-822",
    bucket: "permanent",
    name: "Naka Motor Club #822",
    org: NAKA_MOTOR.collection,
    serialNumber: "822",
    contract: NAKA_MOTOR.contract,
    url: "https://twetch.com/market/4449436086e3cd58b73508aa498d886f62a5e88a049d3e27d49d2c9b90add05a?token=822",
    venue: "Naka Motor Club",
    attained: "2026-05-14",
    imageUrl: "/collectibles/nakamotor/822.png",
    rarity: "Common",
    rank: 2191,
    traits: [
      {
        name: "Background",
        value: "Lightness",
        count: 177,
        rarity: "Common",
      },
      {
        name: "Windows",
        value: "Black Window",
        count: 1211,
        rarity: "Common",
      },
      {
        name: "Headlights",
        value: "Outline Blue Lights",
        count: 70,
        rarity: "Common",
      },
      {
        name: "Paint",
        value: "Red",
        count: 99,
        rarity: "Common",
      },
      {
        name: "Decal",
        value: "Trim Accent",
        count: 133,
        rarity: "Common",
      },
      {
        name: "Wheels",
        value: "Fracture Black Wheels",
        count: 101,
        rarity: "Common",
      },
      {
        name: "Underglow",
        value: "No Underglow",
        count: 1703,
        rarity: "Common",
      },
      {
        name: "Feature",
        value: "Eddie",
        count: 156,
        rarity: "Common",
      },
    ],
    attributes: {
      Rareness: "Common",
      Rank: "2191 of 2222",
      Number: "822 of 2222",
    },
  },
  {
    id: "naka-510",
    bucket: "permanent",
    name: "Naka Motor Club #510",
    org: NAKA_MOTOR.collection,
    serialNumber: "510",
    contract: NAKA_MOTOR.contract,
    url: "https://twetch.com/market/4449436086e3cd58b73508aa498d886f62a5e88a049d3e27d49d2c9b90add05a?token=510",
    venue: "Naka Motor Club",
    attained: "2026-01-27",
    imageUrl: "/collectibles/nakamotor/510.png",
    rarity: "Uncommon",
    rank: 1010,
    traits: [
      {
        name: "Background",
        value: "Bunker Entrance",
        count: 47,
        rarity: "Rare",
      },
      {
        name: "Windows",
        value: "Purple Window",
        count: 191,
        rarity: "Uncommon",
      },
      {
        name: "Headlights",
        value: "Hyper Blue Lights",
        count: 53,
        rarity: "Uncommon",
      },
      {
        name: "Paint",
        value: "Blue",
        count: 101,
        rarity: "Common",
      },
      {
        name: "Decal",
        value: "Half Black",
        count: 74,
        rarity: "Uncommon",
      },
      {
        name: "Wheels",
        value: "Cozy Grey Wheels",
        count: 99,
        rarity: "Common",
      },
      {
        name: "Underglow",
        value: "No Underglow",
        count: 1703,
        rarity: "Common",
      },
      {
        name: "Feature",
        value: "Blue Bumper",
        count: 66,
        rarity: "Rare",
      },
    ],
    attributes: {
      Rareness: "Uncommon",
      Rank: "1010 of 2222",
      Number: "510 of 2222",
    },
  },
  {
    id: "naka-585",
    bucket: "permanent",
    name: "Naka Motor Club #585",
    org: NAKA_MOTOR.collection,
    serialNumber: "585",
    contract: NAKA_MOTOR.contract,
    url: "https://twetch.com/market/4449436086e3cd58b73508aa498d886f62a5e88a049d3e27d49d2c9b90add05a?token=585",
    venue: "Naka Motor Club",
    attained: "2025-12-19",
    imageUrl: "/collectibles/nakamotor/585.png",
    rarity: "Rare",
    rank: 329,
    traits: [
      {
        name: "Background",
        value: "Hovering Rocks",
        count: 66,
        rarity: "Uncommon",
      },
      {
        name: "Windows",
        value: "Black Window",
        count: 1211,
        rarity: "Common",
      },
      {
        name: "Headlights",
        value: "Rectangle Turquoise Lights",
        count: 59,
        rarity: "Uncommon",
      },
      {
        name: "Paint",
        value: "Green Carbon Fiber",
        count: 32,
        rarity: "Uncommon",
      },
      {
        name: "Decal",
        value: "SV Tag",
        count: 103,
        rarity: "Common",
      },
      {
        name: "Wheels",
        value: "Cozy Green Wheels",
        count: 32,
        rarity: "Rare",
      },
      {
        name: "Underglow",
        value: "Turquoise Underglow",
        count: 116,
        rarity: "Rare",
      },
      {
        name: "Feature",
        value: "The Dreamer With Oni Gear",
        count: 49,
        rarity: "Rare",
      },
    ],
    attributes: {
      Rareness: "Rare",
      Rank: "329 of 2222",
      Number: "585 of 2222",
    },
  },

  {
    id: "rare-hat-69",
    bucket: "permanent",
    name: "Hat 69",
    org: RARE_HAT.collection,
    serialNumber: "69",
    contract: RARE_HAT.contract,
    url: "https://twetch.com/hats/69",
    venue: "Rare Hat Secret Society",
    attained: "2026-01-19",
    imageUrl: "/collectibles/rarehat.mp4",
    attributes: {
      Collection: RARE_HAT.collection,
      Number: `69 of ${RARE_HAT.issuance}`,
      Issuance: String(RARE_HAT.issuance),
      Transferable: "Yes",
    },
  },

  {
    id: "rarepepes-3213121",
    bucket: "permanent",
    name: "Vapor Pepe",
    org: "Counterfeit Rares",
    serialNumber: "3213121",
    contract: "1CgMstr9xY3nG4uM6vN7zA8qS5cV9eW2f9",
    url: "https://copedex.com",
    venue: "Rare Pepe Club",
    attained: "2025-10-24",
    imageUrl: "/collectibles/art1.png",
    attributes: {
      Rareness: "Counterfeit",
      Membership: "Lifetime",
      Domain: "rarepepe.club",
    },
  },
  {
    id: "rarepepes-3213122",
    bucket: "permanent",
    name: "Green Herring",
    org: "Counterfeit Rares",
    serialNumber: "3213122",
    contract: "1CgMstr9xY3nG4uM6vN7zA8qS5cV9eW2f9",
    url: "https://copedex.com",
    venue: "Rare Pepe Club",
    attained: "2025-10-24",
    imageUrl: "/collectibles/art2.png",
    attributes: {
      Rareness: "Counterfeit",
      Membership: "Lifetime",
      Domain: "rarepepe.club",
    },
  },
  {
    id: "rarepepes-3213123",
    bucket: "permanent",
    name: "Cypher Pepe 2028",
    org: "Counterfeit Rares",
    serialNumber: "3213123",
    contract: "1CgMstr9xY3nG4uM6vN7zA8qS5cV9eW2f9",
    url: "https://copedex.com",
    venue: "Rare Pepe Club",
    attained: "2025-10-24",
    imageUrl: "/collectibles/art3.png",
    attributes: {
      Rareness: "Counterfeit",
      Membership: "Lifetime",
      Domain: "rarepepe.club",
    },
  },
  {
    id: "rarepepes-3213124",
    bucket: "permanent",
    name: "Coomedian",
    org: "Counterfeit Rares",
    serialNumber: "3213124",
    contract: "1CgMstr9xY3nG4uM6vN7zA8qS5cV9eW2f9",
    url: "https://copedex.com",
    venue: "Rare Pepe Club",
    attained: "2025-10-24",
    imageUrl: "/collectibles/art4.png",
    attributes: {
      Rareness: "Counterfeit",
      Membership: "Lifetime",
      Domain: "rarepepe.club",
    },
  },
  {
    id: "rarepepes-3213125",
    bucket: "permanent",
    name: "Pepe Homo",
    org: "Counterfeit Rares",
    serialNumber: "3213125",
    contract: "1CgMstr9xY3nG4uM6vN7zA8qS5cV9eW2f9",
    url: "https://copedex.com",
    venue: "Rare Pepe Club",
    attained: "2025-10-24",
    imageUrl: "/collectibles/art5.png",
    attributes: {
      Rareness: "Counterfeit",
      Membership: "Lifetime",
      Domain: "rarepepe.club",
    },
  },
  {
    id: "nexushack-prize-942842",
    bucket: "permanent",
    name: "NexusChain 1st Prize",
    org: "NexusChain",
    serialNumber: "942842",
    contract: "1NxHkPrz8vQ2mF3tL5sK6wX9yR4bT7cU8d",
    url: "https://nexuschain.io/hackathon/2023/winners/first-place",
    venue: "NexusChain Hackathon",
    attained: "2023-04-22",
    imageUrl: "/collectibles/certificate1.png",
    autoBurn: true,
    attributes: {
      Event: "NexusChain Hackathon",
      Prize: "1st Place",
      Date: "April 22, 2023",
    },
  },
  {
    id: "coingeek-masterclass-4412144",
    bucket: "permanent",
    name: "CoinGeek Master Class",
    org: "CoinGeek",
    serialNumber: "4412144",
    contract: "1CgMstr9xY3nG4uM6vN7zA8qS5cV9eW2fH",
    url: "https://coingeek.com/masterclass/san-francisco-2024",
    venue: "San Francisco",
    attained: "2024-11-11",
    imageUrl: "/collectibles/certificate2.png",
    autoBurn: true,
    attributes: {
      Location: "San Francisco",
      Event: "CoinGeek Master Class",
      Date: "November 11, 2024",
    },
  },
  {
    id: "bitcoin-monasteries-ticket-017764",
    bucket: "finite",
    name: "Bitcoin Monasteries Movie Ticket",
    org: "Mind's Eye Cinema",
    serialNumber: "017764",
    contract: "1BtMnst7yZ4oH5vO7wP8aB9rT6dW1fX3gI",
    url: "https://mindseyecinema.com/movies/bitcoin-monasteries",
    venue: "Mind's Eye Cinema",
    event: "Bitcoin Monasteries Viewing",
    validThrough: "2026-03-18",
    imageUrl: "/collectibles/ticket1.png",
    autoBurn: true,
    attributes: {
      Event: "Bitcoin Monasteries",
      "Valid Through": "March 18, 2026",
      Row: "6",
      Seat: "E12",
    },
  },
  {
    id: "soho-gold-membership-4412141",
    bucket: "finite",
    name: "SOHO Gold Membership",
    org: "SOHO",
    serialNumber: "4412141",
    contract: "1SoGld8zA5pI6wQ8xR9bC1sU7eX2gY4jJ",
    url: "https://sohorooftopclub.com/memberships/gold",
    venue: "SOHO Rooftop Club",
    validThrough: "2026-04-12",
    imageUrl: "/collectibles/membership2.png",
    autoBurn: true,
    attributes: {
      Membership: "Gold",
      "Valid Through": "April 12, 2026",
      Benefits: "Access to VIP Area",
    },
  },
  {
    id: "cyborg-theocracy-ticket-017650",
    bucket: "expired",
    name: "Cyborg Theocracy Movie Ticket",
    org: "Mind's Eye Cinema",
    serialNumber: "017650",
    venue: "Mind's Eye Theatre",
    event: "Cyborg Theocracy Viewing",
    validThrough: "2024-03-18",
    imageUrl: "/collectibles/ticket2.png",
    redeemed: true,
    expired: true,
    attributes: {
      Venue: "Mind's Eye Theatre",
      Event: "Cyborg Theocracy",
      "Valid Through": "March 18, 2024",
      Row: "6",
      Seat: "E12",
      Status: "Redeemed",
    },
  },
  {
    id: "high-roller-vip-942842",
    bucket: "expired",
    name: "The High Roller Casino VIP",
    org: "The High Roller",
    serialNumber: "942842",
    venue: "High Roller Casino",
    validThrough: "2024-11-18",
    imageUrl: "/collectibles/membership1.png",
    expired: true,
    attributes: {
      Venue: "High Roller Casino",
      Membership: "Platinum",
      "Valid Through": "November 18, 2024",
      Benefits: "Free Drinks in Poker Lounge",
    },
  },
];
