"use client";

import { ScrollStack } from "@/components/hub/vendor/scroll-stack";
import dynamic from "next/dynamic";
import { content, getMessagePeople } from "@/lib/data";
import { markFirstRunSeen, useFirstRunSeen } from "@/lib/first-run";
import { checkHandle, suggestHandle } from "@/lib/handle-suggest";
import { useReducedMotion } from "@/lib/motion";
import { addHandle, useSettings } from "@/lib/settings-store";
import { useHub } from "@/components/hub/hub-provider";
import { useCustomTheme } from "@/components/hub/theme-provider";
import { ShareBackdrop } from "@/components/hub/share-backdrop";
import TiltedTiles from "@/components/hub/vendor/tilted-tiles";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Shuffle } from "lucide-react";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";

/*
 * Loaded on demand, never on the server.
 *
 * `three` and @react-three/fiber are hundreds of kilobytes of WebGL, and this
 * screen can only ever render in a demo build. A static import would put all of
 * it in a shipped binary for something that is compiled out of the render —
 * measured, not assumed; see the note in hub-shell about what the flag does and
 * does not remove. Dynamic keeps it in its own chunk, fetched when the welcome
 * actually opens.
 */
const GlowingWave = dynamic(
  () => import("@/components/hub/vendor/glowing-wave"),
  { ssr: false }
);

/**
 * Whether this surface can draw the wave at all.
 *
 * three throws outright when a WebGL context cannot be created, and
 * @react-three/fiber turns that into a render-time error — which is how a
 * missing GPU takes down the whole welcome rather than just its background.
 * Reproduced in a headless Chrome with WebGL disabled: "THREE.WebGLRenderer:
 * Error creating WebGL context", and inside r3f's own Provider it surfaces as a
 * null `addEventListener`.
 *
 * Asked once, on the client, with the throwaway canvas released immediately.
 * Contexts are a limited resource and leaking one to answer a yes/no question
 * would be a poor trade on a machine already short of them.
 */
function useHasWebgl(): boolean {
  /* A lazy initialiser rather than an effect, for the reason the handle
     suggestion is one: this component never renders on the server, so touching
     `document` during the first render is safe, and asking in an effect would
     mean a render with the wave missing before a second with it there. */
  const [ok] = useState(() => {
    try {
      const probe = document.createElement("canvas");
      const gl =
        probe.getContext("webgl2") ??
        probe.getContext("webgl") ??
        probe.getContext("experimental-webgl");
      /* Hand the context back rather than waiting for the collector. */
      (gl as WebGLRenderingContext | null)
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext();
      return Boolean(gl);
    } catch {
      return false;
    }
  });
  return ok;
}

/**
 * Keeps a failing backdrop from taking the welcome with it.
 *
 * The capability check above catches the common case; this catches the rest —
 * a driver that reports WebGL and then fails, a context lost mid-render, a
 * future component that throws for its own reasons. A first run is the one
 * screen where a crash costs the whole first impression, and the thing being
 * guarded is decoration: rendering nothing is a complete answer.
 */
class BackdropBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn(
      "first-run backdrop failed, continuing without it",
      error,
      info
    );
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The wave's colours, taken from the theme rather than chosen.
 *
 * Read off the document at mount: these are the same custom properties the rest
 * of the chrome paints with, so a workspace with its own accent gets a wave in
 * it, and light and dark need no separate values. Hex only — THREE.Color cannot
 * parse the `rgba()` some of the other tokens carry, which is why this reads
 * --accent, --background and --surface and not, say, --surface-hover.
 */
function useThemeInk(): { hot: string; ink: string; backdrop: string } {
  const [ink, setInk] = useState({
    hot: "#4353ff",
    ink: "#221a2f",
    backdrop: "#0a0a0a",
  });
  useEffect(() => {
    const read = (): void => {
      const style = getComputedStyle(document.documentElement);
      const pick = (name: string, fallback: string): string => {
        const value = style.getPropertyValue(name).trim();
        return value.startsWith("#") ? value : fallback;
      };
      /* NOT --canvas. That token is the colour of a web PAGE, so it is
         #ffffff light and #f2f1ef dark — near-white in both, because websites
         are. --background is the app's own backdrop and is the one that flips
         with the theme, which is what anything sitting behind chrome wants. */
      setInk({
        hot: pick("--accent", "#4353ff"),
        ink: pick("--surface", "#221a2f"),
        backdrop: pick("--background", "#17111f"),
      });
    };
    read();
    /* The theme can change under us — the mode follows the OS, and the shell
       swaps the palette on the root element. Watch the attributes that carry
       it rather than polling. */
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", read);
    return () => {
      watch.disconnect();
      media.removeEventListener("change", read);
    };
  }, []);
  return ink;
}

