import {
  IexMarketEvent,
  IexQuoteTick,
  IexTradeTick,
  MarketDataSnapshot,
} from "./types";
import { BoundedLog } from "../boundedLog";

export class MarketDataStore {
  private readonly quotesBySymbol = new Map<string, IexQuoteTick>();
  private readonly trades: BoundedLog<IexTradeTick>;

  constructor(maxTrades = 1_000) {
    this.trades = new BoundedLog(maxTrades);
  }

  record(event: IexMarketEvent): void {
    if (event.type === "quote") {
      this.quotesBySymbol.set(event.symbol, { ...event });
      return;
    }

    this.trades.append({ ...event });
  }

  snapshot(symbol?: string): MarketDataSnapshot {
    const normalizedSymbol = symbol?.toUpperCase();
    const quotes = normalizedSymbol === undefined
      ? [...this.quotesBySymbol.values()]
      : [this.quotesBySymbol.get(normalizedSymbol)].filter(
          (quote): quote is IexQuoteTick => quote !== undefined,
        );
    const allTrades = this.trades.snapshot();
    const trades = normalizedSymbol === undefined
      ? allTrades
      : allTrades.filter((trade) => trade.symbol === normalizedSymbol);

    return {
      quotes: quotes.map((quote) => ({ ...quote })),
      trades: trades.map((trade) => ({ ...trade })),
    };
  }
}
