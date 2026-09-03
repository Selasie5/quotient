import { AlertTriangle, FlaskConical, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cancelOrder, getEngineSnapshot, modifyOrder, placeOrder, seedLiquidity } from "./api";
import { DepthBook } from "./components/DepthBook";
import { Header } from "./components/Header";
import { OpenOrders } from "./components/OpenOrders";
import { OrderTicket } from "./components/OrderTicket";
import { PriceChart } from "./components/PriceChart";
import { TradeTape } from "./components/TradeTape";
import { deriveMarketStats } from "./market";
import type { EngineSnapshot, PlaceOrderInput, Side } from "./types";

const SYMBOL = (import.meta.env.VITE_SYMBOL ?? "AAPL").toUpperCase();
const TRADER_ID = "sim-trader";
const EMPTY_SNAPSHOT: EngineSnapshot = {
  book: { bids: [], asks: [] },
  orders: [],
  trades: [],
  marketData: { quotes: [], trades: [] },
};

interface Notice {
  kind: "success" | "error";
  message: string;
}

export default function App() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [selectedLevel, setSelectedLevel] = useState<{ price: number; side: Side }>();
  const orderSequence = useRef(0);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      setSnapshot(await getEngineSnapshot(SYMBOL));
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);
    const timer = window.setInterval(() => void refresh(), 800);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (notice === undefined) return;
    const timer = window.setTimeout(() => setNotice(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const stats = useMemo(() => deriveMarketStats(snapshot.book, snapshot.trades), [snapshot.book, snapshot.trades]);
  const myOrders = useMemo(() => snapshot.orders.filter(order => order.ownerId === TRADER_ID), [snapshot.orders]);
  const quote = snapshot.marketData.quotes[0];

  async function runAction(action: () => Promise<string | void>, success: string) {
    try {
      const resultMessage = await action();
      await refresh();
      setNotice({ kind: "success", message: resultMessage ?? success });
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Action failed" });
    }
  }

  async function submitOrder(order: Omit<PlaceOrderInput, "id" | "ownerId">) {
    setActionBusy(true);
    const id = `sim-${order.side}-${Date.now()}-${orderSequence.current++}`;
    try {
      await runAction(async () => {
        const result = await placeOrder({ ...order, id, ownerId: TRADER_ID });
        const fillCount = result.trades.length;
        return fillCount === 0
          ? "Order accepted and working"
          : `Order accepted · ${fillCount} execution${fillCount === 1 ? "" : "s"}`;
      }, "Order accepted");
    } finally {
      setActionBusy(false);
    }
  }

  async function seed() {
    setActionBusy(true);
    try {
      const reference = quote === undefined ? stats.midpoint ?? 182.40 : (quote.bidPrice + quote.askPrice) / 2;
      await runAction(() => seedLiquidity(reference), "Six bid and six ask levels added");
    } finally {
      setActionBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusyOrderId(id);
    try {
      await runAction(() => cancelOrder(id), "Order cancelled");
    } finally {
      setBusyOrderId(undefined);
    }
  }

  async function modify(id: string, price: number, quantity: number) {
    setBusyOrderId(id);
    try {
      await runAction(async () => {
        const result = await modifyOrder(id, { price, quantity });
        return result.trades.length === 0
          ? undefined
          : `Order modified · ${result.trades.length} execution${result.trades.length === 1 ? "" : "s"}`;
      }, "Order modified");
    } finally {
      setBusyOrderId(undefined);
    }
  }

  return (
    <div className="app-shell">
      <Header symbol={SYMBOL} connected={connected} stats={stats} openOrderCount={myOrders.length} hasLiveQuote={quote !== undefined} />

      {!connected && !loading && (
        <div className="connection-banner" role="alert">
          <AlertTriangle size={16} />
          <span><strong>Engine unavailable.</strong> Start the API on port 3000; this workstation will reconnect automatically.</span>
          <button type="button" onClick={() => void refresh(true)}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      <main className="trading-grid" aria-busy={loading}>
        <aside className="ticket-column">
          <OrderTicket stats={stats} selectedPrice={selectedLevel?.price} selectedSide={selectedLevel?.side} busy={actionBusy} disabled={!connected} onSubmit={submitOrder} />
          <section className="panel simulation-panel">
            <FlaskConical size={17} />
            <div><strong>Need a market?</strong><p>Add balanced resting liquidity around the current midpoint.</p></div>
            <button type="button" onClick={() => void seed()} disabled={actionBusy || !connected}>Seed book</button>
          </section>
        </aside>

        <section className="market-column">
          <PriceChart trades={snapshot.trades} referencePrice={stats.lastPrice} />
          <DepthBook book={snapshot.book} onSelectPrice={(price, side) => setSelectedLevel({ price, side })} />
        </section>

        <aside className="tape-column">
          <TradeTape trades={snapshot.trades} />
        </aside>

        <OpenOrders orders={myOrders} busyOrderId={busyOrderId} onCancel={cancel} onModify={modify} />
      </main>

      <footer className="app-footer">
        <span>Quotient matching engine</span>
        <span>Price–time priority · Cancel-incoming STP</span>
        <span className={connected ? "text-bid" : "text-ask"}>{connected ? "● synchronized" : "● waiting for engine"}</span>
      </footer>

      {notice !== undefined && (
        <div className={`toast ${notice.kind}`} role="status">
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(undefined)}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
