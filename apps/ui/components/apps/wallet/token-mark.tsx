import { getEcosystem, getToken, type Token } from "@/lib/data";
import { FLAGS } from "@/components/apps/wallet/flags";
import type { ReactNode } from "react";

/** The mark of each chain a token can sit on. */
const CHAIN_ICONS: Record<string, string> = {
  bsv: "/tokens/bsv.svg",
  sol: "/chains/sol.svg",
  eth: "/chains/eth.svg",
  doge: "/chains/doge.svg",
};

/**
 * Below this the badge is noise rather than information.
 *
 * A chain badge is two fifths of the mark, so on the 14px marks that sit inline
 * beside an amount it would be a five-pixel smudge — unreadable, and enough to
 * make the mark itself look damaged. The list rows that are actually about
 * choosing between assets draw at 36 and get one.
 */
const BADGE_FROM = 24;

/**
 * Which chain to badge a token with, or null for the ones that are the chain.
 *
 * USDsv is dollars *on* BSV and USDC is dollars *on* Solana, and which chain is
 * the difference between them — so both are badged. Bitcoin is not badged with
 * bitcoin, and neither is SOL with Solana: a coin that is its own chain has
 * nothing to disambiguate, and stamping it anyway is a label reading "this is
 * itself".
 */
function chainBadgeFor(token: Token): string | null {
  const chain = token.chain ?? "bsv";
  const isTheChain = token.chain ? token.id === token.chain : Boolean(token.base);
  if (isTheChain) return null;
  return CHAIN_ICONS[chain] ?? null;
}

/**
 * The chain badge, sitting over the mark's bottom-right rather than inside it.
 *
 * Superimposed on purpose. ChangeNOW ships USDC-on-Solana as one square image
 * with the Solana mark in its corner, and a round clip took a bite out of it —
 * the badge read as a rendering fault rather than as a fact about the coin.
 * Drawn here instead, over the edge, with a ring of the surrounding surface so
 * it reads as a separate chip resting on top.
 */
function ChainBadge({ icon, size }: { icon: string; size: number }): ReactNode {
  const badge = Math.round(size * 0.42);
  return (
    <span
      aria-hidden="true"
      className="bg-background absolute overflow-hidden rounded-full"
      style={{
        width: badge,
        height: badge,
        right: -Math.round(badge * 0.12),
        bottom: -Math.round(badge * 0.12),
        padding: 1,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt=""
        className="rounded-full"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </span>
  );
}

/**
 * A token's mark. Its own icon where it has one, otherwise the issuing
 * ecosystem's — so a NUTRI amount carries the same Mycelia glyph a Mycelia
 * handle does, and provenance is legible without a legend.
 *
 * Whatever the mark turns out to be, the chain it lives on is badged over its
 * corner where there is room — see `chainBadgeFor`.
 */
export function TokenMark({
  token,
  size = 14,
  className = "",
}: {
  token: Token;
  size?: number;
  className?: string;
}): ReactNode {
  const badge = size >= BADGE_FROM ? chainBadgeFor(token) : null;
  const mark = <Mark token={token} size={size} className={className} />;
  if (!badge) return mark;
  return (
    /* The wrapper is the mark's own size and does not clip, so the badge can
       hang over the edge without widening the row it sits in. */
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      {mark}
      <ChainBadge icon={badge} size={size} />
    </span>
  );
}

function Mark({
  token,
  size,
  className,
}: {
  token: Token;
  size: number;
  className: string;
}): ReactNode {
  // A pegged stablecoin is recognised by its flag before its ticker, so the
  // flag wins over the generic mark where there is one — the Vela convention.
  const flag = token.flag ? FLAGS[token.flag] : undefined;
  if (flag) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-black/10 ${className}`}
        style={{ width: size, height: size }}
      >
        {/* Cropped to the circle rather than fitted inside it. A 4:3 flag
            letterboxed into a square left flat bands top and bottom, so the
            mark read as a flag on a badge instead of as a round flag. */}
        <svg
          viewBox="0 0 4 3"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: size, height: size }}
        >
          {flag}
        </svg>
      </span>
    );
  }

  const icon =
    token.icon ??
    (token.ecosystem ? getEcosystem(token.ecosystem)?.icon : null) ??
    null;

  if (!icon) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${className}`}
        style={{
          width: size,
          height: size,
          background: token.color,
          fontSize: size * 0.5,
        }}
      >
        {token.symbol[0]}
      </span>
    );
  }

  /*
   * The icon fills the circle, and the circle clips it.
   *
   * It used to be inset to 72% on a plate of the token's colour, which was
   * meant for a dark glyph on a dark surface. Every icon that reaches here is
   * a picture with its own background, so what that produced was a coloured
   * ring around a square with visible corners. A logo that genuinely is a
   * glyph on nothing says so with `plate`, and gets one.
   */
  const plate = token.plate;
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        ...(plate ? { background: plate } : {}),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt=""
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    </span>
  );
}

/**
 * Trim trailing zeros without losing meaningful precision.
 *
 * Capped at eight places whatever the chain says. Ether carries eighteen, and
 * honouring that turns a swap quote into `0.002656345993589744 ETH` — every
 * digit true, and the number as a whole unreadable. Eight is where bitcoin
 * stops, it is past the point anybody reads, and the digits below it are not a
 * quantity a person is deciding anything with.
 */
const MAX_PLACES = 8;

export function formatUnits(units: number, decimals: number): string {
  return units.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, MAX_PLACES),
  });
}

/**
 * An amount in a token: the number, the mark, then the symbol upper-cased.
 * Reads as `3 ◉NUTRI` — the mark sits between them so the icon prefixes the
 * symbol rather than floating away from it.
 */
export function TokenAmount({
  tokenId,
  units,
  size = 14,
  className = "",
  symbolClassName = "",
}: {
  tokenId: string;
  units: number;
  size?: number;
  className?: string;
  symbolClassName?: string;
}): ReactNode {
  const token = getToken(tokenId);
  if (!token) return <span className={className}>{units}</span>;
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span>{formatUnits(units, token.decimals)}</span>
      <span className="inline-flex items-center gap-1 self-center">
        <TokenMark token={token} size={size} />
        {/*
          Always the registry's canonical casing, however it was typed: `nutri`
          renders as NUTRI, and `eursv` as EURsv rather than a shouted EURSV.
        */}
        <span className={symbolClassName}>{token.symbol}</span>
      </span>
    </span>
  );
}
