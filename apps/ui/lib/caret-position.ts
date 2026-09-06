/**
 * Where the caret sits inside a textarea, in pixels from its top.
 *
 * A textarea will not say. It reports a character index and nothing about where
 * that index landed once the text wrapped, so the only way to find out is to lay
 * the same text out again somewhere you can measure — a mirror div with the
 * field's own metrics copied onto it, the text up to the caret inside it, and a
 * marker at the end. The marker's offset is the answer.
 *
 * Used to hang the mention and command lists under the line being typed rather
 * than under the bottom of the box, which on a three-row composer is most of a
 * paragraph away from where you are looking.
 */

/**
 * The properties that decide where a character lands.
 *
 * Copied rather than inherited: the mirror is a detached div, so anything not
 * named here falls back to the page default and the mirror wraps at a different
 * column than the field it is imitating.
 */
const MIRRORED = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textIndent",
  "textTransform",
  "wordSpacing",
  "textRendering",
] as const;

/**
 * The top of the line the caret is on, relative to the field's padding box.
 *
 * Already adjusted for scrolling, so it is a number you can hand straight to a
 * `top` on something positioned against the field.
 */
export function caretLineTop(field: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(field);
  const mirror = document.createElement("div");

  for (const property of MIRRORED) {
    mirror.style[property] = style[property];
  }
  /* Off-screen rather than `display: none`, which measures as zero. */
  mirror.style.position = "absolute";
  mirror.style.top = "-9999px";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  /* The two that make a div wrap the way a textarea does. */
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";

  const caret = field.selectionStart ?? field.value.length;
  mirror.textContent = field.value.slice(0, caret);

  /* A zero-width marker, so it sits on the caret's own line even when the caret
     is at the very end of a line that is about to wrap. */
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  document.body.removeChild(mirror);

  return top - field.scrollTop;
}

/** The height of one line, for offsetting below the caret rather than onto it. */
export function lineHeightOf(field: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(field);
  const parsed = Number.parseFloat(style.lineHeight);
  /* `normal` parses to NaN. 1.2em is what browsers use for it. */
  return Number.isNaN(parsed)
    ? Number.parseFloat(style.fontSize) * 1.2
    : parsed;
}
