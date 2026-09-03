import { Activity, Database, Radio, Waves } from "lucide-react";
import { formatPrice, formatQuantity, type MarketStats } from "../market";

interface HeaderProps {
  symbol: string;
  connected: boolean;
  stats: MarketStats;
  openOrderCount: number;
  hasLiveQuote: boolean;
}

export function Header({
  symbol,
  connected,
  stats,
  openOrderCount,
  hasLiveQuote,
}: HeaderProps) {
  return (
    <>
      <header className="app-header">
        <div className="brand-lockup" aria-label="Quotient simulator">
          <span className="brand-mark"><Waves size={18} strokeWidth={2} /></span>
          <span className="brand-name">QUOTIENT</span>
          <span className="environment-label">SIM</span>
        </div>

        <div className="instrument-identity">
          <strong>{symbol}</strong>
          <span>US EQUITY · PAPER VENUE</span>
        </div>

        <div className="header-status">
          <span className={`status-dot ${connected ? "is-online" : "is-offline"}`} />
          <span>{connected ? "Engine online" : "Engine offline"}</span>
          <span className="status-divider" />
          <span className="feed-state">
            <Radio size={14} /> {hasLiveQuote ? "IEX quote" : "Local simulation"}
          </span>
        </div>
      </header>

      <section className="market-strip" aria-label="Market summary">
        <div className="primary-quote">
          <span className="eyebrow">LAST / MID</span>
          <strong>{formatPrice(stats.lastPrice)}</strong>
          <span className="currency">USD</span>
        </div>
        <Metric label="Best bid" value={formatPrice(stats.bestBid)} tone="bid" />
        <Metric label="Best ask" value={formatPrice(stats.bestAsk)} tone="ask" />
        <Metric label="Spread" value={stats.spread === undefined ? "—" : stats.spread.toFixed(2)} />
        <Metric label="Matched volume" value={formatQuantity(stats.tradedVolume)} icon={<Activity size={13} />} />
        <Metric label="Open orders" value={String(openOrderCount)} icon={<Database size={13} />} />
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "bid" | "ask";
  icon?: React.ReactNode;
}) {
  return (
    <div className="market-metric">
      <span className="metric-label">{icon}{label}</span>
      <strong className={tone === undefined ? undefined : `text-${tone}`}>{value}</strong>
    </div>
  );
}
