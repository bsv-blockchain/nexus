/**
 * tables: wallet_accounts, wallet_transactions — placeholder rows.
 */
import type { WalletAccount, WalletTransaction } from "./types";

export const walletAccounts: WalletAccount[] = [
  {
    id: "acct-main",
    label: "Main Wallet",
    address: "1BSVHubXk3pQm9vWc7dTfLr2NahG4eKjUw",
    balanceSatoshis: 482_310_450,
    fiatCurrency: "USD",
    fiatRate: 52.4,
    createdAt: "2026-01-12T09:00:00.000Z",
  },
];

export const walletTransactions: WalletTransaction[] = [
  {
    id: "wtx-1",
    accountId: "acct-main",
    txid: "9f2b41c8a7e6d5f4030201beefcafe1234567890abcdef1234567890abcdef12",
    direction: "incoming",
    amountSatoshis: 125_000_000,
    feeSatoshis: 0,
    counterparty: "invoice #2201, Aurora Media",
    memo: "Milestone payment",
    status: "confirmed",
    confirmations: 1_204,
    createdAt: "2026-07-04T15:12:00.000Z",
  },
  {
    id: "wtx-2",
    accountId: "acct-main",
    txid: "77aa12bb34cc56dd78ee90ff0011223344556677889900aabbccddeeff001122",
    direction: "outgoing",
    amountSatoshis: 4_500_000,
    feeSatoshis: 96,
    counterparty: "coffee.example.com",
    memo: "Espresso subscription",
    status: "confirmed",
    confirmations: 3_982,
    createdAt: "2026-07-02T08:03:00.000Z",
  },
  {
    id: "wtx-3",
    accountId: "acct-main",
    txid: "misc0de00112233445566778899aabbccddeeff00112233445566778899aabbcc",
    direction: "outgoing",
    amountSatoshis: 21_000_000,
    feeSatoshis: 110,
    counterparty: "1LmN8...9qRs",
    memo: "Domain renewal",
    status: "confirmed",
    confirmations: 9_310,
    createdAt: "2026-06-24T19:47:00.000Z",
  },
  {
    id: "wtx-4",
    accountId: "acct-main",
    txid: "feed5eed11223344556677889900aabbccddeeff11223344556677889900aabb",
    direction: "incoming",
    amountSatoshis: 60_000_000,
    feeSatoshis: 0,
    counterparty: "payout, Overlay Services",
    memo: "Weekly settlement",
    status: "pending",
    confirmations: 0,
    createdAt: "2026-07-06T07:58:00.000Z",
  },
];
