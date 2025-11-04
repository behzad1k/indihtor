import { Injectable, Logger } from '@nestjs/common';
import { ExchangeAggregatorService } from '@modules/external-api/services/exchange-aggregator.service';
import { RateLimiterService } from './rate-limiter.service';
import { OHLCVData, ExchangeType } from '@/types/exchange.types';

@Injectable()
export class PriceDataService {
  private readonly logger = new Logger(PriceDataService.name);

  // Cache for price data (5 minute TTL)
  private priceCache: Map<string, { data: OHLCVData[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  // Performance tracking
  private fetchStats = {
    totalFetches: 0,
    cacheHits: 0,
    raceFetches: 0,
    fallbackFetches: 0,
    avgFetchTime: 0,
  };

  constructor(
    private readonly exchangeAggregator: ExchangeAggregatorService,
    private readonly rateLimiterService: RateLimiterService,
  ) {
    // Log stats every 5 minutes
    setInterval(() => this.logStats(), 300000);
  }

  /**
   * Fetch price journey using race condition for speed
   * OPTIMIZED FOR HIGH-VOLUME FACT-CHECKING (1M+ signals)
   */
  async fetchPriceJourney(
    symbol: string,
    timestamp: Date,
    timeframe: string,
    candlesAhead: number = 10,
  ): Promise<OHLCVData[] | null> {
    const startTime = Date.now();
    this.fetchStats.totalFetches++;

    // Check cache
    const cacheKey = this.getCacheKey(symbol, timestamp, timeframe, candlesAhead);
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.fetchStats.cacheHits++;
      this.logger.debug(`Cache hit for ${symbol} ${timeframe}`);
      return cached.data;
    }

    // Calculate time range
    const startTimestamp = Math.floor(timestamp.getTime() / 1000);
    const minutes = this.getTimeframeMinutes(timeframe);
    const endTimestamp = startTimestamp + (minutes * 60 * (candlesAhead + 2));

    const options = {
      symbol,
      timeframe,
      limit: candlesAhead + 5,
      startTime: startTimestamp,
      endTime: endTimestamp,
    };

    // Use race condition for speed - fetch from multiple exchanges simultaneously
    let data: OHLCVData[] | null = null;

    // Try race mode first (fastest)
    try {
      data = await this.exchangeAggregator.fetchCandlesRace(options);
      if (data && data.length >= 2) {
        this.fetchStats.raceFetches++;
        this.updateFetchTime(Date.now() - startTime);
        this.cacheData(cacheKey, data);
        return data;
      }
    } catch (error) {
      this.logger.warn(`Race fetch failed for ${symbol}: ${error.message}`);
    }

    // Fallback to sequential fetching if race fails
    try {
      data = await this.exchangeAggregator.fetchCandlesWithFallback(options);
      if (data && data.length >= 2) {
        this.fetchStats.fallbackFetches++;
        this.updateFetchTime(Date.now() - startTime);
        this.cacheData(cacheKey, data);
        return data;
      }
    } catch (error) {
      this.logger.error(`Fallback fetch failed for ${symbol}: ${error.message}`);
    }

    this.logger.error(`All fetch methods failed for ${symbol} ${timeframe}`);
    return null;
  }

  /**
   * Batch fetch for multiple symbols/timeframes
   * Optimized for parallel processing
   */
  async batchFetchPriceJourneys(
    requests: Array<{
      symbol: string;
      timestamp: Date;
      timeframe: string;
      candlesAhead: number;
    }>,
  ): Promise<Map<string, OHLCVData[] | null>> {
    const results = new Map<string, OHLCVData[] | null>();

    this.logger.log(`Batch fetching ${requests.length} price journeys`);

    // Process in batches of 20 to avoid overwhelming the system
    const batchSize = 20;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map(async req => {
        const key = `${req.symbol}:${req.timeframe}:${req.timestamp.toISOString()}`;
        const data = await this.fetchPriceJourney(
          req.symbol,
          req.timestamp,
          req.timeframe,
          req.candlesAhead,
        );
        return { key, data };
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.key, result.value.data);
        }
      }

      // Log progress
      const completed = Math.min(i + batchSize, requests.length);
      if (completed % 100 === 0 || completed === requests.length) {
        this.logger.log(
          `Batch progress: ${completed}/${requests.length} (${(completed / requests.length * 100).toFixed(1)}%)`
        );
      }
    }

