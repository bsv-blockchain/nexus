/**
 * tables: signing_keys, documents, sign_envelopes — placeholder rows.
 */
import type { SignableDocument, SignEnvelope, SigningKey } from "./types";

export const signEnvelopes: SignEnvelope[] = [
  {
    id: "env-tenancy",
    title: "Tenancy Agreement 2026",
    createdAt: "2026-07-01T07:09:00.000Z",
    actionDate: null,
    status: "completed",
    tag: "Contract",
  },
  {
    id: "env-nda",
    title: "Mutual NDA, Aurora Media",
    createdAt: "2026-07-05T12:00:00.000Z",
    actionDate: "2026-07-12T00:00:00.000Z",
    status: "awaiting",
    tag: "Legal",
  },
  {
    id: "env-sow",
    title: "Statement of Work Q3",
    createdAt: "2026-06-30T09:00:00.000Z",
    actionDate: "2026-07-01T17:22:00.000Z",
    status: "completed",
    tag: "Finance",
  },
  {
    id: "env-invoice",
    title: "Invoice #2201 Approval",
    createdAt: "2026-06-18T10:30:00.000Z",
    actionDate: null,
    status: "draft",
    tag: "Finance",
  },
  {
    id: "env-supply",
    title: "Supplier Onboarding Form",
    createdAt: "2026-06-10T14:00:00.000Z",
    actionDate: "2026-06-14T09:00:00.000Z",
    status: "declined",
    tag: "Procurement",
  },
];

export const signingKeys: SigningKey[] = [
  {
    id: "key-identity",
    label: "Identity Key",
    publicKey: "02a1b2…c3d4",
    keyType: "identity",
    createdAt: "2026-01-12T09:05:00.000Z",
  },
  {
    id: "key-docs",
    label: "Document Key",
    publicKey: "03e5f6…a7b8",
    keyType: "document",
    createdAt: "2026-02-20T13:40:00.000Z",
  },
  {
    id: "key-delegate",
    label: "Assistant (delegated)",
    publicKey: "029c0d…e1f2",
    keyType: "delegated",
    createdAt: "2026-05-02T10:15:00.000Z",
  },
];

export const signableDocuments: SignableDocument[] = [
  {
    id: "doc-nda",
    title: "Mutual NDA, Aurora Media",
    fileName: "aurora-mutual-nda.pdf",
    sizeBytes: 412_003,
    status: "awaiting-signature",
    signedWithKeyId: null,
    signedAt: null,
    requestedBy: "legal@auroramedia.example",
    createdAt: "2026-07-05T12:00:00.000Z",
  },
  {
    id: "doc-sow",
    title: "Statement of Work Q3",
    fileName: "sow-q3-2026.pdf",
    sizeBytes: 981_220,
    status: "signed",
    signedWithKeyId: "key-docs",
    signedAt: "2026-07-01T17:22:00.000Z",
    requestedBy: "ops@nexus.example",
    createdAt: "2026-06-30T09:00:00.000Z",
  },
  {
    id: "doc-invoice",
    title: "Invoice #2201 Approval",
    fileName: "invoice-2201.pdf",
    sizeBytes: 88_410,
    status: "verified",
    signedWithKeyId: "key-identity",
    signedAt: "2026-06-18T11:05:00.000Z",
    requestedBy: "billing@auroramedia.example",
    createdAt: "2026-06-18T10:30:00.000Z",
  },
];
