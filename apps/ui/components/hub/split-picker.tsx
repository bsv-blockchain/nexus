"use client";

import { AppTile } from "@/components/hub/app-icon";
import { DevBadge } from "@/components/hub/dev-badge";
import { useHub } from "@/components/hub/hub-provider";
import { useBrandMode, withBrand } from "@/lib/brand";
import { content, getHubApps } from "@/lib/data";
import { useReducedMotion } from "@/lib/motion";
import { Columns2, Search, Star } from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

const copy = content.appMenu;

const EASE = [0.4, 0, 0.2, 1] as const;
const LIST = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
};
const STILL = { hidden: { opacity: 1 }, show: { opacity: 1 } };

/**
 * What goes in the second pane, chosen in the second pane.
 *
 * It was a menu hanging off the header, which is the wrong size for the
 * decision: picking the app you are about to work beside deserves the same
 * look as picking one in the store, not a dropdown of names. The pane is empty
 * anyway until something is chosen — so the choice happens where the result
 * will be, and the empty half stops being empty.
 *
 * Only apps this profile has connected, minus the one already on the left. A
 * profile is a selection of apps and a split reaching past it would be a hole
 * in the boundary the profile exists to draw; two panes on the same app is a
 * split that has achieved nothing.
 */
export function SplitPicker(): ReactNode {
  const { installedApps, activeApp, setSplitApp } = useHub();
  const brandMode = useBrandMode();
  const still = useReducedMotion();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const options = getHubApps()
    .filter(
      (app) => installedApps.includes(app.slug) && app.slug !== activeApp,
    )
    /* Not the ones whose hosts refuse to be framed. Opening those means
       handing off to Browse, and a pane that answers a pick by changing the
       *other* pane is not a pick anybody made. */
    .filter((app) => app.web?.embeds !== false)
    .filter(
      (app) =>
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q),
    );

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <span
            className="bg-accent/15 text-accent mx-auto grid size-12 place-items-center rounded-2xl"
            aria-hidden="true"
          >
            <Columns2 className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-balance">
            {copy.pickerTitle}
          </h2>
        </div>

        {/* Only worth showing once the list is long enough to scan badly. */}
        {getHubApps().filter((app) => installedApps.includes(app.slug)).length >
          6 && (
          <div className="focus-within:ring-accent border-border bg-surface mx-auto mt-6 flex max-w-sm items-center gap-2 rounded-full border px-3.5 py-2 focus-within:ring-2">
            <Search
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.pickerSearch}
              aria-label={copy.pickApp}
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        )}

        <motion.ul
          variants={still ? STILL : LIST}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {options.map((app) => (
            <motion.li key={app.slug} variants={still ? STILL : ITEM}>
                <button
                  type="button"
                  onClick={() => setSplitApp(app.slug)}
                  className="focus-ring bg-surface ring-border/60 hover:ring-accent hover:bg-surface-hover flex h-full w-full flex-col rounded-2xl p-4 text-left ring-1 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className="flex items-start gap-3">
                    <AppTile app={app} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {app.name}
                      </span>
                      <DevBadge developer={app.developer} className="mt-0.5" />
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">
                      <Star
                        className="size-3 fill-[#FFAF00] text-[#FFAF00]"
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">
                        {app.rating.toFixed(1)}
                      </span>
                    </span>
                  </span>
                  <span className="text-muted-foreground mt-3 line-clamp-2 flex-1 text-xs leading-relaxed">
                    {withBrand(app.description, brandMode)}
                  </span>
                </button>
            </motion.li>
          ))}
        </motion.ul>

        {options.length === 0 && (
          <p className="text-muted-foreground mt-10 text-center text-sm text-pretty">
            {q ? copy.pickerNoMatch : copy.noneToSplit}
          </p>
        )}
      </div>
    </div>
  );
}
