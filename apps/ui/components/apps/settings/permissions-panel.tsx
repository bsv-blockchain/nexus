"use client";

import { Favicon } from "@/components/hub/favicon";
import { content } from "@/lib/data";
import {
  removeException,
  setCapability,
  setSetting,
  setWalletCapability,
  useSettings,
  type CapabilityId,
  type Permission,
  type WalletCapabilityId,
} from "@/lib/settings-store";
import {
  Bell,
  Boxes,
  Camera,
  ClipboardList,
  Coins,
  Download,
  FileSignature,
  Fingerprint,
  MapPin,
  Mic,
  Music,
  X,
  type LucideIcon,
} from "lucide-react";
import { Group, SatsAmount, Toggle } from "@/components/apps/settings/blocks";
import type { ReactNode } from "react";

const copy = content.settings.permissions;

const PAGE_CAPS: { id: CapabilityId; icon: LucideIcon }[] = [
  { id: "camera", icon: Camera },
  { id: "microphone", icon: Mic },
  { id: "location", icon: MapPin },
  { id: "notifications", icon: Bell },
  { id: "clipboard", icon: ClipboardList },
  { id: "downloads", icon: Download },
  { id: "midi", icon: Music },
];

const WALLET_CAPS: { id: WalletCapabilityId; icon: LucideIcon }[] = [
  { id: "spend", icon: Coins },
  { id: "identity", icon: Fingerprint },
  { id: "baskets", icon: Boxes },
  { id: "certificates", icon: FileSignature },
];

const CAPS: { id: Permission; label: string }[] = [
  { id: "ask", label: copy.capAsk },
  { id: "allow", label: copy.capAllow },
  { id: "block", label: copy.capBlock },
];

/**
 * Ask, allow or block, as three segments.
 *
 * A switch would only offer two, and the middle one is the honest default for
 * most of these: nobody can decide in advance whether a site they have not
 * visited should have the microphone.
 */
function Tri({
  value,
  onPick,
  label,
}: {
  value: Permission;
  onPick: (next: Permission) => void;
  label: string;
}): ReactNode {
  return (
    <span
      role="radiogroup"
      aria-label={label}
      className="bg-surface ring-border/60 flex shrink-0 gap-0.5 rounded-lg p-0.5 ring-1"
    >
      {CAPS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onPick(option.id)}
            className={`focus-ring rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              active
                ? "bg-accent/20 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}

function CapRow({
  icon: Icon,
  label,
  value,
  onPick,
}: {
  icon: LucideIcon;
  label: string;
  value: Permission;
  onPick: (next: Permission) => void;
}): ReactNode {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Icon
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <Tri value={value} onPick={onPick} label={label} />
    </div>
  );
}

/* Shortcuts either side of what a small purchase costs; the field takes the
   rest. Zero means every payment asks, which is why it reads as "Ask". */
const SPEND_CAPS = [21_800, 218_000];

/**
 * What pages and apps are allowed to do.
 *
 * Two lists, deliberately apart. The first is what every browser calls
 * permissions; the second is the set only this browser has, and the ones that
 * cost money or say who you are. Mixing them would put "spend satoshis" in a
 * list next to "MIDI devices", which is the wrong company for it.
 */
export function PermissionsPanel(): ReactNode {
  const settings = useSettings();
  return (
    <>
      <Group title={copy.pageTitle} hint={copy.pageHint}>
        {PAGE_CAPS.map((cap) => (
          <CapRow
            key={cap.id}
            icon={cap.icon}
            label={copy.capabilities[cap.id]}
            value={settings.capabilities[cap.id]}
            onPick={(next) => setCapability(cap.id, next)}
          />
        ))}
      </Group>

      <Group title={copy.walletTitle} hint={copy.walletHint}>
        {/* First, because it is the one that decides whether the rest of this
            group is ever read aloud: with it on, a paying action inside the cap
            happens without a prompt. */}
        <Toggle
          label={copy.oneClick}
          hint={copy.oneClickHint}
          value={settings.oneClickPay}
          onChange={(next) => setSetting("oneClickPay", next)}
        />
        {WALLET_CAPS.map((cap) => (
          <CapRow
            key={cap.id}
            icon={cap.icon}
            label={copy.walletCapabilities[cap.id]}
            value={settings.walletCapabilities[cap.id]}
            onPick={(next) => setWalletCapability(cap.id, next)}
          />
        ))}
        {/* The ceiling only means anything once spending is allowed, so it is
            shown as part of that decision rather than as a separate setting
            somebody might set and never reach. */}
        <div className="px-3 py-2.5">
          <p className="text-sm font-medium">{copy.spendCap}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px] text-pretty">
            {copy.spendCapHint}
          </p>
          <div className="mt-2">
            <SatsAmount
              label={copy.spendCap}
              value={settings.spendCapSats}
              presets={SPEND_CAPS}
              offLabel={copy.capAsk}
              onPick={(next) => setSetting("spendCapSats", next)}
            />
          </div>
        </div>
      </Group>

      <Group title={copy.exceptionsTitle} hint={copy.exceptionsHint}>
        {settings.exceptions.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2.5 text-xs">
            {copy.exceptionsNone}
          </p>
        ) : (
          settings.exceptions.map((entry) => (
            <div
              key={`${entry.origin}-${entry.capability}`}
              className="flex items-center gap-2.5 px-3 py-2.5"
            >
              <Favicon
                url={`https://${entry.origin}`}
                letter={entry.origin.slice(0, 1).toUpperCase()}
                color="#6b6580"
                size={20}
                rounded="rounded"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {entry.origin}
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  {copy.capabilities[entry.capability]} ·{" "}
                  {entry.value === "allow" ? copy.capAllow : copy.capBlock}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeException(entry.origin, entry.capability)}
                aria-label={`${copy.exceptionRemove}: ${entry.origin}`}
                title={copy.exceptionRemove}
                className="focus-ring text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 rounded-md p-1"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </Group>
    </>
  );
}
