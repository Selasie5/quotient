import { Order } from "./order";

class OrderNode {
  order: Order;
  prev: OrderNode | null =null;
  next: OrderNode | null =null;

  constructor(order: Order) {
    this.order = order;
  }
}
export class PriceLevel {
  private orders: Order[] = [];
  private head: OrderNode | null = null;
  private tail: OrderNode | null = null;
  private nodesById = new Map<string, OrderNode>();
  private runningQuantity = 0;


  enqueue(order: Order): void {
    const node = new OrderNode(order);

    if (this.tail === null)
    {
      this.tail = node;
      this.head = node;
    }
    else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.nodesById.set(order.id, node);
    this.runningQuantity += order.quantity;
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
