"use client";

import { useBrandMode, withBrand } from "@/lib/brand";
import { DEMO_SURFACES } from "@/lib/surfaces";
import { AppTile } from "@/components/hub/app-icon";
import { content, type HubApp } from "@/lib/data";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Github,
  Play,
  Star,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

const LEARN_MORE_URL = "https://hub.bsvblockchain.org/brc/wallet/0116";

/** FNV-1a 32-bit hash — deterministic per-app mock stats, SSR-safe. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Format a count as 1,234 or 12.3k. */
function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

interface AppStats {
  installs: number;
  stars: number;
  follows: number;
  rating: number;
  reviewCount: number;
  distribution: number[]; // [5★,4★,3★,2★,1★] counts
  updated: string;
}

function relativeUpdated(days: number): string {
  const d = content.appStore.detail;
  if (days < 14) return days <= 1 ? `1 ${d.dayAgo}` : `${days} ${d.daysAgo}`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return w <= 1 ? `1 ${d.weekAgo}` : `${w} ${d.weeksAgo}`;
  }
  const m = Math.round(days / 30);
  return m <= 1 ? `1 ${d.monthAgo}` : `${m} ${d.monthsAgo}`;
}

function getAppStats(app: HubApp): AppStats {
  const installs = 1200 + (hash(`${app.slug}:i`) % 88000);
  const stars = 60 + (hash(`${app.slug}:s`) % 4200);
  const follows = 20 + (hash(`${app.slug}:f`) % 1400);
  const rating = 4.2 + (hash(`${app.slug}:r`) % 8) / 10; // 4.2–4.9
  const reviewCount = 40 + (hash(`${app.slug}:rc`) % 860);
  // Weight the distribution toward 5★, jittered per app, then scaled to counts.
  const j = hash(`${app.slug}:d`);
  const weights = [
    82 + (j % 12),
    5 + ((j >> 3) % 6),
    2 + ((j >> 6) % 3),
    (j >> 9) % 2,
    1 + ((j >> 11) % 3),
  ];
  const total = weights.reduce((a, b) => a + b, 0);
  const distribution = weights.map((w) =>
    Math.round((w / total) * reviewCount)
  );
  const updated = relativeUpdated(1 + (hash(`${app.slug}:u`) % 90));
  return {
    installs,
    stars,
    follows,
    rating,
    reviewCount,
    distribution,
    updated,
  };
}

interface Review {
  id: string;
  author: string;
  location: string;
  tenure: string;
  date: string;
  rating: number;
  body: string;
}

const REVIEW_BODIES = [
  "Rock solid. The signing flow is instant and I never worry about my keys leaving the device.",
  "Exactly what the BSV ecosystem needed. Clean, fast, and the permissions are transparent.",
  "Support was super helpful and resolved my issue within the hour. Highly recommend.",
  "Been using this daily for months. It just works, and the on-chain data model is a game changer.",
  "Great app overall. A few rough edges on mobile but the team ships fixes quickly.",
  "The integration with the rest of my Nexus is seamless. Couldn't go back to anything else.",
];
const REVIEW_AUTHORS = [
  "Store Fittings Direct",
  "Ada Merchants",
  "Ledger & Co.",
  "Bright Harbor",
  "Nakamoto Labs",
  "Peertide",
];
const REVIEW_PLACES = [
  "United Kingdom",
  "United States",
  "Netherlands",
  "Canada",
  "Australia",
  "Singapore",
];
const REVIEW_DATES = [
  "June 2, 2026",
  "May 19, 2026",
  "April 28, 2026",
  "March 11, 2026",
];
const REVIEW_TENURES = [
  "7 months using the app",
  "About 1 year using the app",
  "3 months using the app",
  "Over 2 years using the app",
];

function getAppReviews(app: HubApp): Review[] {
  const h = hash(`${app.slug}:reviews`);
  return Array.from({ length: 3 }, (_, i) => {
    const seed = hash(`${app.slug}:review:${i}`);
    return {
      id: `${app.slug}-${i}`,
      author: REVIEW_AUTHORS[(h + i * 5) % REVIEW_AUTHORS.length]!,
      location: REVIEW_PLACES[(seed >> 3) % REVIEW_PLACES.length]!,
      tenure: REVIEW_TENURES[(seed >> 6) % REVIEW_TENURES.length]!,
      date: REVIEW_DATES[(seed >> 9) % REVIEW_DATES.length]!,
      rating: seed % 10 < 8 ? 5 : 4,
      body: REVIEW_BODIES[(seed >> 2) % REVIEW_BODIES.length]!,
    };
  });
}

