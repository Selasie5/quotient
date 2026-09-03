import { Clock3 } from "lucide-react";
import { formatPrice, formatQuantity } from "../market";
import type { Trade } from "../types";

export function TradeTape({ trades }: { trades: Trade[] }) {
  const newest = [...trades].reverse().slice(0, 18);

  return (
    <section className="panel tape-panel" aria-labelledby="tape-title">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">MATCH LOG</span>
          <h2 id="tape-title">Time &amp; sales</h2>
        </div>
        <Clock3 size={16} />
      </div>
      <div className="tape-columns" aria-hidden="true"><span>Time</span><span>Price</span><span>Size</span></div>
      <div className="tape-list">
        {newest.length === 0 ? (
          <div className="empty-state"><strong>No executions yet</strong><span>Seed liquidity, then cross the spread.</span></div>
        ) : newest.map((trade, index) => {
          const previous = newest[index + 1];
          const direction = previous === undefined || trade.price === previous.price ? "flat" : trade.price > previous.price ? "up" : "down";
          return (
            <div className={`tape-row ${direction}`} key={`${trade.timestamp}-${trade.buyOrderId}-${trade.sellOrderId}`}>
              <time>{new Date(trade.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
              <strong>{formatPrice(trade.price)}</strong>
              <span>{formatQuantity(trade.quantity)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
