import { Injectable, Logger } from '@nestjs/common';
import { KuCoinService } from './kucoin.service';
import { BinanceService } from './binance.service';
import { TabdealService } from './tabdeal.service';
import { NobitexService } from './nobitex.service';
import { CoinbaseService } from './coinbase.service';
import { KrakenService } from './kraken.service';
import { BybitService } from './bybit.service';
import { OKXService } from './okx.service';
import { GateService } from './gate.service';
import {
  OHLCVData,
  FetchDataOptions,
  CurrentPriceResponse,
  ExchangeType,
} from '@/types/exchange.types';

interface RateLimitInfo {
  requestsInLastMinute: number[];
  limit: number;
  lastReset: number;
}

@Injectable()
export class ExchangeAggregatorService {
  private readonly logger = new Logger(ExchangeAggregatorService.name);

  // Priority order for exchanges (most reliable/fastest first)
  private readonly EXCHANGE_PRIORITY = [
    ExchangeType.BINANCE,
    ExchangeType.BYBIT,
    ExchangeType.OKX,
    ExchangeType.KUCOIN,
    ExchangeType.COINBASE,
    ExchangeType.KRAKEN,
    ExchangeType.GATE,
  ];

  // Rate limits per exchange (requests per minute)
  private readonly RATE_LIMITS: Record<ExchangeType, number> = {
    [ExchangeType.BINANCE]: 1200,
    [ExchangeType.BYBIT]: 600,
    [ExchangeType.OKX]: 600,
    [ExchangeType.KUCOIN]: 100,
    [ExchangeType.COINBASE]: 300,
    [ExchangeType.KRAKEN]: 60,
    [ExchangeType.GATE]: 300,
    [ExchangeType.TABDEAL]: 100,
    [ExchangeType.NOBITEX]: 60,
  };

  // Track rate limits per exchange
  private rateLimitTracking: Map<ExchangeType, RateLimitInfo> = new Map();

  // Current exchange index for circular rotation
  private currentExchangeIndex = 0;

  constructor(
    private readonly kucoinService: KuCoinService,
    private readonly binanceService: BinanceService,
    private readonly tabdealService: TabdealService,
    private readonly nobitexService: NobitexService,
    private readonly coinbaseService: CoinbaseService,
    private readonly krakenService: KrakenService,
    private readonly bybitService: BybitService,
    private readonly okxService: OKXService,
    private readonly gateService: GateService,
  ) {
    // Initialize rate limit tracking
    for (const exchange of this.EXCHANGE_PRIORITY) {
      this.rateLimitTracking.set(exchange, {
        requestsInLastMinute: [],
        limit: this.RATE_LIMITS[exchange],
        lastReset: Date.now(),
      });
    }

    // Clean up old requests every 10 seconds
    setInterval(() => this.cleanupRateLimits(), 10000);
  }

  /**
   * Fetch with circular priority rotation (respects rate limits)
   * Uses round-robin with rate limit awareness
   * MOST EFFICIENT for high-volume operations
   */
  async fetchCandlesWithCircularPriority(
    options: FetchDataOptions,
  ): Promise<OHLCVData[] | null> {
    const attempts = this.EXCHANGE_PRIORITY.length;

    for (let i = 0; i < attempts; i++) {
      // Get next exchange in rotation
      const exchange = this.getNextAvailableExchange();

      if (!exchange) {
        this.logger.warn('All exchanges rate-limited, waiting...');
        await this.sleep(1000);
        continue;
      }

      try {
        this.logger.debug(`Trying ${exchange} (rotation ${i + 1}/${attempts})`);

        const data = await this.fetchCandlesFromExchange(exchange, options);

        if (data && data.length >= 50) {
          this.logger.debug(`✅ Success from ${exchange}`);
          this.trackRequest(exchange);
          return data;
        }
      } catch (error) {
        this.logger.debug(`${exchange} failed: ${error.message}`);
        this.trackRequest(exchange); // Still count as a request
        continue;
      }
    }

    this.logger.error(`All exchanges failed for ${options.symbol}`);
    return null;
  }

