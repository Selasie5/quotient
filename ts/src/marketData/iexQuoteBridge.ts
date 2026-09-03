import { MatchingEngine } from "../matchEngine";
import { createOrder, Side } from "../order";
import { IexQuoteTick } from "./types";

export class IexQuoteBridge {
  constructor(
    private readonly engine: MatchingEngine,
    private readonly symbol: string,
    private readonly lotSize = 100,
  ) {}

  process(quote: IexQuoteTick): void {
    if (quote.symbol.toUpperCase() !== this.symbol.toUpperCase()) return;

    this.engine.cancelOrder(this.orderId("buy"));
    this.engine.cancelOrder(this.orderId("sell"));

    this.submitSide("buy", quote.bidPrice, quote.bidSize, quote.timestamp);
    this.submitSide("sell", quote.askPrice, quote.askSize, quote.timestamp);
  }

  private submitSide(
    side: Side,
    price: number,
    size: number,
    timestamp: string,
  ): void {
    if (price <= 0 || size <= 0) return;

    this.engine.submitOrder(
      createOrder({
        id: this.orderId(side),
        ownerId: `iex:${this.symbol.toUpperCase()}:${side}`,
        type: "limit",
        side,
        price,
        quantity: size * this.lotSize,
        timestamp: Date.parse(timestamp),
      }),
    );
  }

  private orderId(side: Side): string {
    return `iex:${this.symbol.toUpperCase()}:${side}`;
  }
}
