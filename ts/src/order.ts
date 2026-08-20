export type Side = 'buy' | 'sell';

export type OrderType = 'limit' | 'market';

export interface Order {
  id: string,
  type: OrderType,
  side: Side,
  price?: number,
  quantity: number,
  timestamp: number
}


export interface CreateOrderInput{
  id: string,
  type: OrderType,
  side: Side,
  price?: number,
  quantity: number,
  timestamp?: number
}


export function createOrder(input: CreateOrderInput): Order {
  if (input.quantity <= 0) {
    throw new Error ("order quantity must be greater than 0")
  }

  if (input.type === 'limit') {
    if (input.price === undefined || input.price <= 0) {
      throw new Error (`Limit requires a positive price, got ${input.price}`)
    }
  }
  return {
    id: input.id,
    type: input.type,
    side: input.side,
    price: input.price ?? 0,
    quantity: input.quantity,
    timestamp: input.timestamp ?? Date.now(),
  }
}
