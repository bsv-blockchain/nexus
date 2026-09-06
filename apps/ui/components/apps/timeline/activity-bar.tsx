"use client";

/**
 * What the Activity strip is, and what it is showing.
 *
 * The other three strips open on a composer; this one opened on rows, with
 * nothing between the tabs and the first event to say whose log it is. That is
 * the one thing an activity feed has to be unambiguous about — it looks exactly
 * like a public timeline and is nothing of the sort — so the line says which
 * half is which rather than a reassuring "private" badge that would also be
 * wrong about the posts.
 *
 * The two filters sit beside it because a log is only useful once you can point
 * it at something: a fortnight, or one app.
 */

import { AppTile } from "@/components/hub/app-icon";
import { useHub } from "@/components/hub/hub-provider";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { content, getHubApp } from "@/lib/data";
import {
  RANGE_MINUTES,
  TIMELINE_SLUG,
  clearActivityApps,
  setActivityRange,
  toggleActivityApp,
  useTimeline,
  type ActivityRange,
} from "@/lib/timeline-store";
import {
  CalendarRange,
  Check,
  ChevronDown,
  LayoutGrid,
  Lock,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { useHostOverlay } from "@/lib/wallet-data";

const copy = content.timeline.activityBar;

const RANGES = Object.keys(RANGE_MINUTES) as ActivityRange[];

export function ActivityBar(): ReactNode {
  const { activityRange, activityApps } = useTimeline();
  const [open, setOpen] = useState<null | "range" | "apps">(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  /* Holds the shell's page layer down while this is up: a browsed page is a
     native view that paints above this document, so no z-index reaches over
     it. See lib/wallet-data. */
  useHostOverlay(open !== null);

  const show = (kind: "range" | "apps", rect: DOMRect): void => {
    setAnchor(rect);
    setOpen(kind);
  };

  return (
    /* The composer's height, because this replaces it: the tab row must not
       move when you cross between strips, or the tabs themselves appear to
       jump. */
    <div className="border-border/60 flex min-h-[104px] flex-col justify-center gap-2 border-b px-4 py-3">
      <p className="text-xs text-pretty">
        <Lock
          className="text-muted-foreground mr-1 inline size-3 align-[-0.1em]"
          aria-hidden="true"
        />
        <span className="font-semibold">{copy.privateNote}</span>
        <span className="text-muted-foreground">{copy.publicNote}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Chip
          icon={<CalendarRange className="size-3.5" aria-hidden="true" />}
          label={copy.ranges[activityRange]}
          on={activityRange !== "all"}
          onOpen={(rect) => show("range", rect)}
        />
        <Chip
          icon={<LayoutGrid className="size-3.5" aria-hidden="true" />}
          label={
            activityApps.length === 0
              ? copy.apps
              : activityApps.length === 1
                ? copy.appsOne
                : copy.appsSome.replace("{count}", String(activityApps.length))
          }
          on={activityApps.length > 0}
          onOpen={(rect) => show("apps", rect)}
        />
      </div>

      <AnimatePresence>
        {open && anchor && (
          <Popover
            key={open}
            anchor={anchor}
            onClose={() => setOpen(null)}
            label={open === "range" ? copy.rangeLabel : copy.appsLabel}
          >
            {open === "range" ? (
              <RangeList onPick={() => setOpen(null)} />
            ) : (
              <AppList />
            )}
          </Popover>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({
  icon,
  label,
  on,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  on: boolean;
  onOpen: (rect: DOMRect) => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => onOpen(event.currentTarget.getBoundingClientRect())}
      className={`focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        on
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
    </button>
  );
}

function Popover({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: DOMRect;
  label: string;
  onClose: () => void;
  children: ReactNode;
}): ReactNode {
  const isDesktop = useIsDesktop();
  const width = 260;
  const pos = {
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
    top: anchor.bottom + 8,
  };
  const frame =
    "z-80 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";

  return (
    <>
      <motion.button
        type="button"
        aria-label={copy.clear}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-75 ${isDesktop ? "cursor-default" : "bg-black/40"}`}
      />
      <motion.div
        role="dialog"
        aria-label={label}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(isDesktop ? { style: { ...pos, width } } : {})}
        className={
          isDesktop
            ? `fixed rounded-2xl p-1.5 ${frame}`
            : `fixed inset-x-0 bottom-0 max-h-[70vh] rounded-t-3xl p-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${frame}`
        }
      >
        {children}
      </motion.div>
    </>
  );
}

function RangeList({ onPick }: { onPick: () => void }): ReactNode {
  const { activityRange } = useTimeline();
  return (
    <div role="radiogroup" aria-label={copy.rangeLabel}>
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          role="radio"
          aria-checked={activityRange === range}
          onClick={() => {
            setActivityRange(range);
            onPick();
          }}
          className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm"
        >
          <span
            aria-hidden="true"
            className={`grid size-4 shrink-0 place-items-center rounded-full ring-1 transition-colors ${
              activityRange === range ? "bg-accent ring-accent" : "ring-border"
            }`}
          >
            {activityRange === range && (
              <span className="size-1.5 rounded-full bg-white" />
            )}
          </span>
          {copy.ranges[range]}
        </button>
      ))}
    </div>
  );
}

function AppList(): ReactNode {
  const { activityApps } = useTimeline();
  const { installedApps } = useHub();
  const [query, setQuery] = useState("");

  const apps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return installedApps
      .flatMap((slug) => {
        const app = getHubApp(slug);
        return app ? [app] : [];
      })
      .filter((app) => app.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [installedApps, query]);

  const all = activityApps.length === 0;

  return (
    <div>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Search
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.appsSearch}
          aria-label={copy.appsSearch}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {/* "All" is the absence of a filter rather than every box ticked, so
            choosing it clears rather than selects — and a workspace that
            connects a new app tomorrow is included without being told. */}
        <Row label={copy.appsAll} checked={all} onToggle={clearActivityApps} />
        {/* Above the connected apps rather than sorted among them: it is the
            canvas you are standing on, not one of the things plugged into it. */}
        {copy.appsTimeline
          .toLowerCase()
          .includes(query.trim().toLowerCase()) && (
          <Row
            label={copy.appsTimeline}
            icon={
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/icons/Nexus-logo-solid-BG2.png"
                alt=""
                aria-hidden="true"
                width={18}
                height={18}
                className="size-[18px] shrink-0 rounded-[22%]"
              />
            }
            checked={all || activityApps.includes(TIMELINE_SLUG)}
            dimmed={all}
            onToggle={() => toggleActivityApp(TIMELINE_SLUG)}
          />
        )}
        {apps.length === 0 ? (
          <p className="text-muted-foreground px-2.5 py-3 text-xs">
            {copy.appsNoMatch}
          </p>
        ) : (
          apps.map((app) => (
            <Row
              key={app.slug}
              label={app.name}
              icon={<AppTile app={app} size={18} />}
              checked={all || activityApps.includes(app.slug)}
              dimmed={all}
              onToggle={() => toggleActivityApp(app.slug)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  checked,
  dimmed = false,
  onToggle,
}: {
  label: string;
  icon?: ReactNode;
  checked: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left"
    >
      <span
        aria-hidden="true"
        className={`grid size-4 shrink-0 place-items-center rounded ring-1 transition-colors ${
          checked
            ? "bg-accent text-accent-foreground ring-accent"
            : "ring-border"
        } ${dimmed ? "opacity-50" : ""}`}
      >
        {checked && <Check className="size-3" />}
      </span>
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
    </button>
  );
}
