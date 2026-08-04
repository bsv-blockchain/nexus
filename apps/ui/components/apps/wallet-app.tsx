"use client";

import { Portfolio } from "@/components/apps/wallet/portfolio";
import {
  ExchangeSheet,
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
import { payAvailable } from "@/lib/pay-data";
import {
  Coins,
  Image as ImageIcon,
  Link2,
  Receipt,
  Scissors,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

/** Canvas sections. The sidebar renders these on desktop, tabs on mobile. */
export const WALLET_SECTIONS: {
  id: WalletSection;
  label: string;
  icon: typeof Coins;
}[] = [
  { id: "cash", label: "Cash", icon: Coins },
  { id: "collectibles", label: "Collectibles", icon: ImageIcon },
  { id: "activity", label: "Activity", icon: Receipt },
  { id: "links", label: "Links", icon: Link2 },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "splits", label: "Splits", icon: Scissors },
];

/**
 * Pay & Receive.
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
    walletSection,
    setWalletSection,
    walletFilter,
    walletIntent,
    setWalletIntent,
    openApp,
  } = useHub();
  const account = getWalletAccount();
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
  const activity = useActivity(getWalletTransactions(account.id));
  const transactions =
    activity.mode === "demo"
      ? [
          ...fromCommands.filter((tx) => tx.accountId === account.id),
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
        return (
          <div className="mx-auto w-full max-w-2xl">
            {live ? (
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
          <PaymentLinks onCreate={() => toast.info(copy.linkComingSoon)} />
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
            onOpenToken={openToken}
            onSend={() => (live ? setPayOpen("pay") : send())}
            onReceive={() =>
              live ? setPayOpen("get") : setWalletIntent({ kind: "receive" })
            }
            onExchange={() => setWalletIntent({ kind: "exchange" })}
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
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden"
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6">
        {body}
      </div>

      <PaySheet
        open={payOpen !== null}
        initialDirection={payOpen ?? "pay"}
        onClose={() => setPayOpen(null)}
      />

      <SendSheet
        open={walletIntent?.kind === "send"}
        tokenId={walletIntent?.tokenId ?? "bsv"}
        presetPersonId={walletIntent?.personId ?? null}
        onClose={closeIntent}
        onSend={({ token, units, person }) => {
          recordPayment({
            person,
            sats: token.base ? Math.round(units * 100_000_000) : 0,
            memo: copy.sentFromWallet,
            accountId: account.id,
            ...(token.base ? {} : { token: { id: token.id, units } }),
          });
          closeIntent();
          toast.success(`${copy.sent} ${person.name}`);
        }}
      />

      <ReceiveSheet
        open={walletIntent?.kind === "receive"}
        tokenId={walletIntent?.tokenId ?? "bsv"}
        onClose={closeIntent}
      />

      <Sheet
        open={Boolean(whois)}
        onClose={() => setWhois(null)}
        label={whois ? whois.name : "Identity"}
      >
        {whois && <WhoisCard person={whois} />}
      </Sheet>

      <ExchangeSheet
        open={walletIntent?.kind === "exchange"}
        onClose={closeIntent}
        onExchange={({ from, to, fromUnits, toUnits }) => {
          closeIntent();
          toast.success(
            `${copy.exchanged} ${fromUnits} ${from.symbol} → ${toUnits.toFixed(2)} ${to.symbol}`,
          );
        }}
      />
    </div>
    </ProfileActionsProvider>
  );
}
