import { describe, expect, test } from "vitest";
import { MaxHeap } from "../maxHeap";

describe("MaxHeap", () => {
  test("keeps the maximum value at the top", () => {
    const heap = new MaxHeap();

    heap.insert(100);
    heap.insert(105);
    heap.insert(102);

    expect(heap.peek()).toBe(105);
    expect(heap.pop()).toBe(105);
    expect(heap.pop()).toBe(102);
    expect(heap.pop()).toBe(100);
    expect(heap.pop()).toBeUndefined();
  });
});
