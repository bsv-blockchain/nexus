/**
 * tables: wallet_accounts, wallet_transactions — placeholder rows.
 */
import type { WalletAccount, WalletTransaction } from "./types";

/**
 * The wallets you hold, not the wallet you have.
 *
 * One was always a simplification: people keep spending money separate from
 * savings, and a shared household float separate from both. Which of these a
 * profile may reach is a per-profile setting; which one is *active* is a
 * separate choice made in the wallet itself, because those are different
 * questions and answering them in one control conflates "Work can see this"
 * with "I am spending from this right now".
 *
 * Transactions stay keyed to `acct-main`, which is the everyday wallet under
 * its old id. Renaming it would have orphaned every seeded transaction to make
 * an identifier read more nicely, which is a bad trade in a table nobody sees.
 */
export const walletAccounts: WalletAccount[] = [
  {
    id: "acct-main",
    label: "Everyday",
    address: "1BSVHubXk3pQm9vWc7dTfLr2NahG4eKjUw",
    identifier: "wk_02f3a91c8be47d05",
    colors: ["#4353ff", "#22d3ee"],
    balanceSatoshis: 482_310_450,
    fiatCurrency: "USD",
    fiatRate: 52.4,
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: "acct-cold",
    label: "Cold storage",
    address: "1Cq7wPjKm4xNvZa8bTrLd3EuHy6MsGfVnR",
    identifier: "wk_07b1e4dd2af96310",
    colors: ["#0f172a", "#64748b"],
    /* The one that is sealed. Savings is exactly the wallet somebody would
       want a password on, and a prototype with no locked wallet never shows
       what the lock is for. */
    locked: true,
    balanceSatoshis: 1_240_000_000,
    fiatCurrency: "USD",
    fiatRate: 52.4,
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: "acct-work",
    label: "Work",
    address: "1JhT9vLpQe2sXd5RnFcYw8BuKa4MzGxHo7",
    identifier: "wk_0c9d5f7061ba824e",
    colors: ["#7c3aed", "#f472b6"],
    balanceSatoshis: 61_420_800,
    fiatCurrency: "USD",
    fiatRate: 52.4,
    createdAt: "2026-02-04T09:00:00.000Z",
  },
  {
    id: "acct-shared",
    label: "Household",
    address: "1Ky6bNwStE3rVc9XmLd7QpZa2HuTf5GjWo",
    identifier: "wk_0a48c2e6395fb7d1",
    colors: ["#f59e0b", "#ef4444"],
    balanceSatoshis: 8_905_300,
    fiatCurrency: "USD",
    fiatRate: 52.4,
    createdAt: "2026-03-19T09:00:00.000Z",
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
