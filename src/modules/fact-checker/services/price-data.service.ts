import { Injectable, Logger } from '@nestjs/common';
import { ExchangeAggregatorService } from '@modules/external-api/services/exchange-aggregator.service';
import { CandleCacheService } from './candle-cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { OHLCVData, ExchangeType } from '@/types/exchange.types';

@Injectable()
export class PriceDataService {
  private readonly logger = new Logger(PriceDataService.name);

  // Performance tracking
  private fetchStats = {
    totalFetches: 0,
    cacheHits: 0,
    derivations: 0,
    directFetches: 0,
    avgFetchTime: 0,
    apiCallsSaved: 0,
  };

  constructor(
    private readonly exchangeAggregator: ExchangeAggregatorService,
    private readonly candleCache: CandleCacheService,
    private readonly rateLimiterService: RateLimiterService,
  ) {
    // Log stats every 5 minutes
    setInterval(() => this.logStats(), 300000);

    // Clean expired cache every minute
    setInterval(() => this.candleCache.clearExpiredCache(), 60000);
  }

  /**
   * Fetch price journey with intelligent caching and derivation
   * HIGHLY OPTIMIZED for high-volume fact-checking (1M+ signals)
   */
  async fetchPriceJourney(
    symbol: string,
    timestamp: Date,
    timeframe: string,
    candlesAhead: number = 10,
  ): Promise<OHLCVData[] | null> {
    const startTime = Date.now();
    this.fetchStats.totalFetches++;

    try {
      // Calculate time range
      const startTimestamp = Math.floor(timestamp.getTime() / 1000);
      const minutes = this.getTimeframeMinutes(timeframe);
      const endTimestamp = startTimestamp + (minutes * 60 * (candlesAhead + 2));

      // Use cache service with intelligent derivation
      const data = await this.candleCache.getCandles(
        symbol,
        timeframe,
        candlesAhead + 5, // Extra buffer
        async (tf: string, limit: number) => {
          // Fetch function passed to cache
          return this.fetchFromExchange(symbol, tf, limit, startTimestamp, endTimestamp);
        },
      );

      if (data && data.length >= 2) {
        const cacheStats = this.candleCache.getStats();

        // Update our stats based on cache behavior
        if ((cacheStats as any).cacheHits > this.fetchStats.cacheHits) {
          this.fetchStats.cacheHits++;
        } else if (cacheStats.derivations > this.fetchStats.derivations) {
          this.fetchStats.derivations++;
          this.fetchStats.apiCallsSaved++;
        } else {
          this.fetchStats.directFetches++;
        }

        this.updateFetchTime(Date.now() - startTime);
        return data;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error fetching price journey: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch from exchange using circular priority (rate-limit aware)
   */
  private async fetchFromExchange(
    symbol: string,
    timeframe: string,
    limit: number,
    startTime?: number,
    endTime?: number,
  ): Promise<OHLCVData[] | null> {
    const options = {
      symbol,
      timeframe,
      limit,
      startTime,
      endTime,
    };

    // Use circular priority for best distribution
    return this.exchangeAggregator.fetchCandlesWithCircularPriority(options);
  }

  /**
   * Batch fetch for multiple symbols/timeframes with pre-warming
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

    // Pre-warm cache for unique symbols
    const uniqueSymbols = [...new Set(requests.map(r => r.symbol))];

    this.logger.log(`Pre-warming cache for ${uniqueSymbols.length} symbols...`);
    for (const symbol of uniqueSymbols) {
      await this.candleCache.prewarmCache(
        symbol,
        async (tf: string, limit: number) => {
          return this.fetchFromExchange(symbol, tf, limit);
        },
      );
    }

    // Process requests in batches of 20
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

        // Log cache efficiency
        const cacheStats = this.candleCache.getStats();
        this.logger.log(
          `Cache efficiency: ${cacheStats.hitRate} hit rate, ${cacheStats.apiCallsSaved} API calls saved`
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
   * Clear all caches
   */
  clearCache(): void {
    this.candleCache.clearCache();
    this.logger.log('All caches cleared');
  }

  /**
   * Get comprehensive performance statistics
   */
  getStats() {
    const cacheStats = this.candleCache.getStats();

    const totalApiCalls = this.fetchStats.directFetches + this.fetchStats.derivations;
    const potentialCalls = totalApiCalls + this.fetchStats.apiCallsSaved;

    const efficiency = potentialCalls > 0
      ? ((this.fetchStats.apiCallsSaved / potentialCalls) * 100).toFixed(2)
      : '0.00';

    return {
      fetching: {
        totalFetches: this.fetchStats.totalFetches,
        cacheHits: this.fetchStats.cacheHits,
        derivations: this.fetchStats.derivations,
        directFetches: this.fetchStats.directFetches,
        avgFetchTimeMs: this.fetchStats.avgFetchTime.toFixed(2),
      },
      cache: cacheStats,
      efficiency: {
        apiCallsMade: totalApiCalls,
        apiCallsSaved: this.fetchStats.apiCallsSaved,
        totalPotentialCalls: potentialCalls,
        savingsPercentage: `${efficiency}%`,
      },
      rateLimits: this.exchangeAggregator.getRateLimitStatus(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.fetchStats = {
      totalFetches: 0,
      cacheHits: 0,
      derivations: 0,
      directFetches: 0,
      avgFetchTime: 0,
      apiCallsSaved: 0,
    };
    this.candleCache.resetStats();
    this.logger.log('All statistics reset');
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

  private updateFetchTime(timeMs: number): void {
    const total = this.fetchStats.totalFetches;
    this.fetchStats.avgFetchTime =
      (this.fetchStats.avgFetchTime * (total - 1) + timeMs) / total;
  }

  private logStats(): void {
    const stats = this.getStats();

    this.logger.log('=== Price Data Service Statistics ===');
    this.logger.log(`Total Fetches: ${stats.fetching.totalFetches}`);
    this.logger.log(`Cache Hits: ${stats.fetching.cacheHits}`);
    this.logger.log(`Derivations: ${stats.fetching.derivations}`);
    this.logger.log(`Direct Fetches: ${stats.fetching.directFetches}`);
    this.logger.log(`Avg Fetch Time: ${stats.fetching.avgFetchTimeMs}ms`);
    this.logger.log('');
    this.logger.log('Cache Stats:');
    this.logger.log(`  Size: ${stats.cache.cacheSize} entries`);
    this.logger.log(`  Hit Rate: ${stats.cache.hitRate}`);
    this.logger.log(`  Derivations: ${stats.cache.derivations}`);
    this.logger.log('');
    this.logger.log('Efficiency:');
    this.logger.log(`  API Calls Made: ${stats.efficiency.apiCallsMade}`);
    this.logger.log(`  API Calls Saved: ${stats.efficiency.apiCallsSaved}`);
    this.logger.log(`  Savings: ${stats.efficiency.savingsPercentage}`);
    this.logger.log('=====================================');
  }
}