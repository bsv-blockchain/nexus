"use client";

import { ScrollStack } from "@/components/hub/vendor/scroll-stack";
import dynamic from "next/dynamic";
import { content, getMessagePeople } from "@/lib/data";
import { markFirstRunSeen, useFirstRunSeen } from "@/lib/first-run";
import { Clip, PresetPicker } from "@/components/hub/preset-picker";
import { useApplyPresets } from "@/components/hub/use-apply-presets";
import { setChosenPresets } from "@/lib/presets-store";
import { startTour } from "@/lib/tour-store";
import { useHostOverlay } from "@/lib/wallet-data";
import { toast } from "sonner";
import { checkHandle, suggestHandle } from "@/lib/handle-suggest";
import { useReducedMotion } from "@/lib/motion";
import { addHandle, useSettings } from "@/lib/settings-store";
import { useHub } from "@/components/hub/hub-provider";
import { useCustomTheme } from "@/components/hub/theme-provider";
import { ShareBackdrop } from "@/components/hub/share-backdrop";
import TiltedTiles from "@/components/hub/vendor/tilted-tiles";
import { ScannerCardStream } from "@/components/hub/vendor/scanner-card-stream";
import { HANDLE_CARDS } from "@/components/hub/handle-cards";
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
  /* PNG rather than JPG: this one is a product render of the devices on black,
     not a photograph, and JPG rings around the crisp UI edges inside them. */
  { key: "workspaces", image: "/first-run/workspaces.png" },
] as const;

/**
 * The paintings, one per card and all of them in the opening.
 *
 * Order matters: `ART[n]` is the plate behind card `n`, and ART[0] is also the
 * frame the opening's shuffle lands on, so the picture you arrive on is the
 * picture already there. Everything is a blue duotone at source, which is why
 * they sit under the chrome without fighting it.
 *
 * Chosen against each card's own sentence rather than for looks:
 *   welcome    a vault, lit through its windows — the slogan, roughly
 *   browse     a ferry crossing and recrossing, with a village on the far bank
 *   pay        figures carrying baskets out and back, which is what paying is
 *   workspaces a camp of separate households, side by side, each its own
 *   handle     one named landmark alone against the sky
 */
const ART = [
  "/first-run/art/vault.webp",
  "/first-run/art/ferry.webp",
  "/first-run/art/fishing.webp",
  "/first-run/art/halt.webp",
  "/first-run/art/mill.webp",
] as const;

/** The three that only ever appear in the opening's shuffle. */
const ART_EXTRA = [
  "/first-run/art/rock.webp",
  "/first-run/art/swiss.webp",
  "/first-run/art/buffalo.webp",
] as const;

/** How long one frame of the opening's shuffle is held, in milliseconds. */
const FLIP = 250;

/**
 * How long one plate takes to dissolve into the next, in seconds.
 *
 * Exactly the hold, which is what makes this a crossfade rather than a pile.
 * Each plate is fully up as the next starts, and fully gone as the one after
 * that starts, so there are never more than two on screen and the blend is
 * always between a known pair. Stretching it beyond FLIP sounds smoother and is
 * not: at 1.4x the hold, four plates were compositing at once and four
 * different paintings averaged together is a grey wash, not a dissolve.
 *
 * Derived from FLIP rather than typed out so changing the pace cannot leave the
 * two disagreeing.
 */
const DISSOLVE = FLIP / 1000;

/** Behind the mark, and behind the deck: two strengths of the same layer. */
const ART_INTRO_OPACITY = 0.35;
const ART_DECK_OPACITY = 0.12;

/**
 * The wall on the browsing card. Same story: local, numbered, replaceable.
 *
 * Real Metanet apps rather than stock tiles: the card's claim is that there is
 * something to browse, and eighteen actual products make it where a wall of
 * pretty rectangles only decorates it.
 */
const TILES = Array.from(
  { length: 18 },
  (_, index) => `/metanetnet_appdemos/metanet-app-${index + 1}.png`
);

