export class BoundedLog<T> {
  private readonly values: Array<T | undefined>;
  private start = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("capacity must be a positive integer");
    }
    this.values = new Array<T | undefined>(capacity);
  }

  append(value: T): void {
    if (this.count < this.capacity) {
      this.values[(this.start + this.count) % this.capacity] = value;
      this.count += 1;
      return;
    }

    this.values[this.start] = value;
    this.start = (this.start + 1) % this.capacity;
  }

  snapshot(): T[] {
    const snapshot: T[] = [];
    for (let index = 0; index < this.count; index += 1) {
      snapshot.push(this.values[(this.start + index) % this.capacity]!);
    }
    return snapshot;
  }
}
