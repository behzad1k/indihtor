/**
 * Candle Cache Service with Request Deduplication
 *
 * FIXES:
 * 1. Request deduplication - prevents duplicate fetches
 * 2. In-flight request tracking
 * 3. Proper cache coordination
 */

import { Injectable, Logger } from '@nestjs/common';
import { OHLCVData } from '@/types/exchange.types';

interface CacheEntry {
  data: OHLCVData[];
  timestamp: number;
  symbol: string;
  timeframe: string;
}

interface TimeframeConfig {
  baseTimeframe: string;
  multiplier: number;
}

interface InFlightRequest {
  promise: Promise<OHLCVData[] | null>;
  startTime: number;
}

@Injectable()
export class CandleCacheService {
  private readonly logger = new Logger(CandleCacheService.name);

  // Base timeframes to fetch from exchanges
  private readonly BASE_TIMEFRAMES = ['1m', '5m', '30m', '4h', '8h'];

  // Cache with 10-minute TTL
  private readonly CACHE_TTL = 600000; // 10 minutes
  private readonly cache: Map<string, CacheEntry> = new Map();

  // In-flight requests tracking (prevents duplicates!)
  private readonly inFlightRequests: Map<string, InFlightRequest> = new Map();

  // Timeframe conversion mappings
  private readonly TIMEFRAME_DERIVATIONS: Record<string, TimeframeConfig> = {
    // From 1m base:
    '3m': { baseTimeframe: '1m', multiplier: 3 },

    // From 5m base:
    '15m': { baseTimeframe: '5m', multiplier: 3 },

    // From 30m base:
    '1h': { baseTimeframe: '30m', multiplier: 2 },
    '2h': { baseTimeframe: '30m', multiplier: 4 },

    // From 6h base:
    '12h': { baseTimeframe: '4h', multiplier: 3 },

    // From 8h base:
    '1d': { baseTimeframe: '8h', multiplier: 3 },
  };

