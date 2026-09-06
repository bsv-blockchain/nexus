import type { BrowserExtension } from "./types";

/**
 * The extensions this browser is carrying.
 *
 * One, and that is the honest number. Nexus is Chromium underneath, so a
 * Chrome extension runs here — but most of what people reach for extensions to
 * do, this browser already does: there is a wallet, an identity, a signer and a
 * blocker's worth of permission prompts built in. A fixture stocked with six
 * would be describing a browser that needed them.
 *
 * uBlock Origin earns its place because ad-blocking is the one job nothing in
 * the shell does. A wallet extension does not: putting one beside the wallet
 * that IS the browser would be two things claiming the same key, which is the
 * confusion this product exists to remove.
 *
 * The commands are uBlock's real ones, in its own order, so the shortcuts
 * screen is a picture of a real extension rather than four invented verbs.
 */
export const browserExtensions: BrowserExtension[] = [
  {
    /*
     * Ours, and the reason this manager has more than one row.
     *
     * StumbleUpon's idea — a button that takes you somewhere you did not know
     * to look for — aimed at a web where the interesting thing is that a site
     * can hold a wallet. The catalogue is the App Store minus the Essentials,
     * so what it lands on is a real address somebody can open.
     */
    id: "tumbleupon",
    name: "TumbleUpon",
    blurb: "Discover the best of web3, one click at a time.",
    version: "1.0.0",
    mark: { letters: "Tu", background: "#4353ff", color: "#ffffff" },
    enabled: true,
    permissions: [
      "Read the address of the page you are on",
      "Open pages in the tab you are using",
    ],
    site: "https://tumbleupon.nexus.free",
    commands: ["Tumble to a new site", "Like this site", "Open the inbox"],
  },
  {
    id: "ublock-origin",
    name: "uBlock Origin",
    blurb: "Finally, an efficient blocker. Easy on CPU and memory.",
    version: "1.63.2",
    /* Its own mark: a shield, in its own red, with the letters it is known by.
       Drawn rather than fetched — one asset from one publisher's CDN is one
       asset that goes missing when they reorganise it. */
    mark: { letters: "uB", background: "#8b1a1a", color: "#ffffff" },
    enabled: true,
    permissions: [
      "Read and change all your data on websites you visit",
      "Read your browsing history",
    ],
    site: "https://github.com/gorhill/uBlock",
    commands: [
      "Activate the extension",
      "Enter element picker mode",
      "Enter element zapper mode",
      "Open the logger",
      "Open the dashboard",
      "Relax blocking mode",
      "Toggle cosmetic filtering",
      "Toggle JavaScript",
    ],
  },
];
