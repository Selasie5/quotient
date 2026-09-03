import { describe, expect, test } from "vitest";
import { deriveMarketStats, pricePath, visibleDepth } from "./market";

describe("market view helpers", () => {
  test("derives top-of-book, spread, last price, and volume", () => {
    const stats = deriveMarketStats(
      {
        bids: [{ price: 100, quantity: 5 }],
        asks: [{ price: 100.2, quantity: 7 }],
      },
      [{ price: 100.1, quantity: 3, buyOrderId: "b", sellOrderId: "s", timestamp: 1 }],
    );

    expect(stats).toMatchObject({
      bestBid: 100,
      bestAsk: 100.2,
      midpoint: 100.1,
      spread: 0.2,
      lastPrice: 100.1,
      tradedVolume: 3,
    });
  });

  test("orders asks visually toward the spread and keeps bids best-first", () => {
    const depth = visibleDepth({
      bids: [{ price: 100, quantity: 2 }, { price: 99, quantity: 4 }],
      asks: [{ price: 101, quantity: 3 }, { price: 102, quantity: 9 }],
    });

    expect(depth.bids.map(level => level.price)).toEqual([100, 99]);
    expect(depth.asks.map(level => level.price)).toEqual([102, 101]);
    expect(depth.maxQuantity).toBe(9);
  });

  test("builds a bounded SVG path and handles flat prices", () => {
    expect(pricePath([10, 10, 10], 100, 40)).toBe("M0.00,40.00 L50.00,40.00 L100.00,40.00");
    expect(pricePath([10], 100, 40)).toBe("");
  });
});
