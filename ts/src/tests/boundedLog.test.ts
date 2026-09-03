import { describe, expect, test } from "vitest";
import { BoundedLog } from "../boundedLog";

describe("BoundedLog", () => {
  test("keeps the newest values in chronological order", () => {
    const log = new BoundedLog<number>(3);

    log.append(1);
    log.append(2);
    log.append(3);
    log.append(4);
    log.append(5);

    expect(log.snapshot()).toEqual([3, 4, 5]);
  });

  test("returns a detached array snapshot", () => {
    const log = new BoundedLog<number>(2);
    log.append(1);

    const snapshot = log.snapshot();
    snapshot.push(2);

    expect(log.snapshot()).toEqual([1]);
  });
});
