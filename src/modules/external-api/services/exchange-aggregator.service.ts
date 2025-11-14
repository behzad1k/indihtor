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
import * as fs from 'fs/promises';
import * as path from 'path';

interface RateLimitInfo {
  requestsInLastMinute: number[];
  limit: number;
  lastReset: number;
}

interface SymbolAvailability {
  available: Set<ExchangeType>;
  unavailable: Set<ExchangeType>;
  lastChecked: number;
}

interface FetchAttempt {
  exchange: ExchangeType;
  success: boolean;
  error?: string;
  duration: number;
}

@Injectable()
export class ExchangeAggregatorService {
  private readonly logger = new Logger(ExchangeAggregatorService.name);
  private readonly CACHE_DIR = './data';
  private readonly CACHE_FILE = path.join(this.CACHE_DIR, 'symbol-availability-cache.json');
  // Priority order for exchanges (most reliable/fastest first)
  private readonly EXCHANGE_PRIORITY = [
    ExchangeType.BINANCE,
    ExchangeType.BYBIT,
    ExchangeType.OKX,
    ExchangeType.KUCOIN,
    ExchangeType.KRAKEN,
    ExchangeType.GATE,
    // ExchangeType.COINBASE,
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

  // NEW: Symbol availability cache
  private readonly symbolAvailability: Map<string, SymbolAvailability> = new Map();
  private readonly AVAILABILITY_CACHE_TTL = 86400000; // 24 hours

  // NEW: Statistics tracking
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    symbolNotFoundErrors: 0,
    cacheHits: 0,
    cacheMisses: 0,
    exchangeAttempts: new Map<ExchangeType, number>(),
    exchangeSuccesses: new Map<ExchangeType, number>(),
  };

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
      this.stats.exchangeAttempts.set(exchange, 0);
      this.stats.exchangeSuccesses.set(exchange, 0);
    }
    this.loadCacheFromDisk();
    // Clean up old requests every 10 seconds
    setInterval(() => this.cleanupRateLimits(), 10000);

    // Clean up old availability cache every hour
    setInterval(() => this.cleanupAvailabilityCache(), 3600000);
  }

  /**
   * Load symbol availability cache from disk on startup
   */
  private async loadCacheFromDisk(): Promise<void> {
    try {
      const cacheData = await fs.readFile(this.CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(cacheData);

      this.importAvailabilityCache(parsed);

      this.logger.log(`✅ Loaded symbol availability cache with ${this.symbolAvailability.size} symbols`);

      // Log sample statistics
      const stats = this.getOptimizedStats();
      this.logger.log(`   Cache contains ${stats.cache.cachedSymbols} symbols`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn('⚠️  No symbol cache found. Run prewarm script for better performance.');
        this.logger.warn('   Command: npx ts-node scripts/prewarm-symbol-cache.ts');
      } else {
        this.logger.error(`❌ Failed to load cache: ${error.message}`);
      }
    }
  }

  /**
   * OPTIMIZED: Fetch with smart exchange selection
   * Only tries exchanges that are likely to have the symbol
   */
  async fetchCandlesWithCircularPriority(
    options: FetchDataOptions,
  ): Promise<OHLCVData[] | null> {
    this.stats.totalRequests++;
    const startTime = Date.now();
    const attempts: FetchAttempt[] = [];

    // Get available exchanges for this symbol
    const availableExchanges = this.getAvailableExchanges(options.symbol);

    if (availableExchanges.length === 0) {
      this.logger.debug(`No known exchanges for ${options.symbol}, trying all`);
    } else {
      }

    const exchangesToTry = availableExchanges.length > 0
      ? availableExchanges
      : this.EXCHANGE_PRIORITY;

    // Try each exchange
    for (let i = 0; i < exchangesToTry.length; i++) {
      const exchange = exchangesToTry[i];

      // Skip if rate limited
      if (this.isRateLimited(exchange)) {
        this.logger.debug(`${exchange} rate-limited, skipping...`);
        continue;
      }

      // Skip if known to not have this symbol
      if (this.isKnownUnavailable(options.symbol, exchange)) {
        this.logger.debug(`${exchange} known to not have ${options.symbol}, skipping...`);
        continue;
      }

      const attemptStart = Date.now();
      this.stats.exchangeAttempts.set(
        exchange,
        (this.stats.exchangeAttempts.get(exchange) || 0) + 1
      );

      try {
        const data = await this.fetchCandlesFromExchange(exchange, options);

        const attemptDuration = Date.now() - attemptStart;

        if (data && data.length >= options.limit) {
          this.trackRequest(exchange);
          this.markAvailable(options.symbol, exchange);
          this.stats.successfulRequests++;
          this.stats.exchangeSuccesses.set(
            exchange,
            (this.stats.exchangeSuccesses.get(exchange) || 0) + 1
          );

          attempts.push({
            exchange,
            success: true,
            duration: attemptDuration,
          });

          return data;
        } else {
          this.logger.warn(`${exchange} returned insufficient data for ${options.symbol} in tf: ${options.timeframe} length: ${data.length}/${options.limit} date: ${new Date(options.startTime * 1000)} - ${new Date(options.endTime * 1000)}`);
          attempts.push({
            exchange,
            success: false,
            error: 'Insufficient data',
            duration: attemptDuration,
          });
        }
      } catch (error) {
        const attemptDuration = Date.now() - attemptStart;
        const errorMsg = error.message || String(error);

        this.logger.debug(`${exchange} failed: ${errorMsg}`);

        // Check if it's a "symbol not found" error
        if (this.isSymbolNotFoundError(errorMsg)) {
          this.logger.debug(`${exchange} doesn't have ${options.symbol}, marking as unavailable`);
          this.markUnavailable(options.symbol, exchange);
          this.stats.symbolNotFoundErrors++;
        }

        attempts.push({
          exchange,
          success: false,
          error: errorMsg,
          duration: attemptDuration,
        });

        this.trackRequest(exchange); // Still count as a request
        continue;
      }
    }

    // All exchanges failed
    this.stats.failedRequests++;
    this.logger.error(`❌ All exchanges failed for ${options.symbol}`);

    return null;
  }
  /**
   * Check if error indicates symbol not found
   */
  private isSymbolNotFoundError(errorMsg: string): boolean {
    const notFoundIndicators = [
      '404',
      'not found',
      'invalid symbol',
      'unknown symbol',
      'does not exist',
      'invalid response',
      'symbol not supported',
    ];

    const lowerMsg = errorMsg.toLowerCase();
    return notFoundIndicators.some(indicator => lowerMsg.includes(indicator));
  }

  /**
   * Get exchanges that are known to have this symbol
   */
  private getAvailableExchanges(symbol: string): ExchangeType[] {
    const cached = this.symbolAvailability.get(symbol);

    if (!cached) {
      this.stats.cacheMisses++;
      return []; // Unknown, will try all
    }

    // Check if cache is stale
    if (Date.now() - cached.lastChecked > this.AVAILABILITY_CACHE_TTL) {
      this.stats.cacheMisses++;
      this.symbolAvailability.delete(symbol);
      return [];
    }

    this.stats.cacheHits++;

    // Return available exchanges in priority order
    return this.EXCHANGE_PRIORITY.filter(ex => cached.available.has(ex));
  }


  /**
   * Check if exchange is known to not have this symbol
   */
  private isKnownUnavailable(symbol: string, exchange: ExchangeType): boolean {
    const cached = this.symbolAvailability.get(symbol);
    if (!cached) return false;

    // Check if cache is stale
    if (Date.now() - cached.lastChecked > this.AVAILABILITY_CACHE_TTL) {
      return false;
    }

    return cached.unavailable.has(exchange);
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


  /**
   * Mark symbol as available on exchange
   */
  private markAvailable(symbol: string, exchange: ExchangeType): void {
    let cached = this.symbolAvailability.get(symbol);

    if (!cached) {
      cached = {
        available: new Set(),
        unavailable: new Set(),
        lastChecked: Date.now(),
      };
      this.symbolAvailability.set(symbol, cached);
    }

    cached.available.add(exchange);
    cached.unavailable.delete(exchange); // Remove from unavailable if present
    cached.lastChecked = Date.now();
  }

  /**
   * Mark symbol as unavailable on exchange
   */
  private markUnavailable(symbol: string, exchange: ExchangeType): void {
    let cached = this.symbolAvailability.get(symbol);

    if (!cached) {
      cached = {
        available: new Set(),
        unavailable: new Set(),
        lastChecked: Date.now(),
      };
      this.symbolAvailability.set(symbol, cached);
    }

    cached.unavailable.add(exchange);
    cached.available.delete(exchange); // Remove from available if present
    cached.lastChecked = Date.now();
  }

  /**
   * Bulk validate symbol availability across exchanges
   * Useful for pre-warming the cache
   */
  async validateSymbolAvailability(symbol: string): Promise<{
    available: ExchangeType[];
    unavailable: ExchangeType[];
  }> {
    const available: ExchangeType[] = [];
    const unavailable: ExchangeType[] = [];

    this.logger.log(`Validating ${symbol} across all exchanges...`);

    // Try all exchanges in parallel (quick check)
    const promises = this.EXCHANGE_PRIORITY.map(async exchange => {
      if (this.isRateLimited(exchange)) {
        return { exchange, available: null };
      }

      try {
        const data = await this.fetchCandlesFromExchange(exchange, {
          symbol,
          timeframe: '1h',
          limit: 10, // Small limit for validation
        });

        return { exchange, available: data && data.length > 0 };
      } catch (error) {
        const isNotFound = this.isSymbolNotFoundError(error.message);
        return { exchange, available: isNotFound ? false : null };
      }
    });

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { exchange, available: isAvailable } = result.value;

        if (isAvailable === true) {
          available.push(exchange);
          this.markAvailable(symbol, exchange);
        } else if (isAvailable === false) {
          unavailable.push(exchange);
          this.markUnavailable(symbol, exchange);
        }
      }
    }

    this.logger.log(`${symbol} validation complete:`);
    this.logger.log(`  Available: ${available.join(', ')}`);
    this.logger.log(`  Unavailable: ${unavailable.join(', ')}`);

    return { available, unavailable };
  }

  /**
   * Batch validate multiple symbols
   */
  async batchValidateSymbols(symbols: string[]): Promise<void> {
    this.logger.log(`Batch validating ${symbols.length} symbols...`);

    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      await Promise.all(
        batch.map(symbol => this.validateSymbolAvailability(symbol))
      );

      this.logger.log(
        `Progress: ${Math.min(i + batchSize, symbols.length)}/${symbols.length}`
      );

      // Small delay between batches
      await this.sleep(1000);
    }

    this.logger.log(`✅ Batch validation complete`);
  }

  /**
   * Clean up stale availability cache entries
   */
  private cleanupAvailabilityCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [symbol, cached] of this.symbolAvailability.entries()) {
      if (now - cached.lastChecked >= this.AVAILABILITY_CACHE_TTL) {
        this.symbolAvailability.delete(symbol);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} stale availability cache entries`);
    }
  }

  /**
   * Get comprehensive statistics
   */
  getOptimizedStats() {
    const exchangeStats: any = {};

    for (const exchange of this.EXCHANGE_PRIORITY) {
      const attempts = this.stats.exchangeAttempts.get(exchange) || 0;
      const successes = this.stats.exchangeSuccesses.get(exchange) || 0;
      const successRate = attempts > 0 ? (successes / attempts * 100).toFixed(2) : '0.00';

      exchangeStats[exchange] = {
        attempts,
        successes,
        failures: attempts - successes,
        successRate: `${successRate}%`,
      };
    }

    const cacheHitRate = this.stats.totalRequests > 0
      ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(2)
      : '0.00';

    return {
      overall: {
        totalRequests: this.stats.totalRequests,
        successfulRequests: this.stats.successfulRequests,
        failedRequests: this.stats.failedRequests,
        symbolNotFoundErrors: this.stats.symbolNotFoundErrors,
        successRate: this.stats.totalRequests > 0
          ? `${(this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)}%`
          : '0.00%',
      },
      cache: {
        hits: this.stats.cacheHits,
        misses: this.stats.cacheMisses,
        hitRate: `${cacheHitRate}%`,
        cachedSymbols: this.symbolAvailability.size,
      },
      exchanges: exchangeStats,
      rateLimits: this.getRateLimitStatus(),
    };
  }

  /**
   * Export availability cache for persistence
   */
  exportAvailabilityCache(): any {
    const exported: any = {};

    for (const [symbol, cached] of this.symbolAvailability.entries()) {
      exported[symbol] = {
        available: Array.from(cached.available),
        unavailable: Array.from(cached.unavailable),
        lastChecked: cached.lastChecked,
      };
    }

    return exported;
  }

  /**
   * Import availability cache from persistence
   */
  importAvailabilityCache(data: any): void {
    let imported = 0;

    for (const [symbol, cached] of Object.entries(data as any)) {
      this.symbolAvailability.set(symbol, {
        available: new Set((cached as any).available),
        unavailable: new Set((cached as any).unavailable),
        lastChecked: (cached as any).lastChecked,
      });
      imported++;
    }

    this.logger.log(`✅ Imported ${imported} symbol availability entries`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}