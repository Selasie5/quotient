export class MaxHeap {
  private readonly values: number[] = [];

  get size(): number {
    return this.values.length;
  }

  peek(): number | undefined {
    return this.values[0];
  }

  insert(value: number): void {
    this.values.push(value);
    this.siftUp(this.values.length - 1);
  }

  pop(): number | undefined {
    if (this.values.length === 0) return undefined;

    const maximum = this.values[0];
    const last = this.values.pop()!;

    if (this.values.length > 0) {
      this.values[0] = last;
      this.siftDown(0);
    }

    return maximum;
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent] >= this.values[index]) return;

      this.swap(parent, index);
      index = parent;
    }
  }

  private siftDown(index: number): void {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;

      if (
        left < this.values.length &&
        this.values[left] > this.values[largest]
      ) {
        largest = left;
      }

      if (
        right < this.values.length &&
        this.values[right] > this.values[largest]
      ) {
        largest = right;
      }

      if (largest === index) return;

      this.swap(index, largest);
      index = largest;
    }
  }

  private swap(left: number, right: number): void {
    [this.values[left], this.values[right]] = [
      this.values[right],
      this.values[left],
    ];
  }
}
