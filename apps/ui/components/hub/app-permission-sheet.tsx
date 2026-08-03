"use client";

import { collectionIcons } from "@/components/hub/app-collections";
import { AppTile } from "@/components/hub/app-icon";
import { PRIMARY_CTA } from "@/components/hub/cta";
import { useHub } from "@/components/hub/hub-provider";
import {
  content,
  getAppCollections,
  getCollectionAppSlugs,
  getEssentialAppSlugs,
  getHubApp,
  getSystemAppSlugs,
} from "@/lib/data";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Info,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

const LEARN_MORE_URL = "https://hub.bsvblockchain.org/brc/wallet/0116";

/** Renders the install/uninstall permission bottom sheet, if one is pending. */
export function AppPermissionSheet(): ReactNode {
  const { appPrompt } = useHub();
  return (
    <AnimatePresence>
      {appPrompt && (
        <SheetBody
          key={`${appPrompt.mode}:${appPrompt.kind === "app" ? appPrompt.slug : appPrompt.id}`}
        />
      )}
    </AnimatePresence>
  );
}

/** Info affordance that reveals a tooltip on hover, focus, or click. */
function InfoTooltip({ text }: { text: string }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex rounded-full p-0.5 text-muted-foreground hover:text-foreground"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 bottom-full z-10 mb-2 w-56 rounded-lg bg-foreground px-3 py-2 text-xs leading-snug text-balance text-background shadow-lg"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  tooltip,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  tooltip?: string;
}): ReactNode {
  return (
    <div className="flex w-full items-center gap-3 py-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onChange}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
      >
        <span
          className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
            checked
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface"
          }`}
          aria-hidden="true"
        >
          {checked && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 text-sm text-balance">{label}</span>
      </button>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );
}

/** One labelled numeric field in the auto-approve settings form. */
function AutoApproveField({
  label,
  desc,
  prefix,
  defaultValue,
}: {
  label: string;
  desc: string;
  prefix?: string;
  defaultValue: string;
}): ReactNode {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-balance text-muted-foreground">{desc}</p>
      </div>
      <div className="relative shrink-0">
        {prefix && (
          <span
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          defaultValue={defaultValue}
          aria-label={label}
          className={`focus-ring w-24 rounded-lg border border-border bg-surface-raised py-1.5 pr-2.5 text-right text-sm ${
            prefix ? "pl-6" : "pl-2.5"
          }`}
        />
      </div>
    </div>
  );
}

/** Payment auto-approve limits, revealed under "Advanced settings". */
function AutoApproveSettings({
  title,
  notifyAlways,
  onToggleNotify,
  identify,
  onToggleIdentify,
}: {
  title: string;
  notifyAlways: boolean;
  onToggleNotify: () => void;
  identify: boolean;
  onToggleIdentify: () => void;
}): ReactNode {
  const store = content.appStore;
  const a = store.autoApprove;
  return (
    <div className="mt-2 space-y-4 rounded-2xl bg-surface p-4">
      <h4 className="text-sm font-semibold">
        {a.title} for {title}
      </h4>
      <button
        type="button"
        role="checkbox"
        aria-checked={notifyAlways}
        onClick={onToggleNotify}
        className="focus-ring flex w-full items-start gap-3 text-left"
      >
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
            notifyAlways
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface-raised"
          }`}
          aria-hidden="true"
        >
          {notifyAlways && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{a.notify}</span>
          <span className="block text-xs text-balance text-muted-foreground">
            {a.notifyDesc}
          </span>
        </span>
      </button>
      <Checkbox
        checked={identify}
        onChange={onToggleIdentify}
        label={store.optIdentify}
        tooltip={store.optIdentifyInfo}
      />
      <AutoApproveField
        label={a.perTx}
        desc={a.perTxDesc}
        prefix="$"
        defaultValue="1.00"
      />
      <AutoApproveField
        label={a.perSession}
        desc={a.perSessionDesc}
        prefix="$"
        defaultValue="10.00"
      />
      <AutoApproveField label={a.rate} desc={a.rateDesc} defaultValue="30" />
      <AutoApproveField label={a.maxTx} desc={a.maxTxDesc} defaultValue="100" />
    </div>
  );
}

