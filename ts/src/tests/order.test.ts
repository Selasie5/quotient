import { describe, test, expect } from "vitest";
import { Order , createOrder} from "../order";

describe("Order Details Test Suite", () =>
{
  test("given order details, create a valid limit order", () =>
  {
    const order = createOrder({
      id: "1",
      type: "limit",
      side: "buy",
      price: 100,
      quantity: 1,
      timestamp: Date.now(),
    })
    expect(order).toBeDefined();
  });
  test("given an order with type limit and price 0 , the order should be rejected", () => {
    expect(() => createOrder({
      id: "1",
      type: "limit",
      side: "buy",
      quantity: 1,
      timestamp: Date.now(),
    })).toThrow(/positive price/);
  });
  test("given a market order without a price, price value should default to 0", () => {
    const order = createOrder({
      id: "1",
      type: "market",
      side: "buy",
      quantity: 1,
      timestamp: Date.now(),
    })
    expect(order.price).toEqual(0);
  });
  test("given an order with a quantity of 0 or a negative quantity, the order should be rejected", () =>
  {

    expect(()=>createOrder({
      id: "1",
      type: "limit",
      side: "buy",
      price: 100,
      quantity: 0,
    })).toThrow(/order quantity must be greater than 0/);
  });
});
