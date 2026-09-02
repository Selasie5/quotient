import { describe, expect, test } from "vitest";
import { createOrder, Side } from "../order";
import { OrderBook } from "../orderBook";

function limitOrder(id: string, side: Side, price: number) {
  return createOrder({
    id,
    type: "limit",
    side,
    price,
    quantity: 1,
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
});