  /**
   * Fetch with sequential priority (respects rate limits)
   * Tries exchanges in priority order, skipping rate-limited ones
   * RECOMMENDED for general use
   */
  async fetchCandlesWithFallback(
    options: FetchDataOptions,
  ): Promise<OHLCVData[] | null> {
    this.logger.debug(`Fetching candles for ${options.symbol} on ${options.timeframe}`);

    for (const exchange of this.EXCHANGE_PRIORITY) {
      // Check if exchange is rate-limited
      if (this.isRateLimited(exchange)) {
        this.logger.debug(`${exchange} rate-limited, skipping...`);
        continue;
      }

      try {
        const data = await this.fetchCandlesFromExchange(exchange, options);

        if (data && data.length >= 50) {
          this.logger.debug(`✅ Data fetched from ${exchange}`);
          this.trackRequest(exchange);
          return data;
        }
      } catch (error) {
        this.logger.warn(`${exchange} fetch failed: ${error.message}`);
        this.trackRequest(exchange); // Still count as a request
        continue;
      }
    }

    this.logger.error(`❌ Failed to fetch data for ${options.symbol} from all exchanges`);
    return null;
  }

  /**
   * Get next available exchange (not rate-limited) in circular rotation
   */
  private getNextAvailableExchange(): ExchangeType | null {
    const startIndex = this.currentExchangeIndex;
    let attempts = 0;

    while (attempts < this.EXCHANGE_PRIORITY.length) {
      const exchange = this.EXCHANGE_PRIORITY[this.currentExchangeIndex];

      // Move to next for next call
      this.currentExchangeIndex =
        (this.currentExchangeIndex + 1) % this.EXCHANGE_PRIORITY.length;

      // Check if this exchange is available
      if (!this.isRateLimited(exchange)) {
        return exchange;
      }

      attempts++;
    }

    return null; // All exchanges are rate-limited
  }

  /**
   * Check if exchange is currently rate-limited
   */
  private isRateLimited(exchange: ExchangeType, threshold = 0.9): boolean {
    const info = this.rateLimitTracking.get(exchange);
    if (!info) return false;

    // Clean old requests
    const oneMinuteAgo = Date.now() - 60000;
    info.requestsInLastMinute = info.requestsInLastMinute.filter(
      time => time > oneMinuteAgo
    );

    const currentRequests = info.requestsInLastMinute.length;
    const limitThreshold = info.limit * threshold;

    return currentRequests >= limitThreshold;
  }

  /**
   * Track a request for rate limiting
   */
  private trackRequest(exchange: ExchangeType): void {
    const info = this.rateLimitTracking.get(exchange);
    if (!info) return;

    info.requestsInLastMinute.push(Date.now());
  }

  /**
   * Clean up old request timestamps
   */
  private cleanupRateLimits(): void {
    const oneMinuteAgo = Date.now() - 60000;

    for (const [exchange, info] of this.rateLimitTracking.entries()) {
      info.requestsInLastMinute = info.requestsInLastMinute.filter(
        time => time > oneMinuteAgo
      );
    }
  }

  /**
   * Get rate limit status for all exchanges
   */
  getRateLimitStatus(): Record<ExchangeType, {
    current: number;
    limit: number;
    percentage: number;
    available: boolean;
  }> {
    const status: any = {};

    for (const [exchange, info] of this.rateLimitTracking.entries()) {
      const current = info.requestsInLastMinute.length;
      const percentage = (current / info.limit) * 100;

      status[exchange] = {
        current,
        limit: info.limit,
        percentage: Math.round(percentage),
        available: !this.isRateLimited(exchange),
      };
    }

    return status;
  }

