"use client";

/**
 * The home screen's own state: one goal, a few tasks, a note, a timer.
 *
 * Persisted, unlike almost everything else in this prototype. The rest of the
 * stores are demo preference and a refresh putting them back is the right
 * behaviour — but a daily goal that forgets itself when you open a new window
 * is not a daily goal, it is a placeholder. Same reasoning as
 * {@link file://./first-run.ts}, and the same `nexus.` key convention.
 *
 * The goal carries the day it was set. A goal is a thing you write in the
 * morning and answer to in the evening, so one left over from Tuesday is not a
 * goal you failed, it is a goal that expired — and the screen should ask again
 * rather than show you somebody else's Tuesday.
 */

import { useSyncExternalStore } from "react";

export interface HomeTask {
  id: string;
  text: string;
  done: boolean;
}

export interface HomeState {
  /** what today is for, in the person's own words */
  goal: string;
  /** whether the goal has been struck through */
  goalDone: boolean;
  /** the day the goal was written, as YYYY-MM-DD */
  goalDay: string;
  tasks: HomeTask[];
  note: string;
  /** seconds left on the timer, counted down by whoever is showing it */
  timerLeft: number;
  timerRunning: boolean;
  timerMode: "focus" | "break";
  /**
   * Focus blocks finished today, and the day they were finished on.
   *
   * Kept with a date for the same reason the goal is: four sessions is a good
   * Tuesday and a meaningless number on Wednesday morning.
   */
  sessions: number;
  sessionsDay: string;
  /**
   * Whether the balance in the corner is readable.
   *
   * A home screen is the one screen somebody else is most likely to be looking
   * at over a shoulder, and it is the only screen in this app that shows money
   * without being asked. Off hides the figure and keeps the button.
   */
  showBalance: boolean;
  /**
   * A quote somebody chose, per workspace, where they chose one.
   *
   * Absent means the workspace keeps the line its own id draws — see
   * `quoteFor`. Only a press of the refresh writes here, so the map stays empty
   * for anybody who never disagreed with what they were given.
   */
  quoteBySpace: Record<string, number>;
  /**
   * Which cards in the column are shut, by card id.
   *
   * Absent means open, so the default state is written nowhere and a card added
   * later arrives open without anything having to say so.
   */
  collapsed: Record<string, boolean>;
}

/** Twenty-five minutes on, five off, which is the shape everybody means. */
export const FOCUS_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

const KEY = "nexus.home";

const INITIAL: HomeState = {
  goal: "",
  goalDone: false,
  goalDay: "",
  tasks: [
    { id: "t-1", text: "Read the BRC-100 section four", done: true },
    { id: "t-2", text: "Reply to Aurora about the invoice", done: false },
    { id: "t-3", text: "Move last quarter into cold storage", done: false },
  ],
  note: "",
  timerLeft: FOCUS_SECONDS,
  timerRunning: false,
  timerMode: "focus",
  sessions: 0,
  sessionsDay: "",
  showBalance: true,
  quoteBySpace: {},
  collapsed: {},
};

/** Local, not UTC: "today" is the day where the person is, not at Greenwich. */
export function today(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function read(): HomeState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return INITIAL;
    return { ...INITIAL, ...(JSON.parse(raw) as Partial<HomeState>) };
  } catch {
    /* Storage refused, or a blob this build cannot read. The defaults are
       always a valid answer and a home screen that throws takes the app. */
    return INITIAL;
  }
}

let state: HomeState = read();
const listeners = new Set<() => void>();

function set(patch: Partial<HomeState>): void {
  state = { ...state, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Nothing to do. It will be gone next launch, which is survivable. */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const server = INITIAL;

export function useHome(): HomeState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => server,
  );
}

/** Today's goal, or "" where the one on record belongs to another day. */
export function goalFor(day: string): { goal: string; done: boolean } {
  if (state.goalDay !== day) return { goal: "", done: false };
  return { goal: state.goal, done: state.goalDone };
}

