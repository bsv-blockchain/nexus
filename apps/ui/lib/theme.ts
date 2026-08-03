/**
 * Custom UI theming from a solid colour or a 2–3 colour gradient.
 *
 * A theme is 1–3 hex stops. We derive a full design-token palette from those
 * stops: the average stop's luminance decides whether the UI runs light (dark
 * text) or dark (light text) for maximum contrast, and every surface/foreground
 * token is mixed from the theme's hue. The raw stops also form a gradient that
 * paints the app backdrop. Pure functions — safe for SSR and the React compiler.
 */

export interface CustomTheme {
  id: string;
  name: string;
  /** 1 stop = solid, 2–3 stops = gradient */
  colors: string[];
}

/** Design-token overrides applied as CSS custom properties on the shell. */
export interface ThemePalette {
  background: string;
  foreground: string;
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
  accent: string;
  accentForeground: string;
  /** CSS background value for the app backdrop (solid or linear-gradient) */
  gradient: string;
  /** true when the theme is dark enough to warrant light text */
  dark: boolean;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): RGB {
  const h = hex.replace("#", "").trim();
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(s.slice(0, 2), 16) || 0,
    g: parseInt(s.slice(2, 4), 16) || 0,
    b: parseInt(s.slice(4, 6), 16) || 0,
  };
}

function toHex({ r, g, b }: RGB): string {
  return (
    "#" +
    [r, g, b].map((x) => clamp255(x).toString(16).padStart(2, "0")).join("")
  );
}

