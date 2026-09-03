import { describe, expect, test } from "vitest";
import { MatchingEngine } from "../matchEngine";
import { AlpacaIexClient } from "../marketData/alpacaIexClient";
import { IexQuoteBridge } from "../marketData/iexQuoteBridge";
import { MarketDataStore } from "../marketData/store";
import { IexMarketEvent, IexQuoteTick } from "../marketData/types";
import { createOrder } from "../order";

class FakeSocket {
  readonly sent: string[] = [];
  private messageListener: ((event: { data: unknown }) => void) | undefined;

  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void {
    if (type === "message") this.messageListener = listener;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {}

  receive(messages: unknown[]): void {
    this.messageListener?.({ data: JSON.stringify(messages) });
  }
}

describe("Alpaca IEX WebSocket client", () => {
  test("authenticates, subscribes, and normalizes IEX messages", () => {
    const socket = new FakeSocket();
    const events: IexMarketEvent[] = [];
    const client = new AlpacaIexClient({
      keyId: "key-id",
      secretKey: "secret-key",
      symbols: ["aapl"],
      onEvent: (event) => events.push(event),
      socketFactory: () => socket,
    });

    client.connect();
    socket.receive([{ T: "success", msg: "connected" }]);
    expect(JSON.parse(socket.sent[0])).toEqual({
      action: "auth",
      key: "key-id",
      secret: "secret-key",
    });

    socket.receive([{ T: "success", msg: "authenticated" }]);
    expect(JSON.parse(socket.sent[1])).toEqual({
      action: "subscribe",
      trades: ["AAPL"],
      quotes: ["AAPL"],
    });

    socket.receive([
      { T: "t", S: "AAPL", i: 7, x: "V", p: 190.5, s: 2, t: "2026-01-01T10:00:00Z" },
      { T: "q", S: "AAPL", bp: 190, bs: 3, ap: 191, as: 4, t: "2026-01-01T10:00:01Z" },
    ]);

    expect(events).toEqual([
      {
        type: "trade",
        symbol: "AAPL",
        tradeId: 7,
        exchange: "V",
        price: 190.5,
        size: 2,
        timestamp: "2026-01-01T10:00:00Z",
      },
      {
        type: "quote",
        symbol: "AAPL",
        bidPrice: 190,
        bidSize: 3,
        askPrice: 191,
        askSize: 4,
        timestamp: "2026-01-01T10:00:01Z",
      },
    ]);
  });
});

describe("IEX market-data processing", () => {
  const quote: IexQuoteTick = {
    type: "quote",
    symbol: "AAPL",
    bidPrice: 99,
    bidSize: 1,
    askPrice: 100,
    askSize: 1,
    timestamp: "2026-01-01T10:00:00Z",
  };

  test("turns an IEX quote into external liquidity for one engine", () => {
    const engine = new MatchingEngine();
    const bridge = new IexQuoteBridge(engine, "AAPL");

    bridge.process(quote);

    expect(engine.getDepth()).toEqual({
      bids: [{ price: 99, quantity: 100 }],
      asks: [{ price: 100, quantity: 100 }],
    });
  });

  test("routes synthetic quote liquidity through matching", () => {
    const engine = new MatchingEngine();
    const bridge = new IexQuoteBridge(engine, "AAPL");
    engine.submitOrder(createOrder({
      id: "user-buy",
      ownerId: "user",
      type: "limit",
      side: "buy",
      price: 101,
      quantity: 100,
    }));

    bridge.process(quote);

    expect(engine.getTrades()).toMatchObject([
      { price: 101, quantity: 100, buyOrderId: "user-buy" },
    ]);
  });

  test("stores observed trades separately from engine executions", () => {
    const store = new MarketDataStore();
    store.record(quote);
    store.record({
      type: "trade",
      symbol: "AAPL",
      tradeId: 8,
      exchange: "V",
      price: 100,
      size: 2,
      timestamp: "2026-01-01T10:00:02Z",
    });

    expect(store.snapshot("aapl")).toEqual({
      quotes: [quote],
      trades: [{
        type: "trade",
        symbol: "AAPL",
        tradeId: 8,
        exchange: "V",
        price: 100,
        size: 2,
        timestamp: "2026-01-01T10:00:02Z",
      }],
    });
  });
});