export function setGoal(goal: string, day: string): void {
  set({ goal: goal.trim(), goalDone: false, goalDay: day });
}

export function toggleGoal(): void {
  set({ goalDone: !state.goalDone });
}

export function clearGoal(): void {
  set({ goal: "", goalDone: false, goalDay: "" });
}

export function addTask(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  set({
    tasks: [
      ...state.tasks,
      /* Keyed off the length and the text rather than the clock: two tasks
         added in the same millisecond would otherwise share an id, and the list
         is short enough that this cannot collide in practice. */
      { id: `t-${state.tasks.length}-${trimmed.slice(0, 8)}`, text: trimmed, done: false },
    ],
  });
}

export function toggleTask(id: string): void {
  set({
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task,
    ),
  });
}

export function removeTask(id: string): void {
  set({ tasks: state.tasks.filter((task) => task.id !== id) });
}

export function setNote(note: string): void {
  set({ note });
}

/** Focus blocks finished today, which is zero on any day but the one recorded. */
export function sessionsFor(day: string): number {
  return state.sessionsDay === day ? state.sessions : 0;
}

/**
 * Which line this workspace shows, out of `count`.
 *
 * Drawn from the id rather than stored, so two workspaces differ from the
 * moment they exist and neither has to be written down to stay that way. A
 * hash, not `Math.random()`: random would be a different quote on every render,
 * which is a flicker rather than a workspace's own line.
 */
export function quoteFor(spaceId: string, count: number): number {
  const chosen = state.quoteBySpace[spaceId];
  if (chosen !== undefined) return chosen % count;
  let hash = 0;
  for (const char of spaceId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % count;
}

/**
 * A different one, at random, and never the one already showing.
 *
 * Pressing refresh and getting the same sentence back reads as a broken button,
 * so the current index is taken out of the draw rather than left in it.
 */
export function shuffleQuote(spaceId: string, count: number): void {
  if (count <= 1) return;
  const current = quoteFor(spaceId, count);
  let next = current;
  while (next === current) next = Math.floor(Math.random() * count);
  set({ quoteBySpace: { ...state.quoteBySpace, [spaceId]: next } });
}

export function toggleCard(id: string): void {
  set({ collapsed: { ...state.collapsed, [id]: !state.collapsed[id] } });
}

export function toggleBalance(): void {
  set({ showBalance: !state.showBalance });
}

/** Drops what is finished, so the list is what is left rather than a history. */
export function clearDoneTasks(): void {
  set({ tasks: state.tasks.filter((task) => !task.done) });
}

/* ---- the timer ---------------------------------------------------------- */

export function startTimer(): void {
  set({ timerRunning: true });
}

export function pauseTimer(): void {
  set({ timerRunning: false });
}

/** One second gone. Called by whichever view is on screen, never by itself. */
export function tickTimer(): void {
  if (!state.timerRunning) return;
  if (state.timerLeft > 1) {
    set({ timerLeft: state.timerLeft - 1 });
    return;
  }
  /* Run out: swap sides and stop. Rolling straight into the next block would
     start a break nobody asked for and, worse, start it unwatched. */
  const next = state.timerMode === "focus" ? "break" : "focus";
  /* Only a finished FOCUS block counts. A break you sat through is not work,
     and a counter that rewards both is a counter that means nothing. */
  const finished = state.timerMode === "focus";
  const day = today(new Date());
  set({
    timerMode: next,
    timerLeft: next === "focus" ? FOCUS_SECONDS : BREAK_SECONDS,
    timerRunning: false,
    ...(finished
      ? {
          sessions: (state.sessionsDay === day ? state.sessions : 0) + 1,
          sessionsDay: day,
        }
      : {}),
  });
}

export function setTimerMode(mode: "focus" | "break"): void {
  set({
    timerMode: mode,
    timerLeft: mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS,
    timerRunning: false,
  });
}

export function resetTimer(): void {
  set({
    timerLeft: state.timerMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS,
    timerRunning: false,
  });
}
