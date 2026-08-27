import type { LinkedDevice } from "./types";

/**
 * The other places this identity is signed in.
 *
 * A phone is the device people carry, so it is the one that grants the others:
 * you open the desktop, it shows a code, you point the phone at it. That makes
 * the phone the register of what is linked — which is why this list lives on
 * the phone's settings and the code lives on the desktop's, and not the other
 * way round.
 *
 * `current` is the device you are holding. It cannot be unlinked from itself,
 * and it is listed apart from the rest for the same reason a session list
 * always is: "log out everything else" is a button people press in a hurry, and
 * it must be unmistakable that it will not log out the thing they are pressing.
 */
export const linkedDevices: LinkedDevice[] = [
  {
    id: "dev-phone",
    label: "iPhone 15 Pro",
    platform: "Nexus iOS 2026.0.6",
    place: "Zug, Switzerland",
    lastActiveMinutes: null,
    current: true,
  },
  /*
   * A second phone, and an Android one.
   *
   * Not padding. Payments draws one row per linked phone and the row differs by
   * platform — Apple authenticates every payment and has no threshold to set,
   * Google's has one — so a device list with a single iPhone in it can only
   * ever show half of that screen. Two phones is also just what people have.
   */
  {
    id: "dev-android",
    label: "Pixel 9 Pro",
    platform: "Nexus Android 2026.0.6",
    place: "Zug, Switzerland",
    lastActiveMinutes: 220,
    current: false,
  },
  {
    id: "dev-desktop",
    label: "MacBook Pro",
    platform: "Nexus for macOS 2026.0.6",
    place: "Zug, Switzerland",
    lastActiveMinutes: 95,
    current: false,
  },
  {
    id: "dev-work",
    label: "Nexus Web",
    platform: "Chrome on Windows",
    place: "Amsterdam, Netherlands",
    lastActiveMinutes: 5_400,
    current: false,
  },
];
