/**
 * tables: connections (Connect app), output_baskets (Baskets app) — placeholders.
 */
import type { Connection, OutputBasket } from "./types";

export const connections: Connection[] = [
  {
    id: "conn-woc",
    name: "WhatsOnChain",
    origin: "https://whatsonchain.com",
    favicon: "W",
    faviconColor: "#facc15",
    permissions: ["Read identity", "Query balances"],
    lastUsedAt: "2026-07-06T08:20:00.000Z",
    createdAt: "2026-05-11T10:00:00.000Z",
  },
  {
    id: "conn-fractional",
    name: "Fractional Farming",
    origin: "https://www.fractional.farm",
    favicon: "F",
    faviconColor: "#16a34a",
    permissions: ["Read identity", "Request payments"],
    lastUsedAt: "2026-07-06T07:55:00.000Z",
    createdAt: "2026-06-20T09:00:00.000Z",
  },
  {
    id: "conn-market",
    name: "1Sat Market",
    origin: "https://1satmarket.example",
    favicon: "1",
    faviconColor: "#f59e0b",
    permissions: ["Read identity", "Sign transactions", "Access baskets"],
    lastUsedAt: "2026-07-04T16:40:00.000Z",
    createdAt: "2026-04-30T09:00:00.000Z",
  },
];

export const outputBaskets: OutputBasket[] = [
  {
    id: "basket-default",
    name: "default",
    description: "Spendable P2PKH change outputs.",
    outputCount: 42,
    satoshis: 482_310_450,
    protocol: "P2PKH",
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: "basket-ordinals",
    name: "ordinals",
    description: "1Sat ordinal inscriptions held by this wallet.",
    outputCount: 17,
    satoshis: 17,
    protocol: "1Sat Ordinals",
    createdAt: "2026-03-02T09:00:00.000Z",
  },
  {
    id: "basket-tokens",
    name: "bsv21-tokens",
    description: "BSV21 fungible token outputs across contracts.",
    outputCount: 9,
    satoshis: 9,
    protocol: "BSV21",
    createdAt: "2026-04-15T09:00:00.000Z",
  },
  {
    id: "basket-tickets",
    name: "app.tickets",
    description: "Custom basket used by an event-ticketing app.",
    outputCount: 5,
    satoshis: 5_000,
    protocol: "PushDrop",
    createdAt: "2026-05-20T09:00:00.000Z",
  },
];
