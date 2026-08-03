"use client";

import { PRIMARY_CTA } from "@/components/hub/cta";
import { content } from "@/lib/data";
import { Award, Check, ChevronRight, CornerDownRight, HelpCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/** macOS-style certificate viewer for the URL bar "Secure" lock. */
export function CertificateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  return (
    <AnimatePresence>{open && <CertBody onClose={onClose} />}</AnimatePresence>
  );
}

function CertBody({ onClose }: { onClose: () => void }): ReactNode {
  const cert = content.browserSettings.cert;
  const [trustOpen, setTrustOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={cert.domain}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-surface-raised text-foreground shadow-[0_24px_90px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/10 dark:ring-white/10"
      >
        <div className="p-5">
          {/* Certificate chain */}
          <div className="rounded-xl bg-surface p-2 ring-1 ring-accent/40">
            {cert.chain.map((node, index) => {
              const leaf = index === cert.chain.length - 1;
              return (
                <div
                  key={node}
                  style={{ paddingLeft: index * 22 }}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${
                    leaf
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-foreground"
                  }`}
                >
                  {index > 0 && (
                    <CornerDownRight
                      className={`size-3.5 shrink-0 ${leaf ? "text-accent-foreground/80" : "text-muted-foreground"}`}
                      aria-hidden="true"
                    />
                  )}
                  <Award
                    className={`size-4 shrink-0 ${leaf ? "text-accent-foreground" : "text-amber-500"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{node}</span>
                </div>
              );
            })}
          </div>

          {/* Certificate detail card */}
          <div className="mt-4 max-h-[46dvh] overflow-y-auto rounded-xl bg-surface p-4 ring-1 ring-border">
            <div className="flex items-start gap-4">
              <span
                className="flex size-16 shrink-0 flex-col items-center justify-center rounded-md bg-linear-to-b from-sky-50 to-sky-100 text-center ring-1 ring-sky-300"
                aria-hidden="true"
              >
                <span className="font-serif text-[11px] leading-tight text-sky-800 italic">
                  {cert.seal}
                </span>
                <span className="font-serif text-[8px] text-sky-700 italic">
                  {cert.sealSub}
                </span>
                <Award className="mt-0.5 size-4 text-amber-500" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{cert.domain}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cert.issuedBy}
                </p>
                <p className="text-sm text-balance text-muted-foreground">
                  {cert.expires}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-positive text-white">
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {cert.valid}
                </p>
              </div>
            </div>

            {/* Trust (expandable) */}
            <Disclosure
              label={cert.trustLabel}
              open={trustOpen}
              onToggle={() => setTrustOpen((v) => !v)}
            >
              <p className="text-sm text-muted-foreground">{cert.trustNote}</p>
            </Disclosure>

            {/* Details (expandable) */}
            <Disclosure
              label={cert.detailsLabel}
              open={detailsOpen}
              onToggle={() => setDetailsOpen((v) => !v)}
            >
              <dl className="space-y-1.5">
                {cert.details.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="shrink-0 text-xs text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="truncate text-right text-xs font-medium">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Disclosure>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              aria-label={cert.help}
              onClick={onClose}
              className="focus-ring flex size-9 items-center justify-center rounded-full bg-surface text-muted-foreground ring-1 ring-border hover:bg-surface-hover"
            >
              <HelpCircle className="size-4.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`focus-ring rounded-full px-6 py-2 text-sm font-semibold ${PRIMARY_CTA}`}
            >
              {cert.ok}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Disclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="mt-3 border-t border-border pt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-1.5 rounded-md py-1 text-left text-sm font-semibold"
      >
        <ChevronRight
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-1 pt-1.5 pb-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
