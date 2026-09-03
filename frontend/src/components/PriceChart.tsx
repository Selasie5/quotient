import { ChartNoAxesCombined } from "lucide-react";
import { formatPrice, pricePath } from "../market";
import type { Trade } from "../types";

export function PriceChart({ trades, referencePrice }: { trades: Trade[]; referencePrice?: number }) {
  const prices = trades.slice(-60).map(trade => trade.price);
  const path = pricePath(prices, 600, 160);
  const high = prices.length > 0 ? Math.max(...prices) : referencePrice;
  const low = prices.length > 0 ? Math.min(...prices) : referencePrice;

  return (
    <section className="panel chart-panel" aria-labelledby="chart-title">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">ENGINE EXECUTIONS</span>
          <h2 id="chart-title">Session price</h2>
        </div>
        <span className="range-label">H {formatPrice(high)} · L {formatPrice(low)}</span>
      </div>
      <div className="chart-stage">
        <div className="chart-grid" />
        {path === "" ? (
          <div className="chart-empty"><ChartNoAxesCombined size={22} /><span>Price trace begins after two executions</span></div>
        ) : (
          <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Session execution price chart">
            <path className="chart-area" d={`${path} L600,160 L0,160 Z`} />
            <path className="chart-line" d={path} />
          </svg>
        )}
        <div className="chart-label high">{formatPrice(high)}</div>
        <div className="chart-label low">{formatPrice(low)}</div>
      </div>
    </section>
  );
}
