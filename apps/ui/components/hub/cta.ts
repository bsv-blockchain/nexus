/**
 * Shared primary-CTA styling, reused across the app cards, the permission
 * sheet, the profile manager and the app contextual columns.
 *
 * Deliberately monochrome rather than branded. This used to be a fixed blue
 * gradient, which meant every custom theme had one button in it that belonged
 * to a different product. `--foreground` on `--background` inverts with the
 * theme on its own — near-black on near-white in a light theme, the reverse in
 * a dark one — so the pairing with the most contrast the palette can offer is
 * also the one that always reads as the primary action.
 */
export const PRIMARY_CTA =
  "bg-foreground text-background shadow-sm transition-all duration-200 hover:bg-foreground/90 active:bg-foreground/80";
