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

  dequeueBestBidOrder(): Order | undefined {
    return this.bids.dequeueBestOrder();
  }

  dequeueBestAskOrder(): Order | undefined {
    return this.asks.dequeueBestOrder();
  }
}
