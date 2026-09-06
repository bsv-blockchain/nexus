"use client";

/**
 * Security: what you can prove yourself with, and where you are asked to.
 *
 * Every factor registered here becomes an option in the vault's chooser, and
 * nothing else does — the two read one store, so a key you removed cannot still
 * be offered on the door. That is the whole reason this panel exists rather
 * than the vault carrying its own hard-coded list of three ways in.
 *
 * The registration flows are mocked and are deliberately shaped like the real
 * ones: a key is not added until it has been touched and named, codes are not
 * on until a code from them has been typed back, and a phone is not paired
 * until it has answered. Skipping straight to "added" would teach the wrong
 * thing about what any of these mean.
 */

import { Choice, Group, Row, Toggle } from "@/components/apps/settings/blocks";
import { JumpingDots } from "@/components/hub/jumping-dots";
import { QrBlock } from "@/components/hub/qr-block";
import { AppTile } from "@/components/hub/app-icon";
import { useHub } from "@/components/hub/hub-provider";
import { content, getHubApp } from "@/lib/data";
import { setSetting, useSettings } from "@/lib/settings-store";
import {
  ALL_APPS,
  addKey,
  addPhone,
  removeKey,
  removePhone,
  setOtp,
  setPassphrase,
  suggestKeyLabel,
  suggestPhoneLabel,
  toggleExempt,
  useSecurity,
} from "@/lib/security-store";
import { Check, KeyRound, Plus, Search, Smartphone, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const copy = content.security;

/** How long the mocked key, phone and authenticator take to answer. */
const DETECT_MS = 2200;
/** The shortest passphrase this will accept. */
const MIN_PASSPHRASE = 8;
/** The secret an authenticator would be given. Fixed, so the QR never reshuffles. */
const OTP_SECRET = "JBSWY3DPEHPK3PXP";

export function SecurityPanel(): ReactNode {
  return (
    <>
      <PassphraseGroup />
      <KeysGroup />
      <OtpGroup />
      <PhonesGroup />
      {/* Above the lock, because it is the broader question: this decides what
          a site is given without being asked, and the group below decides which
          apps skip the asking on the way in. */}
      <AutoConnectGroup />
      <ExemptGroup />
    </>
  );
}

/* ----------------------------------------------------------- passphrase --- */

function PassphraseGroup(): ReactNode {
  const { passphraseSet } = useSecurity();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = (): void => {
    if (next.length < MIN_PASSPHRASE) {
      setError(copy.passphrase.tooShort);
      return;
    }
    if (next !== again) {
      setError(copy.passphrase.mismatch);
      return;
    }
    setPassphrase();
    setOpen(false);
    setNext("");
    setAgain("");
    setError(null);
    toast.success(copy.passphrase.saved);
  };

  return (
    <Group title={copy.passphrase.title} hint={copy.passphrase.body}>
      {open ? (
        <div className="space-y-2 px-3 py-3">
          <Field
            label={copy.passphrase.newLabel}
            value={next}
            onChange={(value) => {
              setNext(value);
              setError(null);
            }}
            type="password"
            autoFocus
          />
          <Field
            label={copy.passphrase.confirmLabel}
            value={again}
            onChange={(value) => {
              setAgain(value);
              setError(null);
            }}
            type="password"
            onEnter={save}
          />
          {error && <p className="text-negative text-[11px]">{error}</p>}
          <FlowButtons
            onCancel={() => {
              setOpen(false);
              setError(null);
            }}
            cancelLabel={copy.passphrase.cancel}
            onConfirm={save}
            confirmLabel={copy.passphrase.save}
          />
        </div>
      ) : (
        <Row
          label={copy.passphrase.change}
          value={passphraseSet ? copy.passphrase.set : copy.passphrase.unset}
          onClick={() => setOpen(true)}
        />
      )}
    </Group>
  );
}

/* ----------------------------------------------------------------- keys --- */

function KeysGroup(): ReactNode {
  const { keys } = useSecurity();
  /* null = closed, "waiting" = listening for the key, otherwise the label it
     reported and you are free to change. */
  const [stage, setStage] = useState<null | "waiting" | "naming">(null);
  const [label, setLabel] = useState("");

  useDetect(stage === "waiting", () => {
    setLabel(suggestKeyLabel());
    setStage("naming");
  });

  return (
    <Group title={copy.keys.title} hint={copy.keys.body}>
      {keys.length === 0 && stage === null ? (
        <Empty line={copy.keys.empty} />
      ) : (
        keys.map((key) => (
          <RegisteredRow
            key={key.id}
            icon={<KeyRound className="size-4" aria-hidden="true" />}
            label={key.label}
            removeLabel={copy.keys.remove}
            onRemove={() => removeKey(key.id)}
          />
        ))
      )}

      <AnimatePresence initial={false} mode="wait">
        {stage === "waiting" ? (
          <Step key="waiting">
            <Waiting label={copy.keys.waiting} />
            <FlowButtons
              onCancel={() => setStage(null)}
              cancelLabel={copy.keys.cancel}
            />
          </Step>
        ) : stage === "naming" ? (
          <Step key="naming">
            <p className="text-sm font-medium">{copy.keys.nameTitle}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
              {copy.keys.nameBody}
            </p>
            <div className="mt-2">
              <Field
                label={copy.keys.nameLabel}
                value={label}
                onChange={setLabel}
                autoFocus
                onEnter={() => {
                  if (!label.trim()) return;
                  addKey(label);
                  setStage(null);
                }}
              />
            </div>
            <FlowButtons
              onCancel={() => setStage(null)}
              cancelLabel={copy.keys.cancel}
              onConfirm={() => {
                if (!label.trim()) return;
                addKey(label);
                setStage(null);
              }}
              confirmLabel={copy.keys.confirm}
            />
          </Step>
        ) : (
          <AddRow
            key="add"
            label={copy.keys.add}
            onClick={() => setStage("waiting")}
          />
        )}
      </AnimatePresence>
    </Group>
  );
}

/* ------------------------------------------------------------------ otp --- */

function OtpGroup(): ReactNode {
  const { otpOn } = useSecurity();
  const [setting, setSetting] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = (): void => {
    /* Six digits, and nothing about which six. There is no authenticator on the
       other end of this, so checking the value would mean printing the answer
       on the screen beside the box — which is the one thing the real flow
       never does. The shape is the part worth honouring. */
    if (!/^\d{6}$/.test(code.trim())) {
      setError(copy.otp.badCode);
      return;
    }
    setOtp(true);
    setSetting(false);
    setCode("");
    setError(null);
  };

  return (
    <Group title={copy.otp.title} hint={copy.otp.body}>
      <Toggle
        label={copy.otp.toggle}
        value={otpOn}
        onChange={(next) => {
          /* On goes through the confirmation; off is immediate. Asking somebody
             to prove they can still generate codes in order to stop using them
             is a trap, not a safeguard. */
          if (next) setSetting(true);
          else setOtp(false);
        }}
      />
      <AnimatePresence initial={false}>
        {setting && (
          <Step key="otp-setup">
            <p className="text-sm font-medium">{copy.otp.setupTitle}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
              {copy.otp.setupBody}
            </p>
            <div className="mt-3 flex flex-col items-center gap-2">
              <QrBlock
                value={OTP_SECRET}
                label={copy.otp.setupTitle}
                className="size-36"
              />
              <span className="text-muted-foreground text-[10px]">
                {copy.otp.secretLabel}
              </span>
              <code className="bg-surface rounded px-2 py-1 font-mono text-xs tracking-[0.2em]">
                {OTP_SECRET}
              </code>
            </div>
            <div className="mt-3">
              <Field
                label={copy.otp.codeLabel}
                value={code}
                onChange={(value) => {
                  setCode(value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                inputMode="numeric"
                mono
                autoFocus
                onEnter={confirm}
              />
            </div>
            {error && (
              <p className="text-negative mt-1.5 text-[11px]">{error}</p>
            )}
            <FlowButtons
              onCancel={() => {
                setSetting(false);
                setError(null);
                setCode("");
              }}
              cancelLabel={copy.otp.cancel}
              onConfirm={confirm}
              confirmLabel={copy.otp.confirm}
            />
          </Step>
        )}
      </AnimatePresence>
    </Group>
  );
}

/* --------------------------------------------------------------- phones --- */

function PhonesGroup(): ReactNode {
  const { phones } = useSecurity();
  const [stage, setStage] = useState<null | "scanning" | "naming">(null);
  const [label, setLabel] = useState("");

  useDetect(stage === "scanning", () => {
    setLabel(suggestPhoneLabel());
    setStage("naming");
  });

  return (
    <Group title={copy.phones.title} hint={copy.phones.body}>
      {phones.length === 0 && stage === null ? (
        <Empty line={copy.phones.empty} />
      ) : (
        phones.map((phone) => (
          <RegisteredRow
            key={phone.id}
            icon={<Smartphone className="size-4" aria-hidden="true" />}
            label={phone.label}
            removeLabel={copy.phones.remove}
            onRemove={() => removePhone(phone.id)}
          />
        ))
      )}

      <AnimatePresence initial={false} mode="wait">
        {stage === "scanning" ? (
          <Step key="scanning">
            <p className="text-sm font-medium">{copy.phones.scanTitle}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
              {copy.phones.scanBody}
            </p>
            <div className="mt-3 flex flex-col items-center gap-3">
              <QrBlock
                value="nexus-pair-device"
                label={copy.phones.scanTitle}
                className="size-36"
              />
              <Waiting label={copy.phones.waiting} />
            </div>
            <FlowButtons
              onCancel={() => setStage(null)}
              cancelLabel={copy.phones.cancel}
            />
          </Step>
        ) : stage === "naming" ? (
          <Step key="phone-naming">
            <p className="text-sm font-medium">{copy.phones.nameTitle}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
              {copy.phones.nameBody}
            </p>
            <div className="mt-2">
              <Field
                label={copy.phones.nameLabel}
                value={label}
                onChange={setLabel}
                autoFocus
                onEnter={() => {
                  if (!label.trim()) return;
                  addPhone(label);
                  setStage(null);
                }}
              />
            </div>
            <FlowButtons
              onCancel={() => setStage(null)}
              cancelLabel={copy.phones.cancel}
              onConfirm={() => {
                if (!label.trim()) return;
                addPhone(label);
                setStage(null);
              }}
              confirmLabel={copy.phones.confirm}
            />
          </Step>
        ) : (
          <AddRow
            key="add-phone"
            label={copy.phones.add}
            onClick={() => setStage("scanning")}
          />
        )}
      </AnimatePresence>
    </Group>
  );
}

/* -------------------------------------------------------- auto connect ---- */

/**
 * Whether a metanet site is handed the wallet, or has to ask.
 *
 * Two answers rather than a switch, because "off" would be the wrong word for
 * the manual side: nothing is being turned off, the asking is being turned on.
 * Named rows say what each one does; a toggle would leave the reader to work
 * out what its unlabelled half means.
 */
function AutoConnectGroup(): ReactNode {
  const settings = useSettings();
  return (
    <Group title={copy.autoConnectTitle} hint={copy.autoConnectHint}>
      <Choice<"auto" | "manual">
        value={settings.autoConnectSites}
        onPick={(next) => setSetting("autoConnectSites", next)}
        options={[
          {
            id: "auto",
            label: copy.autoConnectAuto,
            hint: copy.autoConnectAutoHint,
          },
          {
            id: "manual",
            label: copy.autoConnectManual,
            hint: copy.autoConnectManualHint,
          },
        ]}
      />
    </Group>
  );
}

/* ------------------------------------------------------------- exempt ----- */

function ExemptGroup(): ReactNode {
  const { exempt } = useSecurity();
  const { installedApps } = useHub();
  const [query, setQuery] = useState("");

  const all = exempt.includes(ALL_APPS);

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

  return (
    <Group title={copy.exempt.title} hint={copy.exempt.body}>
      {/* Search inside the group, above the rows it filters. A workspace can
          hold twenty apps and the list is the only way to find one. */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Search
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.exempt.search}
          aria-label={copy.exempt.search}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <CheckRow
        label={copy.exempt.all}
        hint={copy.exempt.allDesc}
        checked={all}
        onToggle={() => toggleExempt(ALL_APPS)}
      />

      {apps.length === 0 ? (
        <Empty line={copy.exempt.noMatch} />
      ) : (
        apps.map((app) => (
          <CheckRow
            key={app.slug}
            label={app.name}
            icon={<AppTile app={app} size={20} />}
            checked={all || exempt.includes(app.slug)}
            /* Everything is ticked and frozen while "Every app" is on: the
               individual boxes would be decoration, and a box you can click
               that changes nothing is worse than one you cannot. */
            disabled={all}
            onToggle={() => toggleExempt(app.slug)}
          />
        ))
      )}
    </Group>
  );
}

/* ---------------------------------------------------------------- parts --- */

/**
 * Wait for a thing that is not really there.
 *
 * One place rather than three copies of the same timeout, and it clears on the
 * way out so a cancelled pairing cannot land a device a second later.
 */
function useDetect(active: boolean, onFound: () => void): void {
  /* The latest callback, updated in an effect rather than during render: the
     handler is an inline arrow and would otherwise be a new value every pass,
     which either restarts the timer on every keystroke or writes to a ref
     mid-render. This is the one shape that does neither. */
  const ref = useRef(onFound);
  useEffect(() => {
    ref.current = onFound;
  });
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => ref.current(), DETECT_MS);
    return () => window.clearTimeout(id);
  }, [active]);
}

function Step({ children }: { children: ReactNode }): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div className="bg-surface/60 px-3 py-3">{children}</div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  onEnter,
  type = "text",
  inputMode,
  mono = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  type?: "text" | "password";
  inputMode?: "numeric";
  mono?: boolean;
  autoFocus?: boolean;
}): ReactNode {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-[11px] font-semibold">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        {...(inputMode ? { inputMode } : {})}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        className={`border-border bg-surface focus:border-ring w-full rounded-lg border px-3 py-2 text-sm outline-none ${
          mono ? "font-mono tracking-[0.3em]" : ""
        }`}
      />
    </label>
  );
}

function FlowButtons({
  onCancel,
  cancelLabel,
  onConfirm,
  confirmLabel,
}: {
  onCancel: () => void;
  cancelLabel: string;
  onConfirm?: () => void;
  confirmLabel?: string;
}): ReactNode {
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="focus-ring border-border hover:bg-surface-hover rounded-lg border px-3 py-1.5 text-sm font-semibold"
      >
        {cancelLabel}
      </button>
      {onConfirm && confirmLabel && (
        <button
          type="button"
          onClick={onConfirm}
          className="focus-ring bg-accent text-accent-foreground rounded-lg px-3 py-1.5 text-sm font-bold hover:opacity-90"
        >
          {confirmLabel}
        </button>
      )}
    </div>
  );
}

function RegisteredRow({
  icon,
  label,
  removeLabel,
  onRemove,
}: {
  icon: ReactNode;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}): ReactNode {
  return (
    <div className="group flex items-center gap-2.5 px-3 py-2.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeLabel}: ${label}`}
        className="focus-ring text-muted-foreground hover:text-negative hover:bg-surface-hover shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function AddRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring text-accent hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold"
    >
      <Plus className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

function CheckRow({
  label,
  hint,
  icon,
  checked,
  disabled = false,
  onToggle,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
    >
      <span
        aria-hidden="true"
        className={`grid size-5 shrink-0 place-items-center rounded-md ring-1 transition-colors ${
          checked
            ? "bg-accent text-accent-foreground ring-accent"
            : "ring-border bg-transparent"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {checked && <Check className="size-3.5" />}
      </span>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {hint && (
          <span className="text-muted-foreground block text-[11px]">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

function Waiting({ label }: { label: string }): ReactNode {
  return (
    <span className="text-muted-foreground flex items-center gap-2 text-xs">
      <JumpingDots className="text-accent" />
      {label}
    </span>
  );
}

function Empty({ line }: { line: string }): ReactNode {
  return <p className="text-muted-foreground px-3 py-3 text-xs">{line}</p>;
}