/**
 * Card art.
 *
 * Local, and named for the step rather than the photograph, so replacing one is
 * dropping a file over another rather than editing this list. Placeholders from
 * the component's own demo set until the real renders land.
 */
const STEPS = [
  { key: "welcome", image: "/first-run/welcome.jpg" },
  { key: "browse", image: "/first-run/browse.jpg" },
  { key: "pay", image: "/first-run/pay.jpg" },
  { key: "workspaces", image: "/first-run/workspaces.jpg" },
] as const;

/** The wall on the browsing card. Same story: local, numbered, replaceable. */
const TILES = Array.from(
  { length: 10 },
  (_, index) =>
    `/first-run/tiles/tile-${String(index + 1).padStart(2, "0")}.jpg`
);

/** The handle card sits after the four told ones. */
const LAST = STEPS.length;
const COUNT = STEPS.length + 1;

/** Below this, the deck is swiped sideways rather than scrolled. */
const NARROW = 768;

/** A swipe has to travel this far, in px, before it counts as one. */
const SWIPE = 48;

/**
 * The first run.
 *
 * Five cards: four that say what this is, and one that asks for a name. Paged
 * rather than free-scrolled — Next, arrow keys, or a sideways swipe — because
 * the reference this is built to (Raycast's) is paged, and a welcome that can
 * be scrolled past at speed is a welcome nobody read.
 *
 * `ScrollStack` is a scroll-driven component, so paging works by scrolling it:
 * each step is a known offset down its own runway, and Next animates there.
 * That keeps the vendored component's stacking, turning and dissolving intact
 * instead of reimplementing it behind a pair of buttons.
 *
 * DEMO ONLY, and mounted behind DEMO_SURFACES by the shell. The last card tells
 * somebody a name is free, and nothing in a shipped build can know that — see
 * lib/handle-suggest, and docs/PROMOTING-DEMO-SURFACES.md for what would have
 * to exist first.
 */
export function FirstRun(): ReactNode {
  const seen = useFirstRunSeen();
  if (seen) return null;
  return <Run />;
}

