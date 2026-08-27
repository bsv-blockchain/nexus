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

/**
 * Whose card it is, in the picture.
 *
 * Four kinds rather than five of one, because that is the honest picture of
 * what people put on a handle: a pixel fox from the set this client ships, a
 * collectible somebody owns, an avatar carried in from another ecosystem, and —
 * on the card with none — the tile this app generates from a name. A row of
 * five identical marks would say the opposite.
 *
 * `null` is the fourth of those, not a missing value.
 */
const CARDS: {
  handle: string;
  space: string;
  key: string;
  avatar: string | null;
  palette: Palette;
}[] = [
  {
    handle: "quietheron",
    space: "Personal",
    key: "02f4a1…9c3e",
    avatar: "/avatars/fox1.png",
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
    /* The generated one. A handle with no picture still has a face. */
    avatar: null,
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
    avatar: "/avatars/treechat/user-treechad.png",
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
    avatar: "/collectibles/nakamotor/2121.png",
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
    avatar: "/avatars/fox4.png",
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

/**
 * The face on a card, or the tile drawn where there is none.
 *
 * The generated one takes the card's own ink and wash rather than a palette of
 * its own, so a handle without a picture reads as part of the same card instead
 * of as a hole in it.
 */
function Avatar({
  src,
  handle,
  palette,
}: {
  src: string | null;
  handle: string;
  palette: Palette;
}): ReactNode {
  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="size-9 shrink-0 rounded-lg object-cover"
        style={{ boxShadow: `0 0 0 1px ${palette.line}` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold"
      style={{
        backgroundImage: `linear-gradient(140deg, ${palette.ink}33, ${palette.ink}11)`,
        boxShadow: `0 0 0 1px ${palette.line}`,
        color: palette.ink,
      }}
    >
      {handle.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Face({
  handle,
  space,
  identityKey,
  avatar,
  palette,
}: {
  handle: string;
  space: string;
  identityKey: string;
  avatar: string | null;
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
        {/* Whose card it is comes first, where a bank card puts nothing and an
            identity card puts the photograph. */}
        <Avatar src={avatar} handle={handle} palette={palette} />
        <span className="flex items-center gap-2 pt-0.5">
          {/* The mark, masked so it takes the card's own ink rather than the
              file's fixed off-white. Same trick the opening's logo uses. */}
          <span
            className="size-6"
            style={{ backgroundColor: palette.ink, ...MARK }}
          />
          {/* Contactless, because that is what a card that pays a name looks
              like to anyone who has ever tapped one. */}
          <Nfc className="size-5" style={{ color: palette.ink }} />
        </span>
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
      avatar={card.avatar}
      palette={card.palette}
    />
  ),
}));
