import { Order } from "./order";
import { OrderBook } from "./orderBook";
import { createTrade, Trade } from "./trade";

export class MatchingEngine {
  private readonly book = new OrderBook();

  submitOrder(incoming: Order): Trade[] {
    const trades: Trade[] = [];
    let remainingQuantity = incoming.quantity;

    while (remainingQuantity > 0) {
      const resting =
        incoming.side === "buy"
          ? this.book.bestAskOrder()
          : this.book.bestBidOrder();

      if (resting === undefined || !this.pricesCross(incoming, resting)) break;

      const executedQuantity = Math.min(
        remainingQuantity,
        resting.quantity,
      );

      if (executedQuantity === resting.quantity) {
        if (!this.book.removeOrder(resting)) {
          throw new Error(`Resting order ${resting.id} could not be removed`);
        }
      } else if (!this.book.reduceOrderQuantity(resting, executedQuantity)) {
        throw new Error(`Resting order ${resting.id} could not be reduced`);
      }

      trades.push(
        createTrade(
          resting.price!,
          executedQuantity,
          incoming.side === "buy" ? incoming.id : resting.id,
          incoming.side === "sell" ? incoming.id : resting.id,
        ),
      );

      remainingQuantity -= executedQuantity;
    }

    if (remainingQuantity > 0 && incoming.type === "limit") {
      this.book.addOrder({ ...incoming, quantity: remainingQuantity });
    }

    return trades;
  }

  bestBid(): number | undefined {
    return this.book.bestBid();
  }

  bestAsk(): number | undefined {
    return this.book.bestAsk();
  }

  bestBidOrder(): Order | undefined {
    return this.book.bestBidOrder();
  }

  bestAskOrder(): Order | undefined {
    return this.book.bestAskOrder();
  }

  private pricesCross(incoming: Order, resting: Order): boolean {
    if (incoming.type === "market") return true;

    if (incoming.side === "buy") {
      return incoming.price! >= resting.price!;
    }

    return incoming.price! <= resting.price!;
  }
}
