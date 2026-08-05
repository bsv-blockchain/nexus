"use client";

import { previewLabel } from "@/components/apps/messages/conversation-list";
import { Sheet } from "@/components/apps/messages/sheet";
import {
  content,
  getCurrentMessageUser,
  type ChatMessage,
  type MessagePerson,
} from "@/lib/data";
import { formatMessageTime, handleOf } from "@/lib/messages";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** The card is an OG-sized still, so it reads the same wherever it is pasted. */
const WIDTH = 1200;
const HEIGHT = 630;
/** Drawn at 2× and displayed at 1×, so text stays crisp when it is enlarged. */
const SCALE = 2;

const PAD = 64;
const AVATAR = 96;
const MAX_LINES = 5;

/** A CSS variable's current value, so the still matches the theme on screen. */
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Greedy wrap, clamped, with the last line ellipsised rather than cut mid-word. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1] ?? "";
    // Only ellipsise when something was actually left out.
    const consumed = lines.join(" ");
    if (consumed.length < text.trim().length) {
      while (last && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1).trimEnd();
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * Draw the message as a still.
 *
 * Composed on a canvas rather than screenshotted from the DOM. The transcript
 * bubble is built for a 340px column with hover states and live popovers, and
 * none of that survives being flattened — so this is its own layout at its own
 * size, reading the theme's tokens so it still looks like the app it came from.
 */
async function paint(
  canvas: HTMLCanvasElement,
  message: ChatMessage,
  person: MessagePerson,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  const family =
    typeof document === "undefined"
      ? "sans-serif"
      : getComputedStyle(document.body).fontFamily || "sans-serif";
  /* `background` rather than `surface-raised`: the sheet showing the preview is
     already raised, and a still the same colour as the panel around it stops
     reading as a thing you could paste somewhere else. Darker than the panel in
     both themes, so the separation holds either way. */
  const bg = token("--background", "#17111f");
  const ink = token("--foreground", "#f5f3ff");
  const muted = token("--muted-foreground", "#a99fc4");
  const accent = token("--accent", "#4353ff");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A hairline of accent down the leading edge: enough to be recognisably from
  // this app without putting a logo across somebody's words.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 8, HEIGHT);

  const avatar = person.photo ? await loadImage(person.photo) : null;
  ctx.save();
  roundedPath(ctx, PAD, PAD, AVATAR, AVATAR, 27);
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, PAD, PAD, AVATAR, AVATAR);
  } else {
    const [from, via, to] = person.avatarColors;
    const gradient = ctx.createLinearGradient(PAD, PAD, PAD + AVATAR, PAD + AVATAR);
    gradient.addColorStop(0, from ?? "#4353ff");
    gradient.addColorStop(0.5, via ?? from ?? "#7c3aed");
    gradient.addColorStop(1, to ?? via ?? "#0ea5e9");
    ctx.fillStyle = gradient;
    ctx.fillRect(PAD, PAD, AVATAR, AVATAR);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(AVATAR * 0.38)}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(person.name), PAD + AVATAR / 2, PAD + AVATAR / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  const textLeft = PAD + AVATAR + 28;
  ctx.fillStyle = ink;
  ctx.font = `700 34px ${family}`;
  ctx.fillText(person.name, textLeft, PAD + 40);
  ctx.fillStyle = muted;
  ctx.font = `500 26px ${family}`;
  ctx.fillText(handleOf(person, { qualified: true }), textLeft, PAD + 78);

  const body = message.text.trim() || previewLabel(message);
  ctx.fillStyle = ink;
  ctx.font = `600 44px ${family}`;
  const lines = wrap(ctx, body, WIDTH - PAD * 2, MAX_LINES);
  let y = PAD + AVATAR + 96;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += 62;
  }

  ctx.fillStyle = muted;
  ctx.font = `500 24px ${family}`;
  ctx.fillText(formatMessageTime(message.createdAt), PAD, HEIGHT - PAD);
  ctx.textAlign = "right";
  ctx.fillText(content.brand.name, WIDTH - PAD, HEIGHT - PAD);
  ctx.textAlign = "left";
}

/**
 * The message as a shareable still, with the two things you would do with one.
 *
 * Both actions work on a real PNG rather than promising one: the canvas is the
 * image, so what gets copied and what gets saved is exactly what is on screen.
 * Clipboard writes for images are permissioned and fail on insecure origins, so
 * the failure is reported rather than swallowed — a Copy button that silently
 * does nothing is worse than one that says it could not.
 */
export function MessageImageSheet({
  message,
  sender,
  open,
  onClose,
}: {
  message: ChatMessage;
  /** absent on the user's own message, where the author is the current user */
  sender?: MessagePerson | undefined;
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const copy = content.messages.messageImage;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const person = sender ?? getCurrentMessageUser();

  useEffect(() => {
    if (!open) return;
    let live = true;
    setReady(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    void paint(canvas, message, person).then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [open, message, person]);

  const blob = async (): Promise<Blob | null> =>
    new Promise((resolve) =>
      canvasRef.current
        ? canvasRef.current.toBlob((value) => resolve(value), "image/png")
        : resolve(null),
    );

  const onCopy = async (): Promise<void> => {
    const png = await blob();
    if (!png) return;
    try {
      if (typeof ClipboardItem === "undefined") throw new Error("unsupported");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png }),
      ]);
      toast.success(copy.copied);
    } catch {
      toast.error(copy.copyFailed);
    }
  };

  const onSave = async (): Promise<void> => {
    const png = await blob();
    if (!png) return;
    const url = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${message.id}.png`;
    link.click();
    /* Revoked on the next tick, not immediately: some browsers have not started
       reading the blob by the time `click` returns, and pulling the URL out from
       under them cancels the download with nothing on screen to say why. */
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(copy.saved);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={copy.title}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => void onCopy()}
            className="focus-ring border-border hover:bg-surface-hover inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-45"
          >
            <Copy className="size-4" aria-hidden="true" />
            {copy.copyImage}
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => void onSave()}
            className="focus-ring bg-accent text-accent-foreground inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            <Download className="size-4" aria-hidden="true" />
            {copy.saveImage}
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-5 pt-3 pb-5">
        <div>
          <h2 className="text-base font-bold">{copy.title}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
            {copy.hint}
          </p>
        </div>
        {/* The canvas is the preview and the artefact both, so there is no way
            for what you see here to differ from what you copy. */}
        <canvas
          ref={canvasRef}
          aria-label={`${copy.title}: ${person.name}`}
          role="img"
          className="border-border block aspect-1200/630 w-full rounded-xl border"
        />
      </div>
    </Sheet>
  );
}
