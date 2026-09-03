export type Side = "buy" | "sell";
export type OrderType = "limit" | "market";

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface BookDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export interface Order {
  id: string;
  ownerId?: string;
  type: OrderType;
  side: Side;
  price: number;
  quantity: number;
  timestamp: number;
}

export interface Trade {
  price: number;
  quantity: number;
  buyOrderId: string;
  sellOrderId: string;
  timestamp: number;
}

export interface QuoteTick {
  type: "quote";
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: string;
}

export interface ExternalTradeTick {
  type: "trade";
  symbol: string;
  tradeId: number;
  exchange: string;
  price: number;
  size: number;
  timestamp: string;
}

export interface MarketDataSnapshot {
  quotes: QuoteTick[];
  trades: ExternalTradeTick[];
}

export interface EngineSnapshot {
  book: BookDepth;
  orders: Order[];
  trades: Trade[];
  marketData: MarketDataSnapshot;
}

export interface PlaceOrderInput {
  id: string;
  ownerId: string;
  type: OrderType;
  side: Side;
  price?: number;
  quantity: number;
}

export interface PlaceOrderResult {
  order: Order;
  trades: Trade[];
}
