import { Order } from "./order";
import { PriceLevel } from "./priceLevel";

export class AskBook {
  private readonly levels = new Map<number, PriceLevel>();

  addOrder(order: Order): void {
    const price = order.price;
    if (price === undefined) {
      throw new Error("A resting ask requires a price");
    }

    if (!this.levels.has(price)) {
      this.levels.set(price, new PriceLevel());
    }

    this.levels.get(price)!.enqueue(order);
  }

  bestPrice(): number | undefined {
    let best: number | undefined;

    for (const [price, level] of this.levels) {
      if (level.isEmpty()) continue;
      if (best === undefined || price < best) {
        best = price;
      }
    }

    return best;
  }

  dequeueBestOrder(): Order | undefined {
    const price = this.bestPrice();
    if (price === undefined) return undefined;

    return this.levels.get(price)!.dequeueFront();
  }
}