function Run(): ReactNode {
  const copy = content.firstRun;
  const reduced = useReducedMotion();
  const settings = useSettings();
  const { activeSpaceId } = useHub();
  const wave = useThemeInk();
  const canWave = useHasWebgl();
  const theme = useCustomTheme();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  /*
   * Every handle the seed knows about, plus the ones this browser already has.
   * A fixture either way — see the module's own note — but at least a fixture
   * that already existed rather than a list invented for this screen.
   */
  const taken = [
    ...getMessagePeople().map((person) => person.handle),
    ...settings.handles,
  ];

  /*
   * Suggested once, in a lazy initialiser rather than an effect.
   *
   * `Math.random()` during render is normally a hydration mismatch waiting to
   * happen — but this component never renders on the server: `useFirstRunSeen`
   * answers "seen" to the server snapshot, so `FirstRun` returns null there and
   * `Run` first exists on the client. That makes the initialiser the honest
   * place for it, and saves the extra render an effect would cost on the one
   * screen where the first paint matters most.
   */
  const [handle, setHandle] = useState(() =>
    suggestHandle(taken, Math.random())
  );

  const verdict = checkHandle(handle, taken);

  /*
   * The welcome runs in the signature palette, following the OS, and hands the
   * workspace back exactly as it found it.
   *
   * Borrowed rather than reset. Clearing the palette outright is the literal
   * reading, but "Show again" in Settings would then quietly wipe an accent
   * somebody chose — a control for replaying a demo should not cost them their
   * theme. So the current pair is captured on the way in and restored on the way
   * out, which also means the effect is safe to run on a genuine first launch
   * where there is nothing to restore: null in, null out.
   *
   * Guarded by a ref rather than dependencies: the context's setters are stable,
   * but re-running this would capture the defaults it had just applied and
   * "restore" those instead, losing the real ones.
   */
  const borrowed = useRef(false);
  useEffect(() => {
    if (borrowed.current) return;
    borrowed.current = true;
    const spaceId = activeSpaceId;
    const colors = theme.profileTheme(spaceId);
    const mode = theme.profileMode(spaceId);
    theme.setProfileTheme(spaceId, null);
    theme.setProfileMode(spaceId, null);
    return () => {
      theme.setProfileTheme(spaceId, colors);
      theme.setProfileMode(spaceId, mode);
    };
  }, [activeSpaceId, theme]);

  /** Scroll the deck to a step. The stack animates because the page moves. */
  const goTo = useCallback(
    (next: number) => {
      const box = scroller.current;
      if (!box) return;
      const clamped = Math.max(0, Math.min(COUNT - 1, next));
      const span = box.scrollHeight - box.clientHeight;
      box.scrollTo({
        top: (span * clamped) / (COUNT - 1),
        behavior: reduced ? "auto" : "smooth",
      });
    },
    [reduced]
  );

  const finish = useCallback(() => {
    if (handle.trim() && verdict === "ok")
      addHandle(handle.trim(), activeSpaceId);
    /* Let the deck fall away before it unmounts. The reveal of the app behind
       it is the point of the screen, and cutting to it wastes the one moment
       this thing exists for. */
    setLeaving(true);
    window.setTimeout(() => markFirstRunSeen(), reduced ? 0 : 420);
  }, [handle, verdict, reduced, activeSpaceId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goTo(index + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index]);

  /* Sideways swipe on narrow screens. Pointer events rather than touch, so a
     trackpad drag works the same way, and captured on the frame rather than the
     card so a swipe that starts on the text still counts. */
  const waveBox = useRef<HTMLDivElement | null>(null);
  /*
   * The wave listens on its own element, and nothing ever reaches it: the
   * scrolling deck covers the viewport on top of it, and the wrapper is
   * pointer-events-none so it cannot steal a swipe. So the move is forwarded —
   * dispatching on a node bypasses hit-testing, which is the whole reason this
   * works without giving the wave a layer that would eat the gesture.
   */
  const steerWave = (event: React.PointerEvent): void => {
    const node = waveBox.current?.firstElementChild;
    if (!node) return;
    node.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: event.clientX,
        clientY: event.clientY,
        bubbles: false,
      })
    );
  };

  const from = useRef<{ x: number; y: number } | null>(null);
  const onDown = (event: React.PointerEvent): void => {
    if (window.innerWidth >= NARROW) return;
    from.current = { x: event.clientX, y: event.clientY };
  };
  const onUp = (event: React.PointerEvent): void => {
    const start = from.current;
    from.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy)) return;
    goTo(index + (dx < 0 ? 1 : -1));
  };

  const last = index >= LAST;

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          /* Down and away, so the app behind it arrives rather than replaces. */
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          transition={{
            duration: reduced ? 0.01 : 0.42,
            ease: [0.4, 0, 0.2, 1],
          }}
          role="dialog"
          aria-modal="true"
          aria-label={copy.steps.welcome.title}
          className="bg-background fixed inset-0 z-120"
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerMove={steerWave}
          onPointerLeave={() =>
            waveBox.current?.firstElementChild?.dispatchEvent(
              new PointerEvent("pointerleave", { bubbles: false })
            )
          }
        >
          {/* The whole viewport, behind the deck. Paused under
              prefers-reduced-motion rather than removed: the wave is most of
              what this screen looks like, and a still one still looks like it.
              Pointer interaction off, because every pointer event here belongs
              to the swipe. */}
          {/*
            Wrapped rather than positioned directly.

            GlowingWave puts `relative` on its own root and merges whatever
            className it is handed onto the same element — and Tailwind emits
            `.relative` after `.absolute`, so `absolute inset-0` lost to it. The
            element became position:relative with the insets inert, and since its
            only child is absolutely placed it collapsed to zero height: a 0x0
            canvas, drawing nothing. The wrapper owns the placement; the wave
            just fills it.
          */}
          {/* No WebGL, no wave, and the welcome carries on. The overlay's own
              --background is behind it either way, so what is lost is the
              movement rather than the screen. */}
          {canWave && (
            <BackdropBoundary>
              <div
                ref={waveBox}
                className="pointer-events-none absolute inset-0"
              >
                <GlowingWave
                  className="h-full w-full"
                  color={wave.ink}
                  hotColor={wave.hot}
                  backgroundColor={wave.backdrop}
                  /* Quieter than the component's own demo: this sits behind five
                 cards of text and is the backdrop, not the subject. Lower swell
                 and glow, less iridescence, fewer bands, and a slow drift. */
                  swell={0.09}
                  swellFrequency={2.2}
                  ripple={0.04}
                  chop={0.02}
                  glow={0.4}
                  glowWidth={0.035}
                  halo={0.28}
                  richness={0.3}
                  colorFrequency={2.5}
                  saturation={0.75}
                  speed={0.55}
                  grain={0.03}
                  opacity={0.85}
                  waterline={-0.08}
                  /* Follows the pointer and a dragging finger, via steerWave above. */
                  cursorInteraction
                  cursorLift={0.07}
                  cursorReach={0.34}
                  paused={reduced}
                />
              </div>
            </BackdropBoundary>
          )}
          <div
            ref={scroller}
            /* `overscroll-contain` so flicking past the last card does not
               scroll the app underneath, which is still mounted. */
            /* Exactly the viewport, and the footer floats over it rather than
               taking height from it: ScrollStack measures against
               window.innerHeight and pins an h-screen child, so a scroll box
               shorter than the viewport puts every card in the wrong place. */
            className="absolute inset-0 overflow-y-auto overscroll-contain"
          >
            <ScrollStack
              variant="deck"
              scrollLength={1}
              cardHeight={0.66}
              cardWidth={720}
              showCounter={false}
              showProgress={false}
              blur={reduced ? 0 : 4}
              smooth={reduced ? 0 : 0.16}
              onIndexChange={setIndex}
            >
              {STEPS.map((step) => (
                <TellCard
                  key={step.key}
                  image={step.image}
                  {...(step.key === "browse"
                    ? {
                        /*
                          The browsing card shows browsing: a drifting wall of
                          pages that leans toward the pointer, rather than one
                          photograph of nothing in particular. Its own tilt
                          answers the mouse and a dragging finger, which is why
                          it belongs on this card and not behind all four.
                          Slower and flatter than the component's demo, because
                          it sits under a heading rather than being the page.
                        */
                        backdrop: (
                          <div className="absolute inset-0">
                            <TiltedTiles
                              images={TILES}
                              columns={12}
                              tilesPerColumn={5}
                              duration={38}
                              rotateX={34}
                              rotateY={14}
                              rotateZ={-18}
                              fadeTop={26}
                              fadeBottom={10}
                              saturation={0.85}
                              parallaxStrength={7}
                            />
                          </div>
                        ),
                      }
                    : {})}
                  title={copy.steps[step.key].title}
                  body={copy.steps[step.key].body}
                />
              ))}
              <HandleCard
                value={handle}
                verdict={verdict}
                onChange={setHandle}
                onShuffle={() => setHandle(suggestHandle(taken, Math.random()))}
              />
            </ScrollStack>
          </div>

          <Footer
            index={index}
            last={last}
            canFinish={verdict === "ok"}
            onBack={() => goTo(index - 1)}
            onNext={() => (last ? finish() : goTo(index + 1))}
            onDot={goTo}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One of the four cards that only has something to say. */
