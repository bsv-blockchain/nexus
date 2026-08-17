/**
 * table: ecosystems — the wallet ecosystems a handle can belong to.
 *
 * BRC-169 addresses every identity as `@handle@ecosystem`, where the ecosystem
 * is an internet domain and is the sole authority for handles within it. There
 * is no central registry: `@kuro@treechat` and `@kuro@twetch` are different
 * people, and each host answers only for its own namespace.
 *
 * `alias` is the dotless short form; `domain` is the fully-qualified authority.
 * BRC-169 section 2.1(5) disambiguates the two by the presence of a dot, and
 * section 2.4(3) requires the domain be shown when only an unverified alias is
 * known — which is why both are carried here rather than derived.
 */
import type { Ecosystem } from "./types";

export const ecosystems: Ecosystem[] = [
  {
    id: "nexus",
    name: "Nexus",
    description:
      "The hub you are signed into. Its handles need no suffix, since they are local to you.",
    alias: "nexus",
    domain: "nexus.app",
    icon: "/icons/Nexus-logo-solid-BG2.png",
    local: true,
    commands: [
      {
        verb: "vouch",
        description:
          "Add public reputation to a handle from your identity key, visible to anyone who runs /whois on them.",
      },
    ],
  },
  {
    id: "treechat",
    name: "Treechat",
    description:
      "Boards where posts earn value from readers rather than advertisers. Accounts are numbered in the order they joined.",
    alias: "treechat",
    domain: "treechat.app",
    icon: "/ecosystems/treechat.webp",
    // Treechat assigns sequential numeric handles; the display name is separate.
    numericHandles: true,
  },
  {
    id: "twetch",
    name: "Twetch",
    description:
      "A social network that put posts on-chain before anyone else, now aimed at peer-to-peer data ownership.",
    alias: "twetch",
    domain: "twetch.com",
    icon: "/ecosystems/twetch.svg",
    // Twetch user numbers are the handle — @3 is Randy, the third account.
    numericHandles: true,
    /** the mark is a bare glyph, so it needs a plate behind it */
    iconPlate: "#0f1021",
  },
  {
    id: "yours",
    name: "Yours",
    description:
      "An open-source wallet that lives in the browser, holding ordinals and tokens alongside ordinary payments.",
    alias: "yours",
    domain: "yours.org",
    icon: "/ecosystems/yours.png",
  },
  {
    id: "handcash",
    name: "HandCash",
    description:
      "A consumer wallet built around handles and micropayments, widely used at small-merchant tills.",
    alias: "handcash",
    domain: "handcash.io",
    icon: "/ecosystems/handcash.webp",
  },
  {
    id: "commonsource",
    name: "Common Source",
    description:
      "A Dutch food-systems network connecting cities, regions, farmers and innovators through mass participation.",
    alias: "commonsource",
    domain: "commonsource.nl",
    icon: "/ecosystems/commonsource.svg",
  },
  {
    id: "mycelia",
    name: "Mycelia",
    description:
      "The Bionutrient Institute's network, linking soil health to measured nutrient density in food.",
    alias: "mycelia",
    domain: "mycelia.network",
    icon: "/ecosystems/mycelia.png",
  },
];
