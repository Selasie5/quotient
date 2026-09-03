import { IexMarketEvent, IexQuoteTick, IexTradeTick } from "./types";

const IEX_WEBSOCKET_URL = "wss://stream.data.alpaca.markets/v2/iex";

interface SocketMessageEvent {
  data: unknown;
}

interface MarketDataSocket {
  addEventListener(
    type: "message",
    listener: (event: SocketMessageEvent) => void,
  ): void;
  send(data: string): void;
  close(): void;
}

export interface AlpacaIexClientOptions {
  keyId: string;
  secretKey: string;
  symbols: string[];
  onEvent: (event: IexMarketEvent) => void;
  onError?: (error: Error) => void;
  socketFactory?: (url: string) => MarketDataSocket;
}

export class AlpacaIexClient {
  private socket: MarketDataSocket | undefined;

  constructor(private readonly options: AlpacaIexClientOptions) {
    if (options.keyId.trim() === "" || options.secretKey.trim() === "") {
      throw new Error("Alpaca API credentials are required");
    }
    if (options.symbols.length === 0) {
      throw new Error("At least one IEX symbol is required");
    }
  }

  connect(): void {
    if (this.socket !== undefined) return;

    const factory = this.options.socketFactory ?? defaultSocketFactory;
    this.socket = factory(IEX_WEBSOCKET_URL);
    this.socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  private handleMessage(data: unknown): void {
    try {
      const messages = JSON.parse(String(data));
      if (!Array.isArray(messages)) throw new Error("Expected an Alpaca message array");

      for (const message of messages) this.handleProtocolMessage(message);
    } catch (error) {
      this.options.onError?.(
        error instanceof Error ? error : new Error("Invalid Alpaca message"),
      );
    }
  }

  private handleProtocolMessage(message: unknown): void {
    if (!isObject(message) || typeof message.T !== "string") return;

    if (message.T === "success" && message.msg === "connected") {
      this.send({
        action: "auth",
        key: this.options.keyId,
        secret: this.options.secretKey,
      });
      return;
    }

    if (message.T === "success" && message.msg === "authenticated") {
      const symbols = this.options.symbols.map((symbol) => symbol.toUpperCase());
      this.send({ action: "subscribe", trades: symbols, quotes: symbols });
      return;
    }

    if (message.T === "error") {
      this.options.onError?.(
        new Error(typeof message.msg === "string" ? message.msg : "Alpaca error"),
      );
      return;
    }

    const event = parseMarketEvent(message);
    if (event !== undefined) this.options.onEvent(event);
  }

  private send(message: unknown): void {
    this.socket?.send(JSON.stringify(message));
  }
}

function defaultSocketFactory(url: string): MarketDataSocket {
  return new WebSocket(url) as unknown as MarketDataSocket;
}

function parseMarketEvent(message: Record<string, unknown>): IexMarketEvent | undefined {
  if (message.T === "t") {
    if (
      typeof message.S !== "string" ||
      !isFiniteNumber(message.i) ||
      typeof message.x !== "string" ||
      !isFiniteNumber(message.p) ||
      !isFiniteNumber(message.s) ||
      typeof message.t !== "string"
    ) return undefined;

    const trade: IexTradeTick = {
      type: "trade",
      symbol: message.S,
      tradeId: message.i,
      exchange: message.x,
      price: message.p,
      size: message.s,
      timestamp: message.t,
    };
    return trade;
  }

  if (message.T === "q") {
    if (
      typeof message.S !== "string" ||
      !isFiniteNumber(message.bp) ||
      !isFiniteNumber(message.bs) ||
      !isFiniteNumber(message.ap) ||
      !isFiniteNumber(message.as) ||
      typeof message.t !== "string"
    ) return undefined;

    const quote: IexQuoteTick = {
      type: "quote",
      symbol: message.S,
      bidPrice: message.bp,
      bidSize: message.bs,
      askPrice: message.ap,
      askSize: message.as,
      timestamp: message.t,
    };
    return quote;
  }

  return undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
