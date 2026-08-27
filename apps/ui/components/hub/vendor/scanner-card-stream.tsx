"use client";

/*
 * "Scanner Card Stream" — a line of cards drifting past a scanning beam, each
 * resolving as it crosses.
 *
 * Adapted from the published component rather than dropped in. The differences,
 * so a later diff against the original is readable:
 *
 * 1. It sized itself to `window.innerWidth` and `w-screen h-screen` throughout —
 *    camera frustum, canvas widths, the beam's position, the wrap-around. This
 *    one lives inside an onboarding card a few hundred pixels wide, so every
 *    one of those reads a measured container box instead.
 *
 * 2. Faces are ReactNodes, not image URLs. The cards here are rendered
 *    identity cards — a handle, a key, a mark — and an <img> cannot be any of
 *    that.
 *
 * 3. The scan runs the other way. Upstream, cards dissolve INTO code; the beam
 *    reveals ascii on the side it has passed. Here code resolves INTO cards,
 *    which is the direction the card's sentence needs: a name is the readable
 *    thing, the key underneath it is not.
 *
 * 4. No drag, wheel or pointer handling at all. This sits inside a deck that
 *    pages on horizontal swipe, and two things cannot own the same gesture.
 *
 * 5. The beam's position is a prop rather than the middle of the box. Cards
 *    resolve on the side they have already crossed to, so where the beam sits
 *    decides how much of the strip is readable names and how much is still
 *    code — see `beamAt`.
 *
 * 6. Particle counts are a fraction of the original's, and both systems stop
 *    under `prefers-reduced-motion`. It is a background on a card that already
 *    sits over a live WebGL shader, not the whole page.
 *
 * 7. styled-jsx replaced by Tailwind and a keyframe in globals.css; the file
 *    also fixed a literal newline inside the code generator's string.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

const ASCII_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789(){}[]<>;:,._-+=!@#$%^&*|\\/\"'`~?";

/** A block of gibberish, `height` lines of `width` characters. */
function generateCode(width: number, height: number): string {
  const rows: string[] = [];
  for (let row = 0; row < height; row += 1) {
    let line = "";
    for (let col = 0; col < width; col += 1) {
      line += ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)];
    }
    rows.push(line);
  }
  return rows.join("\n");
}

/**
 * The gibberish's type size, and what one character of it measures.
 *
 * Stated here because three things have to agree: how many columns and rows are
 * generated, and how big they are drawn. Deriving the first two from the last
 * means resizing the cards cannot leave the code overflowing its own card or
 * stopping short of it. 0.6em is the advance width of a monospace glyph, near
 * enough for every stack we ship.
 */
const CODE_PX = 12;
const CODE_LINE = 14;
const CODE_CHAR = CODE_PX * 0.6;

export type StreamCard = {
  id: string;
  /** What the card resolves into once the beam has passed it. */
  face: ReactNode;
};

