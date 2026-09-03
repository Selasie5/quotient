import { test, expect } from "vitest";
import { PriceLevel } from "../priceLevel";
import { Order } from "../order";
import { createOrder } from "../order";

function mkOrder(id: string, quantity: number) {
  return createOrder({ id, side: "buy", type: "limit", price: 100, quantity });
}

test("dequeues in FIFO order regardless of insertion order elsewhere", () => {
  const level = new PriceLevel();
  level.enqueue(mkOrder("A", 10));
  level.enqueue(mkOrder("B", 20));
  level.enqueue(mkOrder("C", 30));

  expect(level.dequeueFront()?.id).toBe("A");
  expect(level.dequeueFront()?.id).toBe("B");
  expect(level.dequeueFront()?.id).toBe("C");
});

test("cancel removes an order from the MIDDLE without disturbing FIFO order of the rest", () => {
  const level = new PriceLevel();
  level.enqueue(mkOrder("A", 10));
  level.enqueue(mkOrder("B", 20));
  level.enqueue(mkOrder("C", 30));

  const cancelled = level.cancelOrder("B");

  expect(cancelled).toBe(true);
  expect(level.dequeueFront()?.id).toBe("A");
  expect(level.dequeueFront()?.id).toBe("C");   // B is gone, A→C link held
});

test("cancelling the head correctly advances head", () => {
  const level = new PriceLevel();
  level.enqueue(mkOrder("A", 10));
  level.enqueue(mkOrder("B", 20));

  level.cancelOrder("A");
  expect(level.dequeueFront()?.id).toBe("B");
});

test("cancelling the tail correctly retreats tail", () => {
  const level = new PriceLevel();
  level.enqueue(mkOrder("A", 10));
  level.enqueue(mkOrder("B", 20));

  level.cancelOrder("B");
  level.enqueue(mkOrder("C", 30));   // should append after A, not crash on stale tail

  expect(level.dequeueFront()?.id).toBe("A");
  expect(level.dequeueFront()?.id).toBe("C");
});

test("cancelling an unknown id returns false and does not affect the level", () => {
  const level = new PriceLevel();
  level.enqueue(mkOrder("A", 10));

  expect(level.cancelOrder("does-not-exist")).toBe(false);
  expect(level.totalQuantity()).toBe(10);
});

test("totalQuantity tracks enqueue, dequeue, and cancel correctly", () => {
  const level = new PriceLevel();
  level.enqueue(mkOrder("A", 10));
  level.enqueue(mkOrder("B", 20));
  expect(level.totalQuantity()).toBe(30);

  level.cancelOrder("A");
  expect(level.totalQuantity()).toBe(20);

  level.dequeueFront();
  expect(level.totalQuantity()).toBe(0);
});

test("isEmpty reflects state through enqueue/dequeue/cancel", () => {
  const level = new PriceLevel();
  expect(level.isEmpty()).toBe(true);

  level.enqueue(mkOrder("A", 10));
  expect(level.isEmpty()).toBe(false);

  level.cancelOrder("A");
  expect(level.isEmpty()).toBe(true);
});

test("reducing an order updates both its quantity and the level total", () => {
  const level = new PriceLevel();
  level.enqueue(mkOrder("A", 10));

  expect(level.reduceOrderQuantity("A", 4)).toBe(true);
  expect(level.peekFront()?.quantity).toBe(6);
  expect(level.totalQuantity()).toBe(6);
});
