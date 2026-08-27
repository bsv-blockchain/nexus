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
 *   left     Focus's own column — the date, what is left, sessions, and the
 *            way into this guide, like every other app's column
 *   centre   the photograph and the day
 *   right    the tasks, the note and the timer
 *
 * The photograph is the one the Getting Started page uses. Deliberately: a home
 * screen and a welcome screen are the two places this product says hello, and
 * two different landscapes would be two different products saying it.
 */

import { useWalletAccountId } from "@/components/apps/wallet/use-wallet-account";
import { DetailPane } from "@/components/hub/detail-pane";
import { NexusSyncPitch } from "@/components/hub/nexus-sync-pitch";
import { FocusSidebar } from "@/components/apps/home/focus-sidebar";
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
  quoteFor,
  shuffleQuote,
  toggleBalance,
  toggleCard,
  toggleGoal,
  toggleTask,
  today,
  useHome,
} from "@/lib/home-store";
import { useMinute } from "@/lib/clock";
import { useReducedMotion } from "@/lib/motion";
import { profileFor, useProfiles } from "@/lib/profiles-store";
import { activeHandleFor, useSettings } from "@/lib/settings-store";
import { motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const copy = content.home;
const syncCopy = content.timeline.rail.sync;

/** The photograph, and the reason it is this one — see the note at the top. */
const BACKDROP = "/images/ricardo-gomez-angel-58uZCE8zrdk-unsplash.jpg";

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
  const { showBalance } = useHome();
  useWallets();
  const accountId = useWalletAccountId();
  const { total } = usePortfolio(accountId);
  const wallet = getWallet(accountId);

  const unread = getChatThreads().reduce(
    (sum, thread) => sum + getUnreadCount(thread.id),
    0,
  );

  return (
    /* `z-10`, because the block that carries the clock is a later sibling that
       fills the whole stage — transparent, and so invisible, but still the
       thing under the pointer everywhere including up here. Without this the
       eye and both figures looked live and were not. */
    <div className="absolute top-6 right-7 z-10 flex items-start gap-7 text-white">
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
      {/*
        The figure and the eye are two controls, not one.

        A home screen is the likeliest screen in this app for somebody else to
        be reading over a shoulder, and the only one that shows money without
        being asked to. Hiding it leaves the row exactly where it was — same
        width, same wallet name underneath — because a balance that disappears
        takes the layout with it and announces that there was something to hide.
      */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => openApp("wallet")}
          aria-label={copy.openWallet}
          className="focus-ring rounded-lg text-right transition-opacity hover:opacity-80"
        >
          <span className="block text-2xl font-semibold tabular-nums drop-shadow-md">
            {showBalance ? usd(total) : "••••"}
          </span>
          <span className="block text-xs drop-shadow-md">
            {wallet
              ? copy.balance.replace("{wallet}", labelOf(wallet))
              : copy.balanceNone}
          </span>
        </button>
        <button
          type="button"
          onClick={toggleBalance}
          aria-pressed={!showBalance}
          aria-label={showBalance ? copy.balanceHide : copy.balanceShow}
          title={showBalance ? copy.balanceHide : copy.balanceShow}
          className="focus-ring mt-1.5 rounded-md p-1 text-white/70 transition-colors hover:text-white"
        >
          {showBalance ? (
            <Eye className="size-4" aria-hidden="true" />
          ) : (
            <EyeOff className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ centre */

function Stage(): ReactNode {
  /* Once a minute, from the one timer the app keeps — see lib/clock. A digit
     changing every second at this size is a thing to watch instead of a thing
     to read the time by. */
  const now = new Date(useMinute());
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

  /* The workspace's own line, not the day's. See `quoteFor` — it is drawn from
     the id, so Work and Personal never open on the same sentence. */
  const quote = copy.quotes[quoteFor(activeSpaceId, copy.quotes.length)]!;

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

        {/* The refresh sits ON the line rather than under it, and only appears
            to a pointer that has found it: a button permanently beside a quote
            is a button competing with the quote. Always present for the
            keyboard, which has no hover to reveal it. */}
        <p className="group absolute inset-x-8 bottom-8 flex items-center justify-center gap-2 text-sm italic drop-shadow-md">
          <span>“{quote}”</span>
          <button
            type="button"
            onClick={() => shuffleQuote(activeSpaceId, copy.quotes.length)}
            aria-label={copy.quoteAnother}
            title={copy.quoteAnother}
            className="focus-ring shrink-0 rounded-md p-1 text-white/70 opacity-0 transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
          >
            <RefreshCcw className="size-3.5" aria-hidden="true" />
          </button>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- right */

function Card({
  id,
  title,
  children,
  action,
  grow = false,
}: {
  /** stable key for whether this card is shut; see `toggleCard` */
  id: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  /**
   * Take whatever height the column has left.
   *
   * For the one card whose content has no natural size. The others are as tall
   * as what is in them — three tasks is three rows — but a note is as long as
   * you want it to be, and a fixed five rows is either a scrollbar over two
   * sentences or a band of empty surface under one.
   */
  grow?: boolean;
}): ReactNode {
  const { collapsed } = useHome();
  const shut = collapsed[id] === true;
  /* A shut card cannot also be the one taking up the slack, or shutting it
     would leave the column with a tall empty header. */
  const filling = grow && !shut;

  return (
    <section
      className={`bg-surface rounded-2xl p-4 ${
        filling ? "flex min-h-40 flex-1 flex-col" : ""
      }`}
    >
      {/*
        The whole heading is the control, not a chevron beside it.

        A 14px target at the end of a row somebody has to aim at is the reason
        collapsible panels feel fiddly; the row is already the width of the card
        and is doing nothing else. `action` stays outside the button so the count
        beside Tasks is readable rather than another thing being pressed.
      */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => toggleCard(id)}
          aria-expanded={!shut}
          className="focus-ring -m-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md p-1 text-left"
        >
          <ChevronDown
            className={`text-muted-foreground size-3.5 shrink-0 transition-transform ${
              shut ? "-rotate-90" : ""
            }`}
            aria-hidden="true"
          />
          <h2 className="min-w-0 flex-1 text-sm font-semibold">{title}</h2>
        </button>
        {action}
      </div>
      {!shut && (
        <div className={`mt-3 ${filling ? "min-h-0 flex-1" : ""}`}>
          {children}
        </div>
      )}
    </section>
  );
}

function Tasks(): ReactNode {
  const { tasks } = useHome();
  const [draft, setDraft] = useState("");
  const left = tasks.filter((task) => !task.done).length;

  return (
    <Card
      id="tasks"
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
    <Card id="note" title={copy.note} grow>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={copy.notePlaceholder}
        aria-label={copy.note}
        /* `h-full` rather than a row count, so the field is the card and the
           card is the space left. `min-h-40` on the card keeps it usable on a
           short window, where the column scrolls instead. */
        className="placeholder:text-muted-foreground h-full w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none"
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
    <Card id="timer" title={copy.timer}>
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
  const { detailPane } = useHub();
  return (
    /*
     * Two columns where there is room for two, one scroll where there is not.
     *
     * This used to be a row with the cards in an `aside` that was `hidden`
     * below `lg` — which on a phone left Focus as a photograph and a text
     * field. Nothing else: no tasks, no timer, no note, and no way to reach
     * the Nexus Sync card whose button lives on it. It is the screen an
     * install with no presets lands on, so it was also the first thing a good
     * half of people saw.
     *
     * Stacked, the photograph keeps most of a phone screen and everything
     * else is a scroll away — which is the order they are in on a desktop too,
     * read left to right instead of top to bottom.
     */
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2 pb-20 md:pb-2 lg:flex-row lg:overflow-hidden">
      {/* A share of the viewport rather than a share of the flex, because in a
          column `flex-1` inside a scroller is however tall the photograph
          feels like being. Two thirds leaves the first card's edge showing,
          which is what says there is more under it. */}
      <div className="h-[66vh] min-h-0 min-w-0 shrink-0 lg:h-auto lg:flex-1 lg:shrink">
        <Stage />
      </div>
      {/*
        The same right-hand column the Timeline has, at the same width, so the
        two screens are the same screen with a different middle — and it gives
        the same slot up to a reference pane for the same reason. The guide
        opened from the left column has to appear somewhere, and a third column
        beside these two would leave the photograph a strip.
      */}
      <aside className="flex min-h-0 shrink-0 flex-col gap-2 lg:w-80 lg:overflow-y-auto">
        {detailPane ? (
          <DetailPane />
        ) : (
          <>
            {/* Focus's contextual column, as a card. On a desktop it is down
                the left-hand side; below `md` there is no such side, and how
                today is going is not a thing to lose because the window is
                narrow. */}
            <div className="lg:hidden">
              <FocusSidebar asCard />
            </div>
            <Tasks />
            <Timer />
            <Note />
            {/* Last, because it is the only card here that is asking for
                something rather than holding something of yours. */}
            <Card id="sync" title={syncCopy.title}>
              <NexusSyncPitch />
            </Card>
          </>
        )}
      </aside>
    </div>
  );
}
