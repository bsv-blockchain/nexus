"use client";

import {
  content,
  getDefaultRepositories,
  suggestedRepositories,
  type AppRepository,
} from "@/lib/data";
import { storageKeys } from "@/lib/config";
import { Check, Plus, Settings, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = (): void => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

function readRepositories(): AppRepository[] {
  const defaults = getDefaultRepositories();
  try {
    const raw = window.localStorage.getItem(storageKeys.repositories);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as AppRepository[];
    // Official repos are always present even if an older payload omitted them.
    const savedIds = new Set(saved.map((r) => r.id));
    const missingOfficial = defaults.filter(
      (r) => r.official && !savedIds.has(r.id),
    );
    return [...missingOfficial, ...saved];
  } catch {
    return defaults;
  }
}

function writeRepositories(repos: AppRepository[]): void {
  try {
    window.localStorage.setItem(
      storageKeys.repositories,
      JSON.stringify(repos),
    );
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

// A dotted hostname (e.g. apps.example.com) or bare localhost. The URL
// constructor alone is too lax — it happily accepts "https://!!!".
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.hostname !== "localhost" && !HOSTNAME.test(url.hostname)) {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Trigger position + viewport, captured at click (avoids render-time reads). */
interface Anchor {
  left: number;
  top: number;
  vw: number;
  vh: number;
}

function RepositoriesSheet({
  anchor,
  onClose,
}: {
  anchor: Anchor | null;
  onClose: () => void;
}): ReactNode {
  const copy = content.repositories;
  const isDesktop = useIsDesktop();
  const [repos, setRepos] = useState<AppRepository[]>(() => readRepositories());
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [commonSource, setCommonSource] = useState(false);

  useEffect(() => {
    writeRepositories(repos);
  }, [repos]);

  const existingUrls = useMemo(
    () => new Set(repos.map((r) => r.url.replace(/\/$/, ""))),
    [repos],
  );
  const suggestions = suggestedRepositories.filter(
    (s) => !existingUrls.has(s.url.replace(/\/$/, "")),
  );

  const toggle = (id: string): void =>
    setRepos((current) =>
      current.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  const remove = (id: string): void =>
    setRepos((current) => current.filter((r) => r.id !== id));
  const add = (name: string, rawUrl: string): void => {
    const clean = normalizeUrl(rawUrl);
    if (!clean) {
      setError(copy.invalidUrl);
      return;
    }
    if (existingUrls.has(clean.replace(/\/$/, ""))) {
      setError(copy.duplicate);
      return;
    }
    setError(null);
    setRepos((current) => [
      ...current,
      {
        id: `repo-${clean.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}-${current.length}`,
        name: name || hostLabel(clean),
        url: clean,
        official: false,
        enabled: true,
      },
    ]);
    setUrl("");
  };

  // Anchor the desktop popover just above the trigger button.
  const desktopPos =
    isDesktop && anchor
      ? {
          left: Math.max(12, Math.min(anchor.left, anchor.vw - 348)),
          bottom: anchor.vh - anchor.top + 8,
        }
      : null;

  const panelBase =
    "z-70 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";
  const panelClass = isDesktop
    ? `fixed w-[336px] rounded-2xl ${panelBase}`
    : `fixed inset-x-0 bottom-0 top-16 rounded-t-3xl ${panelBase}`;

  return (
    <>
      <motion.button
        type="button"
        aria-label={"Close"}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-65 ${isDesktop ? "cursor-default" : "bg-black/40"}`}
      />
      <motion.div
        role="dialog"
        aria-label={copy.title}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(desktopPos
          ? { style: { left: desktopPos.left, bottom: desktopPos.bottom } }
          : {})}
        className={panelClass}
      >
        {!isDesktop && (
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="size-4" aria-hidden="true" />
            {copy.title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={commonSource}
              aria-label={copy.commonSourceToggle}
              title={copy.commonSourceToggle}
              onClick={() => setCommonSource((v) => !v)}
              className={`focus-ring relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                commonSource ? "bg-accent" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                  commonSource ? "translate-x-4" : "translate-x-0.5"
                }`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              aria-label={"Close"}
              onClick={onClose}
              className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {commonSource ? (
            <div className="group flex items-center gap-2.5 rounded-xl px-2 py-2">
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground ring-1 ring-accent"
                aria-hidden="true"
              >
                <Check className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {copy.commonSource}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {copy.commonSourceTag}
                  </span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {copy.commonSourceDesc}
                </span>
              </div>
            </div>
          ) : (
            <>
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="group flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-hover"
            >
              <button
                type="button"
                role="switch"
                aria-checked={repo.enabled}
                aria-label={`${repo.enabled ? copy.disable : copy.enable}: ${repo.name}`}
                onClick={() => toggle(repo.id)}
                className={`focus-ring flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors ${
                  repo.enabled
                    ? "bg-accent text-accent-foreground ring-accent"
                    : "bg-transparent ring-border"
                }`}
              >
                {repo.enabled && (
                  <Check className="size-3.5" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => toggle(repo.id)}
                className="focus-ring min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {repo.name}
                  </span>
                  {repo.official && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {copy.official}
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {hostLabel(repo.url)}
                </span>
              </button>
              {!repo.official && (
                <button
                  type="button"
                  aria-label={`${copy.remove}: ${repo.name}`}
                  onClick={() => remove(repo.id)}
                  className="focus-ring shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:bg-surface-hover hover:text-negative group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          {suggestions.length > 0 && (
            <div className="mt-2 px-2">
              <p className="pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {copy.suggested}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.url}
                    type="button"
                    onClick={() => add(s.name, s.url)}
                    className="focus-ring flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {!commonSource && (
        <form
          className="border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            add("", url);
          }}
        >
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              inputMode="url"
              placeholder={copy.urlPlaceholder}
              aria-label={copy.urlPlaceholder}
              aria-invalid={error !== null}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              className="focus-ring shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              {copy.add}
            </button>
          </div>
          {error && (
            <p className="mt-1.5 text-[11px] text-negative">{error}</p>
          )}
        </form>
        )}
      </motion.div>
    </>
  );
}

/** Gear button that opens the repositories manager (popover / bottom sheet). */
export function RepositoriesButton({
  className = "",
}: {
  className?: string;
}): ReactNode {
  const copy = content.repositories;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label={copy.button}
        aria-expanded={open}
        onClick={(event) => {
          const r = event.currentTarget.getBoundingClientRect();
          setAnchor({
            left: r.left,
            top: r.top,
            vw: window.innerWidth,
            vh: window.innerHeight,
          });
          setOpen(true);
        }}
        className={
          className ||
          "focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        }
      >
        <Settings className="size-4" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <RepositoriesSheet anchor={anchor} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
