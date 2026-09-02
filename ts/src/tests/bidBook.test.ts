import { describe, expect, test } from "vitest";
import { BidBook } from "../bidBook";
import { createOrder } from "../order";

function bid(id: string, price: number) {
  return createOrder({
    id,
    type: "limit",
    side: "buy",
    price,
    quantity: 1,
  });
}

describe("BidBook", () => {
  test("returns the highest non-empty price", () => {
    const book = new BidBook();

    book.addOrder(bid("one", 100));
    book.addOrder(bid("two", 105));
    book.addOrder(bid("three", 102));

    expect(book.bestPrice()).toBe(105);
  });

  test("lazily discards an empty best-price level", () => {
    const book = new BidBook();

    book.addOrder(bid("best", 105));
    book.addOrder(bid("next", 102));

    expect(book.dequeueBestOrder()?.id).toBe("best");
    expect(book.bestPrice()).toBe(102);
  });

  test("handles a stale price that is reactivated before cleanup", () => {
    const book = new BidBook();

    book.addOrder(bid("old", 105));
    expect(book.dequeueBestOrder()?.id).toBe("old");

    book.addOrder(bid("new", 105));

    expect(book.bestPrice()).toBe(105);
    expect(book.dequeueBestOrder()?.id).toBe("new");
    expect(book.bestPrice()).toBeUndefined();
  });

  test("reinserts a price that is reactivated after cleanup", () => {
    const book = new BidBook();

    book.addOrder(bid("old", 105));
    book.dequeueBestOrder();
    expect(book.bestPrice()).toBeUndefined();

    book.addOrder(bid("new", 105));

    expect(book.bestPrice()).toBe(105);
  });
});
