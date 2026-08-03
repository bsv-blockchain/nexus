import type { ChatThread } from "@/lib/data";

/**
 * The picture a room is currently wearing.
 *
 * The seeded icon is what the room shipped with; the override is what the user
 * did about it in settings. An override of `null` is a removal and has to win,
 * or a room could never go back to its member mosaic once given an emblem —
 * which is why "no entry" and "entry set to null" are different answers here.
 */
export function groupIconOf(
  thread: Pick<ChatThread, "id" | "group"> | undefined,
  overrides: Record<string, string | null>,
): string | undefined {
  if (!thread?.group) return undefined;
  const override = overrides[thread.id];
  if (override !== undefined) return override ?? undefined;
  return thread.group.icon;
}