  // Statistics
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    derivations: 0,
    baseFetches: 0,
    apiCallsSaved: 0,
    duplicatesAvoided: 0, // NEW!
  };

  /**
   * Get candles with request deduplication
   * CRITICAL: Ensures only ONE fetch per symbol/timeframe at a time
   */
  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    fetchFn: (tf: string, lim: number) => Promise<OHLCVData[] | null>,
  ): Promise<OHLCVData[] | null> {
    // Check if derivable
    // if (this.TIMEFRAME_DERIVATIONS[timeframe]) {
    //   return this.getDerivedCandles(symbol, timeframe, limit, fetchFn);
    // }
    //
    // // Check if it's a base timeframe
    // if (this.BASE_TIMEFRAMES.includes(timeframe)) {
    //   return this.getBaseCandles(symbol, timeframe, limit, fetchFn);
    // }

    // Fallback: fetch directly with deduplication
    return this.fetchWithDeduplication(symbol, timeframe, limit, fetchFn);
  }

  /**
   * Fetch with deduplication - prevents duplicate requests
   */
  private async fetchWithDeduplication(
    symbol: string,
    timeframe: string,
    limit: number,
    fetchFn: (tf: string, lim: number) => Promise<OHLCVData[] | null>,
  ): Promise<OHLCVData[] | null> {
    const requestKey = this.getRequestKey(symbol, timeframe);

    // Check if request is already in-flight
    const inFlight = this.inFlightRequests.get(requestKey);
    if (inFlight) {
      this.stats.duplicatesAvoided++;
      this.logger.debug(`⚡ Request dedup: ${symbol} ${timeframe} (waiting for in-flight request)`);

      // Wait for the in-flight request to complete
      const data = await inFlight.promise;
      return data ? data.slice(-limit) : null;
    }

    // Create new request
    const promise = this.executeFetch(symbol, timeframe, limit, fetchFn);

    // Track as in-flight
    this.inFlightRequests.set(requestKey, {
      promise,
      startTime: Date.now(),
    });

    try {
      const data = await promise;
      return data;
    } finally {
      // Remove from in-flight when complete
      this.inFlightRequests.delete(requestKey);
    }
  }

  /**
   * Execute the actual fetch
   */
  private async executeFetch(
    symbol: string,
    timeframe: string,
    limit: number,
    fetchFn: (tf: string, lim: number) => Promise<OHLCVData[] | null>,
  ): Promise<OHLCVData[] | null> {
    const cacheKey = this.getCacheKey(symbol, timeframe);

    // Double-check cache (might have been populated while waiting)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.stats.cacheHits++;
      this.logger.debug(`Cache HIT: ${symbol} ${timeframe}`);
      return cached.data.slice(-limit);
    }

    // Cache miss - fetch
    this.stats.cacheMisses++;
    this.stats.baseFetches++;
    this.logger.debug(`Cache MISS: ${symbol} ${timeframe} - fetching from exchange`);

    const maxLimit = 1000;
    const data = await fetchFn(timeframe, maxLimit);

    if (!data || data.length === 0) {
      return null;
    }

    // Cache the data
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      symbol,
      timeframe,
    });

    return data.slice(-limit);
  }

  /**
   * Get base timeframe candles with deduplication
   */
  private async getBaseCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    fetchFn: (tf: string, lim: number) => Promise<OHLCVData[] | null>,
  ): Promise<OHLCVData[] | null> {
    const cacheKey = this.getCacheKey(symbol, timeframe);
    const cached = this.cache.get(cacheKey);

    // Check cache validity
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.stats.cacheHits++;
      this.logger.debug(`Cache HIT: ${symbol} ${timeframe}`);
      return cached.data.slice(-limit);
    }

    // Use deduplication for fetching
    return this.fetchWithDeduplication(symbol, timeframe, limit, fetchFn);
  }

  /**
   * Get derived timeframe candles
   */
  private async getDerivedCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    fetchFn: (tf: string, lim: number) => Promise<OHLCVData[] | null>,
  ): Promise<OHLCVData[] | null> {
    const config = this.TIMEFRAME_DERIVATIONS[timeframe];
    const { baseTimeframe, multiplier } = config;

    // Calculate how many base candles we need
    const baseLimit = limit * multiplier + 10;

    // Get base data (will use deduplication)
    const baseData = await this.getBaseCandles(
      symbol,
      baseTimeframe,
      baseLimit,
      fetchFn,
    );

    if (!baseData || baseData.length < multiplier) {
      return null;
    }

    // Derive
    this.stats.derivations++;
    this.stats.apiCallsSaved++;

    this.logger.debug(`Deriving ${timeframe} from ${baseTimeframe} (${baseData.length} candles)`);

    const derived = this.aggregateCandles(baseData, multiplier);
    return derived.slice(-limit);
  }

  /**
   * Aggregate candles into larger timeframe
   */
  private aggregateCandles(
    candles: OHLCVData[],
    multiplier: number,
  ): OHLCVData[] {
    const aggregated: OHLCVData[] = [];

    for (let i = 0; i < candles.length; i += multiplier) {
      const chunk = candles.slice(i, i + multiplier);

      if (chunk.length < multiplier) {
        break;
      }

      aggregated.push({
        timestamp: chunk[0].timestamp,
        open: chunk[0].open,
        high: Math.max(...chunk.map(c => c.high)),
        low: Math.min(...chunk.map(c => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((sum, c) => sum + c.volume, 0),
      });
    }

    return aggregated;
  }

  /**
   * Pre-warm cache for a symbol across all base timeframes
   * With deduplication to prevent race conditions
   */
  async prewarmCache(
    symbol: string,
    fetchFn: (tf: string, lim: number) => Promise<OHLCVData[] | null>,
  ): Promise<void> {
    this.logger.log(`Pre-warming cache for ${symbol}...`);

    // Sequential prewarming to avoid overwhelming exchanges
    for (const tf of this.BASE_TIMEFRAMES) {
      try {
        await this.getBaseCandles(symbol, tf, 1000, fetchFn);
      } catch (error) {
        this.logger.warn(`Failed to prewarm ${symbol} ${tf}: ${error.message}`);
      }
    }

    this.logger.log(`✅ Cache prewarmed for ${symbol}`);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL) {
        this.cache.delete(key);
        cleared++;
      }
    }

    // Also clean up stale in-flight requests (> 30 seconds old)
    for (const [key, request] of this.inFlightRequests.entries()) {
      if (now - request.startTime > 30000) {
        this.inFlightRequests.delete(key);
        this.logger.warn(`Cleaned up stale in-flight request: ${key}`);
      }
    }

    if (cleared > 0) {
      this.logger.debug(`Cleared ${cleared} expired cache entries`);
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.inFlightRequests.clear();
    this.logger.log(`Cleared entire cache (${size} entries)`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = totalRequests > 0
      ? ((this.stats.cacheHits / totalRequests) * 100).toFixed(2)
      : '0.00';

    const efficiency = this.stats.baseFetches > 0
      ? ((this.stats.apiCallsSaved / (this.stats.baseFetches + this.stats.apiCallsSaved)) * 100).toFixed(2)
      : '0.00';

    const totalSaved = this.stats.apiCallsSaved + this.stats.duplicatesAvoided;

    return {
      cacheSize: this.cache.size,
      inFlightRequests: this.inFlightRequests.size,
      cacheMisses: this.stats.cacheMisses,
      hitRate: `${hitRate}%`,
      derivations: this.stats.derivations,
      baseFetches: this.stats.baseFetches,
      apiCallsSaved: this.stats.apiCallsSaved,
      duplicatesAvoided: this.stats.duplicatesAvoided,
      totalSaved,
      efficiency: `${efficiency}%`,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      derivations: 0,
      baseFetches: 0,
      apiCallsSaved: 0,
      duplicatesAvoided: 0,
    };
    this.logger.log('Statistics reset');
  }

  private getCacheKey(symbol: string, timeframe: string): string {
    return `${symbol}:${timeframe}`;
  }

  private getRequestKey(symbol: string, timeframe: string): string {
    return `req:${symbol}:${timeframe}`;
  }
}