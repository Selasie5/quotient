import { describe, test, expect } from "vitest";
import { Order } from "../order";

describe('Order', () =>
{
  test('should create an order', () =>
  {
    const order: Order = {
      id: "1",
      side: "buy",
      type: "limit",
      price: 100,
      quantity: 10,
      timestamp: Date.now(),
    };
    expect(order.side).toBe("buy");
  })
})
