import { describe, test, expect } from "vitest";


import { createTrade } from "../trade";

describe("Trade Test Suite", () =>
{
  test("given a valid order, the trade should be executed", () =>
  {
    const trade = createTrade(100, 5, "buy-1", "sell-1")
    expect(trade.price).toBe(100);
    expect(trade.quantity).toBe(5)
  });
  test("given a trade where buy and sell order ids match, the trade should be rejected", () =>
  {
    expect(() => createTrade(100, 5, "buy-1", "buy-1")).toThrow(/same order id/)
  })
})