    return results;
  }

  /**
   * Fetch from specific exchange (for testing/comparison)
   */
  async fetchPriceJourneyFromExchange(
    exchange: ExchangeType,
    symbol: string,
    timestamp: Date,
    timeframe: string,
    candlesAhead: number = 10,
  ): Promise<OHLCVData[] | null> {
    const startTimestamp = Math.floor(timestamp.getTime() / 1000);
    const minutes = this.getTimeframeMinutes(timeframe);
    const endTimestamp = startTimestamp + (minutes * 60 * (candlesAhead + 2));

    const data = await this.exchangeAggregator.fetchCandlesFromExchange(exchange, {
      symbol,
      timeframe,
      limit: candlesAhead + 5,
      startTime: startTimestamp,
      endTime: endTimestamp,
    });

    return data;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;

    for (const [key, value] of this.priceCache.entries()) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.priceCache.delete(key);
        cleared++;
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
    const size = this.priceCache.size;
    this.priceCache.clear();
    this.logger.log(`Cleared entire cache (${size} entries)`);
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const cacheHitRate = this.fetchStats.totalFetches > 0
      ? (this.fetchStats.cacheHits / this.fetchStats.totalFetches * 100).toFixed(2)
      : '0.00';

    const raceSuccessRate = this.fetchStats.totalFetches > 0
      ? (this.fetchStats.raceFetches / this.fetchStats.totalFetches * 100).toFixed(2)
      : '0.00';

    return {
      ...this.fetchStats,
      cacheHitRate: `${cacheHitRate}%`,
      raceSuccessRate: `${raceSuccessRate}%`,
      cacheSize: this.priceCache.size,
      avgFetchTimeMs: this.fetchStats.avgFetchTime.toFixed(2),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.fetchStats = {
      totalFetches: 0,
      cacheHits: 0,
      raceFetches: 0,
      fallbackFetches: 0,
      avgFetchTime: 0,
    };
    this.logger.log('Statistics reset');
  }

  private getCacheKey(
    symbol: string,
    timestamp: Date,
    timeframe: string,
    candles: number,
  ): string {
    const tsStr = timestamp.toISOString().substring(0, 16); // Minute precision
    return `${symbol}:${timeframe}:${tsStr}:${candles}`;
  }

  private getTimeframeMinutes(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 1, '3m': 3, '5m': 5, '15m': 15,
      '30m': 30, '1h': 60, '2h': 120, '4h': 240,
      '6h': 360, '8h': 480, '12h': 720, '1d': 1440,
      '3d': 4320, '1w': 10080,
    };
    return map[timeframe] || 60;
  }

  private cacheData(key: string, data: OHLCVData[]): void {
    this.priceCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Auto-cleanup if cache gets too large (> 10,000 entries)
    if (this.priceCache.size > 10000) {
      this.clearExpiredCache();
    }
  }

  private updateFetchTime(timeMs: number): void {
    const total = this.fetchStats.totalFetches;
    this.fetchStats.avgFetchTime =
      (this.fetchStats.avgFetchTime * (total - 1) + timeMs) / total;
  }

  private logStats(): void {
    const stats = this.getStats();
    this.logger.log('=== Price Data Service Statistics ===');
    this.logger.log(`Total Fetches: ${stats.totalFetches}`);
    this.logger.log(`Cache Hit Rate: ${stats.cacheHitRate}`);
    this.logger.log(`Race Success Rate: ${stats.raceSuccessRate}`);
    this.logger.log(`Fallback Fetches: ${stats.fallbackFetches}`);
    this.logger.log(`Avg Fetch Time: ${stats.avgFetchTimeMs}ms`);
    this.logger.log(`Cache Size: ${stats.cacheSize} entries`);
    this.logger.log('=====================================');
  }
}