function TellCard({
  image,
  backdrop,
  title,
  body,
}: {
  image: string;
  /** Replaces the still, for a card whose subject moves. */
  backdrop?: ReactNode;
  title: string;
  body: string;
}): ReactNode {
  return (
    <article className="ring-border/60 relative flex h-full w-full flex-col justify-end overflow-hidden rounded-3xl bg-black shadow-2xl ring-1">
      {backdrop ?? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* The ramp is its own layer with a stated height, for the reason the
          collectible tiles explain: text sitting on the transparent half of a
          wash is white on whatever the art happens to be. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/95 via-black/70 to-transparent"
      />
      <div className="relative flex flex-col items-center gap-2 p-8 text-center sm:gap-3 sm:p-10">
        <h2 className="max-w-[20ch] text-2xl font-bold tracking-tight text-balance text-white sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-[38ch] text-sm leading-relaxed text-balance text-white/75 sm:text-base">
          {body}
        </p>
      </div>
    </article>
  );
}

/** The fifth card, which asks for something instead of saying something. */
function HandleCard({
  value,
  verdict,
  onChange,
  onShuffle,
}: {
  value: string;
  verdict: ReturnType<typeof checkHandle>;
  onChange: (next: string) => void;
  onShuffle: () => void;
}): ReactNode {
  const copy = content.firstRun.handle;
  const tone =
    verdict === "ok"
      ? "text-positive"
      : verdict === "empty"
        ? "text-muted-foreground"
        : "text-negative";

  return (
    /*
      The drifting app collage from the share sheet, on the one card that is not
      a photograph.
      The four before this are full-bleed images; this one asks a question, so it
      needs a ground of its own rather than a flat panel at the end of a run of
      pictures. ShareBackdrop already is that ground — the same tiles, the same
      accent bloom, the same pointer parallax — and reusing it means the welcome
      ends on something the rest of the app already does rather than a fifth
      invention.
    */
    <article className="ring-border/60 relative h-full w-full overflow-hidden rounded-3xl shadow-2xl ring-1">
      <ShareBackdrop className="flex h-full w-full flex-col items-center justify-center gap-5 p-8 text-center sm:p-10">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {copy.title}
          </h2>
          <p className="text-muted-foreground max-w-[36ch] text-sm text-balance">
            {copy.body}
          </p>
        </div>

        <div className="w-full max-w-sm">
          <label className="sr-only" htmlFor="first-run-handle">
            {copy.label}
          </label>
          <div className="bg-surface-raised ring-border/60 focus-within:ring-accent/60 flex items-center gap-1 rounded-xl px-3 py-2 ring-1">
            <span className="text-muted-foreground font-mono text-lg">@</span>
            <input
              id="first-run-handle"
              value={value}
              onChange={(event) => onChange(event.target.value.toLowerCase())}
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent font-mono text-lg outline-none"
            />
            <button
              type="button"
              onClick={onShuffle}
              aria-label={copy.shuffle}
              title={copy.shuffle}
              className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground rounded-lg p-1.5"
            >
              <Shuffle className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p
            className={`mt-2 flex items-center justify-center gap-1 text-xs font-medium ${tone}`}
          >
            {verdict === "ok" && (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            {copy.status[verdict]}
          </p>
        </div>

        <p className="text-muted-foreground max-w-[38ch] text-[11px] leading-relaxed text-balance">
          {copy.changeNote}
        </p>
      </ShareBackdrop>
    </article>
  );
}

/** Back, the dots, and the one button that moves you on. */
function Footer({
  index,
  last,
  canFinish,
  onBack,
  onNext,
  onDot,
}: {
  index: number;
  last: boolean;
  canFinish: boolean;
  onBack: () => void;
  onNext: () => void;
  onDot: (index: number) => void;
}): ReactNode {
  const copy = content.firstRun;
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/*
        A pool of the page's own colour under the controls, and nothing wider.

        These sit over whatever the front card happens to be, which on a bright
        photograph leaves a dark dot row and a dark arrow with nothing behind
        them. A full-width bar would read as a toolbar and cut the card off at
        the ankles; an ellipse fading out well before the edges reads as depth
        instead. A theme token rather than black, so it darkens on a dark theme and
        lightens on a light one, which is the direction contrast needs in each.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-[min(40rem,90%)] -translate-x-1/2"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 100%, color-mix(in oklab, var(--background) 88%, transparent), transparent 72%)",
        }}
      />
      <button
        type="button"
        onClick={onBack}
        disabled={index === 0}
        aria-label={copy.back}
        className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground relative rounded-lg p-2 disabled:pointer-events-none disabled:opacity-0"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </button>

      <div className="relative flex items-center gap-1.5">
        {Array.from({ length: COUNT }, (_, dot) => (
          <button
            key={dot}
            type="button"
            onClick={() => onDot(dot)}
            aria-label={`${copy.stepLabel} ${dot + 1}`}
            aria-current={dot === index ? "step" : undefined}
            className={`focus-ring h-1.5 rounded-full transition-all ${
              dot === index
                ? "bg-foreground w-5"
                : "bg-muted-foreground/40 hover:bg-muted-foreground w-1.5"
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={last && !canFinish}
        className="focus-ring bg-accent text-accent-foreground relative rounded-full px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
      >
        {last ? copy.finish : copy.next}
      </button>
    </div>
  );
}
