/**
 * tables: identity_keys, identity_certificates — placeholder identity data.
 */
import type { IdentityCertificate, IdentityKey } from "./types";

export const identityKeys: IdentityKey[] = [
  {
    id: "key-everyday",
    label: "Everyday Identity Badge",
    publicKey:
      "03463bd7cb6662e7a127151d498bffcd98ee12c3bc66c1d05cdb3f787027baffba",
    primary: true,
  },
  {
    id: "key-work",
    label: "Work Identity Badge",
    publicKey:
      "02a1f7c934e0d6b8215c9e4477013fbe9a5d2c88ee6301f4bb27ce50aa9df3c1e7",
    primary: false,
  },
];

// No certificates yet — the app shows the empty state that prompts the user
// to register with identity certifiers.
export const identityCertificates: IdentityCertificate[] = [];
