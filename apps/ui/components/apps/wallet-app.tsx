"use client";

import { AppMenu } from "@/components/hub/app-menu";
import { SwapSheet } from "@/components/apps/wallet/swap-flow";
import { useWalletAccountId } from "@/components/apps/wallet/use-wallet-account";
import { getWallet } from "@/lib/wallets-store";
import { Portfolio } from "@/components/apps/wallet/portfolio";
import {
  WalletSwitcher,
  WalletTrigger,
} from "@/components/apps/wallet/wallet-switcher";
import {
  ReceiveSheet,
  SendSheet,
} from "@/components/apps/wallet/wallet-flows";
import { Collectibles } from "@/components/apps/wallet/collectibles";
import { Contacts } from "@/components/apps/wallet/contacts";
import { Splits } from "@/components/apps/wallet/splits";
import {
  Activity,
  ActivityDetail,
  PaymentLinks,
  TokenDetail,
} from "@/components/apps/wallet/wallet-views";
import { ProfileActionsProvider } from "@/components/apps/messages/profile-hovercard";
import { Sheet } from "@/components/apps/messages/sheet";
import { useProfileQuickActions } from "@/components/apps/messages/use-profile-actions";
import { WhoisCard } from "@/components/apps/messages/whois-card";
import { useHub, type WalletSection } from "@/components/hub/hub-provider";
import { recordPayment } from "@/lib/command-effects";
import {
  content,
  getWalletAccount,
  getWalletTransactions,
  type MessagePerson,
} from "@/lib/data";
import { useCommandEffects } from "@/lib/use-command-effects";
import { useActivity } from "@/lib/wallet-live";
import { PaySheet, type Direction } from "@/components/apps/wallet/pay-flow";
import { Transactions } from "@/components/apps/wallet/transactions";
import { resolveDataMode } from "@/lib/data-mode";
import { can, payAvailable } from "@/lib/pay-data";
import { DEMO_SURFACES } from "@/lib/surfaces";
import {
  Coins,
  Image as ImageIcon,
  Link2,
  Receipt,
  Scissors,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";
import { setShareStatus } from "@/lib/splits-store";

/**
 * Canvas sections. The sidebar renders these on desktop, tabs on mobile.
 *
 * Cash and Activity read the wallet; the other four read lib/data — invented
 * collectibles, payment links, contacts and split bills — so a shipping build
 * drops them rather than offer a tab that can only ever show someone else's
 * made-up history. See lib/surfaces.ts.
 */
const ALL_WALLET_SECTIONS: {
  id: WalletSection;
  label: string;
  icon: typeof Coins;
}[] = [
  { id: "cash", label: "Cash", icon: Coins },
  { id: "collectibles", label: "Collectibles", icon: ImageIcon },
  { id: "activity", label: "Activity", icon: Receipt },
  /* From content, unlike its five siblings: "Payment links" already exists
     there and the section had drifted to a shortened copy of it. The other five
     are still hardcoded here. */
  { id: "links", label: content.wallet.links, icon: Link2 },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "splits", label: "Splits", icon: Scissors },
];

const LIVE_SECTIONS: ReadonlySet<WalletSection> = new Set(["cash", "activity"]);

export const WALLET_SECTIONS = DEMO_SURFACES
  ? ALL_WALLET_SECTIONS
  : ALL_WALLET_SECTIONS.filter((section) => LIVE_SECTIONS.has(section.id));

/**
 * Payments.
 *
 * BSV is the base currency throughout: it heads the asset list, it is what a
 * bare amount means, and every other asset is valued through it. Tokens sit
 * beside it rather than under a separate tab, which is how Phantom and Coinbase
 * treat a chain's native coin.
 *
 * Navigation is the hub's own contextual sidebar at md+ and a scrolling tab bar
 * below that, so the same sections work on either.
 */
