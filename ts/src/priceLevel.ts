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
    if (this.nodesById.has(order.id)) {
      throw new Error(`Duplicate order ID: ${order.id}`);
    }

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
    if (this.head === null) return undefined;
    const node = this.head;
    this.unlink(node);
    return node.order;
  }
  cancelOrder(orderId: string): boolean{
    const node = this.nodesById.get(orderId);
    if (!node) return false;
    this.unlink(node);
    return true
  }
  totalQuantity(): number{
    return this.runningQuantity
  }
  isEmpty(): boolean {
    return this.head === null;
}
  private unlink(node: OrderNode): void{
    if (node.prev) {
      node.prev.next = node.next
    }
    else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }
    else {
      this.tail = node.prev;
    }

    this.nodesById.delete(node.order.id)
    this.runningQuantity-=node.order.quantity
  }
}
