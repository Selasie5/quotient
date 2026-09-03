import { AskBook } from "./askBook";
import { BidBook } from "./bidBook";
import { BookDepth } from "./bookDepth";
import { Order } from "./order";

export interface OrderModification {
  price?: number;
  quantity?: number;
}

export class OrderBook {
  private readonly bids = new BidBook();
  private readonly asks = new AskBook();
  private readonly ordersById = new Map<string, Order>();

  addOrder(order: Order): void {
    if (this.ordersById.has(order.id)) {
      throw new Error(`Duplicate order ID: ${order.id}`);
    }

    if (order.side === "buy") {
      this.bids.addOrder(order);
    } else {
      this.asks.addOrder(order);
    }

    this.ordersById.set(order.id, order);
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
    const order = this.bids.dequeueBestOrder();
    if (order !== undefined) this.ordersById.delete(order.id);
    return order;
  }

  dequeueBestAskOrder(): Order | undefined {
    const order = this.asks.dequeueBestOrder();
    if (order !== undefined) this.ordersById.delete(order.id);
    return order;
  }

  removeOrder(order: Order): boolean {
    const removed = order.side === "buy"
      ? this.bids.removeOrder(order)
      : this.asks.removeOrder(order);

    if (removed) this.ordersById.delete(order.id);
    return removed;
  }

  reduceOrderQuantity(order: Order, quantity: number): boolean {
    return order.side === "buy"
      ? this.bids.reduceOrderQuantity(order, quantity)
      : this.asks.reduceOrderQuantity(order, quantity);
  }

  findOrder(orderId: string): Order | undefined {
    return this.ordersById.get(orderId);
  }

  cancelOrder(orderId: string): boolean {
    const order = this.findOrder(orderId);
    return order === undefined ? false : this.removeOrder(order);
  }

  modifyOrder(orderId: string, changes: OrderModification): boolean {
    const order = this.findOrder(orderId);
    if (order === undefined) return false;

    const price = changes.price ?? order.price!;
    const quantity = changes.quantity ?? order.quantity;

    if (price <= 0) throw new Error("Modified price must be greater than 0");
    if (quantity <= 0) {
      throw new Error("Modified quantity must be greater than 0");
    }

    const priceChanged = price !== order.price;
    const quantityIncreased = quantity > order.quantity;

    if (!priceChanged && !quantityIncreased) {
      if (quantity < order.quantity) {
        return this.reduceOrderQuantity(order, order.quantity - quantity);
      }
      return true;
    }

    if (!this.removeOrder(order)) {
      throw new Error(`Order ${order.id} could not be removed for modification`);
    }

    this.addOrder({
      ...order,
      price,
      quantity,
      timestamp: Date.now(),
    });
    return true;
  }

  getDepth(): BookDepth {
    return {
      bids: this.bids.getDepth(),
      asks: this.asks.getDepth(),
    };
  }
}
