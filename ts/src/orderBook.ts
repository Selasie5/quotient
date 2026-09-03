import { AskBook } from "./askBook";
import { BidBook } from "./bidBook";
import { Order } from "./order";

export class OrderBook {
  private readonly bids = new BidBook();
  private readonly asks = new AskBook();

  addOrder(order: Order): void {
    if (order.side === "buy") {
      this.bids.addOrder(order);
      return;
    }

    this.asks.addOrder(order);
  }

  bestBid(): number | undefined {
    return this.bids.bestPrice();
  }

  bestAsk(): number | undefined {
    return this.asks.bestPrice();
  }

  bestBidOrder(): Order | undefined {
    return this.bids.bestOrder();
  }

  bestAskOrder(): Order | undefined {
    return this.asks.bestOrder();
  }

  dequeueBestBidOrder(): Order | undefined {
    return this.bids.dequeueBestOrder();
  }

  dequeueBestAskOrder(): Order | undefined {
    return this.asks.dequeueBestOrder();
  }

  removeOrder(order: Order): boolean {
    return order.side === "buy"
      ? this.bids.removeOrder(order)
      : this.asks.removeOrder(order);
  }

  reduceOrderQuantity(order: Order, quantity: number): boolean {
    return order.side === "buy"
      ? this.bids.reduceOrderQuantity(order, quantity)
      : this.asks.reduceOrderQuantity(order, quantity);
  }
}
