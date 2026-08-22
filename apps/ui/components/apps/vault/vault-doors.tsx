"use client";

/**
 * The vault, as a door that actually opens.
 *
 * Two leaves filling the whole canvas rather than a card sitting in the middle
 * of it. A 560px vault door on a 1400px screen is a picture of a vault; this is
 * the door of the room you are standing in, which is the only version where
 * parting it feels like getting in.
 *
 * The face is drawn once and duplicated: each leaf is a 50%-tall clipping box
 * holding a FULL-SIZE copy, so the engraved rings and the frame line up across
 * the seam instead of being two halves kept in step by hand. Everything that
 * must NOT be duplicated — the bolt-work along each inner edge, and the wheel —
 * is drawn per leaf or as a single overlay above both.
 *
 * Opening is two events and both are on screen: the wheel turns and the bolts
 * withdraw, then the leaves tilt back into the dark and travel apart. The
 * previous build ran the second one straight into an unmount, so the doors were
 * wound up and then teleported.
 *
 * All three unlock methods are mocked. QR and the security key resolve on a
 * timer: there is no second device and no authenticator, and a button that says
 * "pretend it worked" would be worse than a wait that behaves like the real one.
 */

import { QrBlock } from "@/components/hub/qr-block";
import { JumpingDots } from "@/components/hub/jumping-dots";
import { content } from "@/lib/data";
import { useHub } from "@/components/hub/hub-provider";
import { useSecurity } from "@/lib/security-store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import {
  backToChooser,
  beginMethod,
  checking,
  chooseMethod,
  closeChooser,
  deny,
  lock,
  opened,
  openChooser,
  parting,
  settle,
  unlocking,
  useVault,
  type UnlockMethod,
} from "@/lib/vault-store";
import {
  ArrowLeft,
  Hash,
  KeyRound,
  Lock,
  QrCode,
  ScanLine,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const copy = content.vault.lock;

/** How long a check appears to take. Long enough to read, short enough to sit through. */
const CHECK_MS = 650;
/** The wheel's turn and the bolts' withdrawal, before anything travels. */
const SPIN_MS = 900;
/** The leaves' travel. */
const PART_MS = 1500;
/** The shake, and how long a refusal is left on screen before the panel rests. */
const SHAKE_MS = 450;
/** How long the mocked second device and security key take to answer. */
const REMOTE_MS = 2600;
/** Bolts per leaf edge, counting the gaps the other leaf's bolts drop into. */
const BOLT_COUNT = 11;

/**
 * The door's material.
 *
 * Fixed steel rather than theme tokens, and that is deliberate. Mixing these
 * from `--foreground` read correctly in a stylesheet and wrong on screen: in
 * the dark theme the foreground is near-white, so "steel dark" came out pale
 * and the whole door washed to silver with the wheel invisible on it.
 *
 * A vault door is an object, not a surface. It is the same steel in a lit room
 * as in a dark one — what the theme is allowed to change is the room around it
 * and the light the wheel picks up, which is where `--accent` does the work of
 * belonging to this product.
 */
const STEEL_DEEP = "#14171a";
const STEEL_DARK = "#23282d";
const STEEL_MID = "#3b4148";
const STEEL_LIGHT = "#666f79";
const STEEL_EDGE = "#8a939d";

const METHODS: { id: UnlockMethod; icon: typeof QrCode }[] = [
  { id: "password", icon: KeyRound },
  { id: "qr", icon: QrCode },
  { id: "security-key", icon: ScanLine },
  { id: "otp", icon: Hash },
];

export function VaultDoors(): ReactNode {
  const { phase, step, method, message } = useVault();
  const security = useSecurity();
  const isDesktop = useIsDesktop();
  const releasing = phase === "unlocking" || phase === "parting";
  const moving = phase === "parting";

  /* Every timer this component starts, so none of them outlive it. */
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    []
  );

  const accept = useCallback((): void => {
    unlocking();
    later(parting, SPIN_MS);
    later(opened, SPIN_MS + PART_MS);
  }, [later]);

  const refuse = useCallback(
    (reason: string): void => {
      deny(reason);
      later(settle, SHAKE_MS);
    },
    [later]
  );

  /*
   * The door offers exactly what Security has registered.
   *
   * Not a fixed list of three: a key you removed or codes you turned off would
   * still be on the door, and choosing one would be a dead end. QR carries an
   * extra condition — it moves the proof onto a second device, and on a phone
   * this IS the second device, so there is nowhere for it to go.
   */
  const methods = METHODS.filter((entry) => {
    if (entry.id === "password") return security.passphraseSet;
    if (entry.id === "qr") return isDesktop && security.phones.length > 0;
    if (entry.id === "security-key") return security.keys.length > 0;
    return security.otpOn;
  });

  /* If the chosen one was switched off while the chooser was shut, land on
     something that exists rather than opening an empty panel. */
  const active = methods.some((entry) => entry.id === method)
    ? method
    : (methods[0]?.id ?? "password");

  /*
   * QR and the security key answer on their own.
   *
   * Keyed on the panel being up rather than on a button, because neither of
   * these is a thing you press — you point a camera at one and touch the other,
   * and the screen's job in both cases is to wait convincingly. Leaving the
   * panel clears the timer, so a cancelled scan cannot open the vault a second
   * later.
   */
  useEffect(() => {
    if (step !== "method") return;
    if (active === "password" || active === "otp") return;
    if (phase !== "locked") return;
    const id = window.setTimeout(() => {
      checking();
      window.setTimeout(accept, CHECK_MS);
    }, REMOTE_MS);
    return () => window.clearTimeout(id);
  }, [step, active, phase, accept]);

  return (
    <div
      className="absolute inset-0 z-30 overflow-hidden select-none"
      /* The leaves tilt back into the room as they go, which needs a camera.
         Set on the container so both share one vanishing point — per-element
         perspective would give each its own and they would splay apart. */
      style={{ perspective: 1600, perspectiveOrigin: "50% 50%" }}
    >
      <Interior />

      <DoorLeaf half="top" moving={moving} releasing={releasing} />
      <DoorLeaf half="bottom" moving={moving} releasing={releasing} />

      {/* The wheel: one object over both leaves, so it is never cut in half by
          the seam and can turn as a whole. It is also the way in. */}
      <Wheel
        releasing={releasing}
        moving={moving}
        onOpen={openChooser}
        idle={step === "shut" && phase === "locked"}
      />

      {/* Everything you press, over the doors and gone once they release. */}
      <div
        className={`absolute inset-0 z-40 grid place-items-center px-6 ${
          phase === "denied" ? "vault-shake" : ""
        }`}
        style={{
          opacity: releasing ? 0 : 1,
          transform: releasing ? "scale(.94)" : "scale(1)",
          pointerEvents: releasing || step === "shut" ? "none" : "auto",
          transition: "opacity 300ms ease, transform 300ms ease",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === "chooser" ? (
            <Panel key="chooser">
              {methods.length === 0 ? (
                <NoMethods />
              ) : (
                <Chooser methods={methods} selected={active} />
              )}
            </Panel>
          ) : step === "method" ? (
            <Panel key={`method-${active}`}>
              <Method
                method={active}
                phase={phase}
                message={message}
                onAccept={accept}
                onRefuse={refuse}
                later={later}
              />
            </Panel>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- door --- */

/**
 * One leaf.
 *
 * The wrapper clips to half the height and holds a face of twice that, offset,
 * so both leaves draw the same artwork. The travel is on the wrapper: a tilt
 * back about the outer edge and a slide past it, so the leaf reads as swinging
 * away into the dark rather than as a rectangle sliding off a screen.
 */
function DoorLeaf({
  half,
  moving,
  releasing,
}: {
  half: "top" | "bottom";
  moving: boolean;
  releasing: boolean;
}): ReactNode {
  const isTop = half === "top";
  return (
    <div
      className="vault-door absolute left-0 z-10 h-1/2 w-full overflow-hidden"
      style={{
        top: isTop ? 0 : "50%",
        transformOrigin: isTop ? "50% 0%" : "50% 100%",
        transform: moving
          ? `translateY(${isTop ? "-102%" : "102%"}) rotateX(${
              isTop ? "-38deg" : "38deg"
            }) scale(0.96)`
          : "translateY(0) rotateX(0deg) scale(1)",
        opacity: moving ? 0 : 1,
        /* The travel leads and the fade trails, so the leaf is still solid
           through the part you are meant to watch. */
        transition: `transform ${PART_MS}ms cubic-bezier(.7,0,.2,1), opacity ${Math.round(PART_MS * 0.45)}ms linear ${Math.round(PART_MS * 0.55)}ms`,
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
      }}
    >
      <div
        className="absolute left-0 w-full"
        style={{ height: "200%", top: isTop ? 0 : "-100%" }}
      >
        <DoorFace />
      </div>

      {/*
        The bolt-work, per leaf rather than in the shared face.

        This is the detail that makes a slab of metal read as a vault: two rows
        of throw-bolts meshing along the seam. They cannot live in the
        duplicated face — that would draw one row twice and cut every bolt in
        half — so each leaf carries its own, offset from the other so the two
        interlock. They withdraw the moment the wheel finishes and before
        anything travels, which is the order the real thing does it in.
      */}
      <BoltRow isTop={isTop} released={releasing} />

      {/* The lit inner edge. A door this thick catches light on the face it
          presents to the seam, and without it the two leaves read as one sheet
          with a line drawn across it. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 h-px"
        style={{
          [isTop ? "bottom" : "top"]: 0,
          background: `linear-gradient(90deg, transparent, ${STEEL_EDGE}, transparent)`,
          opacity: 0.55,
        }}
      />
    </div>
  );
}

/** The shared artwork: steel, jamb, engraved rings. */
function DoorFace(): ReactNode {
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `
          radial-gradient(120% 80% at 30% 18%, rgba(255,255,255,.13), transparent 60%),
          linear-gradient(112deg, ${STEEL_DEEP} 0%, ${STEEL_MID} 34%, ${STEEL_LIGHT} 50%, ${STEEL_MID} 66%, ${STEEL_DEEP} 100%)
        `,
      }}
    >
      {/* brushed grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(93deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px)",
        }}
      />

      {/* The jamb: heavy outer frame, then the channel, then the slab. Three
          steps rather than one border, because thickness is the whole
          difference between a vault door and a grey rectangle. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ boxShadow: `inset 0 0 0 14px ${STEEL_DEEP}` }}
      />
      <div
        aria-hidden="true"
        className="absolute rounded-[28px]"
        style={{
          inset: 22,
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,.10), inset 0 2px 0 rgba(255,255,255,.06), 0 0 40px rgba(0,0,0,.5)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute rounded-[22px]"
        style={{
          inset: 40,
          background:
            "radial-gradient(120% 90% at 35% 20%, rgba(255,255,255,.07), transparent 55%)",
          boxShadow:
            "inset 0 0 90px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.06)",
        }}
      />

      {/* Engraved rings, concentric with the wheel. Turned circles are what a
          vault door has instead of decoration. */}
      {[560, 440, 340].map((size, index) => (
        <div
          key={size}
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            border: `1px solid rgba(255,255,255,${0.05 + index * 0.015})`,
            boxShadow: "inset 0 1px 0 rgba(0,0,0,.4)",
          }}
        />
      ))}

      <Rivets />

      {/* A vignette, so the centre of the door is the brightest thing on it and
          the eye lands on the wheel rather than on a corner. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 50%, transparent 40%, rgba(0,0,0,.45) 100%)",
        }}
      />
    </div>
  );
}

/** Frame fixings, down both sides of the jamb. */
function Rivets(): ReactNode {
  return (
    <>
      {[6, 20, 34, 48, 62, 76, 90].map((y) =>
        [0, 1].map((side) => (
          <span
            key={`${side}-${y}`}
            aria-hidden="true"
            className="absolute size-2.5 rounded-full"
            style={{
              [side === 0 ? "left" : "right"]: 5,
              top: `${y}%`,
              marginTop: -5,
              background: `radial-gradient(circle at 34% 28%, ${STEEL_EDGE}, ${STEEL_DEEP} 70%)`,
              boxShadow:
                "0 1px 2px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.06)",
            }}
          />
        ))
      )}
    </>
  );
}

/** Throw-bolts along one leaf's inner edge. */
function BoltRow({
  isTop,
  released,
}: {
  isTop: boolean;
  released: boolean;
}): ReactNode {
  /* Offset between the rows, so the two leaves' bolts sit in each other's gaps
     rather than nose to nose. */
  const offset = isTop ? 0 : 1;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute h-10 overflow-hidden"
      /* Inside the slab, not across the jamb: the frame is the part of a vault
         door that does not move, and a bolt lying over it reads as loose
         hardware. Insetting also stops the last one running off the edge. */
      style={{ left: 56, right: 56, [isTop ? "bottom" : "top"]: 0 }}
    >
      {/* The channel the bolts run in. Without it they read as blocks resting
          on the door rather than as steel coming out of it. */}
      <span
        className="absolute inset-x-0 h-3.5"
        style={{
          [isTop ? "bottom" : "top"]: 0,
          background: isTop
            ? "linear-gradient(0deg, rgba(0,0,0,.6), transparent)"
            : "linear-gradient(180deg, rgba(0,0,0,.6), transparent)",
        }}
      />
      {Array.from({ length: BOLT_COUNT }, (_, index) =>
        (index + offset) % 2 === 0 ? (
          <span
            key={index}
            className="absolute h-8 min-w-[34px] rounded-[3px]"
            style={{
              left: `${(index * 100) / BOLT_COUNT + 1.4}%`,
              width: `${100 / BOLT_COUNT - 2.8}%`,
              /* Overhanging the leaf's inner edge, so the two rows mesh across
                 the seam instead of hovering a few pixels short of it. The
                 wrapper clips the overhang, which is what makes each bolt look
                 like it continues into the other leaf. */
              [isTop ? "bottom" : "top"]: -14,
              background: `linear-gradient(${isTop ? "180deg" : "0deg"}, ${STEEL_MID}, ${STEEL_LIGHT} 55%, ${STEEL_DARK})`,
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 1px rgba(0,0,0,.45), 0 3px 6px rgba(0,0,0,.7)",
              /* Withdrawn into the leaf, not shrunk: a bolt that got smaller
                 would read as the door shrinking. */
              transform: released
                ? `translateY(${isTop ? "-30px" : "30px"})`
                : "translateY(0)",
              transition: `transform ${Math.round(SPIN_MS * 0.6)}ms cubic-bezier(.5,0,.2,1) ${Math.round(SPIN_MS * 0.35)}ms`,
            }}
          />
        ) : null
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- wheel --- */

/**
 * The handwheel, and the way in.
 *
 * The button IS the wheel rather than a pill floating over it. A vault has
 * exactly one control on the outside and everybody already knows what it does;
 * putting a rounded rectangle on top of it was covering an affordance with a
 * picture of an affordance. The label is stencilled onto the door beneath it,
 * where a real one is painted.
 */
function Wheel({
  releasing,
  moving,
  idle,
  onOpen,
}: {
  releasing: boolean;
  moving: boolean;
  idle: boolean;
  onOpen: () => void;
}): ReactNode {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
      style={{
        transform: releasing ? "rotate(232deg)" : "rotate(0deg)",
        opacity: moving ? 0 : 1,
        transition: `transform ${SPIN_MS}ms cubic-bezier(.45,0,.15,1), opacity ${Math.round(PART_MS * 0.3)}ms linear`,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!idle}
        aria-label={copy.openAction}
        className="group focus-ring pointer-events-auto relative grid size-[210px] place-items-center rounded-full transition-transform duration-300 enabled:hover:scale-[1.03] enabled:active:scale-[0.99]"
        style={{
          background: `radial-gradient(circle at 34% 26%, ${STEEL_LIGHT}, ${STEEL_DEEP} 74%)`,
          boxShadow:
            "0 18px 46px rgba(0,0,0,.65), inset 0 3px 8px rgba(255,255,255,.14), inset 0 -6px 14px rgba(0,0,0,.6)",
        }}
      >
        {/* Knurled rim. Conic rather than a border image, so the teeth stay
            crisp at any size and turn with the wheel. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full opacity-70"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, rgba(255,255,255,.10) 0deg 1.6deg, transparent 1.6deg 3.2deg)",
            maskImage:
              "radial-gradient(circle, transparent 86%, #000 87%, #000 100%)",
            WebkitMaskImage:
              "radial-gradient(circle, transparent 86%, #000 87%, #000 100%)",
          }}
        />
        {/* The ring that answers the pointer. The one place `--accent` touches
            the door, so the steel stays steel and the product still shows. */}
        <span
          aria-hidden="true"
          className="ring-accent/0 group-enabled:group-hover:ring-accent/70 absolute inset-1 rounded-full ring-2 transition-colors duration-300"
        />
        <span
          aria-hidden="true"
          className="absolute inset-5 rounded-full"
          style={{ border: "1px dashed rgba(255,255,255,.16)" }}
        />

        {/* Spokes: four bars, eight arms. */}
        {[0, 45, 90, 135].map((deg) => (
          <span
            key={deg}
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              left: "50%",
              top: "50%",
              width: 168,
              height: 13,
              marginLeft: -84,
              marginTop: -6.5,
              background: `linear-gradient(90deg, ${STEEL_DEEP}, ${STEEL_EDGE} 50%, ${STEEL_DEEP})`,
              boxShadow:
                "0 2px 4px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.18)",
              transform: `rotate(${deg}deg)`,
            }}
          />
        ))}

        {/* The hub, carrying the glyph. */}
        <span
          aria-hidden="true"
          className="relative grid size-[74px] place-items-center rounded-full"
          style={{
            background: `radial-gradient(circle at 34% 28%, ${STEEL_LIGHT}, ${STEEL_DEEP} 72%)`,
            boxShadow:
              "inset 0 2px 5px rgba(255,255,255,.18), inset 0 -4px 10px rgba(0,0,0,.7), 0 4px 10px rgba(0,0,0,.6)",
          }}
        >
          <Lock className="size-6 text-white/70" />
        </span>
      </button>

      {/* Stencilled onto the door under the wheel. Outside the button's round
          box but inside its meaning — the wheel already carries the label as
          its accessible name, so this is the visible half of one control. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 mt-[132px] text-[11px] font-semibold tracking-[0.42em] uppercase"
        style={{
          color: "rgba(255,255,255,.32)",
          textShadow: "0 1px 0 rgba(0,0,0,.85)",
          opacity: idle ? 1 : 0,
          transition: "opacity 250ms",
        }}
      >
        {copy.openAction}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- panels --- */

/** The frosted card every unlock step sits on. */
function Panel({ children }: { children: ReactNode }): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="w-[min(370px,92%)] rounded-2xl bg-black/80 p-5 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
    >
      {children}
    </motion.div>
  );
}

function Chooser({
  methods,
  selected,
}: {
  methods: typeof METHODS;
  selected: UnlockMethod;
}): ReactNode {
  return (
    <div className="text-white">
      <h2 className="text-base font-bold">{copy.chooseTitle}</h2>
      <p className="mt-1 text-xs text-white/60">{copy.chooseBody}</p>

      {/* One block holding all three: the options are alternatives to each
          other, and a gap between them would read as three separate offers. */}
      <div
        role="radiogroup"
        aria-label={copy.chooseTitle}
        className="mt-4 overflow-hidden rounded-xl bg-white/[0.06]"
      >
        {methods.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected === id}
            onClick={() => chooseMethod(id)}
            className="focus-ring flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span
              aria-hidden="true"
              className={`grid size-5 shrink-0 place-items-center rounded-full transition-colors ${
                selected === id ? "bg-accent" : "bg-white/20"
              }`}
            >
              {selected === id && (
                <span className="size-1.5 rounded-full bg-white" />
              )}
            </span>
            <Icon
              className="size-5 shrink-0 text-white/70"
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{copy.methods[id]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={closeChooser}
          className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          onClick={beginMethod}
          className="focus-ring bg-accent text-accent-foreground rounded-full px-5 py-2 text-sm font-bold transition-opacity hover:opacity-90"
        >
          {copy.continueAction}
        </button>
      </div>
    </div>
  );
}

function Method({
  method,
  phase,
  message,
  onAccept,
  onRefuse,
  later,
}: {
  method: UnlockMethod;
  phase: string;
  message: string;
  onAccept: () => void;
  onRefuse: (reason: string) => void;
  later: (fn: () => void, ms: number) => void;
}): ReactNode {
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");
  const busy = phase === "checking";

  /*
   * Six digits, and nothing about which six.
   *
   * There is no authenticator on the other end, so checking the value would
   * mean printing the answer on the screen beside the box — which is the one
   * thing the real flow never does. The shape is the part worth honouring.
   */
  const submitCode = (): void => {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      onRefuse(copy.otpBadCode);
      return;
    }
    checking();
    later(onAccept, CHECK_MS);
  };

  const submit = (): void => {
    if (busy) return;
    /*
     * Any passphrase opens it.
     *
     * There is nothing sealed behind this door and no secret worth printing on
     * the screen in front of it, so the only refusal that means anything is an
     * empty box. The shake stays: it is what tells you the button was pressed
     * and the answer was no.
     */
    if (pass.trim() === "") {
      onRefuse(copy.needPassphrase);
      return;
    }
    checking();
    later(onAccept, CHECK_MS);
  };

  return (
    <div className="text-white">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={backToChooser}
          aria-label={copy.back}
          className="focus-ring -ml-1 rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold">
          {method === "password"
            ? copy.passwordTitle
            : method === "qr"
              ? copy.qrTitle
              : method === "otp"
                ? copy.otpTitle
                : copy.keyTitle}
        </h2>
      </div>

      <p className="mt-1 text-xs text-pretty text-white/60">
        {method === "password"
          ? copy.passwordBody
          : method === "qr"
            ? copy.qrBody
            : method === "otp"
              ? copy.otpBody
              : copy.keyBody}
      </p>

      {method === "password" ? (
        <>
          <input
            autoFocus
            type="password"
            value={pass}
            disabled={busy}
            onChange={(event) => setPass(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submit()}
            placeholder={copy.passwordPlaceholder}
            aria-label={copy.passwordLabel}
            className="focus:ring-accent mt-4 w-full rounded-lg bg-black/50 px-3.5 py-2.5 text-center text-base tracking-[0.3em] text-white ring-1 ring-white/15 outline-none focus:ring-2 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="focus-ring bg-accent text-accent-foreground mt-3 grid h-10 w-full place-items-center rounded-lg text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <JumpingDots label={copy.verifying} /> : copy.unlockAction}
          </button>
        </>
      ) : method === "otp" ? (
        <>
          <input
            autoFocus
            inputMode="numeric"
            value={code}
            disabled={busy}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(event) => event.key === "Enter" && submitCode()}
            placeholder="000000"
            aria-label={copy.otpLabel}
            className="focus:ring-accent mt-4 w-full rounded-lg bg-black/50 px-3.5 py-2.5 text-center font-mono text-xl tracking-[0.45em] text-white ring-1 ring-white/15 outline-none focus:ring-2 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submitCode}
            disabled={busy}
            className="focus-ring bg-accent text-accent-foreground mt-3 grid h-10 w-full place-items-center rounded-lg text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <JumpingDots label={copy.verifying} /> : copy.unlockAction}
          </button>
        </>
      ) : method === "qr" ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <QrBlock
            value="nexus-vault-unlock"
            label={copy.qrTitle}
            className="size-40"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-white ring-4 ring-white">
              <Lock className="size-4 text-black" aria-hidden="true" />
            </span>
          </QrBlock>
          <Waiting label={busy ? copy.verifying : copy.qrWaiting} />
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-4 pb-1">
          {/* The key, drawn rather than photographed: a picture of one
              manufacturer's dongle tells somebody holding a different one that
              theirs is the wrong thing. */}
          <span
            aria-hidden="true"
            className="bg-accent relative grid h-11 w-20 place-items-center rounded-lg"
          >
            <span className="size-4 rounded-full bg-black/80" />
            <span className="bg-accent absolute top-1/2 -right-2 h-5 w-3 -translate-y-1/2 rounded-r-sm" />
          </span>
          <Waiting label={busy ? copy.verifying : copy.keyWaiting} />
        </div>
      )}

      {/* Reserved whether or not it is filled, so a refusal does not resize the
          card it appears in. */}
      <p
        className={`mt-3 min-h-4 text-center text-xs ${
          message ? "text-[var(--negative)]" : "text-transparent"
        }`}
      >
        {message || "·"}
      </p>
    </div>
  );
}

/**
 * A vault with nothing switched on.
 *
 * Reachable only by turning every factor off in Settings, which is a thing
 * somebody can do — so the door says what happened and where it was decided,
 * rather than showing an empty list of ways in.
 */
function NoMethods(): ReactNode {
  const { setMainView, setSettingsCategory } = useHub();
  return (
    <div className="text-white">
      <h2 className="text-base font-bold">{copy.chooseTitle}</h2>
      <p className="mt-1 text-xs text-pretty text-white/60">{copy.noMethods}</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={closeChooser}
          className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          onClick={() => {
            setSettingsCategory("security");
            setMainView("settings");
          }}
          className="focus-ring bg-accent text-accent-foreground rounded-full px-5 py-2 text-sm font-bold transition-opacity hover:opacity-90"
        >
          {copy.openSecurity}
        </button>
      </div>
    </div>
  );
}

/** The two methods you cannot press: dots, and what they are waiting for. */
function Waiting({ label }: { label: string }): ReactNode {
  return (
    <span className="flex items-center gap-2 text-xs text-white/60">
      <JumpingDots className="text-white/70" />
      {label}
    </span>
  );
}

/**
 * What is behind the doors while they travel.
 *
 * The app's own background rather than a lit chamber, because the contents land
 * on it a moment later and a coloured interior would flash and then be replaced.
 * The one thing it carries is the fall-off down the walls, which is what gives
 * the parting leaves something to have been standing in front of.
 */
function Interior(): ReactNode {
  return (
    <div
      aria-hidden="true"
      className="bg-background absolute inset-0 z-0"
      style={{ boxShadow: "inset 0 0 120px 40px rgba(0,0,0,.55)" }}
    />
  );
}

/** Shut it again, from the open vault's header. */
export function SealButton(): ReactNode {
  return (
    <button
      type="button"
      onClick={lock}
      className="focus-ring border-border hover:bg-surface-hover flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold"
    >
      <Lock className="size-4" aria-hidden="true" />
      {copy.sealAction}
    </button>
  );
}
