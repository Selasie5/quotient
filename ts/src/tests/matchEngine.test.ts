import { describe, expect, test } from "vitest";
import { MatchingEngine } from "../matchEngine";
import { createOrder, Side } from "../order";

function limitOrder(
  id: string,
  side: Side,
  price: number,
  quantity = 5,
) {
  return createOrder({ id, type: "limit", side, price, quantity });
}

describe("MatchingEngine simple match", () => {
  test("an incoming buy fully consumes one crossing ask", () => {
    const engine = new MatchingEngine();

    expect(engine.submitOrder(limitOrder("sell-1", "sell", 100))).toBeUndefined();
    const trade = engine.submitOrder(limitOrder("buy-1", "buy", 105));

    expect(trade).toMatchObject({
      price: 100,
      quantity: 5,
      buyOrderId: "buy-1",
      sellOrderId: "sell-1",
    });
    expect(engine.bestAsk()).toBeUndefined();
    expect(engine.bestBid()).toBeUndefined();
  });

  test("an incoming sell fully consumes one crossing bid", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("buy-1", "buy", 105));
    const trade = engine.submitOrder(limitOrder("sell-1", "sell", 100));

    expect(trade).toMatchObject({
      price: 105,
      quantity: 5,
      buyOrderId: "buy-1",
      sellOrderId: "sell-1",
    });
    expect(engine.bestBid()).toBeUndefined();
    expect(engine.bestAsk()).toBeUndefined();
  });

  test("non-crossing orders rest on their respective sides", () => {
    const engine = new MatchingEngine();

    expect(engine.submitOrder(limitOrder("sell-1", "sell", 105))).toBeUndefined();
    expect(engine.submitOrder(limitOrder("buy-1", "buy", 100))).toBeUndefined();

    expect(engine.bestBid()).toBe(100);
    expect(engine.bestAsk()).toBe(105);
  });

  test("matches the best price and FIFO order first", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-later-price", "sell", 102));
    engine.submitOrder(limitOrder("sell-first", "sell", 100));
    engine.submitOrder(limitOrder("sell-second", "sell", 100));

    const trade = engine.submitOrder(limitOrder("buy-1", "buy", 105));

    expect(trade?.sellOrderId).toBe("sell-first");
    expect(engine.bestAsk()).toBe(100);
  });

  test("rejects an unequal crossing fill without removing the resting order", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-1", "sell", 100, 5));

    expect(() =>
      engine.submitOrder(limitOrder("buy-1", "buy", 100, 3)),
    ).toThrow(/equal order quantities/);
    expect(engine.bestAsk()).toBe(100);
    expect(engine.bestBid()).toBeUndefined();
  });
});
