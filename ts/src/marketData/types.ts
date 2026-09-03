export interface IexTradeTick {
  type: "trade";
  symbol: string;
  tradeId: number;
  exchange: string;
  price: number;
  size: number;
  timestamp: string;
}

export interface IexQuoteTick {
  type: "quote";
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: string;
}

export type IexMarketEvent = IexTradeTick | IexQuoteTick;

export interface MarketDataSnapshot {
  quotes: IexQuoteTick[];
  trades: IexTradeTick[];
}