function SheetBody(): ReactNode {
  const {
    appPrompt,
    closeAppPrompt,
    installApp,
    uninstallApp,
    bulkSetInstalled,
    presetGroup,
    ungroupApp,
  } = useHub();
  const copy = content.appStore;
  const [identify, setIdentify] = useState(true);
  const [operate, setOperate] = useState(true);
  const [permsOpen, setPermsOpen] = useState(false);
  const [notifyAlways, setNotifyAlways] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeAppPrompt();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeAppPrompt]);

  // After confirming, show the success state briefly, then slide the sheet shut.
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => closeAppPrompt(), 1500);
    return () => window.clearTimeout(timer);
  }, [done, closeAppPrompt]);

  if (!appPrompt) return null;
  const install = appPrompt.mode === "install";

  // Resolve the target — a single app or a whole collection.
  const app = appPrompt.kind === "app" ? getHubApp(appPrompt.slug) : undefined;
  const collection =
    appPrompt.kind === "collection"
      ? getAppCollections().find((c) => c.id === appPrompt.id)
      : undefined;
  if (appPrompt.kind === "app" && !app) return null;
  if (appPrompt.kind === "collection" && !collection) return null;

  const title = app ? app.name : (collection?.name ?? "");
  const CollectionIcon = collection
    ? (collectionIcons[collection.icon] ?? Sparkles)
    : null;
  const collectionCount = collection
    ? getCollectionAppSlugs(collection.id).length
    : 0;
  const subtitle = collection
    ? `${collectionCount} apps`
    : install
      ? copy.installSubtitle
      : copy.uninstallSubtitle;
  const introExpanded = collection
    ? copy.permsIntroCollection
    : copy.permsIntro;
  const introCollapsed = collection
    ? copy.permsIntroCollectionCollapsed
    : copy.permsIntroCollapsed;

  const confirm = (): void => {
    // Installing/removing keeps you on the page you did it from.
    if (app) {
      if (install) installApp(app.slug);
      else uninstallApp(app.slug);
    } else if (collection) {
      const slugs = getCollectionAppSlugs(collection.id);
      const essentialSlugs = new Set(getEssentialAppSlugs());
      const systemSlugs = getSystemAppSlugs();
      const systemSet = new Set(systemSlugs);
      const bundlesWeb = collection.bundlesWeb === true;
      if (install) {
        // Persona bundles also pull in the Web apps.
        const targets = bundlesWeb ? [...slugs, ...systemSlugs] : slugs;
        bulkSetInstalled(targets, true);
        if (collection.id !== "all") {
          // Persona folders fold in the Web apps; other collections keep them
          // out. Essential apps are never grouped.
          const grouped = targets.filter((slug) =>
            bundlesWeb
              ? !essentialSlugs.has(slug)
              : !essentialSlugs.has(slug) && !systemSet.has(slug),
          );
          presetGroup(collection.name, grouped);
        }
      } else {
        // Only essential apps are protected; Web apps can be switched off.
        const removable = slugs.filter((slug) => !essentialSlugs.has(slug));
        bulkSetInstalled(removable, false);
        // Disabling a persona returns the shared Web apps to standalone
        // instead of leaving them orphaned in the persona's folder.
        if (bundlesWeb) {
          for (const slug of systemSlugs) ungroupApp(slug);
        }
      }
    }
    setDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-80 flex items-end justify-center"
      onClick={closeAppPrompt}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={install ? `Install ${title}` : `Remove ${title}`}
        onClick={(event) => event.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface-raised text-foreground shadow-[0_-12px_90px_-8px_rgba(0,0,0,0.55)] ring-1 ring-black/10 dark:shadow-[0_-12px_90px_-4px_rgba(0,0,0,0.95)] dark:ring-white/10"
      >
        {/* Grab handle (mobile affordance) */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-6 pt-4 pb-6 sm:px-7 sm:pt-6">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col items-center py-12 text-center"
              >
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    damping: 14,
                    stiffness: 220,
                    delay: 0.05,
                  }}
                  className="flex size-16 items-center justify-center rounded-full bg-positive/15 text-positive"
                >
                  <Check className="size-8" strokeWidth={2.5} aria-hidden="true" />
                </motion.span>
                <p className="mt-4 text-lg font-bold">
                  {title} {install ? "added" : "removed"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {install ? copy.successAdded : copy.successRemoved}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mt-2 mb-3">
                    {app ? (
                      <AppTile app={app} size={52} />
                    ) : (
                      CollectionIcon && (
                        <span className="flex size-13 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                          <CollectionIcon
                            className="size-7"
                            aria-hidden="true"
                          />
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-lg font-bold">{title}</p>
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>

                {install ? (
                  <>
                    {app &&
                      (app.pricing ? (
                        <div className="mt-5 rounded-2xl bg-surface p-4">
                          <div className="flex items-center gap-2">
                            <Wallet
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <h3 className="min-w-0 flex-1 text-sm font-medium">
                              {copy.iapTitle}
                            </h3>
                            <span className="shrink-0 text-sm font-semibold">
                              {app.pricing.summary}
                            </span>
                          </div>
                          {app.pricing.note && (
                            <p className="mt-1.5 text-xs text-balance text-muted-foreground">
                              {app.pricing.note}
                            </p>
                          )}
                          {app.pricing.plans && (
                            <ul className="mt-3 space-y-1.5">
                              {app.pricing.plans.map((plan) => (
                                <li
                                  key={plan.name}
                                  className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-sm"
                                >
                                  <span className="text-muted-foreground">
                                    {plan.name}
                                  </span>
                                  <span className="font-semibold">
                                    {plan.price}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface p-4">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-positive/15 text-positive">
                            <BadgeCheck className="size-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {copy.iapFree}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {copy.iapFreeNote}
                            </p>
                          </div>
                        </div>
                      ))}

                    <div
                      className={`${app ? "mt-3" : "mt-5"} rounded-2xl bg-surface p-4`}
                    >
                      <button
                        type="button"
                        onClick={() => setPermsOpen((v) => !v)}
                        aria-expanded={permsOpen}
                        className="focus-ring flex w-full items-center gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          {permsOpen ? introExpanded : introCollapsed}
                        </span>
                        <ChevronDown
                          className={`size-4 shrink-0 text-muted-foreground transition-transform ${permsOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                      <AnimatePresence initial={false} mode="wait">
                        {permsOpen ? (
                          <motion.div
                            key="full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="mt-3"
                          >
                            <ul className="space-y-2.5">
                              {[copy.perm1, copy.perm2, copy.perm3].map(
                                (perm) => (
                                  <li
                                    key={perm}
                                    className="flex items-start gap-2.5"
                                  >
                                    <Check
                                      className="mt-0.5 size-4 shrink-0 text-positive"
                                      strokeWidth={2.5}
                                      aria-hidden="true"
                                    />
                                    <span className="min-w-0 flex-1 text-sm text-balance">
                                      {perm}
                                    </span>
                                    <a
                                      href={LEARN_MORE_URL}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="focus-ring mt-0.5 shrink-0 text-xs font-semibold text-accent hover:underline"
                                    >
                                      {copy.learnMore}
                                    </a>
                                  </li>
                                ),
                              )}
                            </ul>
                            <p className="mt-3 border-t border-border pt-3 text-xs text-balance text-muted-foreground">
                              {copy.installNote}
                            </p>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="chips"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="mt-3 flex flex-wrap gap-1.5"
                          >
                            {copy.permWords.map((word) => (
                              <span
                                key={word}
                                className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2.5 py-1 text-xs font-medium"
                              >
                                <Check
                                  className="size-3 text-positive"
                                  strokeWidth={3}
                                  aria-hidden="true"
                                />
                                {word}
                              </span>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="mt-4">
                      <Checkbox
                        checked={operate}
                        onChange={() => setOperate((v) => !v)}
                        label={copy.optOperate}
                        tooltip={copy.optOperateInfo}
                      />
                    </div>

                    <div className="mt-2">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setAdvancedOpen((v) => !v)}
                          aria-expanded={advancedOpen}
                          className="focus-ring flex items-center gap-1.5 rounded-md py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          <ChevronDown
                            className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                          {copy.advanced}
                        </button>
                      </div>
                      {advancedOpen && (
                        <AutoApproveSettings
                          title={title}
                          notifyAlways={notifyAlways}
                          onToggleNotify={() => setNotifyAlways((v) => !v)}
                          identify={identify}
                          onToggleIdentify={() => setIdentify((v) => !v)}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl bg-surface p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-negative/15 text-negative">
                      <ShieldAlert className="size-5" aria-hidden="true" />
                    </span>
                    <p className="text-sm text-balance text-muted-foreground">
                      {copy.uninstallBody}
                    </p>
                  </div>
                )}

                <div className="mt-6 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={closeAppPrompt}
                    className="focus-ring flex-1 rounded-full bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-surface-hover"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    className={`focus-ring flex-1 truncate rounded-full px-5 py-2.5 text-sm font-semibold ${
                      install
                        ? PRIMARY_CTA
                        : "bg-negative text-white transition-colors hover:opacity-90"
                    }`}
                  >
                    {install ? `Install ${title}` : copy.uninstallConfirm}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
