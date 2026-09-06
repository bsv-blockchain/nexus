"use client";

/**
 * The half of a store admin's job that is not selling anything.
 *
 * A promo tool decides what gets pushed; this decides what exists. Both
 * belong to the same person, and until now only the first one had a screen:
 * there was no way to take a listing down, no way to pull a whole source out
 * of the catalogue after it shipped something it should not have, and no way
 * to put a good app at the front of the row it already appears in.
 *
 * Three controls, and deliberately no fourth. There is no review queue here,
 * because there are no submissions to review — nothing in this build
 * produces one, and a queue stocked with invented pending apps would
 * describe a process that does not exist. The same rule the rest of Discover
 * follows: a section with nothing real in it does not render a row of
 * promises.
 *
 * Everything here runs through `setCatalogueOverrides` in lib/data, which is
 * what `getHubApps()` reads — so a hidden listing is genuinely gone from the
 * store, the rail, search and every collection card that counted it, not
 * merely greyed out here.
 */

import { AdminGroup, ArmedButton, fieldClass } from "@/components/apps/store-admin/blocks";
import {
  setAppFeatured,
  setAppHidden,
  setRepoSuspended,
  type AdminPromoState,
} from "@/lib/admin-store";
import { getCatalogueListings, getDefaultRepositories } from "@/lib/data";
import { EyeOff, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

export function CatalogueTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const { suspendedRepoIds, hiddenAppSlugs, featuredAppSlugs } = admin.catalogue;
  const repos = getDefaultRepositories();
  const [query, setQuery] = useState("");

  /* The full catalogue, not `getHubApps()` — see getCatalogueListings for
     why the screen that edits the takedowns cannot read past them. */
  const catalogue = getCatalogueListings();
  const needle = query.trim().toLowerCase();
  const listings = catalogue.filter(
    (app) =>
      !needle ||
      app.name.toLowerCase().includes(needle) ||
      app.developer.toLowerCase().includes(needle),
  );

  return (
    <>
      <AdminGroup
        id="sources"
        title="Sources"
        hint="Suspending a source pulls every listing it ships out of the catalogue — the store, the rail, search and any collection card that counted them."
      >
        {repos.map((repo) => {
          const suspended = suspendedRepoIds.includes(repo.id);
          const count = catalogue.filter((app) => app.repoId === repo.id).length;
          const campaigns = [...admin.banners, ...admin.collections].filter(
            (campaign) => campaign.repoId === repo.id,
          ).length;
          return (
            <div key={repo.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {repo.name}
                  {repo.official && (
                    <span className="text-muted-foreground ml-2 text-[11px] font-semibold">
                      Official
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {count} listing{count === 1 ? "" : "s"} · {campaigns} campaign
                  {campaigns === 1 ? "" : "s"}
                  {suspended ? " · suspended" : ""}
                </p>
              </div>
              {suspended ? (
                <button
                  type="button"
                  onClick={() => {
                    setRepoSuspended(repo.id, false, repo.name);
                    toast.success("Source restored", { description: repo.name });
                  }}
                  className="focus-ring border-border hover:bg-surface-hover shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
                >
                  Restore
                </button>
              ) : (
                <ArmedButton
                  label="Suspend"
                  armedLabel="Confirm suspend"
                  onConfirm={() => {
                    setRepoSuspended(repo.id, true, repo.name);
                    toast.success("Source suspended", {
                      description: `${count} listing${count === 1 ? "" : "s"} removed from the catalogue`,
                      action: {
                        label: "Undo",
                        onClick: () => setRepoSuspended(repo.id, false, repo.name),
                      },
                    });
                  }}
                />
              )}
            </div>
          );
        })}
      </AdminGroup>

      <AdminGroup
        id="listings"
        title="Listings"
        hint="Feature pulls an app to the front of the editorial row its category already feeds. Hide takes one listing down without touching the rest of its source."
      >
        <div className="p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the catalogue"
            className={fieldClass}
          />
        </div>
        {listings.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">Nothing matches that search.</p>
        )}
        {listings.map((app) => {
          const hidden = hiddenAppSlugs.includes(app.slug);
          const featured = featuredAppSlugs.includes(app.slug);
          const repoSuspended = suspendedRepoIds.includes(app.repoId);
          return (
            <div key={app.slug} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {app.name}
                  {featured && (
                    <span className="text-accent ml-2 text-[11px] font-semibold">Featured</span>
                  )}
                  {hidden && (
                    <span className="text-muted-foreground ml-2 text-[11px] font-semibold">
                      Hidden
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {app.developer} · {app.category}
                  {repoSuspended ? " · source suspended" : ""}
                </p>
              </div>
              {app.essential ? (
                /* Identity and payments are how the browser works, not
                   merchandising. `getHubApps` refuses to hide them either
                   way; saying so here is better than offering a control that
                   quietly does nothing. */
                <span className="text-muted-foreground shrink-0 text-[11px]">
                  Essential — always listed
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={hidden}
                    onClick={() => setAppFeatured(app.slug, !featured, app.name)}
                    className={`focus-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${
                      featured
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-muted-foreground hover:bg-surface-hover"
                    }`}
                  >
                    <Star className="size-3" aria-hidden="true" />
                    {featured ? "Featured" : "Feature"}
                  </button>
                  {hidden ? (
                    <button
                      type="button"
                      onClick={() => setAppHidden(app.slug, false, app.name)}
                      className="focus-ring border-border hover:bg-surface-hover rounded-full border px-2.5 py-1 text-xs font-semibold"
                    >
                      Restore
                    </button>
                  ) : (
                    <ArmedButton
                      label="Hide"
                      armedLabel="Confirm hide"
                      icon={<EyeOff className="size-3" aria-hidden="true" />}
                      onConfirm={() => {
                        setAppHidden(app.slug, true, app.name);
                        toast.success("Listing hidden", {
                          description: app.name,
                          action: {
                            label: "Undo",
                            onClick: () => setAppHidden(app.slug, false, app.name),
                          },
                        });
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </AdminGroup>
    </>
  );
}