/** Linear blend from `a` to `b` by `t` (0–1). */
function mix(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

function averageColor(colors: string[]): string {
  const sum = colors.reduce(
    (acc, c) => {
      const { r, g, b } = parseHex(c);
      return { r: acc.r + r, g: acc.g + g, b: acc.b + b };
    },
    { r: 0, g: 0, b: 0 },
  );
  const n = colors.length || 1;
  return toHex({ r: sum.r / n, g: sum.g / n, b: sum.b / n });
}

/** WCAG relative luminance (0–1). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const f = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Best-contrast text colour (near-black or white) for a given background. */
export function contrastText(hex: string): string {
  return luminance(hex) > 0.5 ? "#161022" : "#ffffff";
}

/** WCAG contrast ratio between two colours (1–21). */
function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A background this ink has to stay readable on, and the ratio it owes there.
 *
 * Two targets rather than one, because the two kinds of background are not the
 * same job. Body copy sits on the opaque panels and is held to AAA. The same ink
 * also labels the transparent rail, where the raw gradient shows through — a UI
 * label, held to AA. Demanding AAA on the gradient too is unsatisfiable for most
 * saturated mid-lightness colours and would rule out half the colour wheel.
 */
interface Constraint {
  bg: string;
  target: number;
}

/** How far `color` falls short of its worst constraint (≥ 0 means all met). */
function shortfall(color: string, cs: Constraint[]): number {
  return cs.reduce(
    (min, c) => Math.min(min, contrastRatio(color, c.bg) - c.target),
    Infinity,
  );
}

/**
 * Nudge `color` toward black or white by the smallest amount that satisfies
 * *every* constraint at once, keeping as much of the original hue as legibility
 * allows.
 *
 * Correcting against one background at a time was the bug here: a light surface
 * pushes text darker, a dark one pushes it lighter, and applied in sequence the
 * last correction silently undid the first. Body text ended up near-white on a
 * near-white surface — 2.1:1 — across most of the wheel. Both directions are
 * tried against the whole set instead, and the smaller correction wins.
 *
 * When neither direction can satisfy everything, the closest attempt is
 * returned and `paletteContrast` reports the shortfall, so the picker can refuse
 * the colour rather than ship a theme that cannot render its own text.
 */
function ensureAgainst(color: string, cs: Constraint[]): string {
  if (shortfall(color, cs) >= 0) return color;

  let best = color;
  let bestScore = shortfall(color, cs);
  let bestBlend = Infinity;

  for (const toward of ["#000000", "#ffffff"]) {
    let lo = 0;
    let hi = 1;
    let found: string | null = null;
    for (let i = 0; i < 16; i += 1) {
      const t = (lo + hi) / 2;
      const c = mix(color, toward, t);
      if (shortfall(c, cs) >= 0) {
        found = c;
        hi = t;
      } else {
        lo = t;
      }
    }
    if (found) {
      if (hi < bestBlend) {
        best = found;
        bestBlend = hi;
      }
      continue;
    }
    if (bestBlend === Infinity) {
      const score = shortfall(toward, cs);
      if (score > bestScore) {
        best = toward;
        bestScore = score;
      }
    }
  }
  return best;
}

/** Shorthand for "meet `target` on all of `bgs`". */
function on(bgs: string[], target: number): Constraint[] {
  return bgs.map((bg) => ({ bg, target }));
}

/*
 * Luminance a text-bearing panel has to stay within for a single ink to be
 * legible on all of them.
 *
 * Derived, not chosen: white (luminance 1) clears 7:1 against anything at or
 * below 0.10, and the near-black ink (0.0116) clears it against anything at or
 * above 0.40. Keeping every panel inside its band means the palette cannot
 * produce unreadable body text, whatever the theme colour.
 */
const PANEL_MAX_DARK = 0.1;
const PANEL_MIN_LIGHT = 0.4;

/**
 * Push a panel toward the mode's paper colour until it is dark enough (or light
 * enough) for the mode's ink, keeping as much of the theme's hue as that allows.
 *
 * This is where the reported "colours with not quite enough text contrast" came
 * from. `surfaceRaised` mixed only 24% toward the dark paper, so a bright but
 * technically dark-mode theme — a strong olive, say — left the raised panel at
 * luminance 0.18 with white text on it: 4.6:1, well short of the AAA the rest of
 * the palette holds. The colour was never the problem; the surface derivation
 * was, and no amount of correcting the *ink* can fix a panel in the middle of
 * the range.
 */
function settlePanel(color: string, paper: string, dark: boolean): string {
  const inBand = (hex: string): boolean =>
    dark
      ? luminance(hex) <= PANEL_MAX_DARK
      : luminance(hex) >= PANEL_MIN_LIGHT;
  if (inBand(color)) return color;

  let lo = 0;
  let hi = 1;
  let best = paper;
  for (let i = 0; i < 16; i += 1) {
    const t = (lo + hi) / 2;
    const c = mix(color, paper, t);
    if (inBand(c)) {
      best = c;
      hi = t;
    } else {
      lo = t;
    }
  }
  return best;
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// On the opaque panels: body copy is pushed to AAA so it clearly outranks
// muted, and muted plus accent-as-link hold AA for small text.
const BODY_CONTRAST = 7;
const MUTED_CONTRAST = 4.5;
const ACCENT_CONTRAST = 4.5;

// On the raw gradient behind the transparent rail, the same inks label
// navigation rather than setting prose, so both are held to AA-large. A vivid
// backdrop cannot also be a AAA text surface, and demanding that it is would
// rule out a quarter of the colour wheel for the sake of two rail labels.
// Body copy is unaffected: it sits on the panels, which are settled into a band
// that guarantees AAA regardless of the theme.
const BODY_ON_GRADIENT = 3;
const MUTED_ON_GRADIENT = 3;

/** CSS background value for the given stops. */
export function themeGradient(colors: string[]): string {
  if (colors.length <= 1) return colors[0] ?? "#4353ff";
  return `linear-gradient(140deg, ${colors.join(", ")})`;
}

/**
 * Normalise any theme (1–3 stops) to exactly three gradient stops so the
 * app backdrop can interpolate between themes (CSS only crossfades gradients
 * that share the same stop count). Rendering is visually identical to
 * `themeGradient`: a solid repeats its colour; a 2-stop pair gets its exact
 * linear midpoint inserted, which leaves the gradient unchanged.
 */
export function gradientStops(colors: string[]): [string, string, string] {
  const s = colors.length ? colors : ["#4353ff"];
  const a = s[0] ?? "#4353ff";
  const b = s[1] ?? a;
  const c = s[2] ?? b;
  if (s.length === 1) return [a, a, a];
  if (s.length === 2) return [a, mix(a, b, 0.5), b];
  return [a, b, c];
}

/**
 * Derive a full token palette from a theme's colour stops.
 *
 * Legibility-first: text-bearing surfaces are opaque tints (the gradient stays
 * on the rail/backdrop/accents), and every text/accent token is force-corrected
 * to meet WCAG contrast — including against the raw gradient behind the
 * transparent rail (`base`), which is what otherwise washed out inactive text.
 */
export function derivePalette(colors: string[]): ThemePalette {
  const stops = colors.length ? colors : ["#4353ff"];
  const base = averageColor(stops);
  const rep = stops[Math.floor((stops.length - 1) / 2)] ?? base;
  const dark = luminance(base) < 0.45;
  const gradient = themeGradient(stops);

  // Opaque surface tints (mix the theme hue toward the mode's paper colour),
  // each then settled into the band its ink can actually be read on.
  const paper = dark ? "#0b0810" : "#ffffff";
  const tint = (t: number, towards = paper): string =>
    settlePanel(mix(base, towards, t), paper, dark);
  const background = dark ? tint(0.58) : tint(0.62, "#ffffff");
  const surface = dark ? tint(0.42) : tint(0.86, "#ffffff");
  const surfaceRaised = dark ? tint(0.24, "#17121f") : tint(0.95, "#ffffff");

  // Panels text sits on, plus the raw gradient that shows through the
  // transparent rail and the page margins — held to its own, lower target.
  const panels = [surface, surfaceRaised, background];

  const foreground = ensureAgainst(contrastText(background), [
    ...on(panels, BODY_CONTRAST),
    { bg: base, target: BODY_ON_GRADIENT },
  ]);
  // Start muted as a blend, then force it legible on every surface it lands on.
  const mutedForeground = ensureAgainst(mix(foreground, surface, 0.45), [
    ...on([surface, background], MUTED_CONTRAST),
    { bg: base, target: MUTED_ON_GRADIENT },
  ]);
  // Accent doubles as link text, so it must contrast the surfaces too.
  const accent = ensureAgainst(rep, on([surface, background], ACCENT_CONTRAST));

  return {
    background,
    foreground,
    surface,
    surfaceRaised,
    surfaceHover: rgba(dark ? "#ffffff" : foreground, dark ? 0.07 : 0.06),
    muted: dark ? mix(base, paper, 0.3) : mix(base, "#ffffff", 0.6),
    mutedForeground,
    border: rgba(dark ? "#ffffff" : foreground, dark ? 0.1 : 0.12),
    ring: accent,
    accent,
    accentForeground: contrastText(accent),
    gradient,
    dark,
  };
}

/**
 * How legible a set of stops actually is, once the palette has been derived.
 *
 * Reported rather than assumed. Some colours cannot produce a readable UI at
 * all: a mid-lightness, fully saturated stop sits close enough to the mode
 * boundary that its tinted surfaces and the raw gradient behind the rail pull
 * text in opposite directions, and no single ink satisfies both. The picker uses
 * this to keep the pointer out of those bands instead of letting you choose a
 * theme that renders its own text unreadable.
 */
export interface PaletteContrast {
  /** how far the worst ink is from the ratio it owes; ≥ 0 means every ink passes */
  headroom: number;
  /** worst body-text ratio on the opaque panels */
  body: number;
  /** worst secondary-text ratio on the opaque panels */
  muted: number;
  /** worst accent-as-link ratio */
  accent: number;
  /** body-text ratio against the raw gradient behind the rail */
  onGradient: number;
  /** true when every ink clears its target */
  legible: boolean;
}

export function paletteContrast(colors: string[]): PaletteContrast {
  const stops = colors.length ? colors : ["#4353ff"];
  const p = derivePalette(stops);
  const base = averageColor(stops);
  const panels = [p.surface, p.surfaceRaised, p.background];

  const bodyGap = shortfall(p.foreground, [
    ...on(panels, BODY_CONTRAST),
    { bg: base, target: BODY_ON_GRADIENT },
  ]);
  const mutedGap = shortfall(p.mutedForeground, [
    ...on([p.surface, p.background], MUTED_CONTRAST),
    { bg: base, target: MUTED_ON_GRADIENT },
  ]);
  const accentGap = shortfall(
    p.accent,
    on([p.surface, p.background], ACCENT_CONTRAST),
  );
  const headroom = Math.min(bodyGap, mutedGap, accentGap);

  return {
    headroom,
    body: Math.min(...panels.map((bg) => contrastRatio(p.foreground, bg))),
    muted: Math.min(
      contrastRatio(p.mutedForeground, p.surface),
      contrastRatio(p.mutedForeground, p.background),
    ),
    accent: Math.min(
      contrastRatio(p.accent, p.surface),
      contrastRatio(p.accent, p.background),
    ),
    onGradient: contrastRatio(p.foreground, base),
    legible: headroom >= 0,
  };
}

/** Map a palette to the CSS custom properties used by globals.css tokens. */
export function paletteVars(p: ThemePalette): Record<string, string> {
  return {
    "--background": p.background,
    "--foreground": p.foreground,
    "--surface": p.surface,
    "--surface-raised": p.surfaceRaised,
    "--surface-hover": p.surfaceHover,
    "--muted": p.muted,
    "--muted-foreground": p.mutedForeground,
    "--border": p.border,
    "--ring": p.ring,
    "--accent": p.accent,
    "--accent-foreground": p.accentForeground,
  };
}
