import type { BookDepth, DepthLevel, Trade } from "./types";

export interface MarketStats {
  bestBid?: number;
  bestAsk?: number;
  midpoint?: number;
  spread?: number;
  lastPrice?: number;
  tradedVolume: number;
}

export function deriveMarketStats(book: BookDepth, trades: Trade[]): MarketStats {
  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;
  const midpoint = bestBid !== undefined && bestAsk !== undefined
    ? (bestBid + bestAsk) / 2
    : bestBid ?? bestAsk;

  return {
    bestBid,
    bestAsk,
    midpoint,
    spread: bestBid !== undefined && bestAsk !== undefined
      ? Number((bestAsk - bestBid).toFixed(8))
      : undefined,
    lastPrice: trades.at(-1)?.price ?? midpoint,
    tradedVolume: trades.reduce((total, trade) => total + trade.quantity, 0),
  };
}

export function visibleDepth(book: BookDepth, limit = 7): {
  bids: DepthLevel[];
  asks: DepthLevel[];
  maxQuantity: number;
} {
  const bids = book.bids.slice(0, limit);
  const asks = book.asks.slice(0, limit).reverse();
  const maxQuantity = Math.max(1, ...bids.map(level => level.quantity), ...asks.map(level => level.quantity));
  return { bids, asks, maxQuantity };
}

export function pricePath(prices: number[], width: number, height: number): string {
  if (prices.length < 2) return "";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const range = high - low || 1;

  return prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price - low) / range) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function formatPrice(value?: number): string {
  return value === undefined ? "—" : value.toFixed(2);
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
