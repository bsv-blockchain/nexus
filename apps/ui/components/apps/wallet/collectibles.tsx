"use client";

import { CollectibleArt } from "@/components/apps/wallet/collectible-art";

import { Collectible3DCard } from "@/components/apps/wallet/collectible-card-3d";
import { Sheet } from "@/components/apps/messages/sheet";
import {
  content,
  getAttributeColor,
  getCollectibles,
  type Collectible,
  type CollectibleBucket,
} from "@/lib/data";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Flame,
  Share2,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

const BUCKETS: CollectibleBucket[] = ["finite", "permanent", "expired"];

function statusOf(item: Collectible): {
  label: string;
  tone: string;
} | null {
  const copy = content.wallet.collectibles.status;
  if (item.redeemed) return { label: copy.redeemed, tone: "bg-muted text-muted-foreground" };
  if (item.expired) return { label: copy.expired, tone: "bg-negative/15 text-negative" };
  if (item.validThrough) return { label: copy.valid, tone: "bg-positive/15 text-positive" };
  return null;
}

/** `2026-03-18` → `18 Mar 2026`, deterministic and locale-independent. */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** A colour chip plus the attribute's key and value. */
function Attribute({ name, value }: { name: string; value: string }): ReactNode {
  const tint = getAttributeColor(name);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        toast.success(content.wallet.copied);
      }}
      title={`${name}: ${value}`}
      className="focus-ring flex w-full items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ background: tint ?? "var(--muted-foreground)" }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {name}
        </span>
        <span className="block truncate text-xs font-semibold">{value}</span>
      </span>
    </button>
  );
}

/**
 * A collection, drawn as the stack it is.
 *
 * Three layers of the same size would read as one thick card, so the two
 * behind peek out at different widths and are dimmed — the eye reads depth
 * from the overlap and the darkening rather than from a border. The plate
 * underneath is what makes it a folder rather than a fanned hand: something
 * the cards are sitting *in*.
 */
