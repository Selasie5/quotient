import { Order } from "./order";

export class PriceLevel {
  private orders: Order[] = [];

  enqueue(order: Order): void {
    this.orders.push(order);
  }
  dequeueFront(): Order | undefined {
    return this.orders.shift();
  }
  cancelOrder(orderId: string): boolean{
    const index = this.orders.findIndex(o => o.id === orderId);
    if (index === -1) return false;
    this.orders.splice(index, 1);
    return true;

  }
  totalQuantity(): number{
    return this.orders.reduce((sum, o)=> sum + o.quantity, 0)
  }
}
