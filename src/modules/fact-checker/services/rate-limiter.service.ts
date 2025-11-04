/**
 * Rate Limiter Service
 *
 * Manages API rate limits for KuCoin and Binance
 * Prevents hitting rate limits with intelligent throttling
 */

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // Rate limits (requests per minute)
  private readonly KUCOIN_RATE_LIMIT = 100;
  private readonly BINANCE_RATE_LIMIT = 1200;

  // Request tracking
  private kucoinRequests: number[] = [];
  private binanceRequests: number[] = [];

  /**
   * Wait if needed to avoid exceeding KuCoin rate limit
   */
  async waitIfNeededKucoin(): Promise<void> {
    const now = Date.now();

    // Remove requests older than 1 minute
    this.kucoinRequests = this.kucoinRequests.filter(
      (timestamp) => now - timestamp < 60000
    );

    if (this.kucoinRequests.length >= this.KUCOIN_RATE_LIMIT) {
      // Calculate sleep time
      const oldestRequest = this.kucoinRequests[0];
      const sleepTime = 60000 - (now - oldestRequest) + 100;

      if (sleepTime > 0) {
        this.logger.debug(`KuCoin rate limit: sleeping ${sleepTime}ms`);
        await this.sleep(sleepTime);
        this.kucoinRequests = [];
      }
    }

    this.kucoinRequests.push(now);
  }

  /**
   * Wait if needed to avoid exceeding Binance rate limit
   */
  async waitIfNeededBinance(): Promise<void> {
    const now = Date.now();

    // Remove requests older than 1 minute
    this.binanceRequests = this.binanceRequests.filter(
      (timestamp) => now - timestamp < 60000
    );

    if (this.binanceRequests.length >= this.BINANCE_RATE_LIMIT) {
      // Calculate sleep time
      const oldestRequest = this.binanceRequests[0];
      const sleepTime = 60000 - (now - oldestRequest) + 100;

      if (sleepTime > 0) {
        this.logger.debug(`Binance rate limit: sleeping ${sleepTime}ms`);
        await this.sleep(sleepTime);
        this.binanceRequests = [];
      }
    }

    this.binanceRequests.push(now);
  }

  /**
   * Check if KuCoin is near rate limit (90% threshold)
   */
  isKucoinNearLimit(threshold: number = 0.9): boolean {
    const now = Date.now();
    this.kucoinRequests = this.kucoinRequests.filter(
      (timestamp) => now - timestamp < 60000
    );

    return this.kucoinRequests.length >= this.KUCOIN_RATE_LIMIT * threshold;
  }

  /**
   * Check if Binance is near rate limit (90% threshold)
   */
  isBinanceNearLimit(threshold: number = 0.9): boolean {
    const now = Date.now();
    this.binanceRequests = this.binanceRequests.filter(
      (timestamp) => now - timestamp < 60000
    );

    return this.binanceRequests.length >= this.BINANCE_RATE_LIMIT * threshold;
  }

  /**
   * Get remaining capacity for KuCoin
   */
  getKucoinRemainingCapacity(): number {
    const now = Date.now();
    this.kucoinRequests = this.kucoinRequests.filter(
      (timestamp) => now - timestamp < 60000
    );

    return Math.max(0, this.KUCOIN_RATE_LIMIT - this.kucoinRequests.length);
  }

  /**
   * Get remaining capacity for Binance
   */
  getBinanceRemainingCapacity(): number {
    const now = Date.now();
    this.binanceRequests = this.binanceRequests.filter(
      (timestamp) => now - timestamp < 60000
    );

    return Math.max(0, this.BINANCE_RATE_LIMIT - this.binanceRequests.length);
  }

  /**
   * Get rate limiter statistics
   */
  getStats() {
    return {
      kucoin: {
        limit: this.KUCOIN_RATE_LIMIT,
        current: this.kucoinRequests.length,
        remaining: this.getKucoinRemainingCapacity(),
        utilizationPct: (this.kucoinRequests.length / this.KUCOIN_RATE_LIMIT) * 100,
      },
      binance: {
        limit: this.BINANCE_RATE_LIMIT,
        current: this.binanceRequests.length,
        remaining: this.getBinanceRemainingCapacity(),
        utilizationPct: (this.binanceRequests.length / this.BINANCE_RATE_LIMIT) * 100,
      },
    };
  }

  /**
   * Reset rate limiters (for testing)
   */
  reset(): void {
    this.kucoinRequests = [];
    this.binanceRequests = [];
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}