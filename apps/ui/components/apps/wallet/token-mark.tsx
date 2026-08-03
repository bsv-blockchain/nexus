import { getEcosystem, getToken, type Token } from "@/lib/data";
import { FLAGS } from "@/components/apps/wallet/flags";
import type { ReactNode } from "react";

/**
 * A token's mark. Its own icon where it has one, otherwise the issuing
 * ecosystem's — so a NUTRI amount carries the same Mycelia glyph a Mycelia
 * handle does, and provenance is legible without a legend.
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
        <svg viewBox="0 0 4 3" style={{ width: size, height: size }}>
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

  // Ecosystem-derived marks are square-ish logos; give them a plate so a
  // dark glyph stays visible on a dark surface.
  const plate = !token.icon;
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        ...(plate ? { background: token.color } : {}),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt=""
        style={
          plate
            ? { width: size * 0.72, height: size * 0.72, objectFit: "contain" }
            : { width: size, height: size }
        }
      />
    </span>
  );
}

/** Trim trailing zeros without losing meaningful precision. */
export function formatUnits(units: number, decimals: number): string {
  return units.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
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
