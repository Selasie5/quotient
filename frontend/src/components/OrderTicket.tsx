import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarketStats } from "../market";
import { formatPrice, formatQuantity } from "../market";
import type { OrderType, PlaceOrderInput, Side } from "../types";

interface OrderTicketProps {
  stats: MarketStats;
  selectedPrice?: number;
  selectedSide?: Side;
  busy: boolean;
  disabled: boolean;
  onSubmit: (order: Omit<PlaceOrderInput, "id" | "ownerId">) => Promise<void>;
}

export function OrderTicket({ stats, selectedPrice, selectedSide, busy, disabled, onSubmit }: OrderTicketProps) {
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<OrderType>("limit");
  const [quantity, setQuantity] = useState("100");
  const [price, setPrice] = useState("182.40");

  useEffect(() => {
    if (selectedPrice !== undefined) setPrice(selectedPrice.toFixed(2));
    if (selectedSide !== undefined) setSide(selectedSide);
  }, [selectedPrice, selectedSide]);

  useEffect(() => {
    if (stats.midpoint !== undefined && price === "182.40") {
      setPrice(stats.midpoint.toFixed(2));
    }
  }, [stats.midpoint, price]);

  const quantityNumber = Number(quantity);
  const priceNumber = Number(price);
  const referencePrice = type === "limit" ? priceNumber : stats.lastPrice;
  const estimatedNotional = Number.isFinite(quantityNumber) && referencePrice !== undefined
    ? quantityNumber * referencePrice
    : 0;
  const valid = quantityNumber > 0 && (type === "market" || priceNumber > 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    await onSubmit({
      type,
      side,
      quantity: quantityNumber,
      ...(type === "limit" ? { price: priceNumber } : {}),
    });
  }

  return (
    <section className={`panel ticket-panel side-${side}`} aria-labelledby="ticket-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">EXECUTION</span>
          <h2 id="ticket-title">Order ticket</h2>
        </div>
        <span className="shortcut-hint">Enter ↵</span>
      </div>

      <form onSubmit={submit}>
        <div className="side-selector" aria-label="Order side">
          <button type="button" className={side === "buy" ? "active buy" : ""} aria-pressed={side === "buy"} onClick={() => setSide("buy")}>
            <ArrowDownToLine size={16} /> Buy
          </button>
          <button type="button" className={side === "sell" ? "active sell" : ""} aria-pressed={side === "sell"} onClick={() => setSide("sell")}>
            <ArrowUpFromLine size={16} /> Sell
          </button>
        </div>

        <fieldset className="type-selector">
          <legend>Order type</legend>
          <label><input type="radio" name="type" checked={type === "limit"} onChange={() => setType("limit")} /> Limit</label>
          <label><input type="radio" name="type" checked={type === "market"} onChange={() => setType("market")} /> Market</label>
        </fieldset>

        <label className="field-label" htmlFor="order-quantity">
          <span>Quantity</span><span>shares</span>
        </label>
        <div className="number-field">
          <input id="order-quantity" inputMode="numeric" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} />
          <span>SH</span>
        </div>
        <div className="quick-sizes" aria-label="Quick quantities">
          {[10, 50, 100, 500].map(size => (
            <button type="button" key={size} onClick={() => setQuantity(String(size))}>{size}</button>
          ))}
        </div>

        <label className="field-label" htmlFor="order-price">
          <span>Limit price</span><span>USD</span>
        </label>
        <div className={`number-field ${type === "market" ? "is-disabled" : ""}`}>
          <input id="order-price" inputMode="decimal" type="number" min="0.01" step="0.01" value={price} disabled={type === "market"} onChange={event => setPrice(event.target.value)} />
          <span>{type === "market" ? "MKT" : "$"}</span>
        </div>

        <dl className="ticket-review">
          <div><dt>Estimated value</dt><dd>${formatQuantity(Math.round(estimatedNotional))}</dd></div>
          <div><dt>Reference</dt><dd>{type === "market" ? `Market · ${formatPrice(stats.lastPrice)}` : `Limit · ${formatPrice(priceNumber || undefined)}`}</dd></div>
          <div><dt>Protection</dt><dd>Cancel incoming STP</dd></div>
        </dl>

        <button className={`submit-order ${side}`} type="submit" disabled={!valid || busy || disabled}>
          {busy ? <LoaderCircle className="spin" size={17} /> : side === "buy" ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}
          {busy ? "Routing order…" : `Place ${side} order`}
        </button>
      </form>
    </section>
  );
}
