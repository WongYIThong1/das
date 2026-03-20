// Module-level in-memory store for passing File[] across client-side navigation.
// File objects cannot be serialized, so we hold them in module state which
// persists across Next.js soft navigations.

type PendingBatch = {
  batchId: string;
  files: File[];
};

let _pending: PendingBatch | null = null;

export const batchStore = {
  set(batchId: string, files: File[]): void {
    _pending = { batchId, files };
  },
  consume(): PendingBatch | null {
    const result = _pending;
    _pending = null;
    return result;
  },
  peek(): PendingBatch | null {
    return _pending;
  },
};