export function ScannerCardStream({
  cards,
  cardWidth = 320,
  cardHeight = 202,
  cardGap = 32,
  speed = 66,
  beamAt = 0.5,
  bandOffsetY = -34,
  openingLead = 0.24,
  active = true,
  reduced = false,
  className = "",
}: {
  cards: StreamCard[];
  cardWidth?: number;
  cardHeight?: number;
  cardGap?: number;
  /** Pixels per second the line travels, rightward. */
  speed?: number;
  /**
   * Where the beam stands, as a fraction of the container's width.
   *
   * The cards travel rightward and are resolved on the side they have already
   * crossed to, so this is really a split: everything right of it reads as a
   * name, everything left of it is still code. A half gives an even argument;
   * moving it left gives more of the strip to the answer than to the puzzle.
   */
  beamAt?: number;
  /**
   * How far the band sits off the container's middle, in pixels.
   *
   * Negative is up. The card carries its title and body along the bottom, and a
   * band centred on the box crowds them; lifting it leaves the lower third to
   * the words.
   */
  bandOffsetY?: number;
  /**
   * How far the leading card has already crossed the beam on entry, as a
   * fraction of its own width.
   *
   * Zero puts its edge exactly on the beam, which is a card that has not
   * started yet; a quarter means the first name is already coming out of the
   * code as the card is reached, so what you arrive to is the effect happening
   * rather than the moment before it.
   */
  openingLead?: number;
  /**
   * Whether this is the card being looked at.
   *
   * The deck mounts every card at once, so without this the stream would have
   * been running — and drifting — for however long somebody spent on the cards
   * before it, and would be found halfway through rather than at its opening
   * position. Going true rewinds it to the start; going false parks it, which
   * also stops a WebGL scene and two particle systems doing work for a card
   * nobody is looking at.
   */
  active?: boolean;
  /** Freeze both particle systems and the drift. */
  reduced?: boolean;
  className?: string;
}): ReactNode {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const beamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  /* Read by the animation loop, which is built once and must not be torn down
     and rebuilt every time the deck changes card — that would mean disposing
     and recreating a WebGL context on every page. */
  const activeRef = useRef(active);
  const rewind = useRef(true);
  useEffect(() => {
    activeRef.current = active;
    if (active) rewind.current = true;
  }, [active]);

  /* The code each card wears before it is scanned. Fixed per card, so a
     re-render does not reshuffle the gibberish mid-drift. */
  const code = useMemo(() => {
    const cols = Math.floor(cardWidth / CODE_CHAR);
    const rows = Math.floor(cardHeight / CODE_LINE);
    return new Map(cards.map((card) => [card.id, generateCode(cols, rows)]));
  }, [cards, cardWidth, cardHeight]);

  /* Measured, not assumed: everything below is relative to this box. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setBox({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const line = lineRef.current;
    const particleCanvas = particleCanvasRef.current;
    const beamCanvas = beamCanvasRef.current;
    if (!line || !particleCanvas || !beamCanvas) return;
    if (box.width === 0 || box.height === 0) return;

    const { width, height } = box;
    const span = (cardWidth + cardGap) * cards.length;

    // ---- the drifting field behind the cards -----------------------------
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      1,
      1000
    );
    camera.position.z = 100;
    const renderer = new THREE.WebGLRenderer({
      canvas: particleCanvas,
      alpha: true,
      antialias: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    /* 90 rather than the original's 400: this is a strip inside a card, and the
       density that reads on a full screen is a smear at this size. */
    const COUNT = 90;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const drift = new Float32Array(COUNT);
    const alphas = new Float32Array(COUNT);

    const texCanvas = document.createElement("canvas");
    texCanvas.width = 64;
    texCanvas.height = 64;
    const texCtx = texCanvas.getContext("2d")!;
    const glow = texCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0.02, "#ffffff");
    glow.addColorStop(0.12, "hsl(217, 61%, 45%)");
    glow.addColorStop(0.3, "hsl(217, 64%, 10%)");
    glow.addColorStop(1, "transparent");
    texCtx.fillStyle = glow;
    texCtx.beginPath();
    texCtx.arc(32, 32, 32, 0, Math.PI * 2);
    texCtx.fill();
    const texture = new THREE.CanvasTexture(texCanvas);

    for (let i = 0; i < COUNT; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * width * 1.4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * height;
      positions[i * 3 + 2] = 0;
      drift[i] = Math.random() * 28 + 12;
      alphas[i] = (Math.random() * 6 + 2) / 10;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { pointTexture: { value: texture } },
      vertexShader:
        "attribute float alpha; varying float vAlpha; void main() { vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 9.0; gl_Position = projectionMatrix * mv; }",
      fragmentShader:
        "uniform sampler2D pointTexture; varying float vAlpha; void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha) * texture2D(pointTexture, gl_PointCoord); }",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ---- the beam ---------------------------------------------------------
    const ctx = beamCanvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    beamCanvas.width = width * dpr;
    beamCanvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    type Spark = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      life: number;
      decay: number;
    };
    /* Everything about the beam reads from here rather than from the middle of
       the box: the sparks it throws, where the line is entered, and which side
       of it a card is on. */
    const beamPx = width * beamAt;
    const spark = (): Spark => ({
      x: beamPx + (Math.random() - 0.5) * 3,
      y: Math.random() * height,
      vx: Math.random() * 0.7 + 0.15,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 0.5 + 0.3,
      alpha: Math.random() * 0.4 + 0.5,
      life: 1,
      decay: Math.random() * 0.02 + 0.006,
    });
    /* 90 idle, 260 while something is crossing — the original's 800/2500 on a
       strip this size is a solid white bar. */
    const IDLE = 90;
    const BUSY = 260;
    let budget = IDLE;
    let sparks: Spark[] = Array.from({ length: IDLE }, spark);

    // ---- the drift --------------------------------------------------------
    /*
     * Where the line sits when the card is entered.
     *
     * Far enough left that NOTHING has crossed the beam yet, and close enough
     * that the leading card's right edge is on it: the state you arrive to is
     * code streaming into the barrier with the first card about to come out of
     * it. Travelling rightward, the leading card is the LAST one in the line —
     * it is the furthest right, so it reaches the middle first.
     *
     * `span - cardGap` is the distance from the line's left edge to that card's
     * right edge; putting it at the middle is the whole expression, plus
     * `openingLead` to start a little way into it.
     */
    /* Folded into the loop's own range, [-span, 0), so entering the card puts
       the line somewhere the wrap could also have put it. */
    const wrapInto = (at: number): number => ((at % span) - span) % span;
    const opening = wrapInto(beamPx - span + cardGap + cardWidth * openingLead);
    let position = opening;
    let last = performance.now();
    let frame = 0;
    let scanning = false;

    const scanWidth = 8;

    const step = (now: number): void => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (rewind.current) {
        rewind.current = false;
        position = opening;
        line.style.transform = `translateX(${position}px)`;
      }

      /* Parked: hold the frame and do none of the work below. */
      if (!activeRef.current) {
        frame = requestAnimationFrame(step);
        return;
      }

      if (!reduced) {
        position += speed * delta;
        /* Wrapping goes to -span rather than back to `opening`: that puts the
           line's right edge on the container's left edge, so cards keep
           arriving without the pause a rewind would leave. */
        /* One run back, not to the far side: with the run duplicated below,
           every card sits exactly `span` behind its own copy, so subtracting a
           run drops an identical card onto every card already on screen.
           Nothing moves that the eye can catch, and it can go round forever.
           Resetting to -span instead left the strip empty for the width of a
           card each time the last one went off the right. */
        if (position >= 0) position -= span;
        line.style.transform = `translateX(${position}px)`;
      }

      // Which side of the beam each card is on decides how much of it has
      // resolved. The line travels rightward, so the side a card has already
      // crossed to — the RIGHT — is the scanned one, and everything still to
      // the left of the beam is code.
      const hostRect = hostRef.current!.getBoundingClientRect();
      const beamX = hostRect.left + beamPx;
      scanning = false;
      line.querySelectorAll<HTMLElement>("[data-card]").forEach((wrapper) => {
        const rect = wrapper.getBoundingClientRect();
        const face = wrapper.querySelector<HTMLElement>("[data-face]")!;
        const cipher = wrapper.querySelector<HTMLElement>("[data-code]")!;
        const left = beamX - scanWidth / 2;
        const right = beamX + scanWidth / 2;
        if (rect.left < right && rect.right > left) {
          scanning = true;
          /* How much of the card has crossed to the RIGHT of the beam. The
             cards travel rightward, so that is the part which has been through
             it — the face grows from the right edge back, and the code retreats
             ahead of it to the left. Reversing the travel without reversing
             this would resolve each card from the edge it has not reached yet. */
          const cut = Math.min(
            Math.max((rect.right - left) / rect.width, 0),
            1
          );
          face.style.clipPath = `inset(0 0 0 ${(1 - cut) * 100}%)`;
          cipher.style.clipPath = `inset(0 ${cut * 100}% 0 0)`;
        } else if (rect.left >= right) {
          // Entirely past the beam: all face.
          face.style.clipPath = "inset(0 0 0 0)";
          cipher.style.clipPath = "inset(0 100% 0 0)";
        } else {
          // Not there yet: all code.
          face.style.clipPath = "inset(0 0 0 100%)";
          cipher.style.clipPath = "inset(0 0 0 0)";
        }
      });

      if (!reduced) {
        const t = now * 0.001;
        for (let i = 0; i < COUNT; i += 1) {
          const at = i * 3;
          positions[at] = (positions[at] ?? 0) + drift[i]! * delta;
          if ((positions[at] ?? 0) > width / 2 + 40)
            positions[at] = -width / 2 - 40;
          positions[at + 1] =
            (positions[at + 1] ?? 0) + Math.sin(t + i * 0.1) * 0.15;
        }
        geometry.attributes.position!.needsUpdate = true;
        renderer.render(scene, camera);

        ctx.clearRect(0, 0, width, height);
        budget += ((scanning ? BUSY : IDLE) - budget) * 0.06;
        while (sparks.length < budget) sparks.push(spark());
        while (sparks.length > budget) sparks.pop();
        for (const p of sparks) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= p.decay;
          if (p.life <= 0 || p.x > width) Object.assign(p, spark());
          ctx.globalAlpha = p.alpha * p.life;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      sparks = [];
    };
  }, [box, cards, cardWidth, cardGap, speed, beamAt, openingLead, reduced]);

  return (
    <div
      ref={hostRef}
      className={`relative overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={particleCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <canvas
        ref={beamCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ width: "100%", height: "100%" }}
      />

      <div
        className="absolute inset-0 flex items-center"
        style={{ transform: `translateY(${bandOffsetY}px)` }}
      >
        <div
          ref={lineRef}
          className="flex shrink-0 items-center will-change-transform"
          style={{ gap: `${cardGap}px` }}
        >
          {/*
            The run, twice.

            A uniform flex `gap` is what makes the loop exact: every card
            occupies cardWidth + cardGap, so copy two's card i sits precisely
            one run after copy one's, and the wrap above can be that same run.
          */}
          {[0, 1].map((copy) =>
            cards.map((card) => (
              <div
                key={`${card.id}-${copy}`}
                data-card
                className="relative shrink-0"
                style={{ width: cardWidth, height: cardHeight }}
              >
                <div
                  data-code
                  className="absolute inset-0 overflow-hidden rounded-xl"
                  style={{ clipPath: "inset(0 0 0 0)" }}
                >
                  <pre
                    className="m-0 h-full w-full overflow-hidden p-0 text-left font-mono whitespace-pre text-indigo-200/45"
                    style={{
                      fontSize: `${CODE_PX}px`,
                      lineHeight: `${CODE_LINE}px`,
                    }}
                  >
                    {code.get(card.id)}
                  </pre>
                </div>
                <div
                  data-face
                  className="absolute inset-0 overflow-hidden rounded-xl"
                  /* Hidden from the LEFT, matching what the loop writes for a
                   card that has not reached the beam. Held over from the old
                   left-to-right travel, this hid the face from the right — the
                   same result, by the opposite edge, which would have made the
                   first frame after a rewind disagree with every frame after
                   it. */
                  style={{ clipPath: "inset(0 0 0 100%)" }}
                >
                  {card.face}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/*
        The beam, last so it paints over the cards.

        It is the thing doing the scanning, so it belongs in front of what it
        scans; behind them it vanished under whichever card it was working on,
        which is the one moment it should be plainest. Ordered rather than
        z-indexed — these are siblings, and the last one wins without anyone
        having to reason about a stacking context.

        Always lit: something is nearly always crossing it, and a line that
        blinks out between cards reads as a fault.
      */}
      <span
        className="pointer-events-none absolute top-1/2 w-px rounded-full bg-gradient-to-b from-transparent via-white/80 to-transparent"
        style={{
          left: `${beamAt * 100}%`,
          height: `${cardHeight + 48}px`,
          /* Rides with the band: a beam left on the middle of the box would
             cut the cards off centre. */
          transform: `translate(-50%, calc(-50% + ${bandOffsetY}px))`,
          boxShadow: "0 0 8px #c7d2fe, 0 0 18px #818cf8, 0 0 34px #4f46e5",
        }}
      />
    </div>
  );
}
