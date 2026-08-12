"use client";

import { Group, Row, Toggle } from "@/components/apps/settings/blocks";
import { useHub } from "@/components/hub/hub-provider";
import { content } from "@/lib/data";
import { setSetting, useSettings } from "@/lib/settings-store";
import type { ReactNode } from "react";

const copy = content.settings.autofill;

/**
 * What gets filled in for you, and how you prove who you are.
 *
 * Sign-in comes first and form-filling second, which is the opposite of how
 * every other browser orders this. The reason is that one of these two is the
 * thing this product can do better: a key you hold cannot be leaked from a
 * server that never had it. Saved passwords are the fallback, and default off.
 *
 * Nothing is stored here. The Vault already holds credentials, so this panel
 * decides the policy and points at the place the material lives — two lists of
 * the same secrets would be one list too many.
 */
export function AutofillPanel(): ReactNode {
  const settings = useSettings();
  const { openApp } = useHub();
  return (
    <>
      <Group title={copy.keyTitle} hint={copy.keyHint}>
        <Toggle
          label={copy.preferKey}
          hint={copy.preferKeyHint}
          value={settings.preferKeySignIn}
          onChange={(next) => setSetting("preferKeySignIn", next)}
        />
        <Toggle
          label={copy.savePasswords}
          hint={copy.savePasswordsHint}
          value={settings.offerToSavePasswords}
          onChange={(next) => setSetting("offerToSavePasswords", next)}
        />
      </Group>

      <Group title={copy.fillTitle}>
        <Toggle
          label={copy.addresses}
          hint={copy.addressesHint}
          value={settings.autofillAddresses}
          onChange={(next) => setSetting("autofillAddresses", next)}
        />
        <Toggle
          label={copy.cards}
          hint={copy.cardsHint}
          value={settings.autofillCards}
          onChange={(next) => setSetting("autofillCards", next)}
        />
        {/* Points at the Vault rather than listing the material here. The
            secrets already have a home, and a second view of them is a second
            thing to keep in step. */}
        <Row
          label={copy.vaultRow}
          hint={copy.vaultRowHint}
          onClick={() => openApp("vault")}
        />
      </Group>
    </>
  );
}