/** The handle card sits after the four told ones. */
const LAST = STEPS.length;
const COUNT = STEPS.length + 1;

/** Below this, the deck is swiped sideways rather than scrolled. */
const NARROW = 768;

/** A swipe has to travel this far, in px, before it counts as one. */
const SWIPE = 48;

/**
 * The opening, as a running clock in milliseconds.
 *
 * One timeline rather than a chain of nested timeouts: every beat is stated
 * against the same zero, so reading the sequence is reading this block, and
 * moving one beat cannot silently shift the ones after it.
 */
const INTRO = {
  /** the mark fades up and settles */
  logoIn: 0,
  /** ...and is left alone for two seconds, which is the whole point of it */
  wordIn: 2600,
  /** "us" comes up to full while the rest stays quiet */
  usIn: 3200,
  /** mark and word recede; the wave comes up to full behind them */
  recede: 3800,
  /** the deck arrives just after the wave starts opening up */
  deck: 4300,
  /** and the controls last, from below */
  footer: 4700,
  /** everything is in place */
  done: 5100,
} as const;

/**
 * How much of the wave is showing before the reveal.
 *
 * A wrapper opacity rather than the shader's own `opacity` uniform: that one is
 * a number the component compiles into its draw, so animating it re-renders the
 * canvas on every frame. Fading the element the canvas sits in costs the
 * compositor nothing and looks identical.
 */
const WAVE_START = 0.25;

/**
 * How much of it is showing once the deck is up.
 *
 * Short of full on purpose. The wave has the screen to itself during the
 * opening, but behind five cards of text and a plate of its own it is the
 * backdrop rather than the subject, and holding a little of it back is what
 * keeps the cards sitting on top of something instead of in it.
 *
 * Multiplies the shader's own `opacity` uniform (0.85 below) rather than
 * replacing it, so the wave is drawn at roughly two thirds strength here.
 */
const WAVE_DECK = 0.8;

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
  /*
   * Two screens, in order: the cards, then the preset picker.
   *
   * The picker is not a sixth card. The cards are read and dismissed; the
   * picker is answered, and its answer builds the rail somebody is about to
   * land on. Putting it in the deck would have made "Next" mean two different
   * things on two adjacent screens.
   */
  const [picking, setPicking] = useState(false);
  const [deckGone, setDeckGone] = useState(false);
  if (seen) return null;

  return (
    <>
      {/*
        Both, while the deck is on its way out.

        The picker mounts the moment the last card is answered, underneath the
        deck, so the deck falls away onto it. Swapping one for the other left a
        gap where neither was mounted and the Timeline showed through for the
        length of the animation — a screen nobody had asked for yet, appearing
        and then being covered again.

        Order is the layering: both sit at `z-120`, so the deck is second and
        therefore on top until it unmounts.
      */}
      {picking && <Presets />}
      {!deckGone && (
        <Run
          onCardsDone={() => setPicking(true)}
          onDeckGone={() => setDeckGone(true)}
        />
      )}
    </>
  );
}

/**
 * The picker, over everything, holding the shell's overlay while it is up.
 *
 * Same reason the cards do: a browsed page is a native view above this
 * document, so without it the whole screen renders behind whatever tab happens
 * to be open.
 */
