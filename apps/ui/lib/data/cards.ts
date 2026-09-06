import type { FundingCard } from "./types";

/**
 * The card already connected, so the screen is not a tutorial.
 *
 * One card, added months ago from the phone, because that is what a wallet
 * somebody actually uses looks like — an empty state teaches the flow and
 * nothing else, and this screen has three separate ideas to demonstrate on top
 * of it: which device captured the number, what the top-up switch does, and
 * why the phone rows below differ by platform.
 *
 * A Visa, and 4242 on purpose. It is the test number every payments engineer
 * on earth recognises, which is a quiet way of saying "nothing here is real"
 * to the only people who would think to check.
 */
export const fundingCards: FundingCard[] = [
  {
    id: "card-visa-4242",
    network: "Visa",
    last4: "4242",
    expiry: "09/28",
    holder: "CRUMBS",
    capturedOn: "dev-phone",
    addedDaysAgo: 96,
  },
];
