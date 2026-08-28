"use client";

/**
 * Sending a link to somebody, rather than copying it and finding your own way.
 *
 * Copy was the only thing a payment link offered, which means every share went
 * through the clipboard and out to whatever app you happened to have open —
 * and the people a payment link is for are almost always people this wallet has
 * already paid. So the button is split: the wide half sends it to a handle, the
 * narrow half still copies, for the times the destination is not somebody Nexus
 * knows about.
 *
 * The list before you type is `getWalletContacts`, which is derived from the
 * ledger rather than stored — the handles this account has actually moved money
 * with, most recent first. That is the closest thing to "who is this link for"
 * that exists without asking.
 *
 * A popover on a desktop and a sheet on a phone. The same content either way:
 * the difference is only whether there is room to hang it off the button.
 */

import { Sheet } from "@/components/apps/messages/sheet";
import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import { PopoverMenu } from "@/components/hub/popover-menu";
import { useWalletAccountId } from "@/components/apps/wallet/use-wallet-account";
import { content, getWalletContacts, type MessagePerson } from "@/lib/data";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { Copy, Search, Send } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

/** How many handles the pre-query list offers before it becomes a directory. */
const RECENT = 6;

/**
 * The split control: send on the left, copy on the right.
 *
 * One rounded shape divided by a rule rather than two buttons with a gap. They
 * are two ways of doing one thing, and a gap would make the narrow half read as
 * a separate, lesser action instead of as the other half of this one.
 */
export function ShareLinkButton({
  url,
  /** what the toast names, so a share reads as being of something */
  title,
  className = "",
}: {
  url: string;
  title: string;
  className?: string;
}): ReactNode {
  const copy = content.wallet;
  /* The trigger's rect, captured at click rather than measured in an effect —
     the contract every popover in this app uses. */
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  return (
    <>
      <span
        className={`bg-accent text-accent-foreground flex overflow-hidden rounded-full ${className}`}
      >
        <button
          type="button"
          onClick={(event) =>
            setAnchor(event.currentTarget.getBoundingClientRect())
          }
          className="focus-ring flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
        >
          <Send className="size-3.5 shrink-0" aria-hidden="true" />
          {copy.shareLink}
        </button>
        {/* The rule is the divider between the two halves, drawn in the
            foreground colour at low alpha so it works on the accent whatever
            the accent has been set to. */}
        <span
          className="bg-accent-foreground/25 my-1.5 w-px shrink-0"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url);
            toast.success(copy.linkCopied, { description: title });
          }}
          aria-label={copy.copyLink}
          title={copy.copyLink}
          className="focus-ring flex shrink-0 items-center justify-center px-3 py-2 transition-opacity hover:opacity-90"
        >
          <Copy className="size-3.5" aria-hidden="true" />
        </button>
      </span>

      <SharePicker
        anchor={anchor}
        title={title}
        onClose={() => setAnchor(null)}
      />
    </>
  );
}

/** The handles themselves, in whichever surface this width has room for. */
function SharePicker({
  anchor,
  title,
  onClose,
}: {
  anchor: DOMRect | null;
  title: string;
  onClose: () => void;
}): ReactNode {
  const copy = content.wallet;
  const isDesktop = useIsDesktop();
  const accountId = useWalletAccountId();
  const [query, setQuery] = useState("");
  const open = anchor !== null;

  const people = getWalletContacts(accountId);
  const needle = query.trim().replace(/^@/, "").toLowerCase();
  const matches = needle
    ? people.filter(
        (person) =>
          person.handle.toLowerCase().includes(needle) ||
          person.name.toLowerCase().includes(needle),
      )
    : people.slice(0, RECENT);

  const send = (person: MessagePerson): void => {
    onClose();
    setQuery("");
    toast.success(copy.shareSent.replace("{handle}", person.handle), {
      description: title,
    });
  };

  const body = (
    <div className="p-1">
      <Field value={query} onChange={setQuery} open={open} />
      <p className="text-muted-foreground px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
        {needle ? copy.shareResults : copy.shareRecent}
      </p>
      {matches.length === 0 ? (
        <p className="text-muted-foreground px-2 py-3 text-xs">
          {needle ? copy.shareNone : copy.shareEmpty}
        </p>
      ) : (
        <ul>
          {matches.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => send(person)}
                className="focus-ring hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left"
              >
                <MemberAvatar person={person} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
                    {person.name}
                  </span>
                  <span className="text-muted-foreground block overflow-hidden text-xs text-ellipsis whitespace-nowrap">
                    @{person.handle}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!isDesktop) {
    return (
      <Sheet open={open} onClose={onClose} label={copy.shareTitle} full>
        <div className="p-3">
          <h2 className="px-2 pb-2 text-sm font-semibold">{copy.shareTitle}</h2>
          {body}
        </div>
      </Sheet>
    );
  }

  return (
    <PopoverMenu
      open={open}
      onClose={onClose}
      label={copy.shareTitle}
      {...(anchor
        ? {
            anchor: {
              top: anchor.top,
              left: anchor.left,
              right: anchor.right,
              bottom: anchor.bottom,
            },
          }
        : {})}
      align="start"
      width={280}
      className="p-1"
    >
      {body}
    </PopoverMenu>
  );
}

/**
 * The search field, focused as it arrives.
 *
 * `useLayoutEffect` rather than `autoFocus`: the surface mounts inside a portal
 * that is still being positioned, and the browser's own autofocus can scroll
 * the page to reach a field that has not settled yet.
 */
function Field({
  value,
  onChange,
  open,
}: {
  value: string;
  onChange: (next: string) => void;
  open: boolean;
}): ReactNode {
  const copy = content.wallet;
  const box = useRef<HTMLInputElement | null>(null);
  useLayoutEffect(() => {
    if (open) box.current?.focus();
  }, [open]);

  return (
    <label className="border-border bg-surface flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
      <Search
        className="text-muted-foreground size-3.5 shrink-0"
        aria-hidden="true"
      />
      <input
        ref={box}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={copy.shareSearch}
        aria-label={copy.shareSearch}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </label>
  );
}