function Presets(): ReactNode {
  const applyPresets = useApplyPresets();
  const { setMainView } = useHub();
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  useHostOverlay(true);

  return (
    /* `z-120`, the same layer the welcome deck uses. At 90 it sat under the
       tooltip layer and under the shell's own chrome, so the rail's mark and
       the assistant button punched through a screen that is meant to be the
       only thing on it. */
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={content.firstRun.presets.title}
      className="fixed inset-0 z-120 bg-black"
      /*
       * Fades onto the workspace it has just built.
       *
       * The rail is already laid out and the feed is already behind this by the
       * time the fade starts, so what you watch is the thing you asked for
       * arriving — a cut would have thrown it at you instead.
       */
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, delay: 0.05 }}
      style={{ pointerEvents: leaving ? "none" : undefined }}
    >
      <PresetPicker
        onDone={(chosen) => {
          setChosenPresets(chosen);
          applyPresets(chosen);
          /* Set before the fade rather than after, so the feed is already
             there to be revealed. */
          setMainView("timeline");
          setLeaving(true);
          /* Unmounted only once it is invisible; `markFirstRunSeen` is what
             takes this whole tree away. */
          window.setTimeout(() => markFirstRunSeen(), reduced ? 0 : 520);
          /*
           * The invitation, two seconds after the feed arrives.
           *
           * Not immediately: the point of those two seconds is that somebody
           * gets to see the workspace they just built before being offered a
           * tour of it. `Infinity` because an offer that expires while you are
           * reading the screen it is about is an offer nobody took.
           */
          window.setTimeout(() => {
            toast(content.tour.invite, {
              description: content.tour.inviteBody,
              duration: Number.POSITIVE_INFINITY,
              action: {
                label: content.tour.inviteAction,
                onClick: () => startTour(),
              },
            });
          }, 2000);
        }}
      />
    </motion.div>
  );
}

