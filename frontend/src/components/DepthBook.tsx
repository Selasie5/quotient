import { Crosshair } from "lucide-react";
import { formatPrice, formatQuantity, visibleDepth } from "../market";
import type { BookDepth, DepthLevel, Side } from "../types";

interface DepthBookProps {
  book: BookDepth;
  onSelectPrice: (price: number, side: Side) => void;
}

export function DepthBook({ book, onSelectPrice }: DepthBookProps) {
  const depth = visibleDepth(book);
  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined;

  return (
    <section className="panel depth-panel" aria-labelledby="depth-title">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">PRICE–TIME PRIORITY</span>
          <h2 id="depth-title">Order book</h2>
        </div>
        <div className="depth-legend"><span>Price</span><span>Size</span></div>
      </div>

      <div className="depth-ladder">
        {depth.asks.length === 0 ? <EmptySide label="No resting asks" /> : depth.asks.map(level => (
          <DepthRow key={`ask-${level.price}`} level={level} side="ask" max={depth.maxQuantity} onClick={() => onSelectPrice(level.price, "buy")} />
        ))}

        <div className="spread-rail">
          <span className="spread-edge ask-edge">{formatPrice(bestAsk)}</span>
          <span className="spread-center"><Crosshair size={13} /> SPREAD {spread === undefined ? "—" : spread.toFixed(2)}</span>
          <span className="spread-edge bid-edge">{formatPrice(bestBid)}</span>
        </div>

        {depth.bids.length === 0 ? <EmptySide label="No resting bids" /> : depth.bids.map(level => (
          <DepthRow key={`bid-${level.price}`} level={level} side="bid" max={depth.maxQuantity} onClick={() => onSelectPrice(level.price, "sell")} />
        ))}
      </div>
      <p className="panel-footnote">Select an ask to prepare a buy, or a bid to prepare a sell.</p>
    </section>
  );
}

function DepthRow({ level, side, max, onClick }: { level: DepthLevel; side: "bid" | "ask"; max: number; onClick: () => void }) {
  return (
    <button className={`depth-row ${side}`} type="button" onClick={onClick} aria-label={`${side} ${level.quantity} shares at ${level.price.toFixed(2)}`}>
      <span className="depth-bar" style={{ width: `${(level.quantity / max) * 100}%` }} />
      <span className="depth-price">{formatPrice(level.price)}</span>
      <span className="depth-size">{formatQuantity(level.quantity)}</span>
    </button>
  );
}

function EmptySide({ label }: { label: string }) {
  return <div className="empty-depth">{label}</div>;
}
