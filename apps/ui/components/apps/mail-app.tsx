"use client";

import { useIsDesktop } from "@/lib/use-is-desktop";
import { useHub } from "@/components/hub/hub-provider";
import { getMailMessages } from "@/lib/data";
import {
  Archive,
  ArchiveX,
  ArrowDownLeft,
  ArrowLeft,
  CircleDollarSign,
  CornerUpLeft,
  Reply,
  ReplyAll,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";

function formatBsv(satoshis: number): string {
  return `${(satoshis / 100_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} BSV`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TagBadge({ tag }: { tag: string }): ReactNode {
  const primary = tag === "work";
  const outline = tag === "personal";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        primary
          ? "bg-accent text-accent-foreground"
          : outline
            ? "border border-border text-foreground"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {tag}
    </span>
  );
}

function Avatar({ name }: { name: string }): ReactNode {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
      {name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}

export function MailApp(): ReactNode {
  const mails = getMailMessages();
  const isDesktop = useIsDesktop();
  const { mailFolder, mailTab, setMailTab } = useHub();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");

  const activeId = selected ?? (isDesktop ? (mails[0]?.id ?? null) : null);
  const active = mails.find((m) => m.id === activeId) ?? null;

  const listed = mails.filter((mail) => {
    if (mailTab === "unread" && mail.read) return false;
    if (mailTab === "paid" && !mail.payment) return false;
    const q = query.toLowerCase();
    return (
      mail.from.toLowerCase().includes(q) ||
      mail.subject.toLowerCase().includes(q) ||
      mail.preview.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full min-h-0">
      {/* Mail list */}
      <div
        className={`w-full flex-col border-r border-border md:flex md:w-96 ${
          activeId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">{mailFolder}</h1>
          <div className="flex rounded-lg bg-muted p-0.5 text-sm">
            {(["all", "unread", "paid"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMailTab(value)}
                className={`rounded-md px-3 py-1 font-medium capitalize ${
                  mailTab === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search mail"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {listed.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No messages.
            </p>
          )}
          {listed.map((mail) => {
            const isActive = mail.id === activeId;
            return (
              <button
                key={mail.id}
                type="button"
                onClick={() => setSelected(mail.id)}
                className={`flex w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                  isActive
                    ? "border-accent/40 bg-accent/10"
                    : "border-border hover:bg-surface-hover"
                }`}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="font-semibold">{mail.from}</span>
                  {!mail.read && (
                    <span
                      className="size-2 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {timeAgo(mail.receivedAt)}
                  </span>
                </div>
                <span className="text-xs font-medium">{mail.subject}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {mail.preview}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {mail.payment && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-semibold text-positive">
                      <ArrowDownLeft className="size-3" aria-hidden="true" />
                      {formatBsv(mail.payment.amountSatoshis)}
                    </span>
                  )}
                  {mail.tags.map((tag) => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reading pane */}
      <div
        className={`min-w-0 flex-1 flex-col ${
          activeId ? "flex" : "hidden md:flex"
        }`}
      >
        {active ? (
          <>
            <div className="flex items-center gap-1 border-b border-border px-2 py-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Back to inbox"
                className="focus-ring rounded-md p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground md:hidden"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
              {[Archive, ArchiveX, Trash2].map((Icon, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={["Archive", "Move to junk", "Move to trash"][index]}
                  className="focus-ring rounded-md p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              ))}
              <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              {[Reply, ReplyAll, CornerUpLeft].map((Icon, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={["Reply", "Reply all", "Forward"][index]}
                  className="focus-ring rounded-md p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <Avatar name={active.from} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{active.from}</p>
                <p className="truncate text-sm">{active.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {active.fromEmail}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(active.receivedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {active.payment && (
              <div className="flex items-center gap-3 border-b border-border bg-positive/10 px-5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-positive/20 text-positive">
                  <ArrowDownLeft className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-positive">
                    Received {formatBsv(active.payment.amountSatoshis)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {active.payment.memo} · from {active.from}
                  </p>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed whitespace-pre-wrap">
              {active.preview}
              {"\n\n"}Best regards,{"\n"}
              {active.from}
            </div>

            <div className="border-t border-border p-4">
              <textarea
                rows={3}
                placeholder={`Reply to ${active.from}...`}
                aria-label="Reply"
                className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
              />
              {payOpen && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-positive/10 px-3 py-2">
                  <ArrowDownLeft
                    className="size-4 shrink-0 text-positive"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-positive">
                    Attach
                  </span>
                  <input
                    value={payAmount}
                    onChange={(event) => setPayAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Payment amount in BSV"
                    className="w-24 min-w-0 rounded border border-positive/30 bg-background px-2 py-1 text-sm outline-none focus:border-positive"
                  />
                  <span className="text-sm text-muted-foreground">BSV</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPayOpen(false);
                      setPayAmount("");
                    }}
                    className="focus-ring ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPayOpen((open) => !open)}
                  aria-pressed={payOpen}
                  className={`focus-ring flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
                    payOpen
                      ? "bg-positive/15 text-positive"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <CircleDollarSign className="size-4" aria-hidden="true" />
                  Attach payment
                </button>
                <button
                  type="button"
                  className="focus-ring flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
                >
                  <Send className="size-4" aria-hidden="true" />
                  {payOpen && payAmount.trim()
                    ? `Send · ${payAmount.trim()} BSV`
                    : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No message selected.
          </div>
        )}
      </div>
    </div>
  );
}
