/**
 * Simple LRU Cache for API responses
 * - Max 100 entries (configurable)
 * - 24hr TTL (configurable)
 * - Memory-only, clears on app restart
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class LRUCache<T> {
    private cache: Map<string, CacheEntry<T>>;
    private maxSize: number;
    private ttlMs: number;

    constructor(maxSize: number = 100, ttlHours: number = 24) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlHours * 60 * 60 * 1000;
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) return null;

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.data;
    }

    set(key: string, data: T): void {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

// Singleton instances for different cache purposes
export const wikiSearchCache = new LRUCache<any>(100, 24); // 100 items, 24hr TTL
export const wikiDetailsCache = new LRUCache<any>(50, 24); // 50 items for place details
