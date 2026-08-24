"use client";

/**
 * Home — what the window opens on when the Timeline is not there to open on it.
 *
 * The Timeline answers "what has happened since I last looked". This answers a
 * different question, and the one somebody opening a browser at nine in the
 * morning is usually asking: what am I doing today. So it is not a feed with
 * the posts taken out — it is a photograph, a clock, one line about the day,
 * and the three things that turn that line into an afternoon.
 *
 * Shaped after Momentum, which has been the answer to this for a decade:
 * full-bleed landscape, the time in the middle, the goal under it, a quote at
 * the foot. What is taken from the Timeline is the FRAME rather than the
 * content — the same three columns, so switching between them does not move
 * the furniture.
 *
 *   left     the workspace's own column, unchanged, rendered by LibraryPanel
 *   centre   the photograph and the day
 *   right    the tasks, the note and the timer
 *
 * The photograph is the one the Getting Started page uses. Deliberately: a home
 * screen and a welcome screen are the two places this product says hello, and
 * two different landscapes would be two different products saying it.
 */

import { useWalletAccountId } from "@/components/apps/wallet/use-wallet-account";
import { AppHelpBar } from "@/components/hub/app-help-bar";
import { useHub } from "@/components/hub/hub-provider";
import { content, getChatThreads, getUnreadCount } from "@/lib/data";
import { usd } from "@/lib/wallet";
import { usePortfolio } from "@/lib/wallet-live";
import { getWallet, labelOf, useWallets } from "@/lib/wallets-store";
import {
  addTask,
  BREAK_SECONDS,
  FOCUS_SECONDS,
  clearGoal,
  goalFor,
  pauseTimer,
  removeTask,
  resetTimer,
  setGoal,
  setNote,
  setTimerMode,
  startTimer,
  tickTimer,
  toggleGoal,
  toggleTask,
  today,
  useHome,
} from "@/lib/home-store";
import { useReducedMotion } from "@/lib/motion";
import { profileFor, useProfiles } from "@/lib/profiles-store";
import { activeHandleFor, useSettings } from "@/lib/settings-store";
import { motion } from "motion/react";
import { Check, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const copy = content.home;

/** The photograph, and the reason it is this one — see the note at the top. */
const BACKDROP = "/images/ricardo-gomez-angel-58uZCE8zrdk-unsplash.jpg";

/**
 * A clock that is a clock.
 *
 * Ticks on the minute rather than the second: the figure is 72px of the screen
 * and a digit changing every second in the corner of the eye is a thing to
 * watch instead of a thing to know the time by. Aligned to the next minute on
 * mount rather than every sixty seconds from whenever the component happened to
 * mount, so it turns over when the minute does.
 */
function useNow(): Date {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const set = (): void => setNow(new Date());
    set();
    const toMinute = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      set();
      interval = setInterval(set, 60_000);
    }, toMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  /* Null until the first effect, because the server has no clock the client
     will agree with and a hydration mismatch on the largest text on the page is
     the one place it is guaranteed to be seen. */
  return now ?? new Date(0);
}

function greeting(hour: number): string {
  if (hour < 12) return copy.morning;
  if (hour < 18) return copy.afternoon;
  return copy.evening;
}

/**
 * The two figures in the corner.
 *
 * Momentum puts the weather and a step count here. Neither is a thing this app
 * knows, and a screen whose rule is "one true line about your day" cannot open
 * with an invented 12°. These are the two numbers somebody glancing at a home
 * screen actually wants: how much is waiting for them, and how much they have.
 *
 * Both are buttons, because a figure you cannot act on is decoration — the
 * count opens Messages and the balance opens Payments.
 */
