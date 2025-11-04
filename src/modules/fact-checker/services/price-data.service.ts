import { Injectable, Logger } from '@nestjs/common';
import { ExchangeAggregatorService } from '@modules/external-api/services/exchange-aggregator.service';
import { RateLimiterService } from './rate-limiter.service';
import { OHLCVData } from '@/types/exchange.types';

@Injectable()
export class PriceDataService {
  private readonly logger = new Logger(PriceDataService.name);

  // Cache for price data (5 minute TTL)
  private priceCache: Map<string, { data: OHLCVData[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    private readonly exchangeAggregator: ExchangeAggregatorService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  /**
   * Fetch price journey using your existing exchange aggregator
   */
  async fetchPriceJourney(
    symbol: string,
    timestamp: Date,
    timeframe: string,
    candlesAhead: number = 10,
  ): Promise<OHLCVData[] | null> {
    // Check cache
    const cacheKey = this.getCacheKey(symbol, timestamp, timeframe, candlesAhead);
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Calculate time range
    const startTime = Math.floor(timestamp.getTime() / 1000);
    const minutes = this.getTimeframeMinutes(timeframe);
    const endTime = startTime + (minutes * 60 * (candlesAhead + 2));

    // Use your existing exchange aggregator
    const data = await this.exchangeAggregator.fetchCandlesWithFallback({
      symbol,
      timeframe,
      limit: candlesAhead + 5,
      startTime,
      endTime,
    });

    if (!data || data.length < 2) {
      return null;
    }

    // Cache the result
    this.priceCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  private getCacheKey(
    symbol: string,
    timestamp: Date,
    timeframe: string,
    candles: number,
  ): string {
    const tsStr = timestamp.toISOString().substring(0, 16);
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

  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.priceCache.entries()) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.priceCache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.priceCache.clear();
  }
}