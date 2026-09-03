import { Order } from "./order";
import { OrderBook, OrderModification } from "./orderBook";
import { createTrade, Trade } from "./trade";

export class MatchingEngine {
  private readonly book = new OrderBook();

  submitOrder(incoming: Order): Trade[] {
    const trades: Trade[] = [];
    let remainingQuantity = incoming.quantity;
    let cancelledBySelfTradePrevention = false;

    while (remainingQuantity > 0) {
      const resting =
        incoming.side === "buy"
          ? this.book.bestAskOrder()
          : this.book.bestBidOrder();

      if (resting === undefined || !this.pricesCross(incoming, resting)) break;

      if (this.hasSameOwner(incoming, resting)) {
        cancelledBySelfTradePrevention = true;
        break;
      }

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

    if (
      remainingQuantity > 0 &&
      incoming.type === "limit" &&
      !cancelledBySelfTradePrevention
    ) {
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

  cancelOrder(orderId: string): boolean {
    return this.book.cancelOrder(orderId);
  }

  modifyOrder(
    orderId: string,
    changes: OrderModification,
  ): Trade[] | undefined {
    const order = this.book.findOrder(orderId);
    if (order === undefined) return undefined;

    const priceChanged =
      changes.price !== undefined && changes.price !== order.price;

    if (!priceChanged) {
      this.book.modifyOrder(orderId, changes);
      return [];
    }

    const price = changes.price!;
    const quantity = changes.quantity ?? order.quantity;
    if (price <= 0) throw new Error("Modified price must be greater than 0");
    if (quantity <= 0) {
      throw new Error("Modified quantity must be greater than 0");
    }

    if (!this.book.cancelOrder(orderId)) {
      throw new Error(`Order ${orderId} could not be removed for modification`);
    }

    return this.submitOrder({
      ...order,
      price,
      quantity,
      timestamp: Date.now(),
    });
  }

  private pricesCross(incoming: Order, resting: Order): boolean {
    if (incoming.type === "market") return true;

    if (incoming.side === "buy") {
      return incoming.price! >= resting.price!;
    }

    return incoming.price! <= resting.price!;
  }

  private hasSameOwner(incoming: Order, resting: Order): boolean {
    return (
      incoming.ownerId !== undefined && incoming.ownerId === resting.ownerId
    );
  }
}
