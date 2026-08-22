/**
 * tables: payment_links, split_bills — the social side of the wallet.
 *
 * Both are addressed to handles rather than addresses, following Vela: you send
 * to a person, and the handle is what proves you are paying the right one.
 */
import type { PaymentLink, SplitBill } from "./types";

export const paymentLinks: PaymentLink[] = [
  {
    id: "pl-samples",
    code: "a3f19c4d",
    description: "Sample kit, forty-farm batch",
    tokenId: "nutri",
    amountUnits: 25,
    status: "open",
    createdAt: "2026-07-27T15:10:00.000Z",
    expiresAt: "2026-08-27T15:10:00.000Z",
    payments: [
      {
        id: "plp-1",
        personId: "isa-van-den-berg",
        units: 25,
        paidAt: "2026-07-28T09:12:00.000Z",
      },
      {
        id: "plp-2",
        personId: "dan-kittredge",
        units: 25,
        paidAt: "2026-07-28T11:40:00.000Z",
      },
    ],
  },
  {
    id: "pl-overlay",
    code: "7b02c9e1",
    description: "Overlay topic review, pay what you like",
    tokenId: "bsv",
    status: "open",
    createdAt: "2026-07-28T17:05:00.000Z",
    expiresAt: "2026-08-11T17:05:00.000Z",
    payments: [
      {
        id: "plp-3",
        personId: "tw-shruggr",
        units: 0.05,
        paidAt: "2026-07-29T08:22:00.000Z",
      },
    ],
  },
  {
    id: "pl-fieldday",
    code: "c81a5b34",
    description: "Brix field day entry",
    tokenId: "eursv",
    amountUnits: 12,
    status: "closed",
    createdAt: "2026-07-14T08:00:00.000Z",
    expiresAt: "2026-07-15T08:00:00.000Z",
    payments: [
      {
        id: "plp-4",
        personId: "marcel-van-silfhout",
        units: 12,
        paidAt: "2026-07-14T09:02:00.000Z",
      },
      {
        id: "plp-5",
        personId: "sophie-meijer",
        units: 12,
        paidAt: "2026-07-14T09:31:00.000Z",
      },
      {
        id: "plp-6",
        personId: "isa-van-den-berg",
        units: 12,
        paidAt: "2026-07-14T10:04:00.000Z",
      },
    ],
  },
];

export const splitBills: SplitBill[] = [
  {
    id: "sb-coordination",
    description: "Week's coordination costs",
    tokenId: "bsv",
    totalUnits: 0.68965517,
    createdAt: "2026-07-26T11:18:00.000Z",
    shares: [
      { personId: "sanne-verhoeven", units: 0.1724138, status: "paid" },
      { personId: "mark-frederiks", units: 0.17241379, status: "paid" },
      { personId: "wouter-de-groot", units: 0.17241379, status: "pending" },
      { personId: "els-verheijen", units: 0.17241379, status: "failed" },
    ],
  },
  {
    id: "sb-seeding",
    description: "Month of seeding, three ways",
    tokenId: "bsv",
    totalUnits: 0.001,
    createdAt: "2026-07-30T19:41:00.000Z",
    shares: [
      { personId: "tw-futurefroggy", units: 0.00033334, status: "paid" },
      { personId: "tw-shruggr", units: 0.00033333, status: "paid" },
      { personId: "tw-sk84m", units: 0.00033333, status: "paid" },
    ],
  },
  {
    id: "sb-lab",
    description: "Spectral run, split with the institute",
    tokenId: "eursv",
    totalUnits: 46,
    createdAt: "2026-07-27T14:18:00.000Z",
    shares: [
      { personId: "marcel-van-silfhout", units: 23, status: "paid" },
      { personId: "dan-kittredge", units: 23, status: "pending" },
    ],
  },
];