function Bundle({
  org,
  items,
  onOpen,
}: {
  org: string;
  items: Collectible[];
  onOpen: () => void;
}): ReactNode {
  /* Front card first, so the one on top is the one worth showing. */
  const [front, second, third] = items;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${org}, ${items.length} ${content.wallet.collectibles.inCollection}`}
      className="group focus-ring relative aspect-square overflow-visible rounded-2xl"
    >
      <span
        aria-hidden="true"
        className="absolute rounded-2xl border-3 border-border bg-surface"
        style={{ width: "100%", height: "90%", bottom: "7.5%", left: 0, zIndex: 1 }}
      />
      {third && (
        <span
          className="absolute overflow-hidden rounded-2xl transition-all duration-200 ease-out group-hover:-translate-y-0.5"
          style={{ width: "80%", height: "75%", left: "10%", bottom: 0, zIndex: 1 }}
        >
          <CollectibleArt src={third.imageUrl} className="size-full object-cover" />
          <span className="absolute inset-0 bg-black/30" />
        </span>
      )}
      {second && (
        <span
          className="absolute overflow-hidden rounded-2xl transition-all duration-300 ease-out group-hover:-translate-y-1"
          style={{ width: "90%", height: "75%", left: "5%", bottom: 0, zIndex: 2 }}
        >
          <CollectibleArt src={second.imageUrl} className="size-full object-cover" />
          <span className="absolute inset-0 bg-black/15" />
        </span>
      )}
      {front && (
        <span
          className="absolute overflow-hidden rounded-2xl shadow-md transition-all duration-300 ease-out group-hover:-translate-y-1.5"
          style={{ width: "100%", height: "75%", left: 0, bottom: 0, zIndex: 3 }}
        >
          <CollectibleArt
            src={front.imageUrl}
            className="size-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 text-left">
            <span className="line-clamp-2 text-sm font-medium text-balance text-white">
              ({items.length}) {org}
            </span>
          </span>
        </span>
      )}
    </button>
  );
}

function Tile({
  item,
  onOpen,
}: {
  item: Collectible;
  onOpen: () => void;
}): ReactNode {
  const status = statusOf(item);
  return (
    /*
      Square, with the name written on the artwork rather than under it.

      A caption in its own block makes a card taller than the folder tile
      beside it, and a grid whose rows do not line up reads as broken before
      it reads as anything else. On the art it also stops being a label and
      starts being part of the thing.
    */
    <button
      type="button"
      onClick={onOpen}
      className="group focus-ring bg-surface ring-border/60 hover:ring-accent/50 relative aspect-square overflow-hidden rounded-2xl text-left ring-1 transition-all hover:-translate-y-0.5"
    >
      <CollectibleArt
        src={item.imageUrl}
        className={`size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
          item.expired ? "opacity-50 saturate-50" : ""
        }`}
      />
      {status && (
        <span
          className={`absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${status.tone}`}
        >
          {status.label}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3">
        <span className="line-clamp-2 text-sm font-medium text-balance text-white">
          {item.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-white/70">
          {item.rarity ?? item.org ?? content.wallet.collectibles.noIssuer} ·{" "}
          <span className="font-mono">#{item.serialNumber}</span>
        </span>
      </span>
    </button>
  );
}

/** The detail view: spinnable card, provenance, attributes, and burning. */
function Detail({
  item,
  onBack,
  onBurn,
}: {
  item: Collectible;
  onBack: () => void;
  onBurn: (item: Collectible) => void;
}): ReactNode {
  const copy = content.wallet.collectibles;
  const [autoBurn, setAutoBurn] = useState(Boolean(item.autoBurn));
  const [burnOpen, setBurnOpen] = useState(false);
  const status = statusOf(item);
  const link = item.contract
    ? `https://nexus.app/collectible/${item.contract}/${item.serialNumber}`
    : null;

  const copyText = (value: string): void => {
    void navigator.clipboard?.writeText(value);
    toast.success(content.wallet.copied);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={content.wallet.back}
          className="focus-ring -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{item.name}</h2>
        {status && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.tone}`}
          >
            {status.label}
          </span>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* The clip is the artwork where there is one; the still is only
            its first frame, and showing the frame in the one place built to be
            looked at would be showing the wrong thing. */}
        <Collectible3DCard
          imageUrl={item.videoUrl ?? item.imageUrl}
          posterUrl={item.videoUrl ? item.imageUrl : undefined}
          name={item.name}
          serialNumber={item.serialNumber}
          org={item.org}
        />

        <div className="min-w-0">
          {item.org && (
            <p className="text-sm font-semibold">{item.org}</p>
          )}
          {item.venue && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Ticket className="size-3.5 shrink-0" aria-hidden="true" />
              {item.venue}
            </p>
          )}

          {item.attributes && (
            <div className="mt-4 grid grid-cols-2 gap-1.5">
              {Object.entries(item.attributes).map(([name, value]) => (
                <Attribute key={name} name={name} value={value} />
              ))}
            </div>
          )}

          {/*
            Traits with their own scarcity beside them.

            A trait list without counts is decoration: "Paint: Metallic Light"
            says nothing until you learn eight of 2,222 have it. The count is
            the reason anybody reads this section.
          */}
          {item.traits && item.traits.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {copy.traits}
              </p>
              <ul className="grid grid-cols-2 gap-1.5">
                {item.traits.map((trait) => (
                  <li
                    key={trait.name}
                    className="min-w-0 rounded-lg bg-surface px-2.5 py-2"
                  >
                    <span className="block truncate text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                      {trait.name}
                    </span>
                    <span className="block truncate text-xs font-semibold">
                      {trait.value}
                    </span>
                    {trait.count !== undefined && (
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground tabular-nums">
                        {trait.count}
                        {trait.rarity ? ` · ${trait.rarity}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
            <div>
              <dt className="text-muted-foreground">{copy.serial}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate font-mono">
                  {item.serialNumber}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(item.serialNumber)}
                  aria-label={copy.copySerial}
                  className="focus-ring shrink-0 rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                </button>
              </dd>
            </div>
            {item.contract && (
              <div>
                <dt className="text-muted-foreground">{copy.contract}</dt>
                <dd className="mt-0.5 font-mono break-all">{item.contract}</dd>
              </div>
            )}
            {item.attained && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{copy.attained}</dt>
                <dd>{shortDate(item.attained)}</dd>
              </div>
            )}
            {item.validThrough && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{copy.validThrough}</dt>
                <dd>{shortDate(item.validThrough)}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {link && (
              <button
                type="button"
                onClick={() => copyText(link)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                {copy.copyLink}
              </button>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {copy.viewIssuer}
              </a>
            )}
            <button
              type="button"
              onClick={() => setBurnOpen(true)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-negative/40 px-3 py-1.5 text-xs font-semibold text-negative hover:bg-negative/10"
            >
              <Flame className="size-3.5" aria-hidden="true" />
              {copy.burn}
            </button>
          </div>

          {/* Auto-burn only means anything for something that can expire. */}
          {item.bucket !== "permanent" && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">
                  {copy.autoBurn}
                </span>
                <span className="mt-0.5 block text-[11px] text-pretty text-muted-foreground">
                  {copy.autoBurnHint}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoBurn}
                aria-label={copy.autoBurn}
                onClick={() => setAutoBurn((value) => !value)}
                className={`focus-ring relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  autoBurn ? "bg-accent" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 size-3 rounded-full bg-white transition-all ${
                    autoBurn ? "left-5" : "left-1"
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={burnOpen}
        onClose={() => setBurnOpen(false)}
        label={copy.burn}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBurnOpen(false)}
              className="focus-ring flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-hover"
            >
              {content.messages.confirm.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setBurnOpen(false);
                onBurn(item);
              }}
              className="focus-ring flex-1 rounded-full bg-negative px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              {copy.burnConfirm}
            </button>
          </div>
        }
      >
        <div className="p-5">
          <h3 className="text-base font-bold">{copy.burnTitle}</h3>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            {copy.burnBody}
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface p-3">
            <CollectibleArt
              src={item.imageUrl}
              className="size-12 shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {item.name}
              </span>
              <span className="block truncate font-mono text-xs text-muted-foreground">
                #{item.serialNumber}
              </span>
            </span>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * The collection.
 *
 * Grouped by lifetime rather than by type, because what you can still do with a
 * collectible is the useful distinction: a ticket that has been redeemed and a
 * membership that has lapsed belong together, however different they look.
 * Within a bucket, items from the same issuer sit next to each other.
 */
export function Collectibles({
  onOpenMarket,
}: {
  onOpenMarket: () => void;
}): ReactNode {
  const copy = content.wallet.collectibles;
  const [tab, setTab] = useState<CollectibleBucket>("finite");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openOrg, setOpenOrg] = useState<string | null>(null);
  const [burned, setBurned] = useState<string[]>([]);

  const all = getCollectibles().filter((item) => !burned.includes(item.id));
  const open = openId ? all.find((item) => item.id === openId) : null;

  if (open) {
    return (
      <Detail
        item={open}
        /* Back to wherever it was opened from, which is the folder when it
           came out of one. */
        onBack={() => setOpenId(null)}
        onBurn={(item) => {
          setBurned((current) => [...current, item.id]);
          setOpenId(null);
          toast.success(`${copy.burned} ${item.name}`);
        }}
      />
    );
  }

  if (openOrg) {
    const inside = all.filter((item) => item.org === openOrg);
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenOrg(null)}
            aria-label={content.wallet.back}
            className="focus-ring -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{openOrg}</h2>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {inside.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {inside.map((item) => (
            <Tile key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-lg font-bold">
          {copy.title} ({all.length})
        </h2>
        <button
          type="button"
          onClick={onOpenMarket}
          className="focus-ring shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-hover"
        >
          {content.wallet.openMarket}
        </button>
      </div>

      {all.length === 0 && (
        <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {content.wallet.noCollectibles}
        </p>
      )}

      {/*
        Tabs rather than three stacked sections.

        The three buckets answer different questions — what expires, what I own
        outright, what is spent — and stacking them made the answer to any one
        of them a scrolling exercise past the other two. A tab keeps its count
        in the label so the shape of the collection is legible without opening
        anything.
      */}
      {all.length > 0 && (
        <div
          role="tablist"
          aria-label={copy.title}
          className="mb-4 flex gap-1 border-b border-border"
        >
          {BUCKETS.map((bucket) => {
            const count = all.filter((item) => item.bucket === bucket).length;
            const selected = bucket === tab;
            return (
              <button
                key={bucket}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(bucket)}
                className={`focus-ring -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                  selected
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent font-medium text-muted-foreground hover:text-foreground"
                }`}
              >
                {copy.buckets[bucket]}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {(() => {
        const items = all
          .filter((item) => item.bucket === tab)
          .sort((a, b) => (a.org ?? "").localeCompare(b.org ?? ""));

        /*
          Anything issued by the same contract collapses into one tile.

          A wallet holding six cars from one collection and two certificates
          was showing eight equal squares, which says the six are six separate
          things. They are one thing you own six of, and the grid should say so
          before it says anything else.
        */
        const byOrg = new Map<string, Collectible[]>();
        for (const item of items) {
          if (!item.org) continue;
          byOrg.set(item.org, [...(byOrg.get(item.org) ?? []), item]);
        }
        const bundles = [...byOrg.entries()].filter(
          ([, list]) => list.length > 1,
        );
        const bundled = new Set(bundles.flatMap(([, list]) => list.map((i) => i.id)));
        const loose = items.filter((item) => !bundled.has(item.id));

        return (
          <section>
            <p className="mb-2.5 text-xs text-muted-foreground">
              {copy.bucketHints[tab]}
            </p>
            {items.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
                {copy.emptyBucket}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {bundles.map(([org, list]) => (
                  <Bundle
                    key={org}
                    org={org}
                    items={list}
                    onOpen={() => setOpenOrg(org)}
                  />
                ))}
                {loose.map((item) => (
                  <Tile
                    key={item.id}
                    item={item}
                    onOpen={() => setOpenId(item.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}
