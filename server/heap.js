/**
 * Min-heap priority queue for emergency cases.
 * Lower priority number is served first (1 = critical).
 * Equal priorities break ties by earlier arrival_time.
 */
class EmergencyHeap {
  constructor() {
    this.items = [];
  }

  size() {
    return this.items.length;
  }

  peek() {
    return this.items[0] || null;
  }

  insert(caseItem) {
    this.items.push(caseItem);
    this.#siftUp(this.items.length - 1);
  }

  extractMin() {
    if (this.items.length === 0) return null;
    const min = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.#siftDown(0);
    }
    return min;
  }

  toArray() {
    return [...this.items].sort((a, b) => this.#compare(a, b));
  }

  rebuild(cases) {
    this.items = [];
    for (const item of cases) this.insert(item);
  }

  #compare(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.arrival_time) - new Date(b.arrival_time);
  }

  #siftUp(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.#compare(this.items[i], this.items[p]) >= 0) break;
      [this.items[i], this.items[p]] = [this.items[p], this.items[i]];
      i = p;
    }
  }

  #siftDown(i) {
    const n = this.items.length;
    while (true) {
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      let smallest = i;
      if (l < n && this.#compare(this.items[l], this.items[smallest]) < 0) smallest = l;
      if (r < n && this.#compare(this.items[r], this.items[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
      i = smallest;
    }
  }
}

const SEVERITY_PRIORITY = {
  critical: 1,
  serious: 2,
  moderate: 3,
  normal: 4
};

module.exports = { EmergencyHeap, SEVERITY_PRIORITY };