function Corner(): ReactNode {
  const { openApp } = useHub();
  useWallets();
  const accountId = useWalletAccountId();
  const { total } = usePortfolio(accountId);
  const wallet = getWallet(accountId);

  const unread = getChatThreads().reduce(
    (sum, thread) => sum + getUnreadCount(thread.id),
    0,
  );

  return (
    <div className="absolute top-6 right-7 flex items-start gap-7 text-white">
      {unread > 0 && (
        <button
          type="button"
          onClick={() => openApp("messages")}
          aria-label={copy.openMessages}
          className="focus-ring rounded-lg text-right transition-opacity hover:opacity-80"
        >
          <span className="block text-2xl font-semibold tabular-nums drop-shadow-md">
            {unread}
          </span>
          <span className="block text-xs drop-shadow-md">{copy.unread}</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => openApp("wallet")}
        aria-label={copy.openWallet}
        className="focus-ring rounded-lg text-right transition-opacity hover:opacity-80"
      >
        <span className="block text-2xl font-semibold tabular-nums drop-shadow-md">
          {usd(total)}
        </span>
        <span className="block text-xs drop-shadow-md">
          {wallet
            ? copy.balance.replace("{wallet}", labelOf(wallet))
            : copy.balanceNone}
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ centre */

function Stage(): ReactNode {
  const now = useNow();
  /* Subscribed, not read: `goalFor` and `activeHandleFor` both reach into
     module state, so without these the greeting and the goal would keep
     whatever they were rendered with. */
  useHome();
  useSettings();
  const profiles = useProfiles();
  const { activeSpaceId } = useHub();
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState("");
  const ready = now.getTime() > 0;

  const day = today(now);
  const { goal, done } = goalFor(day);

  /* The name to say hello to. The workspace's profile first, because that is
     who this workspace IS; the handle as a fallback, because a workspace with
     no profile still has a name people reach it by. */
  const person = profileFor(profiles, activeSpaceId);
  const handle = activeHandleFor(activeSpaceId);
  const name = person.name.split(" ")[0] || handle || "";

  /* One a day rather than one a load: a quote that changes every time you open
     a tab is decoration, and one that lasts the day is something you can end up
     agreeing with. */
  const quote =
    copy.quotes[
      Math.abs(
        [...day].reduce((sum, char) => sum + char.charCodeAt(0), 0),
      ) % copy.quotes.length
    ]!;

  return (
    <div className="relative h-full overflow-hidden rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BACKDROP}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/*
        Two washes rather than one, because the text and the picture want
        opposite things.

        A single even scrim dark enough for white type over a noon sky flattens
        the photograph into a grey rectangle. So: a gentle vertical gradient for
        the corners, where the small text sits — and a soft ellipse behind the
        middle, which is the only part that has to carry 72px of white over
        cloud and snow. The mountains stay mountains and the clock stays
        readable, which one layer could not do.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/55"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 50% 45%, rgba(0,0,0,0.55), rgba(0,0,0,0.28) 55%, transparent 78%)",
        }}
      />

      <Corner />

      <div className="relative flex h-full flex-col items-center justify-center px-8 text-center text-white">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <p className="text-6xl font-semibold tracking-tight tabular-nums drop-shadow-lg sm:text-7xl">
            {ready
              ? now.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"}
          </p>
          <p className="mt-2 text-lg font-medium drop-shadow-md sm:text-xl">
            {ready
              ? `${greeting(now.getHours())}${name ? `, ${name}` : ""}.`
              : ""}
          </p>
        </motion.div>

        {/* The day's one line. An input while it is empty and a sentence once it
            is not — the same row either way, so answering it does not move the
            screen under the answer. */}
        <div className="mt-10 w-full max-w-lg">
          {goal ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleGoal}
                aria-pressed={done}
                aria-label={copy.goalDone}
                className="focus-ring grid size-6 shrink-0 place-items-center rounded-md border-2 border-white/70 transition-colors hover:border-white"
              >
                {done && <Check className="size-4" aria-hidden="true" />}
              </button>
              <p
                className={`text-2xl font-medium drop-shadow-md ${done ? "text-white/60 line-through" : ""}`}
              >
                {goal}
              </p>
              <button
                type="button"
                onClick={clearGoal}
                aria-label={copy.goalClear}
                title={copy.goalClear}
                className="focus-ring shrink-0 rounded-md p-1 text-white/60 transition-colors hover:text-white"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.trim()) return;
                setGoal(draft, day);
                setDraft("");
              }}
            >
              <label
                htmlFor="home-goal"
                className="block text-xl font-medium drop-shadow-md"
              >
                {copy.goalAsk}
              </label>
              <input
                id="home-goal"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                /* No placeholder. The label above is the question, and a
                   greyed-out example inside the field would be a second one. */
                className="mt-4 w-full border-b border-white/50 bg-transparent pb-2 text-center text-xl text-white outline-none transition-colors focus:border-white"
              />
            </form>
          )}
        </div>

        <p className="absolute inset-x-8 bottom-8 text-sm italic drop-shadow-md">
          “{quote}”
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- right */

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <section className="bg-surface rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tasks(): ReactNode {
  const { tasks } = useHome();
  const [draft, setDraft] = useState("");
  const left = tasks.filter((task) => !task.done).length;

  return (
    <Card
      title={copy.tasks}
      action={
        <span className="text-muted-foreground text-xs tabular-nums">
          {copy.tasksLeft.replace("{n}", String(left))}
        </span>
      }
    >
      <ul className="space-y-0.5">
        {tasks.map((task) => (
          <li key={task.id} className="group flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleTask(task.id)}
              aria-pressed={task.done}
              aria-label={task.text}
              className={`focus-ring grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                task.done
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border hover:border-foreground/50"
              }`}
            >
              {task.done && (
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              )}
            </button>
            <span
              className={`min-w-0 flex-1 py-1 text-[13px] ${
                task.done ? "text-muted-foreground line-through" : ""
              }`}
            >
              {task.text}
            </span>
            {/* Only on the row under the pointer. A column of crosses beside a
                list of things to do reads as a list of things to delete. */}
            <button
              type="button"
              onClick={() => removeTask(task.id)}
              aria-label={`${copy.taskRemove} ${task.text}`}
              className="focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-2 flex items-center gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          addTask(draft);
          setDraft("");
        }}
      >
        <Plus
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.taskNew}
          aria-label={copy.taskNew}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none"
        />
      </form>
    </Card>
  );
}