export function WalletApp(): ReactNode {
  const {
    walletSection: requestedSection,
    setWalletSection,
    walletFilter,
    walletIntent,
    setWalletIntent,
    openApp,
    openDetailPane,
  } = useHub();
  // A section this build does not ship is not an error: hub state persists across
  // upgrades and deep links carry it, so a dropped tab falls back to Cash rather
  // than rendering a body no sidebar entry can navigate away from.
  const walletSection = WALLET_SECTIONS.some((s) => s.id === requestedSection)
    ? requestedSection
    : "cash";
  /* The wallet the workspace is spending from, not `walletAccounts[0]`. Cash
     and Activity both read this, and reading the first row meant switching
     wallet changed the switcher and nothing else on the screen. */
  const selectedId = useWalletAccountId();
  /* `account` is only ever read for its shape — a name and an address to draw.
     Anything that FILTERS uses `selectedId`, which is empty when the workspace
     has no wallet and so matches nothing; falling back here and then filtering
     on `account.id` would have shown Everyday's history under a workspace that
     has never connected a wallet. */
  const account = getWallet(selectedId) ?? getWalletAccount();
  const { walletTransactions: fromCommands } = useCommandEffects();
  const copy = content.wallet;

  /**
   * A detail view is tagged with the section it was opened from, so switching
   * section in the sidebar drops it without needing an effect to clear state —
   * the detail is simply stale and ignored.
   */
  const [whois, setWhois] = useState<MessagePerson | null>(null);
  /**
   * The real rails, when a shell is there to run them. In demo mode the fixture
   * sheets stay: they are what makes the screenshots and the App Store review
   * build work, and they never touch a wallet.
   */
  const live = payAvailable();
  /*
   * A live wallet on a shell with no pay rails (desktop today). The fixture
   * sheets are the only thing Send/Receive/Exchange could open there —
   * invented contacts next to a real balance — so the actions disappear
   * instead. Porting the rails to that shell is its own spec.
   */
  const hidePayActions = resolveDataMode() === "live" && !can("pay");
  // The live Activity pager needs only the ledger (tx.*), not the pay rails —
  // desktop has the former and not yet the latter.
  const liveActivity = live || (resolveDataMode() === "live" && can("tx"));
  const [payOpen, setPayOpen] = useState<Direction | null>(null);
  const [detail, setDetail] = useState<{
    section: WalletSection;
    tokenId?: string;
    txId?: string;
  } | null>(null);
  const active = detail?.section === walletSection ? detail : null;
  const tokenId = active?.tokenId ?? null;
  const txId = active?.txId ?? null;
  const openToken = (id: string): void =>
    setDetail({ section: walletSection, tokenId: id });
  const openTxDetail = (id: string): void =>
    setDetail({ section: walletSection, txId: id });
  // Sheets are driven straight off the shared intent, so closing is a single
  // clear and the sidebar's docked buttons open the same surfaces.
  const closeIntent = (): void => setWalletIntent(null);
  const send = (tokenId = "bsv", personId?: string): void =>
    setWalletIntent({
      kind: "send",
      tokenId,
      ...(personId ? { personId } : {}),
    });

  // Demo: locally-recorded payments in front of the fixture history. Live: the
  // wallet's own ledger, and nothing invented alongside it.
  const activity = useActivity(getWalletTransactions(selectedId));
  const transactions =
    activity.mode === "demo"
      ? [
          ...fromCommands.filter((tx) => tx.accountId === selectedId),
          ...activity.transactions,
        ]
      : activity.transactions;
  const filtered = transactions.filter((tx) => {
    if (walletFilter === "all") return true;
    if (walletFilter === "pending") return tx.status === "pending";
    return tx.direction === walletFilter;
  });
  const openTx = txId
    ? (transactions.find((tx) => tx.id === txId) ?? null)
    : null;

  /*
   * The fixture sheets render only in demo mode, but walletIntent arrives from
   * places that do not know which mode this is — the sidebar's docked
   * Send/Receive, TokenDetail's buttons. In live mode the intent is translated
   * here instead: to the real PaySheet when the shell has pay rails, to an
   * honest refusal when it does not. Without this, a docked Send on a live
   * wallet opened a fixture sheet full of invented contacts.
   */
  const fixtureSheets = activity.mode === "demo";
  useEffect(() => {
    if (!walletIntent || fixtureSheets) return;
    if (live) {
      if (walletIntent.kind === "send") setPayOpen("pay");
      else if (walletIntent.kind === "receive") setPayOpen("get");
      else toast.info("Exchange is not available yet.");
    } else {
      toast.info("Payments are not available on this device yet.");
    }
    setWalletIntent(null);
  }, [walletIntent, fixtureSheets, live, setWalletIntent]);

  /* Declared above `body`, which renders the trigger that opens it. */
  const [switching, setSwitching] = useState(false);

  const go = (section: WalletSection): void => {
    setWalletSection(section);
    setDetail(null);
  };

  const body = ((): ReactNode => {
    // Detail views take over the canvas, with a back button, rather than
    // stacking a sheet on top of a sheet.
    if (openTx) {
      return (
        <ActivityDetail
          tx={openTx}
          onBack={() => setDetail(null)}
          onExplore={() => {
            setDetail(null);
            openApp("tx-viewer");
          }}
        />
      );
    }
    if (tokenId) {
      return (
        <TokenDetail
          tokenId={tokenId}
          transactions={transactions}
          onBack={() => setDetail(null)}
          onSend={(id) => send(id)}
          onReceive={(id) => setWalletIntent({ kind: "receive", tokenId: id })}
          onOpenTx={openTxDetail}
        />
      );
    }

    switch (walletSection) {
      case "collectibles":
        return <Collectibles onOpenMarket={() => openApp("market")} />;
      case "activity":
        // Live: the wallet's own ledger, with the status mapping and per-row
        // actions the source app had. Demo: the fixture history, unchanged.
        // Gated on the tx capability, not payAvailable(): the pager only reads
        // the ledger, and desktop ships tx.* without the pay rails.
        return (
          <div className="mx-auto w-full max-w-2xl">
            {liveActivity ? (
              <Transactions />
            ) : (
              <>
                <h2 className="mb-3 text-lg font-bold">{copy.historyTitle}</h2>
                <Activity
                  transactions={filtered}
                  onOpen={openTxDetail}
                  empty={copy.noActivity}
                />
              </>
            )}
          </div>
        );
      case "links":
        return (
          <PaymentLinks
            onCreate={() =>
              openDetailPane({ kind: "new-payment-link", id: "" })
            }
          />
        );
      case "contacts":
        return (
          <Contacts
            onSend={(personId) => send("bsv", personId)}
            onRequest={(personId) => {
              openApp("messages");
              toast.info(copy.requestInMessages);
              void personId;
            }}
            onMessage={() => openApp("messages")}
            onWhois={(person) => setWhois(person)}
          />
        );
      case "splits":
        return <Splits />;
      default:
        return (
          <Portfolio
            /* Phones only. The column carries it at md+, and a second copy
               level with the balance is the placement this moved away from. */
            wallet={
              <span className="md:hidden">
                <WalletTrigger onOpen={() => setSwitching(true)} />
              </span>
            }
            onOpenToken={openToken}
            {...(hidePayActions
              ? {}
              : {
                  onSend: () => (live ? setPayOpen("pay") : send()),
                  onReceive: () =>
                    live
                      ? setPayOpen("get")
                      : setWalletIntent({ kind: "receive" }),
                  /*
                   * Exchange exists in the demo and nowhere else. There is no rail
                   * behind it on a real wallet, so it rendered as a third button
                   * whose only outcome was "not available yet" — a control that
                   * spends a tap to say no. Portfolio drops any action with no
                   * handler, so omitting it here is what hides it.
                   */
                  ...(fixtureSheets
                    ? {
                        onExchange: () => setWalletIntent({ kind: "exchange" }),
                      }
                    : {}),
                })}
          />
        );
    }
  })();

  /*
   * The same actions the card offers everywhere else.
   *
   * The wallet used to build its own set — Pay opened a transfer sheet, and
   * Request and Vouch were absent because there is no composer here. That made
   * the same card mean different things in two places. They are commands, so
   * they go where commands go.
   */
  const profileActions = useProfileQuickActions();

  return (
    <ProfileActionsProvider actions={profileActions}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Mobile section tabs; the sidebar carries these at md+. */}
        <nav
          aria-label={copy.sections}
          className="border-border flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2 md:hidden"
        >
          {WALLET_SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = walletSection === id && !tokenId && !txId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-surface-hover"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* The wallet picker used to head this row, above everything. It heads
            one card rather than the page — a balance belongs to one wallet, and
            the two belong in the same frame — so it is passed into Portfolio
            and this row keeps only the app's own menu. */}
        <div className="flex shrink-0 items-center justify-end px-4 pt-4 sm:px-6">
          <AppMenu slug="wallet" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6">
          {body}
        </div>

        {/* Live: the real rails. `switching` is set by WalletTrigger above, and
          the switcher itself renders one wallet and no picker when the shell is
          answering — one wallet per device is docs/DECISIONS.md §3, not a gap. */}
        <WalletSwitcher open={switching} onClose={() => setSwitching(false)} />

        <PaySheet
          open={payOpen !== null}
          initialDirection={payOpen ?? "pay"}
          onClose={() => setPayOpen(null)}
        />

        {/* Demo only — in live mode the translation effect above consumes the
          intent before these could open, and mounting them at all would put
          fixture contacts one state-glitch away from a real wallet. */}
        {fixtureSheets ? (
          <>
            {/* Keyed on the intent so a new one remounts the sheet.
              `SendSheet` seeds its fields from these props on first render —
              the honest way to hold a draft somebody is editing — and this
              stays mounted across intents, so without a key the second intent
              opened on the first one's amount and recipient. */}
            <SendSheet
              key={
                walletIntent?.kind === "send"
                  ? `${walletIntent.tokenId}:${walletIntent.personId ?? ""}:${walletIntent.units ?? ""}`
                  : "send"
              }
              open={walletIntent?.kind === "send"}
              tokenId={walletIntent?.tokenId ?? "bsv"}
              presetPersonId={walletIntent?.personId ?? null}
              presetUnits={walletIntent?.units ?? null}
              onClose={closeIntent}
              onSend={({ token, units, person }) => {
                recordPayment({
                  person,
                  sats: token.base ? Math.round(units * 100_000_000) : 0,
                  memo: copy.sentFromWallet,
                  accountId: account.id,
                  ...(token.base ? {} : { token: { id: token.id, units } }),
                });
                /* A share is settled by the money leaving, not by the button
                   that opened this sheet — which is why the intent carries
                   what it settles and this is the place that acts on it. */
                const settles = walletIntent?.settles;
                if (settles) {
                  setShareStatus(settles.splitId, settles.personId, "paid");
                }
                closeIntent();
                toast.success(`${copy.sent} ${person.name}`);
              }}
            />

            <ReceiveSheet
              open={walletIntent?.kind === "receive"}
              tokenId={walletIntent?.tokenId ?? "bsv"}
              onClose={closeIntent}
            />

            <SwapSheet
              open={walletIntent?.kind === "exchange"}
              onClose={closeIntent}
              onExchange={({ from, to, fromUnits, toUnits }) => {
                closeIntent();
                toast.success(
                  `${copy.exchanged} ${fromUnits} ${from.symbol} → ${toUnits.toFixed(2)} ${to.symbol}`
                );
              }}
            />
          </>
        ) : null}

        <Sheet
          open={Boolean(whois)}
          onClose={() => setWhois(null)}
          label={whois ? whois.name : "Identity"}
        >
          {whois && <WhoisCard person={whois} />}
        </Sheet>
      </div>
    </ProfileActionsProvider>
  );
}
