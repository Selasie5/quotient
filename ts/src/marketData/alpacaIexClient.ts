import { IexMarketEvent, IexQuoteTick, IexTradeTick } from "./types";

const IEX_WEBSOCKET_URL = "wss://stream.data.alpaca.markets/v2/iex";

interface SocketEvent {
  data?: unknown;
}

interface MarketDataSocket {
  addEventListener(
    type: "message" | "close",
    listener: (event: SocketEvent) => void,
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
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
}

export class AlpacaIexClient {
  private socket: MarketDataSocket | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempt = 0;
  private manuallyClosed = false;

  constructor(private readonly options: AlpacaIexClientOptions) {
    if (options.keyId.trim() === "" || options.secretKey.trim() === "") {
      throw new Error("Alpaca API credentials are required");
    }
    if (options.symbols.length === 0) {
      throw new Error("At least one IEX symbol is required");
    }
  }

  connect(): void {
    this.manuallyClosed = false;
    this.openSocket();
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close();
    this.socket = undefined;
  }

  private openSocket(): void {
    if (this.socket !== undefined) return;

    const factory = this.options.socketFactory ?? defaultSocketFactory;
    const socket = factory(IEX_WEBSOCKET_URL);
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });
    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = undefined;
      if (!this.manuallyClosed) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== undefined) return;

    const baseDelay = this.options.reconnectBaseDelayMs ?? 1_000;
    const maxDelay = this.options.reconnectMaxDelayMs ?? 30_000;
    const delay = Math.min(baseDelay * 2 ** this.reconnectAttempt, maxDelay);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.openSocket();
    }, delay);
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
      this.reconnectAttempt = 0;
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
      !isTimestamp(message.t)
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
      !isTimestamp(message.t)
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

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
