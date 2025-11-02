export class PriceDataCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly ttl: number;

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.ttl) {
        return cached.data;
      }
      this.cache.delete(key);
    }
    return null;
  }

  set(key: string, value: any): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  clearOld(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}