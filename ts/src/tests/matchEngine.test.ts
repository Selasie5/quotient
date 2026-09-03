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

    expect(engine.submitOrder(limitOrder("sell-1", "sell", 100))).toEqual([]);
    const [trade] = engine.submitOrder(limitOrder("buy-1", "buy", 105));

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
    const [trade] = engine.submitOrder(limitOrder("sell-1", "sell", 100));

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

    expect(engine.submitOrder(limitOrder("sell-1", "sell", 105))).toEqual([]);
    expect(engine.submitOrder(limitOrder("buy-1", "buy", 100))).toEqual([]);

    expect(engine.bestBid()).toBe(100);
    expect(engine.bestAsk()).toBe(105);
  });

  test("matches the best price and FIFO order first", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-later-price", "sell", 102));
    engine.submitOrder(limitOrder("sell-first", "sell", 100));
    engine.submitOrder(limitOrder("sell-second", "sell", 100));

    const [trade] = engine.submitOrder(limitOrder("buy-1", "buy", 105));

    expect(trade?.sellOrderId).toBe("sell-first");
    expect(engine.bestAsk()).toBe(100);
  });

  test("partially fills a resting order and preserves its remainder", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-1", "sell", 100, 8));
    const [trade] = engine.submitOrder(limitOrder("buy-1", "buy", 100, 3));

    expect(trade.quantity).toBe(3);
    expect(engine.bestAskOrder()).toMatchObject({ id: "sell-1", quantity: 5 });
    expect(engine.bestAsk()).toBe(100);
    expect(engine.bestBid()).toBeUndefined();
  });

  test("rests the incoming remainder after consuming available asks", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-1", "sell", 100, 3));
    const trades = engine.submitOrder(limitOrder("buy-1", "buy", 100, 5));

    expect(trades).toHaveLength(1);
    expect(trades[0].quantity).toBe(3);
    expect(engine.bestAsk()).toBeUndefined();
    expect(engine.bestBidOrder()).toMatchObject({ id: "buy-1", quantity: 2 });
  });

  test("fills across price levels without trading beyond the limit price", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-100", "sell", 100, 2));
    engine.submitOrder(limitOrder("sell-101", "sell", 101, 3));
    engine.submitOrder(limitOrder("sell-102", "sell", 102, 4));

    const trades = engine.submitOrder(limitOrder("buy-1", "buy", 101, 7));

    expect(trades.map(({ price, quantity }) => ({ price, quantity }))).toEqual([
      { price: 100, quantity: 2 },
      { price: 101, quantity: 3 },
    ]);
    expect(engine.bestAsk()).toBe(102);
    expect(engine.bestBidOrder()).toMatchObject({ id: "buy-1", quantity: 2 });
  });
});
