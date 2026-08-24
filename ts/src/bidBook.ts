import { Order } from "./order";
import { PriceLevel } from "./priceLevel";

export class BidBook {
  private levels = new Map<number, PriceLevel>;

  addOrder(order: Order): void {
    if (!this.levels.has(order.price)) {
      this.levels.set(order.price, new PriceLevel());
    }
    this.levels.get(order.price)!.enqueue(order);
  }

  bestPrice(): number | undefined {
    let best: number | undefined;
    for (const [price, levels] of this.levels) {
      if (levels.isEmpty()) continue;
      if (best === undefined || price > best) {
        best = price;
      }
    }
    return best;
  }
}
