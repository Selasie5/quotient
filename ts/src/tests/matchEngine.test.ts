import { describe, expect, test } from "vitest";
import { MatchingEngine } from "../matchEngine";
import { createOrder, Side } from "../order";

function limitOrder(
  id: string,
  side: Side,
  price: number,
  quantity = 5,
  ownerId?: string,
) {
  return createOrder({ id, ownerId, type: "limit", side, price, quantity });
}

function marketOrder(
  id: string,
  side: Side,
  quantity: number,
  ownerId?: string,
) {
  return createOrder({ id, ownerId, type: "market", side, quantity });
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

  test("a market buy sweeps asks in price-time order", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-102", "sell", 102, 2));
    engine.submitOrder(limitOrder("sell-100", "sell", 100, 2));
    engine.submitOrder(limitOrder("sell-101", "sell", 101, 2));

    const trades = engine.submitOrder(marketOrder("market-buy", "buy", 5));

    expect(trades.map(({ price, quantity }) => ({ price, quantity }))).toEqual([
      { price: 100, quantity: 2 },
      { price: 101, quantity: 2 },
      { price: 102, quantity: 1 },
    ]);
    expect(engine.bestAskOrder()).toMatchObject({ id: "sell-102", quantity: 1 });
    expect(engine.bestBid()).toBeUndefined();
  });

  test("a market sell sweeps bids from highest to lowest", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("buy-100", "buy", 100, 2));
    engine.submitOrder(limitOrder("buy-102", "buy", 102, 2));
    engine.submitOrder(limitOrder("buy-101", "buy", 101, 2));

    const trades = engine.submitOrder(marketOrder("market-sell", "sell", 4));

    expect(trades.map(({ price, quantity }) => ({ price, quantity }))).toEqual([
      { price: 102, quantity: 2 },
      { price: 101, quantity: 2 },
    ]);
    expect(engine.bestBid()).toBe(100);
    expect(engine.bestAsk()).toBeUndefined();
  });

  test("expires an unfilled market-order remainder", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-1", "sell", 100, 2));
    const trades = engine.submitOrder(marketOrder("market-buy", "buy", 5));

    expect(trades).toHaveLength(1);
    expect(trades[0].quantity).toBe(2);
    expect(engine.bestAsk()).toBeUndefined();
    expect(engine.bestBid()).toBeUndefined();
  });

  test("an unfilled market order never rests on an empty book", () => {
    const engine = new MatchingEngine();

    expect(engine.submitOrder(marketOrder("market-buy", "buy", 5))).toEqual([]);
    expect(engine.bestBid()).toBeUndefined();
    expect(engine.bestAsk()).toBeUndefined();
  });

  test("cancels an incoming limit order before it trades with the same owner", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("resting-sell", "sell", 100, 5, "owner-a"));
    const trades = engine.submitOrder(
      limitOrder("incoming-buy", "buy", 100, 5, "owner-a"),
    );

    expect(trades).toEqual([]);
    expect(engine.bestAskOrder()).toMatchObject({ id: "resting-sell", quantity: 5 });
    expect(engine.bestBid()).toBeUndefined();
  });

  test("allows matching orders owned by different participants", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("resting-sell", "sell", 100, 5, "owner-a"));
    const trades = engine.submitOrder(
      limitOrder("incoming-buy", "buy", 100, 5, "owner-b"),
    );

    expect(trades).toHaveLength(1);
    expect(engine.bestAsk()).toBeUndefined();
  });

  test("keeps earlier fills but cancels the remainder at a self-owned order", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("external-sell", "sell", 100, 2, "owner-b"));
    engine.submitOrder(limitOrder("own-sell", "sell", 101, 4, "owner-a"));

    const trades = engine.submitOrder(
      marketOrder("incoming-buy", "buy", 6, "owner-a"),
    );

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      price: 100,
      quantity: 2,
      sellOrderId: "external-sell",
    });
    expect(engine.bestAskOrder()).toMatchObject({ id: "own-sell", quantity: 4 });
    expect(engine.bestBid()).toBeUndefined();
  });

  test("cancels a resting order through the matching engine", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-1", "sell", 100));

    expect(engine.cancelOrder("sell-1")).toBe(true);
    expect(engine.bestAsk()).toBeUndefined();
  });

  test("modifies a resting order through the matching engine", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("buy-1", "buy", 100, 5));

    expect(engine.modifyOrder("buy-1", { price: 101, quantity: 3 })).toEqual([]);
    expect(engine.bestBidOrder()).toMatchObject({
      id: "buy-1",
      price: 101,
      quantity: 3,
    });
  });

  test("matches an order when a price modification crosses the book", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("buy-1", "buy", 99, 5));
    engine.submitOrder(limitOrder("sell-1", "sell", 100, 5));

    const trades = engine.modifyOrder("buy-1", { price: 100 });

    expect(trades).toHaveLength(1);
    expect(trades?.[0]).toMatchObject({
      price: 100,
      quantity: 5,
      buyOrderId: "buy-1",
      sellOrderId: "sell-1",
    });
    expect(engine.bestBid()).toBeUndefined();
    expect(engine.bestAsk()).toBeUndefined();
  });

  test("releases a resting order ID after it is fully matched", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("reusable", "sell", 100));
    engine.submitOrder(limitOrder("buy-1", "buy", 100));

    expect(() =>
      engine.submitOrder(limitOrder("reusable", "sell", 101)),
    ).not.toThrow();
    expect(engine.bestAsk()).toBe(101);
  });

  test("depth reflects quantities remaining after a partial fill", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-1", "sell", 100, 8));
    engine.submitOrder(limitOrder("buy-1", "buy", 100, 3));

    expect(engine.getDepth()).toEqual({
      bids: [],
      asks: [{ price: 100, quantity: 5 }],
    });
  });

  test("records every execution in chronological trade order", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-100", "sell", 100, 2));
    engine.submitOrder(limitOrder("sell-101", "sell", 101, 3));
    engine.submitOrder(limitOrder("buy-1", "buy", 101, 5));

    expect(
      engine.getTrades().map(({ price, quantity }) => ({ price, quantity })),
    ).toEqual([
      { price: 100, quantity: 2 },
      { price: 101, quantity: 3 },
    ]);
  });

  test("returns a detached trade log snapshot", () => {
    const engine = new MatchingEngine();

    engine.submitOrder(limitOrder("sell-1", "sell", 100));
    engine.submitOrder(limitOrder("buy-1", "buy", 100));

    const trades = engine.getTrades();
    trades[0].quantity = 999;
    trades.push({ ...trades[0], price: 999 });

    expect(engine.getTrades()).toHaveLength(1);
    expect(engine.getTrades()[0].quantity).toBe(5);
  });

  test("bounds the engine trade log while preserving newest-first retention", () => {
    const engine = new MatchingEngine(1);

    engine.submitOrder(limitOrder("sell-1", "sell", 100));
    engine.submitOrder(limitOrder("buy-1", "buy", 100));
    engine.submitOrder(limitOrder("sell-2", "sell", 101));
    engine.submitOrder(limitOrder("buy-2", "buy", 101));

    expect(engine.getTrades()).toMatchObject([
      { price: 101, buyOrderId: "buy-2", sellOrderId: "sell-2" },
    ]);
  });
});
