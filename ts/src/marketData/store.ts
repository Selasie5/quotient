import {
  IexMarketEvent,
  IexQuoteTick,
  IexTradeTick,
  MarketDataSnapshot,
} from "./types";

export class MarketDataStore {
  private readonly quotesBySymbol = new Map<string, IexQuoteTick>();
  private readonly trades: IexTradeTick[] = [];

  record(event: IexMarketEvent): void {
    if (event.type === "quote") {
      this.quotesBySymbol.set(event.symbol, { ...event });
      return;
    }

    this.trades.push({ ...event });
  }

  snapshot(symbol?: string): MarketDataSnapshot {
    const normalizedSymbol = symbol?.toUpperCase();
    const quotes = normalizedSymbol === undefined
      ? [...this.quotesBySymbol.values()]
      : [this.quotesBySymbol.get(normalizedSymbol)].filter(
          (quote): quote is IexQuoteTick => quote !== undefined,
        );
    const trades = normalizedSymbol === undefined
      ? this.trades
      : this.trades.filter((trade) => trade.symbol === normalizedSymbol);

    return {
      quotes: quotes.map((quote) => ({ ...quote })),
      trades: trades.map((trade) => ({ ...trade })),
    };
  }
}