function Note(): ReactNode {
  const { note } = useHome();
  return (
    <Card title={copy.note}>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={copy.notePlaceholder}
        aria-label={copy.note}
        rows={5}
        className="placeholder:text-muted-foreground w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none"
      />
    </Card>
  );
}

/** The ring, drawn as one stroke that empties anticlockwise as time goes. */
function Ring({ fraction }: { fraction: number }): ReactNode {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" className="size-32" aria-hidden="true">
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-border"
      />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        className="text-accent"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 64 64)"
      />
    </svg>
  );
}

function Timer(): ReactNode {
  const { timerLeft, timerRunning, timerMode } = useHome();

  /*
   * Counted here rather than in the store.
   *
   * A store that runs its own interval keeps counting in a workspace nobody is
   * looking at, and keeps a timer alive after the screen holding it is gone.
   * The view that shows the number is the thing that should be moving it.
   */
  useEffect(() => {
    if (!timerRunning) return;
    /* `tickTimer` is a module function, not a prop, so there is nothing to keep
       fresh — the interval can call it straight. */
    const id = setInterval(tickTimer, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const whole = timerMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const mins = Math.floor(timerLeft / 60);
  const secs = timerLeft % 60;

  return (
    <Card title={copy.focus}>
      <div className="flex flex-col items-center">
        <div className="bg-muted flex rounded-full p-0.5 text-[11px] font-semibold">
          {(["focus", "break"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTimerMode(mode)}
              aria-pressed={timerMode === mode}
              className={`focus-ring rounded-full px-3 py-1 transition-colors ${
                timerMode === mode
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "focus" ? copy.focusMode : copy.breakMode}
            </button>
          ))}
        </div>

        <div className="relative mt-3 grid place-items-center">
          <Ring fraction={timerLeft / whole} />
          <p className="absolute text-2xl font-semibold tabular-nums">
            {mins}:{String(secs).padStart(2, "0")}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={timerRunning ? pauseTimer : startTimer}
            className="focus-ring bg-accent text-accent-foreground flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-opacity hover:opacity-90"
          >
            {timerRunning ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" aria-hidden="true" />
            )}
            {timerRunning ? copy.pause : copy.start}
          </button>
          <button
            type="button"
            onClick={resetTimer}
            aria-label={copy.reset}
            title={copy.reset}
            className="focus-ring border-border text-muted-foreground hover:text-foreground rounded-full border p-1.5 transition-colors"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------- page */

export function HomeApp(): ReactNode {
  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <div className="min-h-0 min-w-0 flex-1">
        <Stage />
      </div>
      {/* The same right-hand column the Timeline has, at the same width, so the
          two screens are the same screen with a different middle. */}
      <aside className="hidden w-80 shrink-0 flex-col gap-2 overflow-y-auto lg:flex">
        <Tasks />
        <Timer />
        <Note />
        <div className="mt-auto">
          <AppHelpBar slug="timeline" />
        </div>
      </aside>
    </div>
  );
}
