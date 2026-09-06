"use client";

/**
 * The rest of Discover's front page — the two surfaces this tool used to
 * have no opinion about at all.
 *
 * Store Admin owned the banner row and the collection row and nothing else,
 * which meant the most valuable card in the store (the hero, at the very
 * top, the first thing anybody reads) and the three editorial rows under it
 * could only be changed by editing lib/data/discover.ts and shipping a
 * build. That is a strange place to draw the line for a tool whose stated
 * job is Discover's promotional real estate: the hero is where a store puts
 * what it most wants read, and choosing what a row of stories is called is
 * the ordinary editorial work of running a store.
 *
 * What stays in the fixture: which category each editorial row is built
 * from, and the three quicklink cards under the hero. Those are facts about
 * the catalogue and groupings of apps, not things anybody buys or curates
 * week to week — see lib/data/discover.ts.
 */

import { Toggle } from "@/components/apps/settings/blocks";
import { AdminGroup, Field, fieldClass } from "@/components/apps/store-admin/blocks";
import {
  setEditorialFields,
  setHeroFields,
  type AdminPromoState,
} from "@/lib/admin-store";
import { discoverCategoryPages } from "@/lib/data/discover";
import { priceLabel, rateCard } from "@/lib/data/discover-promos";
import type { ReactNode } from "react";

export function SurfacesTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const hero = admin.hero;

  return (
    <>
      <AdminGroup
        id="hero"
        title="Discover hero"
        hint={`The card at the top of the store. Rate card: ${priceLabel(rateCard.hero.monthly)}.`}
      >
        <Toggle
          label="Enabled"
          hint="Off removes the card entirely rather than leaving an empty rectangle where it was."
          value={hero.enabled}
          onChange={(next) => setHeroFields({ enabled: next })}
        />
        <div className="grid gap-4 p-3 sm:grid-cols-2">
          <Field label="Eyebrow" hint="The small line above the headline">
            <input
              value={hero.eyebrow}
              onChange={(event) => setHeroFields({ eyebrow: event.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Headline">
            <input
              value={hero.title}
              onChange={(event) => setHeroFields({ title: event.target.value })}
              className={fieldClass}
            />
          </Field>
        </div>
        <div className="p-3">
          <Field label="Hint" hint="The line under the card, in smaller type">
            <input
              value={hero.hint}
              onChange={(event) => setHeroFields({ hint: event.target.value })}
              className={fieldClass}
            />
          </Field>
        </div>
        <Toggle
          label="Sponsored"
          hint="Adds the same disclosed badge every other sold placement carries."
          value={hero.sponsored}
          onChange={(next) => setHeroFields({ sponsored: next })}
        />
        {hero.sponsored && (
          <div className="grid gap-4 p-3 sm:grid-cols-2">
            <Field label="Advertiser">
              <input
                value={hero.advertiser}
                onChange={(event) => setHeroFields({ advertiser: event.target.value })}
                placeholder="Who bought the hero"
                className={fieldClass}
              />
            </Field>
            <Field
              label="Price per month"
              hint={`Rate card: ${priceLabel(rateCard.hero.monthly)}`}
            >
              <input
                type="number"
                min={0}
                step={50}
                value={hero.priceMonthly}
                onChange={(event) =>
                  setHeroFields({ priceMonthly: Math.max(0, Number(event.target.value) || 0) })
                }
                className={fieldClass}
              />
            </Field>
          </div>
        )}
        {hero.sponsored && !hero.advertiser.trim() && (
          <p className="bg-warning/10 text-warning p-3 text-xs font-medium">
            Marked sponsored with no advertiser set.
          </p>
        )}
        <p className="text-muted-foreground p-3 text-xs">
          {hero.impressions.toLocaleString()} impressions. No click figure:
          the hero&rsquo;s only control is the play button over a clip that
          does not exist yet, so there is nothing here to press.
        </p>
      </AdminGroup>

      <AdminGroup
        id="editorial"
        title="Editorial rows"
        hint="The three story rows under the charts. The words are yours; which apps appear in each is the catalogue's, by category — feature a listing in the Catalogue tab to pull it to the front of its row."
      >
        {admin.editorial.map((row) => {
          const page = discoverCategoryPages.find((entry) => entry.id === row.id);
          return (
            <div key={row.id}>
              <Toggle
                label={page?.label ?? row.id}
                hint={
                  page
                    ? `Built from the ${page.category} category · ${page.hint}`
                    : "Row no longer in the catalogue"
                }
                value={row.enabled}
                onChange={(next) => setEditorialFields(row.id, { enabled: next })}
              />
              {row.enabled && (
                <div className="p-3">
                  <Field label="Row heading" hint="What the row is called on Discover's front page">
                    <input
                      value={row.title}
                      onChange={(event) =>
                        setEditorialFields(row.id, { title: event.target.value })
                      }
                      className={fieldClass}
                    />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </AdminGroup>
    </>
  );
}
