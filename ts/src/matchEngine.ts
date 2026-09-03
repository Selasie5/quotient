import { Order } from "./order";
import { OrderBook } from "./orderBook";
import { createTrade, Trade } from "./trade";

export class MatchingEngine {
  private readonly book = new OrderBook();

  submitOrder(incoming: Order): Trade | undefined {
    if (incoming.type !== "limit") {
      throw new Error("Simple matching supports limit orders only");
    }

    const resting =
      incoming.side === "buy"
        ? this.book.bestAskOrder()
        : this.book.bestBidOrder();

    if (resting === undefined || !this.pricesCross(incoming, resting)) {
      this.book.addOrder(incoming);
      return undefined;
    }

    if (incoming.quantity !== resting.quantity) {
      throw new Error("Simple matching requires equal order quantities");
    }

    if (!this.book.removeOrder(resting)) {
      throw new Error(`Resting order ${resting.id} could not be removed`);
    }

    return createTrade(
      resting.price!,
      incoming.quantity,
      incoming.side === "buy" ? incoming.id : resting.id,
      incoming.side === "sell" ? incoming.id : resting.id,
    );
  }

  bestBid(): number | undefined {
    return this.book.bestBid();
  }

  bestAsk(): number | undefined {
    return this.book.bestAsk();
  }

  private pricesCross(incoming: Order, resting: Order): boolean {
    if (incoming.side === "buy") {
      return incoming.price! >= resting.price!;
    }

    return incoming.price! <= resting.price!;
  }
}
