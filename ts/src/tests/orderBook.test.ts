import { describe, expect, test } from "vitest";
import { createOrder, Side } from "../order";
import { OrderBook } from "../orderBook";

function limitOrder(id: string, side: Side, price: number, quantity = 1) {
  return createOrder({
    id,
    type: "limit",
    side,
    price,
    quantity,
  });
}

describe("OrderBook", () => {
  test("is empty before any orders are added", () => {
    const book = new OrderBook();

    expect(book.bestBid()).toBeUndefined();
    expect(book.bestAsk()).toBeUndefined();
  });

  test("returns the highest bid and lowest ask independently", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("bid-100", "buy", 100));
    book.addOrder(limitOrder("bid-102", "buy", 102));
    book.addOrder(limitOrder("ask-106", "sell", 106));
    book.addOrder(limitOrder("ask-104", "sell", 104));

    expect(book.bestBid()).toBe(102);
    expect(book.bestAsk()).toBe(104);
  });

  test("does not match crossed orders", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("bid", "buy", 105));
    book.addOrder(limitOrder("ask", "sell", 100));

    expect(book.bestBid()).toBe(105);
    expect(book.bestAsk()).toBe(100);
  });

  test("dequeues the best order from the requested side", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("bid", "buy", 100));
    book.addOrder(limitOrder("ask", "sell", 105));

    expect(book.dequeueBestBidOrder()?.id).toBe("bid");
    expect(book.dequeueBestAskOrder()?.id).toBe("ask");
    expect(book.bestBid()).toBeUndefined();
    expect(book.bestAsk()).toBeUndefined();
  });

  test("handles an ask price reactivated before lazy cleanup", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("old-ask", "sell", 100));
    expect(book.dequeueBestAskOrder()?.id).toBe("old-ask");

    book.addOrder(limitOrder("new-ask", "sell", 100));

    expect(book.bestAsk()).toBe(100);
    expect(book.dequeueBestAskOrder()?.id).toBe("new-ask");
    expect(book.bestAsk()).toBeUndefined();
  });

  test("reinserts an ask price reactivated after lazy cleanup", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("old-ask", "sell", 100));
    book.dequeueBestAskOrder();
    expect(book.bestAsk()).toBeUndefined();

    book.addOrder(limitOrder("new-ask", "sell", 100));

    expect(book.bestAsk()).toBe(100);
  });

  test("removes a selected order directly without disturbing its price level", () => {
    const book = new OrderBook();
    const first = limitOrder("first", "sell", 100);
    const second = limitOrder("second", "sell", 100);

    book.addOrder(first);
    book.addOrder(second);

    expect(book.removeOrder(first)).toBe(true);
    expect(book.bestAskOrder()?.id).toBe("second");
    expect(book.removeOrder(first)).toBe(false);
  });

  test("cancels an order by ID and reveals the next price", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("best", "buy", 105));
    book.addOrder(limitOrder("next", "buy", 100));

    expect(book.cancelOrder("best")).toBe(true);
    expect(book.bestBid()).toBe(100);
    expect(book.cancelOrder("missing")).toBe(false);
  });

  test("rejects duplicate order IDs across both sides", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("duplicate", "buy", 100));

    expect(() =>
      book.addOrder(limitOrder("duplicate", "sell", 105)),
    ).toThrow(/Duplicate order ID/);
  });

  test("a quantity decrease preserves FIFO priority", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("first", "sell", 100, 5));
    book.addOrder(limitOrder("second", "sell", 100, 5));

    expect(book.modifyOrder("first", { quantity: 3 })).toBe(true);
    expect(book.bestAskOrder()).toMatchObject({ id: "first", quantity: 3 });
  });

  test("a quantity increase loses FIFO priority", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("first", "sell", 100, 5));
    book.addOrder(limitOrder("second", "sell", 100, 5));

    expect(book.modifyOrder("first", { quantity: 8 })).toBe(true);
    expect(book.bestAskOrder()?.id).toBe("second");
    expect(book.dequeueBestAskOrder()?.id).toBe("second");
    expect(book.bestAskOrder()).toMatchObject({ id: "first", quantity: 8 });
  });

  test("a price change moves the order to its new level", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("moving", "buy", 100, 5));
    book.addOrder(limitOrder("other", "buy", 101, 5));

    expect(book.modifyOrder("moving", { price: 102 })).toBe(true);
    expect(book.bestBidOrder()).toMatchObject({ id: "moving", price: 102 });
  });

  test("an invalid modification leaves the order unchanged", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("order-1", "buy", 100, 5));

    expect(() => book.modifyOrder("order-1", { quantity: 0 })).toThrow(
      /greater than 0/,
    );
    expect(book.bestBidOrder()).toMatchObject({
      id: "order-1",
      price: 100,
      quantity: 5,
    });
  });

  test("releases an order ID after cancellation", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("reusable", "buy", 100));
    expect(book.cancelOrder("reusable")).toBe(true);

    expect(() =>
      book.addOrder(limitOrder("reusable", "sell", 105)),
    ).not.toThrow();
    expect(book.bestAskOrder()?.id).toBe("reusable");
  });

  test("releases an order ID after best-order dequeue", () => {
    const book = new OrderBook();

    book.addOrder(limitOrder("reusable", "buy", 100));
    expect(book.dequeueBestBidOrder()?.id).toBe("reusable");

    expect(() =>
      book.addOrder(limitOrder("reusable", "buy", 101)),
    ).not.toThrow();
    expect(book.bestBid()).toBe(101);
  });
});