function Run({
  onCardsDone,
  onDeckGone,
}: {
  onCardsDone: () => void;
  onDeckGone: () => void;
}): ReactNode {
  /*
   * Tell the shell it is covered.
   *
   * A browsed page is a native view in both shells — a WebContentsView on the
   * desktop, a native web view on mobile — and a native view is a sibling of
   * this document that always paints ABOVE it. No z-index here can reach over
   * one, so without this the welcome renders perfectly and is then completely
   * hidden behind whatever tab happens to be open.
   *
   * Held for the whole mount rather than dropped when `leaving` starts: the
   * deck falling away is the reveal, and letting the page back in first would
   * pop it over the top of that.
   *
   * A no-op in a plain browser, which has no tab layer to hide.
   */
  useHostOverlay(true);
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
   * How far into the opening we are, in milliseconds on INTRO's clock.
   *
   * Reduced motion starts at the end: the sequence is the one part of this
   * screen that is purely motion, so there is nothing left of it to show
   * somebody who has asked not to be shown motion.
   */
  const [beat, setBeat] = useState(() => (reduced ? INTRO.done : 0));
  const introDone = beat >= INTRO.done;

  /*
   * The opening's shuffle, worked out once.
   *
   * Every plate exactly once: the seven that are not ART[0] in a random order,
   * then ART[0] last. A fixed list rather than a timer picking as it goes,
   * because the final frame has to be the plate card one is about to show and a
   * sequence that decides frame by frame cannot promise where it stops.
   *
   * Eight frames at FLIP is two seconds, and the opening runs to INTRO.recede
   * at 3.8 — so the run finishes early and ART[0] simply holds. That is the
   * good version of the gap: the flicker settles before the name appears, and
   * the plate that carries into the first card is already still by then. Making
   * it fill the whole opening instead means a slower FLIP, not more frames.
   *
   * Deterministic per mount (`useState` initialiser, not `useMemo`) so a
   * re-render cannot deal a different hand mid-animation.
   */
  const [shuffle] = useState<string[]>(() => {
    const pool = [...ART.slice(1), ...ART_EXTRA];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return [...pool, ART[0]];
  });
  /* Which frame of the shuffle is up. Frozen at the last one once the opening
     is over, which is what hands the plate to the deck unchanged. */
  const [flip, setFlip] = useState(0);
  const plate = introDone
    ? (ART[Math.min(index, ART.length - 1)] ?? ART[0])
    : (shuffle[Math.min(flip, shuffle.length - 1)] ?? ART[0]);
  const skipIntro = useCallback(() => setBeat(INTRO.done), []);

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
    /*
     * Land on the feed, not on whatever the canvas happened to be showing.
     *
     * The welcome has just spent five cards saying what is in here; the wall of
     * apps is the answer to that, and it is the same place the Workspaces
     * column's View feed button goes. Set BEFORE the deck falls away rather
     * than after, so the page is already there to be revealed — switching once
     * the overlay is gone would show one screen and then replace it.
     */
    /*
     * The picker first, then the deck falls away onto it.
     *
     * Not `setMainView` here any more: the canvas behind this is not what comes
     * next, the picker is, and pointing the app at the feed now only meant the
     * feed flashed up between the two screens.
     */
    onCardsDone();
    setLeaving(true);
    window.setTimeout(() => onDeckGone(), reduced ? 0 : 420);
  }, [handle, verdict, reduced, activeSpaceId, onCardsDone, onDeckGone]);

  /*
   * Walk the opening. One timer per beat, all cleared together.
   *
   * Timers rather than a CSS/motion sequence because the beats gate what is
   * MOUNTED — the deck and the footer are not merely transparent before their
   * turn, they are not there — and a keyframe cannot mount anything.
   */
  useEffect(() => {
    if (introDone) return;
    const timers = Object.values(INTRO)
      .filter((at) => at > 0)
      .map((at) =>
        window.setTimeout(() => setBeat((now) => Math.max(now, at)), at)
      );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [introDone]);

  /* Step the shuffle. Stops of its own accord on the last frame, which is the
     one the deck inherits. */
  useEffect(() => {
    if (introDone) return;
    const timer = window.setInterval(
      () => setFlip((at) => Math.min(at + 1, shuffle.length - 1)),
      FLIP
    );
    return () => window.clearInterval(timer);
  }, [introDone, shuffle.length]);

  /* Any key, anywhere, ends the opening rather than paging the deck. Handled
     before the arrow keys below so the first press cannot do both. */
  useEffect(() => {
    if (introDone) return;
    const onAnyKey = (): void => skipIntro();
    window.addEventListener("keydown", onAnyKey);
    return () => window.removeEventListener("keydown", onAnyKey);
  }, [introDone, skipIntro]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!introDone) return;
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
  }, [goTo, index, introDone]);

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
    /* A press during the opening ends it, and is not also the start of a
       swipe: the deck it would page is not on screen yet. */
    if (!introDone) {
      skipIntro();
      return;
    }
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
              <motion.div
                ref={waveBox}
                className="pointer-events-none absolute inset-0"
                /* A quarter of itself until the mark recedes, then up to its
                   resting strength. Slower than the recede it accompanies, so
                   the wave is still opening as the first card lands rather than
                   arriving with it. */
                initial={false}
                animate={{
                  opacity: beat >= INTRO.recede ? WAVE_DECK : WAVE_START,
                }}
                transition={{
                  duration: reduced ? 0 : 1.4,
                  ease: [0.33, 0, 0.2, 1],
                }}
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
              </motion.div>
            </BackdropBoundary>
          )}

          {/*
            The plates: over the shader, under everything else.

            One element that never unmounts between the opening and the deck.
            The shuffle's last frame is card one's plate, so when the deck
            arrives nothing is swapped — only the opacity falls, from something
            you are meant to see to something you are meant to feel. That is the
            whole reason this is not two layers.

            A background-image rather than an <img>: `cover` on a full-bleed
            plate is one line here and a wrapper plus object-fit there, and this
            is decoration with no alt text to give.
          */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <AnimatePresence initial={false}>
              <motion.div
                key={plate}
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${plate})` }}
                initial={{ opacity: 0 }}
                animate={{
                  opacity:
                    beat >= INTRO.deck ? ART_DECK_OPACITY : ART_INTRO_OPACITY,
                }}
                exit={{ opacity: 0 }}
                /*
                  Two different jobs, so two timings.
                
                  During the shuffle it is a dissolve: linear, and longer than
                  the hold, so the outgoing plate is still going as the incoming
                  one arrives. Linear rather than eased because both halves are
                  composited independently — an ease-in-out on each would thin
                  the middle of every crossing and make the run pulse.
                
                  After it, the same layer is settling to its resting strength
                  or changing cards, which wants an ease and no hurry.
                */
                transition={{
                  duration: reduced ? 0 : beat >= INTRO.recede ? 0.8 : DISSOLVE,
                  ease: beat >= INTRO.recede ? [0.4, 0, 0.2, 1] : "linear",
                }}
              />
            </AnimatePresence>
          </div>

          {/* The opening. Sits over the wave and under nothing — the deck is
              not mounted yet while this is on screen. */}
          <AnimatePresence>
            {beat < INTRO.done && (
              <motion.div
                key="intro"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-6"
                initial={false}
                animate={
                  beat >= INTRO.recede
                    ? { opacity: 0, scale: 0.85, filter: "blur(14px)" }
                    : { opacity: 1, scale: 1, filter: "blur(0px)" }
                }
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduced ? 0 : 0.9,
                  ease: [0.4, 0, 0.6, 1],
                }}
              >
                {/*
                  The mark, painted rather than drawn.

                  The file is a fixed #F4F2F0, which disappears on a light
                  theme; used as a mask instead, the colour is whatever
                  `--foreground` is, so the same asset works in both. Swapping
                  in the animated logo later means changing this one URL.
                */}
                <motion.span
                  className="bg-foreground size-28 sm:size-36"
                  style={{
                    maskImage: "url(/icons/Nexus-logo-white.svg)",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                    maskSize: "contain",
                    WebkitMaskImage: "url(/icons/Nexus-logo-white.svg)",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    WebkitMaskSize: "contain",
                  }}
                  /*
                   * `layout` is what keeps the mark from jumping.
                   *
                   * The name mounting into this column re-centres it, which
                   * moves the mark up by half the name's height — a layout
                   * change, and layout changes are instant. Motion measures
                   * before and after and animates the difference, so the mark
                   * rises into its new place on the same beat the name fades
                   * up into the space it just left.
                   */
                  layout
                  initial={reduced ? false : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: reduced ? 0 : 0.75,
                    ease: [0.16, 1, 0.3, 1],
                    /* Its own timing: the entrance is a slow settle, the rise
                       should keep pace with the name arriving under it. */
                    layout: {
                      duration: reduced ? 0 : 0.55,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }}
                />

                {/* The name, held back until the mark has had its two seconds. */}
                <AnimatePresence>
                  {beat >= INTRO.wordIn && (
                    <motion.p
                      key="word"
                      className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl"
                      /* Comes up from below its resting place rather than
                         appearing in it, so the pair reads as one movement. */
                      initial={reduced ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduced ? 0 : 0.55,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {/*
                        Two spans, one word. Both arrive at the same low
                        opacity and only "us" comes up to full — the emphasis
                        is the point, and it cannot be made with one element.
                      */}
                      <span className="opacity-40">Nex</span>
                      <motion.span
                        initial={false}
                        animate={{ opacity: beat >= INTRO.usIn ? 1 : 0.4 }}
                        transition={{
                          duration: reduced ? 0 : 0.5,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                      >
                        us
                      </motion.span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
          {/*
            Mounted on its beat rather than merely faded in.

            ScrollStack measures the viewport when it mounts and pins its own
            runway to it; mounting it behind a transparent layer means it
            measures while nothing can be seen, which is fine, but it also means
            it starts its scroll-driven work during the opening. Holding the
            mount until the opening is nearly over keeps the two out of each
            other's way, and is why the entrance below is on a wrapper rather
            than on the component.
          */}
          {beat >= INTRO.deck && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0 : 0.7,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute inset-0"
            >
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
                      {...(step.key === "pay"
                        ? {
                            /*
                              Paying is names, so the card shows names: a line
                              of workspace handles drifting past a scanner, each
                              resolving out of the key it stands in for. The
                              direction is the argument — code becomes a
                              readable name, never the other way round.
                            */
                            backdrop: (
                              <div className="absolute inset-0">
                                <ScannerCardStream
                                  cards={HANDLE_CARDS}
                                  /* A third in rather than the middle. The
                                     cards resolve on the side they have
                                     crossed to, so this gives two thirds of
                                     the strip to readable names and a third to
                                     the code they came out of — which is the
                                     ratio the sentence is making. */
                                  beamAt={1 / 3}
                                  /* Rewinds when this card is reached, so it
                                     is always entered at its opening rather
                                     than wherever it drifted to while somebody
                                     read the two cards before it. */
                                  active={index === 2}
                                  reduced={Boolean(reduced)}
                                  className="h-full w-full"
                                />
                              </div>
                            ),
                          }
                        : {})}
                      {...(step.key === "welcome"
                        ? {
                            /*
                              The four people the presets are named for, in six
                              seconds.

                              Cut from the same clips the preset picker plays,
                              so the first thing you see and the question three
                              screens later are the same faces — the welcome is
                              introducing them rather than showing stock. The
                              loop closes on the frame it opens on, so it can
                              run under the title indefinitely without a seam.
                              The still stays as the poster, for the moment
                              before the video has arrived.
                            */
                            backdrop: (
                              <div className="absolute inset-0">
                                <Clip
                                  src="/first-run/welcome.mp4"
                                  poster={step.image}
                                />
                              </div>
                            ),
                          }
                        : {})}
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
                    onShuffle={() =>
                      setHandle(suggestHandle(taken, Math.random()))
                    }
                    /* The card asks the question, so the card can answer it.
                       The footer's Finish is still there and still works; this
                       is the one under the thing you just typed, which is
                       where a hand already is. */
                    onFinish={finish}
                  />
                </ScrollStack>
              </div>
            </motion.div>
          )}

          {/* Last in, and from below: the controls are the invitation to move
              on, so they should arrive after there is something to move on
              from. */}
          {beat >= INTRO.footer && (
            <motion.div
              /*
                A rise, not a slide.
                
                It used to come up a full `100%` — its own height — on the same
                expo curve the mark and the cards use. That curve is nearly
                vertical at the start, so the opacity it was also driving hit
                full almost at once and the bar arrived rather than appeared.
                
                Now the two are separated: a short travel on a gentle ease-out,
                and a longer, linear fade over the top of it. Linear because an
                eased opacity spends most of its time near one end or the other,
                which is the opposite of gracefully.
              */
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0 : 0.85,
                ease: [0.22, 0.61, 0.36, 1],
                opacity: {
                  duration: reduced ? 0 : 1.1,
                  ease: "linear",
                },
              }}
            >
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
  onFinish,
}: {
  value: string;
  verdict: ReturnType<typeof checkHandle>;
  onChange: (next: string) => void;
  onShuffle: () => void;
  onFinish: () => void;
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

        {/* Only once the name is actually free. Disabled rather than hidden, so
            the way out of this card is in the same place whether or not what
            has been typed will do — a button that appears when you get it right
            is a button nobody was looking for while getting it wrong. */}
        <button
          type="button"
          onClick={onFinish}
          disabled={verdict !== "ok"}
          className="focus-ring border-foreground text-foreground hover:bg-foreground hover:text-background rounded-full border px-6 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          {content.firstRun.finish}
        </button>
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

      {/* Filled while there are cards left, outlined on the last one.

          The accent is what says "keep going"; the end of the run is not more
          of the same and should not shout the same way. `border-foreground`
          rather than black or white literally, so it is near-black on a light
          theme and white on a dark one without either being written down. */}
      <button
        type="button"
        onClick={onNext}
        disabled={last && !canFinish}
        className={`focus-ring relative rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 ${
          last
            ? "border-foreground text-foreground hover:bg-foreground hover:text-background border"
            : "bg-accent text-accent-foreground hover:opacity-90"
        }`}
      >
        {last ? copy.finish : copy.next}
      </button>
    </div>
  );
}
