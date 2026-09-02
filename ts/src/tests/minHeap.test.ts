import { describe, expect, test } from "vitest";
import { MinHeap } from "../minHeap";

describe("MinHeap", () => {
  test("keeps the minimum value at the top", () => {
    const heap = new MinHeap();

    heap.insert(105);
    heap.insert(100);
    heap.insert(102);

    expect(heap.peek()).toBe(100);
    expect(heap.pop()).toBe(100);
    expect(heap.pop()).toBe(102);
    expect(heap.pop()).toBe(105);
    expect(heap.pop()).toBeUndefined();
  });
});
