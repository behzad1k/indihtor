import { Injectable, Logger } from '@nestjs/common';
import { ExchangeAggregatorService } from '@modules/external-api/services/exchange-aggregator.service';
import { RateLimiterService } from './rate-limiter.service';
import { OHLCVData, ExchangeType } from '@/types/exchange.types';

/**
 * Price Data Service - SIMPLIFIED VERSION
 *
 * No caching, no timeframe derivation.
 * Fetches directly from exchanges for each request.
 */
@Injectable()
export class PriceDataService {
  private readonly logger = new Logger(PriceDataService.name);

  // Simple performance tracking
  private fetchStats = {
    totalFetches: 0,
    successfulFetches: 0,
    failedFetches: 0,
    avgFetchTime: 0,
    totalApiCalls: 0,
  };

  constructor(
    private readonly exchangeAggregator: ExchangeAggregatorService,
    private readonly rateLimiterService: RateLimiterService,
  ) {
    // Log stats every 5 minutes
    setInterval(() => this.logStats(), 300000);
  }

  /**
   * Fetch price journey for a signal - NO CACHING
   * Directly fetches the exact timeframe needed from exchanges
   */
  async fetchPriceJourney(
    symbol: string,
    timestamp: Date,
    timeframe: string,
    candlesAhead: number = 10,
  ): Promise<OHLCVData[] | null> {
    const startTime = Date.now();
    this.fetchStats.totalFetches++;
    this.fetchStats.totalApiCalls++;

    try {
      // Check if signal is too old (exchanges don't keep very old data)
      const ageInDays = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays > 365) {
        this.logger.warn(
          `Skipping ${symbol}: signal is ${ageInDays.toFixed(0)} days old, ` +
          `exchanges don't keep data this old`
        );
        this.fetchStats.failedFetches++;
        return null;
      }

      if (ageInDays > 90) {
        this.logger.debug(
          `${symbol} signal is ${ageInDays.toFixed(0)} days old, ` +
          `may have limited data availability`
        );
      }

      // Calculate time range
      const startTimestamp = Math.floor(timestamp.getTime() / 1000);
      const minutes = this.getTimeframeMinutes(timeframe);
      const endTimestamp = startTimestamp + (minutes * 60 * (candlesAhead + 5));

      this.logger.debug(
        `Fetching ${symbol} ${timeframe}: ` +
        `${candlesAhead + 5} candles from ${new Date(startTimestamp * 1000).toISOString()}`
      );

      // Fetch directly from exchange - NO CACHING
      const data = await this.exchangeAggregator.fetchCandlesWithCircularPriority({
        symbol,
        timeframe,
        limit: candlesAhead + 5, // Extra buffer
        startTime: startTimestamp,
        endTime: endTimestamp,
      });

      const fetchTime = Date.now() - startTime;

      if (data && data.length >= 2) {
        this.fetchStats.successfulFetches++;
        this.updateFetchTime(fetchTime);

        this.logger.debug(
          `✅ Fetched ${data.length} candles for ${symbol} ${timeframe} in ${fetchTime}ms`
        );

        return data;
      }

      this.fetchStats.failedFetches++;
      this.logger.warn(
        `Failed to fetch ${symbol} ${timeframe}: got ${data?.length || 0} candles`
      );

      return null;
    } catch (error) {
      this.fetchStats.failedFetches++;
      this.logger.error(
        `Error fetching price journey for ${symbol} ${timeframe}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Batch fetch for multiple signals
   * Processes in small batches to respect rate limits
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

    // Process in smaller batches to avoid overwhelming exchanges
    const batchSize = 10;

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
      if (completed % 50 === 0 || completed === requests.length) {
        this.logger.log(
          `Batch progress: ${completed}/${requests.length} ` +
          `(${(completed / requests.length * 100).toFixed(1)}%) - ` +
          `Success rate: ${this.getSuccessRate()}`
        );
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < requests.length) {
        await this.sleep(1000);
      }
    }

    this.logger.log(
      `Batch complete: ${results.size} results, ` +
      `${this.fetchStats.successfulFetches} successful, ` +
      `${this.fetchStats.failedFetches} failed`
    );

    return results;
  }

  /**
   * Fetch from specific exchange (for testing/debugging)
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

    this.logger.debug(
      `Fetching from ${exchange}: ${symbol} ${timeframe}`
    );

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
   * Get comprehensive performance statistics
   */
  getStats() {
    const successRate = this.getSuccessRate();

    return {
      totalFetches: this.fetchStats.totalFetches,
      successfulFetches: this.fetchStats.successfulFetches,
      failedFetches: this.fetchStats.failedFetches,
      successRate,
      avgFetchTimeMs: this.fetchStats.avgFetchTime.toFixed(2),
      totalApiCalls: this.fetchStats.totalApiCalls,
      rateLimits: this.exchangeAggregator.getRateLimitStatus(),
      exchangeStats: this.exchangeAggregator.getOptimizedStats(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.fetchStats = {
      totalFetches: 0,
      successfulFetches: 0,
      failedFetches: 0,
      avgFetchTime: 0,
      totalApiCalls: 0,
    };
    this.logger.log('Statistics reset');
  }

  /**
   * Get timeframe in minutes
   */
  private getTimeframeMinutes(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 1, '3m': 3, '5m': 5, '15m': 15,
      '30m': 30, '1h': 60, '2h': 120, '4h': 240,
      '6h': 360, '8h': 480, '12h': 720, '1d': 1440,
      '3d': 4320, '1w': 10080,
    };
    return map[timeframe] || 60;
  }

  /**
   * Update average fetch time
   */
  private updateFetchTime(timeMs: number): void {
    const total = this.fetchStats.totalFetches;
    if (total === 0) return;

    this.fetchStats.avgFetchTime =
      (this.fetchStats.avgFetchTime * (total - 1) + timeMs) / total;
  }

  /**
   * Get success rate as formatted string
   */
  private getSuccessRate(): string {
    if (this.fetchStats.totalFetches === 0) return '0.00%';

    const rate = (this.fetchStats.successfulFetches / this.fetchStats.totalFetches) * 100;
    return `${rate.toFixed(2)}%`;
  }

  /**
   * Log statistics periodically
   */
  private logStats(): void {
    if (this.fetchStats.totalFetches === 0) return;

    const stats = this.getStats();

    this.logger.log('\n=== Price Data Service Statistics ===');
    this.logger.log(`Total Fetches: ${stats.totalFetches}`);
    this.logger.log(`Successful: ${stats.successfulFetches}`);
    this.logger.log(`Failed: ${stats.failedFetches}`);
    this.logger.log(`Success Rate: ${stats.successRate}`);
    this.logger.log(`Avg Fetch Time: ${stats.avgFetchTimeMs}ms`);
    this.logger.log(`Total API Calls: ${stats.totalApiCalls}`);
    this.logger.log('');
    this.logger.log('Rate Limit Status:');

    for (const [exchange, status] of Object.entries(stats.rateLimits)) {
      this.logger.log(
        `  ${exchange}: ${status.current}/${status.limit} ` +
        `(${status.percentage}% used)`
      );
    }

    this.logger.log('=====================================\n');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}