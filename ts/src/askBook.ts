import { Order } from "./order";
import { MinHeap } from "./minHeap";
import { PriceLevel } from "./priceLevel";

export class AskBook {
  private readonly levels = new Map<number, PriceLevel>();
  private readonly prices = new MinHeap();
  private readonly pricesInHeap = new Set<number>();

  addOrder(order: Order): void {
    const price = order.price;
    if (price === undefined) {
      throw new Error("A resting ask requires a price");
    }

    if (!this.levels.has(price)) {
      this.levels.set(price, new PriceLevel());
    }

    const level = this.levels.get(price)!;
    if (level.isEmpty() && !this.pricesInHeap.has(price)) {
      this.prices.insert(price);
      this.pricesInHeap.add(price);
    }

    level.enqueue(order);
  }

  bestPrice(): number | undefined {
    while (this.prices.size > 0) {
      const price = this.prices.peek()!;
      const level = this.levels.get(price);

      if (level !== undefined && !level.isEmpty()) return price;

      this.prices.pop();
      this.pricesInHeap.delete(price);
    }

    return undefined;
  }

  dequeueBestOrder(): Order | undefined {
    const price = this.bestPrice();
    if (price === undefined) return undefined;

    return this.levels.get(price)!.dequeueFront();
  }

  bestOrder(): Order | undefined {
    const price = this.bestPrice();
    if (price === undefined) return undefined;

    return this.levels.get(price)!.peekFront();
  }

  removeOrder(order: Order): boolean {
    if (order.price === undefined) return false;

    return this.levels.get(order.price)?.cancelOrder(order.id) ?? false;
  }

  reduceOrderQuantity(order: Order, quantity: number): boolean {
    if (order.price === undefined) return false;

    return (
      this.levels.get(order.price)?.reduceOrderQuantity(order.id, quantity) ??
      false
    );
  }

}
