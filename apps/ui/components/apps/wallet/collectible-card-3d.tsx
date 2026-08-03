"use client";

import { CollectibleArt } from "@/components/apps/wallet/collectible-art";

import { Tooltip } from "@/components/hub/tooltip";
import { content } from "@/lib/data";
import { RotateCcw } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

/**
 * A collectible as a card you can spin, like turning a physical one over.
 *
 * The reference wallet does this with Three.js pulled from a CDN. For a flat
 * card that is more machinery than the effect needs, so this uses CSS 3D
 * transforms instead: no runtime dependency, no external script, and every
 * surface stays a theme token so it recolours with the rest of the app.
 *
 * Drag to spin, release to settle, or use the reset button. Keyboard users get
 * arrow keys, since a drag-only control is unusable without a pointer.
 */
export function Collectible3DCard({
  imageUrl,
  posterUrl,
  name,
  serialNumber,
  org,
}: {
  imageUrl: string;
  /** first frame, where `imageUrl` is a clip */
  posterUrl?: string | undefined;
  name: string;
  serialNumber: string;
  org?: string | undefined;
}): ReactNode {
  const copy = content.wallet.collectibles;
  const [angle, setAngle] = useState({ y: -18, x: 8 });
  const dragRef = useRef<{ x: number; y: number; ay: number; ax: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: React.PointerEvent): void => {
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ay: angle.y,
      ax: angle.x,
    };
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    const start = dragRef.current;
    if (!start) return;
    const dy = event.clientX - start.x;
    const dx = event.clientY - start.y;
    setAngle({
      y: start.ay + dy * 0.6,
      // Clamped so the card never flips onto its edge and disappear.
      x: Math.max(-45, Math.min(45, start.ax - dx * 0.4)),
    });
  };

  const stop = (): void => {
    dragRef.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const step = 15;
    if (event.key === "ArrowLeft") setAngle((a) => ({ ...a, y: a.y - step }));
    else if (event.key === "ArrowRight") setAngle((a) => ({ ...a, y: a.y + step }));
    else if (event.key === "ArrowUp")
      setAngle((a) => ({ ...a, x: Math.min(45, a.x + step) }));
    else if (event.key === "ArrowDown")
      setAngle((a) => ({ ...a, x: Math.max(-45, a.x - step) }));
    else return;
    event.preventDefault();
  };

  // Past a quarter turn the back of the card is what faces the viewer.
  const showingBack = Math.abs(((angle.y % 360) + 360) % 360 - 180) < 90;

  return (
    <div className="relative">
      <div
        role="img"
        aria-label={`${name} — ${copy.spinHint}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={onKeyDown}
        className={`focus-ring grid aspect-square w-full place-items-center rounded-2xl bg-surface select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ perspective: "1000px", touchAction: "none" }}
      >
        <div
          className="relative h-[76%] w-[76%]"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${angle.x}deg) rotateY(${angle.y}deg)`,
            transition: dragging ? "none" : "transform 420ms cubic-bezier(.2,.8,.2,1)",
          }}
        >
          {/* Front */}
          <span
            className="absolute inset-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-border"
            style={{ backfaceVisibility: "hidden" }}
          >
            <CollectibleArt
              src={imageUrl}
              {...(posterUrl ? { poster: posterUrl } : {})}
              className="size-full object-cover"
            />
          </span>

          {/* Back — the provenance side, rendered from tokens so it themes. */}
          <span
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-surface-raised p-4 text-center shadow-2xl ring-1 ring-border"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {copy.serial}
            </span>
            <span className="font-mono text-lg font-bold">{serialNumber}</span>
            {org && (
              <span className="text-xs text-pretty text-muted-foreground">
                {copy.issuedBy} {org}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {showingBack ? copy.showingBack : copy.spinHint}
        </p>
        <Tooltip label={copy.reset}>
          <button
            type="button"
            onClick={() => setAngle({ y: -18, x: 8 })}
            aria-label={copy.reset}
            className="focus-ring rounded-full p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
