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
  Search,
  Share2,
  Ticket,
} from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import { toast } from "sonner";
import { useEffect, useRef, useState, type ReactNode } from "react";

const BUCKETS: CollectibleBucket[] = ["finite", "permanent", "expired"];

/**
 * How many of a collection are drawn before scrolling asks for the next lot.
 *
 * Twelve fills the widest grid this pane reaches (three columns) four rows deep,
 * so the first screen is full and the second lot is fetched while the first is
 * still being looked at.
 */
const PAGE = 12;

/** Seconds between one tile appearing and the next. */
const STAGGER = 0.035;

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
      {/*
        The frame lights up under the pointer.
        `color-mix` against `var(--accent)` rather than a fixed colour, so it
        follows the theme — including the per-workspace accents the theme picker
        sets, which a hardcoded blue would ignore. Same construction as the
        handles panel and the share backdrop.
        Its own layer purely so it can fade: a background-image cannot be
        transitioned, and switching one on at hover pops.
      */}
      <span
        aria-hidden="true"
        className="absolute rounded-2xl opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
        style={{
          width: "100%",
          height: "90%",
          bottom: "7.5%",
          left: 0,
          zIndex: 1,
          backgroundImage:
            "radial-gradient(120% 80% at 50% 100%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%)",
        }}
      />
      {/*
        The cards behind sit HIGHER, not just narrower.

        All three used to share `bottom: 0` and `height: 75%`, and the front one
        is full width — so it covered the other two exactly, and a collection of
        forty showed one picture. Being narrower buys nothing when the thing on
        top is wider than you are.

        Each step back now clears the front card's top edge by a few percent,
        which is the only part of a stacked deck that ever reads as a stack. The
        hover lift is ordered to match: the ones behind rise furthest, so the deck
        fans open instead of closing up.
      */}
      {/*
        Deeper at rest, further apart on hover, and dimmer the further back.

        The stagger is the whole effect: at rest the deck sits low and the cards
        behind are shaded, so the front one is plainly the one being offered. On
        hover they rise past it by different amounts and the shading lifts, which
        is the deck fanning out to say there is more in here than one.

        The overlays are what make depth read at a glance — a card behind that is
        merely smaller looks like a smaller card, while a card behind that is
        darker looks further away. They fade rather than switch, on the same
        durations as the lift, so shading and movement are one gesture.

        The rest offsets have to earn their visibility. The front card is full
        width, so the only part of the ones behind that shows is the sliver above
        its top edge — a 2% offset is five pixels at this size, which is a stagger
        in the markup and nothing on screen. 4% and 8% are the smallest that read
        as a deck.

        `object-top` on all three: these cards are a 4:3 window onto art that is
        usually square, and centring the crop ate the top and the bottom of it.
        Anchored to the top, a piece loses only its foot — where the least tends
        to be happening, and where the caption is sitting anyway.
      */}
      {third && (
        <span
          className="absolute overflow-hidden rounded-2xl transition-all duration-300 ease-out group-hover:-translate-y-4"
          style={{ width: "80%", height: "75%", left: "10%", bottom: "8%", zIndex: 1 }}
        >
          <CollectibleArt
            src={third.imageUrl}
            className="size-full object-cover object-top"
          />
          <span className="absolute inset-0 bg-black/55 transition-opacity duration-300 ease-out group-hover:opacity-0" />
        </span>
      )}
      {second && (
        <span
          className="absolute overflow-hidden rounded-2xl transition-all duration-300 ease-out group-hover:-translate-y-2"
          style={{ width: "90%", height: "75%", left: "5%", bottom: "4%", zIndex: 2 }}
        >
          <CollectibleArt
            src={second.imageUrl}
            className="size-full object-cover object-top"
          />
          <span className="absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out group-hover:opacity-0" />
        </span>
      )}
      {front && (
        <span
          className="absolute overflow-hidden rounded-2xl shadow-md transition-all duration-300 ease-out"
          style={{ width: "100%", height: "75%", left: 0, bottom: 0, zIndex: 3 }}
        >
          <CollectibleArt
            src={front.imageUrl}
            className="size-full object-cover object-top"
          />
          {/* Its own layer with a stated height, for the reason Tile explains. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/60 to-transparent"
          />
          <span className="absolute inset-x-0 bottom-0 p-3 text-left">
            <span className="line-clamp-2 text-sm font-medium text-balance text-white">
              ({items.length}) {org}
            </span>
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * Inside one collection: a search field where the heading used to be, and the
 * grid it filters.
 *
 * The collection's name is the placeholder rather than a label beside the box.
 * The name is already the reason you are on this screen — a heading repeating it
 * spends the widest line on the page saying what the breadcrumb behind the back
 * arrow says — and a watermark keeps it readable until the moment you type over
 * it, which is the moment it stops being the answer.
 *
 * Matching is over the name, the serial and the traits, because a collection is
 * the one place people search by attribute: "blue", "1872" and "Legendary" are
 * all things somebody looking for one car out of six would type.
 */
function CollectionView({
  org,
  items,
  onBack,
  onOpen,
}: {
  org: string;
  items: Collectible[];
  onBack: () => void;
  onOpen: (id: string) => void;
}): ReactNode {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? items.filter((item) =>
        [
          item.name,
          item.serialNumber,
          item.rarity ?? "",
          ...(item.traits ?? []).flatMap((trait) => [trait.name, trait.value]),
          ...Object.entries(item.attributes ?? {}).flat(),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : items;

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
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            /* "Search 5 Counterfeit Rares" — the count rides in the watermark
               rather than sitting in a corner of its own. It is the size of the
               collection, not the size of the result: a number that changed as
               you typed would be answering a question the grid below is already
               answering, and it disappears the moment you type anyway. */
            placeholder={`${content.wallet.collectibles.searchCollection} ${items.length} ${org}`}
            aria-label={`${content.wallet.collectibles.searchCollection} ${org}`}
            /* Bold and large like the heading it replaced, so the screen keeps
               its shape whether or not anything has been typed. */
            className="focus-ring bg-surface ring-border/60 placeholder:text-muted-foreground w-full rounded-lg py-1.5 pr-2.5 pl-8 text-lg font-bold ring-1 placeholder:font-bold"
          />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {content.wallet.collectibles.noMatches}
        </p>
      ) : (
        <CollectionGrid items={shown} onOpen={onOpen} />
      )}
    </div>
  );
}

/**
 * A collection's contents, a dozen at a time, each tile arriving after the one
 * before it.
 *
 * The stagger is per BATCH, not per collection: the delay is the tile's position
 * within its own twelve, so the first lot ripples in on open and every lot after
 * it ripples in as it arrives. Framer only runs `initial → animate` when an
 * element mounts, and these are keyed by id, so tiles already on screen sit
 * still while the new ones come in — which is the difference between a list that
 * extends and a list that re-animates itself every time it grows.
 *
 * The sentinel is what asks for more, 200px before it is reached, so the next
 * twelve are usually decoded by the time they matter. It is only rendered while
 * there is more to load, which is also what stops the observer re-firing at the
 * end of the list.
 */
function CollectionGrid({
  items,
  onOpen,
}: {
  items: Collectible[];
  onOpen: (id: string) => void;
}): ReactNode {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const more = shown < items.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!more || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShown((count) => Math.min(count + PAGE, items.length));
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, items.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.slice(0, shown).map((item, index) => (
          <motion.div
            key={item.id}
            className="min-w-0"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0.01 : 0.28,
              ease: [0.4, 0, 0.2, 1],
              delay: reduced ? 0 : (index % PAGE) * STAGGER,
            }}
          >
            <Tile item={item} onOpen={() => onOpen(item.id)} />
          </motion.div>
        ))}
      </div>
      {more && <div ref={sentinel} aria-hidden="true" className="h-8" />}
    </>
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
      /* `w-full` because this is no longer always a direct grid child — inside a
         collection each tile is wrapped for its entry animation, and a button is
         inline-block, so without it the square sizes to its content. */
      className="group focus-ring bg-surface ring-border/60 hover:ring-accent/50 relative aspect-square w-full overflow-hidden rounded-2xl text-left ring-1 transition-all hover:-translate-y-0.5"
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
      {/*
        The ramp is its own layer, with its own height.

        It used to be the text's own background, so how far the dark reached was
        decided by how many lines the name happened to run to — two lines of
        padding, and the top line sat where the wash was still half transparent.
        White on whatever the artwork happened to be, which on a pale piece is
        nothing at all. Padding was the wrong lever: it could only buy height by
        moving the words.

        Split, the height is stated. Half the tile, dark at the bottom and gone by
        the middle, and the text sits on the dark end of it wherever it wraps to.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/60 to-transparent"
      />
      <span className="absolute inset-x-0 bottom-0 p-3">
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
    return (
      <CollectionView
        /* Keyed by collection so opening a second one starts empty and at twelve
           again rather than inheriting the last one's query and scroll depth. */
        key={openOrg}
        org={openOrg}
        items={all.filter((item) => item.org === openOrg)}
        onBack={() => setOpenOrg(null)}
        onOpen={(id) => setOpenId(id)}
      />
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
