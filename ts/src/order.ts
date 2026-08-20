export type Side = 'buy' | 'sell';

export type OrderType = 'limit' | 'market';

export interface Order {
  id: string,
  type: OrderType,
  side: Side,
  price: number,
  quantity: number,
  timestamp: number
}
