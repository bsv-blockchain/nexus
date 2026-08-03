"use client";

import {
  getEffects,
  getEffectsServerSnapshot,
  subscribeEffects,
} from "@/lib/command-effects";
import { useSyncExternalStore } from "react";

/**
 * Read the effects this session's commands have had. The server snapshot is
 * empty, which keeps hydration stable — a payment made after load is client
 * state, not part of the seeded data.
 */
export function useCommandEffects(): ReturnType<typeof getEffects> {
  return useSyncExternalStore(
    subscribeEffects,
    getEffects,
    getEffectsServerSnapshot,
  );
}
