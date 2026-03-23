export type PrioritySelector<T> = (item: T) => number;

interface QueueEntry<T> {
  readonly value: T;
  readonly priority: number;
  readonly sequence: number;
}

export class PriorityQueue<T> {
  private readonly heap: QueueEntry<T>[] = [];
  private sequenceCounter = 0;

  constructor(private readonly selectPriority: PrioritySelector<T>) {}

  get size(): number {
    return this.heap.length;
  }

  peek(): T | null {
    return this.heap.length === 0 ? null : this.heap[0].value;
  }

  enqueue(value: T): void {
    const entry: QueueEntry<T> = {
      value,
      priority: this.selectPriority(value),
      sequence: this.sequenceCounter++,
    };
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!.value;

    const root = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return root.value;
  }

  toArray(): T[] {
    return [...this.heap]
      .sort((a, b) => this.compare(b, a))
      .map((entry) => entry.value);
  }

  private bubbleUp(index: number): void {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (this.compare(this.heap[currentIndex], this.heap[parentIndex]) <= 0) {
        break;
      }
      this.swap(currentIndex, parentIndex);
      currentIndex = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    let currentIndex = index;
    while (true) {
      const leftIndex = currentIndex * 2 + 1;
      const rightIndex = currentIndex * 2 + 2;
      let highestIndex = currentIndex;

      if (leftIndex < this.heap.length && this.compare(this.heap[leftIndex], this.heap[highestIndex]) > 0) {
        highestIndex = leftIndex;
      }

      if (rightIndex < this.heap.length && this.compare(this.heap[rightIndex], this.heap[highestIndex]) > 0) {
        highestIndex = rightIndex;
      }

      if (highestIndex === currentIndex) {
        break;
      }

      this.swap(currentIndex, highestIndex);
      currentIndex = highestIndex;
    }
  }

  private compare(a: QueueEntry<T>, b: QueueEntry<T>): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.sequence - a.sequence;
  }

  private swap(aIndex: number, bIndex: number): void {
    const temp = this.heap[aIndex];
    this.heap[aIndex] = this.heap[bIndex];
    this.heap[bIndex] = temp;
  }
}
