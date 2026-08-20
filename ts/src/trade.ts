export interface Trade {
  price: number;
  quantity: number;
  buyOrderId: string;
  sellOrderId: string;
  timestamp: number;
}


export function createTrade(price:number, quantity:number,buyOrderId: string, sellOrderId: string): Trade {
  if (quantity <= 0) {
    throw new Error(`You cannot place an empty trade`)
  }
  if(buyOrderId === sellOrderId) {
    throw new Error(`same order id`)
  }
  return {
    price,
    quantity,
    buyOrderId,
    sellOrderId,
    timestamp: Date.now(),
  }
}
