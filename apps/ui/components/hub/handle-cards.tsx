"use client";

/**
 * The identity cards on the paying card's backdrop.
 *
 * The card says "Pay a name, not an address", so the thing drifting behind it
 * is a row of names — one per workspace, each with the key it stands in for
 * printed underneath in the small type a card reserves for the number nobody
 * reads. That is the whole argument in one object: the handle is the address,
 * the key is an implementation detail, and every workspace has its own.
 *
 * Names come from the same word lists the last card suggests from
 * (lib/handle-suggest), so the handles a person is about to be offered are the
 * handles they have already seen going past.
 */

import { Nfc } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One card, one palette.
 *
 * Stated per card rather than derived from a hue ramp: these are meant to read
 * as different issuers, and an even sweep through the colour wheel reads as one
 * issuer with a gradient. `ink` is the mark and the contactless glyph, `line`
 * the hairline, `wash` the face itself.
 */
type Palette = { wash: string; ink: string; line: string };

const CARDS: {
  handle: string;
  space: string;
  key: string;
  palette: Palette;
}[] = [
  {
    handle: "quietheron",
    space: "Personal",
    key: "02f4a1…9c3e",
    palette: {
      wash: "linear-gradient(135deg, #1b2a4a 0%, #0d1526 100%)",
      ink: "#a8c7ff",
      line: "rgba(168,199,255,0.22)",
    },
  },
  {
    handle: "amberotter",
    space: "Work",
    key: "03b7c2…41da",
    palette: {
      wash: "linear-gradient(135deg, #3a2a1c 0%, #171008 100%)",
      ink: "#f3c98b",
      line: "rgba(243,201,139,0.22)",
    },
  },
  {
    handle: "swiftmarten",
    space: "Studio",
    key: "02d15e…8b07",
    palette: {
      wash: "linear-gradient(135deg, #10322c 0%, #061512 100%)",
      ink: "#8fe3c4",
      line: "rgba(143,227,196,0.22)",
    },
  },
  {
    handle: "luckypuffin",
    space: "Family",
    key: "0391fa…2e66",
    palette: {
      wash: "linear-gradient(135deg, #331e3d 0%, #150a1b 100%)",
      ink: "#dcb0f5",
      line: "rgba(220,176,245,0.22)",
    },
  },
  {
    handle: "gentlefinch",
    space: "Side project",
    key: "0257bd…7f10",
    palette: {
      wash: "linear-gradient(135deg, #06283a 0%, #04121b 100%)",
      ink: "#93d7f0",
      line: "rgba(147,215,240,0.22)",
    },
  },
];

/**
 * The monogram as a mask, so it takes whatever colour it is put on.
 *
 * The file is a fixed off-white; painting it via `background-color` through a
 * mask is what lets each card ink it in its own palette. Sized in `em` at the
 * call site so the inline one tracks the type it sits in.
 */
const MARK: React.CSSProperties = {
  maskImage: "url(/icons/Nexus-logo-white.svg)",
  maskRepeat: "no-repeat",
  maskPosition: "center",
  maskSize: "contain",
  WebkitMaskImage: "url(/icons/Nexus-logo-white.svg)",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  WebkitMaskSize: "contain",
};

function Face({
  handle,
  space,
  identityKey,
  palette,
}: {
  handle: string;
  space: string;
  identityKey: string;
  palette: Palette;
}): ReactNode {
  return (
    <div
      className="flex h-full w-full flex-col justify-between rounded-xl p-4"
      style={{
        background: palette.wash,
        boxShadow: `inset 0 0 0 1px ${palette.line}`,
      }}
    >
      <div className="flex items-start justify-between">
        {/* The mark, masked so it takes the card's own ink rather than the
            file's fixed off-white. Same trick the opening's logo uses. */}
        <span
          className="size-6"
          style={{ backgroundColor: palette.ink, ...MARK }}
        />
        {/* Contactless, because that is what a card that pays a name looks
            like to anyone who has ever tapped one. */}
        <Nfc className="size-5" style={{ color: palette.ink }} />
      </div>

      <div>
        <p
          className="font-mono text-[15px] leading-tight font-semibold"
          style={{ color: palette.ink }}
        >
          @{handle}@
          {/*
            The mark stands where the host name begins, so the address reads
            "@name@ [Nexus] nexus.free" — the domain is announced by the thing
            that runs it before it is spelled out.

            Sized in `em` and nudged onto the baseline: it has to sit in the
            line like a glyph, not like an image that happens to be nearby.
          */}
          <span
            aria-hidden="true"
            className="mx-[0.1em] inline-block size-[0.95em] align-[-0.1em]"
            style={{ backgroundColor: palette.ink, ...MARK }}
          />
          nexus.free
        </p>
        {/* The key the handle stands in for, truncated the way a card prints
            the digits it does not expect you to read. */}
        <p className="mt-1.5 font-mono text-[10px] tracking-wider text-white/35">
          {identityKey}
        </p>
      </div>

      <div className="flex items-end justify-between">
        <span className="text-[10px] tracking-[0.18em] text-white/40 uppercase">
          {space}
        </span>
        <span
          className="text-[10px] tracking-wider"
          style={{ color: palette.line.replace("0.22", "0.7") }}
        >
          nexus.free
        </span>
      </div>
    </div>
  );
}

/** The faces, in the shape the stream wants them. */
export const HANDLE_CARDS = CARDS.map((card) => ({
  id: card.handle,
  face: (
    <Face
      handle={card.handle}
      space={card.space}
      identityKey={card.key}
      palette={card.palette}
    />
  ),
}));