  /**
   * Fetch from multiple exchanges in parallel and return all results
   * ONLY use this for comparison purposes, not production
   */
  async fetchCandlesParallel(
    options: FetchDataOptions,
    exchanges?: ExchangeType[],
  ): Promise<Map<ExchangeType, OHLCVData[] | null>> {
    const targetExchanges = exchanges || this.EXCHANGE_PRIORITY;
    const results = new Map<ExchangeType, OHLCVData[] | null>();

    const promises = targetExchanges.map(async exchange => {
      // Skip rate-limited exchanges
      if (this.isRateLimited(exchange)) {
        return { exchange, data: null };
      }

      const data = await this.fetchCandlesFromExchange(exchange, options);
      this.trackRequest(exchange);
      return { exchange, data };
    });

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.exchange, result.value.data);
      }
    }

    const successCount = Array.from(results.values()).filter(d => d && d.length >= 50).length;
    this.logger.debug(
      `Parallel fetch complete: ${successCount}/${targetExchanges.length} exchanges succeeded`
    );

    return results;
  }

  /**
   * Fetch data from a specific exchange
   */
  async fetchCandlesFromExchange(
    exchange: ExchangeType,
    options: FetchDataOptions,
  ): Promise<OHLCVData[] | null> {
    try {
      switch (exchange) {
        case ExchangeType.KUCOIN:
          return this.kucoinService.fetchCandles(options);
        case ExchangeType.BINANCE:
          return this.binanceService.fetchCandles(options);
        case ExchangeType.TABDEAL:
          return this.tabdealService.fetchCandles(options);
        case ExchangeType.NOBITEX:
          return this.nobitexService.fetchCandles(options);
        case ExchangeType.COINBASE:
          return this.coinbaseService.fetchCandles(options);
        case ExchangeType.KRAKEN:
          return this.krakenService.fetchCandles(options);
        case ExchangeType.BYBIT:
          return this.bybitService.fetchCandles(options);
        case ExchangeType.OKX:
          return this.okxService.fetchCandles(options);
        case ExchangeType.GATE:
          return this.gateService.fetchCandles(options);
        default:
          this.logger.warn(`Unknown exchange: ${exchange}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`${exchange} fetch error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get current price with fallback
   */
  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    for (const exchange of this.EXCHANGE_PRIORITY) {
      if (this.isRateLimited(exchange)) continue;

      const price = await this.getCurrentPriceFromExchange(exchange, symbol);
      if (price) {
        this.trackRequest(exchange);
        return price;
      }
    }
    return null;
  }

  /**
   * Get current price from specific exchange
   */
  async getCurrentPriceFromExchange(
    exchange: ExchangeType,
    symbol: string,
  ): Promise<CurrentPriceResponse | null> {
    switch (exchange) {
      case ExchangeType.KUCOIN:
        return this.kucoinService.getCurrentPrice(symbol);
      case ExchangeType.BINANCE:
        return this.binanceService.getCurrentPrice(symbol);
      case ExchangeType.TABDEAL:
        return this.tabdealService.getCurrentPrice(symbol);
      case ExchangeType.NOBITEX:
        return this.nobitexService.getCurrentPrice(symbol);
      case ExchangeType.COINBASE:
        return this.coinbaseService.getCurrentPrice(symbol);
      case ExchangeType.KRAKEN:
        return this.krakenService.getCurrentPrice(symbol);
      case ExchangeType.BYBIT:
        return this.bybitService.getCurrentPrice(symbol);
      case ExchangeType.OKX:
        return this.okxService.getCurrentPrice(symbol);
      case ExchangeType.GATE:
        return this.gateService.getCurrentPrice(symbol);
      default:
        return null;
    }
  }

  /**
   * Get prices from all exchanges for comparison
   */
  async getAllPrices(symbol: string): Promise<CurrentPriceResponse[]> {
    const promises = this.EXCHANGE_PRIORITY.map(exchange =>
      this.getCurrentPriceFromExchange(exchange, symbol)
    );

    const prices = await Promise.all(promises);
    return prices.filter((p) => p !== null) as CurrentPriceResponse[];
  }

  /**
   * Get 24hr stats from specific exchange
   */
  async get24hrStats(exchange: ExchangeType, symbol: string): Promise<any> {
    switch (exchange) {
      case ExchangeType.KUCOIN:
        return this.kucoinService.get24hrStats(symbol);
      case ExchangeType.BINANCE:
        return this.binanceService.get24hrStats(symbol);
      case ExchangeType.TABDEAL:
        return this.tabdealService.get24hrStats(symbol);
      case ExchangeType.NOBITEX:
        return this.nobitexService.get24hrStats(symbol);
      case ExchangeType.COINBASE:
        return this.coinbaseService.get24hrStats(symbol);
      case ExchangeType.KRAKEN:
        return this.krakenService.get24hrStats(symbol);
      case ExchangeType.BYBIT:
        return this.bybitService.get24hrStats(symbol);
      case ExchangeType.OKX:
        return this.okxService.get24hrStats(symbol);
      case ExchangeType.GATE:
        return this.gateService.get24hrStats(symbol);
      default:
        return null;
    }
  }

  /**
   * Get all available symbols from specific exchange
   */
  async getAllSymbols(exchange: ExchangeType): Promise<string[]> {
    switch (exchange) {
      case ExchangeType.KUCOIN:
        return this.kucoinService.getAllSymbols();
      case ExchangeType.BINANCE:
        return this.binanceService.getAllSymbols();
      case ExchangeType.TABDEAL:
        return this.tabdealService.getAllSymbols();
      case ExchangeType.NOBITEX:
        return this.nobitexService.getAllSymbols();
      case ExchangeType.COINBASE:
        return this.coinbaseService.getAllSymbols();
      case ExchangeType.KRAKEN:
        return this.krakenService.getAllSymbols();
      case ExchangeType.BYBIT:
        return this.bybitService.getAllSymbols();
      case ExchangeType.OKX:
        return this.okxService.getAllSymbols();
      case ExchangeType.GATE:
        return this.gateService.getAllSymbols();
      default:
        return [];
    }
  }

  /**
   * Get common symbols across multiple exchanges
   */
  async getCommonSymbols(exchanges: ExchangeType[]): Promise<string[]> {
    const symbolSets = await Promise.all(
      exchanges.map((exchange) => this.getAllSymbols(exchange)),
    );

    if (symbolSets.length === 0) return [];

    // Find intersection
    return symbolSets[0].filter((symbol) =>
      symbolSets.every((set) => set.includes(symbol)),
    );
  }

  /**
   * Get order book from specific exchange
   */
  async getOrderBook(exchange: ExchangeType, symbol: string, limit?: number): Promise<any> {
    switch (exchange) {
      case ExchangeType.BINANCE:
        return this.binanceService.getOrderBook(symbol, limit);
      case ExchangeType.TABDEAL:
        return this.tabdealService.getOrderBook(symbol, limit);
      case ExchangeType.NOBITEX:
        return this.nobitexService.getOrderBook(symbol);
      default:
        return null;
    }
  }

  /**
   * Get exchange health status
   */
  async getExchangeHealth(exchange: ExchangeType): Promise<boolean> {
    try {
      const testSymbol = 'BTC';
      const price = await this.getCurrentPriceFromExchange(exchange, testSymbol);
      return price !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get health status of all exchanges
   */
  async getAllExchangesHealth(): Promise<Record<ExchangeType, boolean>> {
    const healthChecks = await Promise.all(
      this.EXCHANGE_PRIORITY.map(async exchange => ({
        exchange,
        healthy: await this.getExchangeHealth(exchange),
      }))
    );

    const result = {} as Record<ExchangeType, boolean>;
    for (const { exchange, healthy } of healthChecks) {
      result[exchange] = healthy;
    }

    return result;
  }

  /**
   * Get USDT rate in local currency (IRT/RLS)
   */
  async getUSDTLocalRate(): Promise<{
    tabdealIRT: number | null;
    nobitexRLS: number | null;
  }> {
    const [tabdealRate, nobitexRate] = await Promise.all([
      this.tabdealService.getUSDTtoIRTRate(),
      this.nobitexService.getUSDTtoRLSRate(),
    ]);

    return {
      tabdealIRT: tabdealRate,
      nobitexRLS: nobitexRate,
    };
  }

  /**
   * Get exchange statistics for monitoring
   */
  getExchangeStats(): {
    totalExchanges: number;
    majorExchanges: string[];
    priority: ExchangeType[];
    rateLimits: Record<ExchangeType, {
      current: number;
      limit: number;
      percentage: number;
      available: boolean;
    }>;
  } {
    return {
      totalExchanges: this.EXCHANGE_PRIORITY.length,
      majorExchanges: [
        'Binance',
        'Bybit',
        'OKX',
        'KuCoin',
        'Coinbase',
        'Kraken',
        'Gate.io',
      ],
      priority: this.EXCHANGE_PRIORITY,
      rateLimits: this.getRateLimitStatus(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}