/** A row of five filled stars, amber up to `value` and grey beyond. */
function Stars({
  value,
  size = 14,
}: {
  value: number;
  size?: number;
}): ReactNode {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i < Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted-foreground/25 text-muted-foreground/25"
          }
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactNode {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** The inner detail content — shared by the desktop side sheet and mobile overlay. */
export function AppDetailPanel({
  app,
  onClose,
  variant = "panel",
}: {
  app: HubApp;
  onClose: () => void;
  variant?: "panel" | "overlay";
}): ReactNode {
  const copy = content.appStore;
  const d = copy.detail;
  const verified = app.developer !== "third-party";
  /* App copy is data, so the chain's name is substituted rather than composed
     from a component. */
  const brandMode = useBrandMode();
  const [permsOpen, setPermsOpen] = useState(false);
  const stats = getAppStats(app);
  const reviews = getAppReviews(app);

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header */}
      <div className="border-border bg-background/95 sticky top-0 z-10 flex items-center gap-3 border-b px-5 py-4 backdrop-blur">
        <AppTile app={app} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold">{app.name}</h2>
          <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
            {app.publisher}
            {verified && (
              <span
                className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0]"
                aria-label="Verified creator"
              >
                <Check
                  className="size-2.5 text-white"
                  strokeWidth={3.5}
                  aria-hidden="true"
                />
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={d.close}
          className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-full p-1.5"
        >
          {variant === "overlay" ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {/* 16:9 video preview placeholder */}
        <div
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${app.accent}, ${app.accent}22)`,
          }}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-white/25 backdrop-blur">
            <Play
              className="size-6 translate-x-0.5 fill-white text-white"
              aria-hidden="true"
            />
          </span>
        </div>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed text-balance">
          {withBrand(app.description, brandMode)}
        </p>

        {/*
          Meta.

          Every row here is derived from a hash of the slug — installs, stars,
          followers, the rating and how many it is over. That is exactly right
          for a prototype and exactly wrong for a build somebody downloads, so
          the whole block, and the reviews under it, are demo-only. What a live
          build can honestly say about a listing is its name, what it does and
          who serves it, which is what remains.
        */}
        {DEMO_SURFACES && (
          <dl className="divide-border/60 bg-surface ring-border mt-5 divide-y overflow-hidden rounded-xl ring-1">
            <MetaRow label={d.installs} value={compact(stats.installs)} />
            <MetaRow label={d.version} value={`v${app.version}`} />
            <MetaRow label={d.updated} value={stats.updated} />
            <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Github className="size-3.5" aria-hidden="true" />
                GitHub
              </dt>
              <dd className="font-medium">
                {compact(stats.stars)} ★ · {compact(stats.follows)} followers
              </dd>
            </div>
          </dl>
        )}

        {/* Permissions (collapsed chips → expandable full list) */}
        <div className="bg-surface ring-border mt-5 rounded-2xl p-4 ring-1">
          <button
            type="button"
            onClick={() => setPermsOpen((v) => !v)}
            aria-expanded={permsOpen}
            className="focus-ring flex w-full items-center gap-2 text-left"
          >
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {d.permissionsTitle}
            </span>
            <span className="text-muted-foreground text-xs">
              {permsOpen ? d.permissionsCollapse : d.permissionsExpand}
            </span>
            <ChevronDown
              className={`text-muted-foreground size-4 shrink-0 transition-transform ${
                permsOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
          <AnimatePresence initial={false} mode="wait">
            {permsOpen ? (
              <motion.ul
                key="full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-3 space-y-2.5"
              >
                {[copy.perm1, copy.perm2, copy.perm3].map((perm) => (
                  <li key={perm} className="flex items-start gap-2.5">
                    <Check
                      className="text-positive mt-0.5 size-4 shrink-0"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-sm text-balance">
                      {perm}
                    </span>
                    <a
                      href={LEARN_MORE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring text-accent mt-0.5 shrink-0 text-xs font-semibold hover:underline"
                    >
                      {copy.learnMore}
                    </a>
                  </li>
                ))}
              </motion.ul>
            ) : (
              <motion.div
                key="chips"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-3 flex flex-wrap gap-1.5"
              >
                {copy.permWords.map((word) => (
                  <span
                    key={word}
                    className="bg-surface-raised inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    <Check
                      className="text-positive size-3"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    {word}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reviews — hashed from the slug, so demo-only for the same reason. */}
        {DEMO_SURFACES && (
          <div className="mt-6">
            <h3 className="flex items-baseline gap-2">
              <span className="text-base font-bold">{d.reviewsTitle}</span>
              <span className="text-muted-foreground text-sm">
                ({stats.reviewCount})
              </span>
            </h3>

            <div className="bg-surface ring-border mt-3 rounded-2xl p-4 ring-1">
              <p className="text-sm font-semibold">{d.overallRating}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-3xl font-extrabold">
                  {stats.rating.toFixed(1)}
                </span>
                <Stars value={stats.rating} size={16} />
              </div>
              <ul className="mt-3 space-y-1.5">
                {stats.distribution.map((count, i) => {
                  const starVal = 5 - i;
                  const pct =
                    stats.reviewCount > 0
                      ? Math.round((count / stats.reviewCount) * 100)
                      : 0;
                  return (
                    <li
                      key={starVal}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="text-muted-foreground w-2 text-right">
                        {starVal}
                      </span>
                      <Star
                        className="size-3 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                      <span className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="text-muted-foreground w-8 text-right tabular-nums">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="focus-ring bg-surface-raised ring-border hover:bg-surface-hover flex-1 rounded-full px-3 py-2 text-xs font-semibold ring-1"
                >
                  {d.writeReview}
                </button>
                <button
                  type="button"
                  className="focus-ring bg-surface-raised ring-border hover:bg-surface-hover flex-1 rounded-full px-3 py-2 text-xs font-semibold ring-1"
                >
                  {d.allReviews}
                </button>
              </div>
            </div>

            <ul className="mt-4 space-y-4">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="border-border/60 border-b pb-4 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <Stars value={review.rating} />
                    <span className="text-muted-foreground text-xs">
                      {review.date}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm text-balance">
                    {review.body}
                  </p>
                  <div className="text-muted-foreground mt-2 text-xs">
                    <span className="text-foreground font-semibold">
                      {review.author}
                    </span>
                    {" · "}
                    {review.location}
                    {" · "}
                    {review.tenure}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
