"use client";

import {
  content,
  getDefaultRepositories,
  suggestedRepositories,
  type AppRepository,
} from "@/lib/data";
import { storageKeys } from "@/lib/config";
import { Check, Plus, Settings, ShieldAlert, Trash2, X } from "lucide-react";
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

/** A repository the user has asked for but not yet agreed to. */
interface PendingRepo {
  name: string;
  url: string;
}

/**
 * The warning in front of adding a store.
 *
 * A repository decides which code the hub is willing to offer you, so this is
 * closer to a permission than a preference — and the moment to say that nobody
 * has reviewed it is before it is added, not in a toast afterwards. Presented
 * the same way as the panel that opened it: a popover on a pointer, a bottom
 * sheet on a phone.
 */
function ConfirmUnvetted({
  target,
  isDesktop,
  position,
  onCancel,
  onConfirm,
}: {
  target: PendingRepo;
  isDesktop: boolean;
  position: { left: number; bottom: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactNode {
  const copy = content.repositories;
  const base =
    "z-80 flex flex-col overflow-hidden bg-surface-raised text-foreground shadow-2xl ring-1 ring-border";
  return (
    <>
      <motion.button
        type="button"
        aria-label={copy.confirmCancel}
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-75 bg-black/40"
      />
      <motion.div
        role="alertdialog"
        aria-label={copy.confirmTitle}
        initial={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96, y: 6 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        {...(isDesktop && position
          ? { style: { left: position.left, bottom: position.bottom } }
          : {})}
        className={
          isDesktop
            ? `fixed w-[336px] rounded-2xl ${base}`
            : `fixed inset-x-0 bottom-0 rounded-t-3xl ${base}`
        }
      >
        {!isDesktop && (
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="bg-muted-foreground/30 h-1 w-9 rounded-full" />
          </div>
        )}
        <div className="space-y-2 px-4 pt-4 pb-3">
          <h2 className="flex items-start gap-2 text-sm font-semibold">
            <ShieldAlert
              className="text-warning mt-px size-4 shrink-0"
              aria-hidden="true"
            />
            {copy.confirmTitle}
          </h2>
          {/* The URL, because it is the whole of what is being trusted. */}
          <div className="bg-surface rounded-lg px-2.5 py-2">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
              {copy.confirmSource}
            </p>
            <p className="truncate text-sm font-medium">
              {target.name || hostLabel(target.url)}
            </p>
            <p className="text-muted-foreground truncate font-mono text-[11px]">
              {target.url}
            </p>
          </div>
          <p className="text-muted-foreground text-xs text-pretty">
            {copy.confirmBody}
          </p>
        </div>
        <div className="border-border flex items-center gap-2 border-t p-3">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring border-border hover:bg-surface-hover flex-1 rounded-lg border px-3 py-2 text-sm font-semibold"
          >
            {copy.confirmCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="focus-ring bg-accent text-accent-foreground flex-1 rounded-lg px-3 py-2 text-sm font-bold hover:opacity-90"
          >
            {copy.confirmAdd}
          </button>
        </div>
      </motion.div>
    </>
  );
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
  /** Open while the URL field has focus, so a blank box is never a dead end. */
  const [picking, setPicking] = useState(false);
  /**
   * The suggestion whose URL is currently in the field, so its name survives.
   *
   * Without this a store chosen by name is filed under its hostname, and the row
   * ends up printing the same string twice. Dropped the moment the URL is edited:
   * a name that no longer matches the address is worse than no name.
   */
  const [picked, setPicked] = useState<PendingRepo | null>(null);
  const [pending, setPending] = useState<PendingRepo | null>(null);

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
  /*
   * Every path to adding a repository goes through the same confirmation.
   *
   * Validation first, so the warning is never shown for a URL that was going to
   * be rejected anyway — and the suggested chips route through here too. A
   * curated-looking name is not vetting, and leaving them a shortcut past the
   * warning would make the warning a formality about typing rather than about
   * trust.
   */
  const requestAdd = (name: string, rawUrl: string): void => {
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
    setPicking(false);
    setPending({ name, url: clean });
  };

  const commitAdd = (): void => {
    if (!pending) return;
    const { name, url: clean } = pending;
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
    setPending(null);
    setPicked(null);
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
                    onClick={() => requestAdd(s.name, s.url)}
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
          className="border-border relative border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            requestAdd(picked?.url === url ? picked.name : "", url);
          }}
        >
          {/*
            Something to try, offered where the typing happens.

            An empty URL field assumes the reader already knows a registry
            address, and almost nobody does — so focusing it lists the
            third-party stores not yet added. Selecting one fills the field
            rather than adding it, which keeps the confirmation as the single
            place a repository is actually agreed to.
          */}
          <AnimatePresence>
            {picking && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.14 }}
                className="border-border bg-surface-raised absolute inset-x-3 bottom-full z-10 mb-2 overflow-hidden rounded-xl border shadow-2xl"
              >
                <p className="text-muted-foreground border-border/60 border-b px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase">
                  {copy.pickSuggested}
                </p>
                <ul>
                  {suggestions.map((s) => (
                    <li key={s.url}>
                      <button
                        type="button"
                        /* The field must keep focus, or the blur below closes
                           this list before the click lands on it. */
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setUrl(s.url);
                          setPicked({ name: s.name, url: s.url });
                          setError(null);
                          setPicking(false);
                        }}
                        className="focus-ring hover:bg-surface-hover block w-full px-3 py-1.5 text-left"
                      >
                        <span className="block truncate text-xs font-medium">
                          {s.name}
                        </span>
                        <span className="text-muted-foreground block truncate font-mono text-[10px]">
                          {hostLabel(s.url)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground border-border/60 border-t px-3 py-1.5 text-[10px] text-pretty">
                  {copy.pickHint}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="flex items-center gap-2"
            /* Closes when focus leaves the field *and* the list, so tabbing
               through the suggestions does not dismiss them. */
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setPicking(false);
              }
            }}
          >
            <input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (picked && picked.url !== event.target.value) setPicked(null);
                if (error) setError(null);
              }}
              onFocus={() => setPicking(true)}
              onClick={() => setPicking(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && picking) {
                  event.stopPropagation();
                  setPicking(false);
                }
              }}
              inputMode="url"
              placeholder={copy.urlPlaceholder}
              aria-label={copy.urlPlaceholder}
              aria-invalid={error !== null}
              className="border-border bg-surface focus:border-ring min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="focus-ring bg-accent text-accent-foreground shrink-0 rounded-lg px-3 py-2 text-sm font-semibold hover:opacity-90"
            >
              {copy.add}
            </button>
          </div>
          {error && <p className="text-negative mt-1.5 text-[11px]">{error}</p>}
        </form>
        )}
      </motion.div>

      <AnimatePresence>
        {pending && (
          <ConfirmUnvetted
            target={pending}
            isDesktop={isDesktop}
            position={desktopPos}
            onCancel={() => setPending(null)}
            onConfirm={commitAdd}
          />
        )}
      </AnimatePresence>
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
