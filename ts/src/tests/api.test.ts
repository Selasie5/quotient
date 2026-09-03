import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createApiServer } from "../api/server";
import { MarketDataStore } from "../marketData/store";

describe("REST API", () => {
  let baseUrl: string;
  let server: ReturnType<typeof createApiServer>;

  beforeEach(async () => {
    server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  test("reports health and an empty book", async () => {
    const health = await fetch(`${baseUrl}/health`);
    const book = await fetch(`${baseUrl}/book`);

    expect(await health.json()).toEqual({ status: "ok" });
    expect(await book.json()).toEqual({ bids: [], asks: [] });
  });

  test("submits orders and exposes generated trades", async () => {
    await postOrder({
      id: "sell-1",
      ownerId: "owner-a",
      type: "limit",
      side: "sell",
      price: 100,
      quantity: 5,
    });

    const response = await postOrder({
      id: "buy-1",
      ownerId: "owner-b",
      type: "limit",
      side: "buy",
      price: 100,
      quantity: 5,
    });
    const result = await response.json() as { trades: unknown[] };

    expect(response.status).toBe(201);
    expect(result.trades).toHaveLength(1);

    const trades = await fetch(`${baseUrl}/trades`);
    expect(await trades.json()).toMatchObject([
      { price: 100, quantity: 5, buyOrderId: "buy-1", sellOrderId: "sell-1" },
    ]);
  });

  test("modifies and cancels resting orders", async () => {
    await postOrder({
      id: "buy-1",
      type: "limit",
      side: "buy",
      price: 100,
      quantity: 5,
    });

    const modified = await fetch(`${baseUrl}/orders/buy-1`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ price: 101, quantity: 3 }),
    });
    expect(modified.status).toBe(200);

    const openOrders = await fetch(`${baseUrl}/orders`);
    expect(await openOrders.json()).toMatchObject([
      { id: "buy-1", side: "buy", price: 101, quantity: 3 },
    ]);

    const book = await fetch(`${baseUrl}/book`);
    expect(await book.json()).toEqual({
      bids: [{ price: 101, quantity: 3 }],
      asks: [],
    });

    const cancelled = await fetch(`${baseUrl}/orders/buy-1`, {
      method: "DELETE",
    });
    expect(cancelled.status).toBe(204);
  });

  test("returns useful client errors", async () => {
    const invalid = await postOrder({
      id: "bad",
      type: "limit",
      side: "unknown",
      price: 100,
      quantity: 5,
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "side must be buy or sell" });

    const missing = await fetch(`${baseUrl}/orders/missing`, {
      method: "DELETE",
    });
    expect(missing.status).toBe(404);
  });

  test("exposes observed external market data", async () => {
    const marketData = new MarketDataStore();
    marketData.record({
      type: "trade",
      symbol: "AAPL",
      tradeId: 1,
      exchange: "V",
      price: 100,
      size: 2,
      timestamp: "2026-01-01T10:00:00Z",
    });

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    server = createApiServer(undefined, marketData);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/market-data?symbol=AAPL`);
    const result = await response.json() as { trades: unknown[] };

    expect(result.trades).toHaveLength(1);
  });

  function postOrder(body: Record<string, unknown>) {
    return fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
});
