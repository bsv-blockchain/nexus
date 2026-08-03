/**
 * tables: transactions, tx_overlays — placeholder rows for the tx viewer.
 */
import type { ChainTransaction } from "./types";

export const chainTransactions: ChainTransaction[] = [
  {
    id: "ctx-1",
    txid: "9f2b41c8a7e6d5f4030201beefcafe1234567890abcdef1234567890abcdef12",
    blockHeight: 921_442,
    blockHash:
      "000000000000000004a1c9dd6f2f4e8b17c55aa0912ef3bb08d0a1f4c77e21b9",
    confirmations: 1_204,
    sizeBytes: 226,
    feeSatoshis: 96,
    totalInputSatoshis: 125_000_096,
    totalOutputSatoshis: 125_000_000,
    inputs: [
      {
        address: "1AuroraPayk9XmR2vC4bT7eLq3WgN8dHsUv",
        satoshis: 125_000_096,
        scriptType: "P2PKH",
      },
    ],
    outputs: [
      {
        address: "1BSVHubXk3pQm9vWc7dTfLr2NahG4eKjUw",
        satoshis: 125_000_000,
        scriptType: "P2PKH",
      },
    ],
    overlays: [
      {
        id: "ovl-1",
        transactionId: "ctx-1",
        network: "Payments Overlay",
        topic: "tm_payments",
        summary: "Invoice settlement broadcast to the payments topic",
        dataPreview: '{"invoice":"#2201","payer":"Aurora Media"}',
      },
      {
        id: "ovl-2",
        transactionId: "ctx-1",
        network: "Identity Overlay",
        topic: "tm_identity",
        summary: "Counterparty identity attestation resolved",
        dataPreview: '{"idKey":"02a1b2…c3d4","verified":true}',
      },
    ],
    createdAt: "2026-07-04T15:12:00.000Z",
  },
  {
    id: "ctx-2",
    txid: "aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66",
    blockHeight: 920_101,
    blockHash:
      "00000000000000000b3fe6a1d0c9e4527ab881c04f1de6720cd2e0a9b64c7f13",
    confirmations: 2_545,
    sizeBytes: 3_212_440,
    feeSatoshis: 3_240,
    totalInputSatoshis: 5_003_240,
    totalOutputSatoshis: 5_000_000,
    inputs: [
      {
        address: "1BSVHubXk3pQm9vWc7dTfLr2NahG4eKjUw",
        satoshis: 5_003_240,
        scriptType: "P2PKH",
      },
    ],
    outputs: [
      {
        address: "OP_RETURN (data)",
        satoshis: 0,
        scriptType: "NullData",
      },
      {
        address: "1BSVHubXk3pQm9vWc7dTfLr2NahG4eKjUw",
        satoshis: 5_000_000,
        scriptType: "P2PKH",
      },
    ],
    overlays: [
      {
        id: "ovl-3",
        transactionId: "ctx-2",
        network: "Media Overlay",
        topic: "tm_media",
        summary: "Image published: Sunrise over the Bay",
        dataPreview: '{"file":"sunrise-bay.jpg","mime":"image/jpeg"}',
      },
    ],
    createdAt: "2026-06-28T06:45:00.000Z",
  },
  {
    id: "ctx-3",
    txid: "feed5eed11223344556677889900aabbccddeeff11223344556677889900aabb",
    blockHeight: null,
    blockHash: null,
    confirmations: 0,
    sizeBytes: 244,
    feeSatoshis: 102,
    totalInputSatoshis: 60_000_102,
    totalOutputSatoshis: 60_000_000,
    inputs: [
      {
        address: "1OverlaySvc7hJk2mN4pQ6rS8tU0vW1xYz",
        satoshis: 60_000_102,
        scriptType: "P2PKH",
      },
    ],
    outputs: [
      {
        address: "1BSVHubXk3pQm9vWc7dTfLr2NahG4eKjUw",
        satoshis: 60_000_000,
        scriptType: "P2PKH",
      },
    ],
    overlays: [
      {
        id: "ovl-4",
        transactionId: "ctx-3",
        network: "Payments Overlay",
        topic: "tm_payments",
        summary: "Weekly settlement, awaiting first confirmation",
        dataPreview: '{"period":"2026-W27","status":"pending"}',
      },
    ],
    createdAt: "2026-07-06T07:58:00.000Z",
  },
];
