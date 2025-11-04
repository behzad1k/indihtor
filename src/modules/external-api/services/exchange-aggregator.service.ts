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

@Injectable()
export class ExchangeAggregatorService {
  private readonly logger = new Logger(ExchangeAggregatorService.name);

  // Priority order for exchanges (fastest/most reliable first)
  private readonly EXCHANGE_PRIORITY = [
    ExchangeType.BINANCE,
    ExchangeType.BYBIT,
    ExchangeType.OKX,
    ExchangeType.KUCOIN,
    ExchangeType.COINBASE,
    ExchangeType.KRAKEN,
    ExchangeType.GATE,
    ExchangeType.TABDEAL,
    ExchangeType.NOBITEX,
  ];

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
  ) {}

  /**
   * Fetch OHLCV data with automatic fallback across exchanges
   * Priority: Binance -> Bybit -> OKX -> KuCoin -> Coinbase -> Kraken -> Gate -> Tabdeal -> Nobitex
   */
  async fetchCandlesWithFallback(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    this.logger.debug(`Fetching candles for ${options.symbol} on ${options.timeframe}`);

    for (const exchange of this.EXCHANGE_PRIORITY) {
      const data = await this.fetchCandlesFromExchange(exchange, options);

      if (data && data.length >= 50) {
        this.logger.debug(`✅ Data fetched from ${exchange}`);
        return data;
      }
    }

    this.logger.error(`❌ Failed to fetch data for ${options.symbol} from all exchanges`);
    return null;
  }

  /**
   * Fetch from multiple exchanges in parallel (race condition)
   * Returns the first successful response
   * OPTIMIZED FOR HIGH-VOLUME FACT-CHECKING
   */
  async fetchCandlesRace(
    options: FetchDataOptions,
    exchanges?: ExchangeType[],
  ): Promise<OHLCVData[] | null> {
    const targetExchanges = exchanges || this.EXCHANGE_PRIORITY.slice(0, 5); // Top 5 fastest

    this.logger.debug(
      `Racing ${targetExchanges.length} exchanges for ${options.symbol} ${options.timeframe}`
    );

    const promises = targetExchanges.map(exchange =>
      this.fetchCandlesFromExchange(exchange, options)
      .then(data => ({ exchange, data }))
      .catch(error => {
        this.logger.debug(`${exchange} race failed: ${error.message}`);
        return { exchange, data: null };
      })
    );

    // Use Promise.race to get the first successful response
    try {
      const results = await Promise.race([
        // Return first valid result
        Promise.all(promises).then(results => {
          const valid = results.find(r => r.data && r.data.length >= 50);
          if (valid) {
            this.logger.debug(`🏁 Race won by ${valid.exchange}`);
            return valid.data;
          }
          return null;
        }),
        // Timeout after 5 seconds
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);

      return results;
    } catch (error) {
      this.logger.error(`Race failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch from all exchanges in parallel and return all results
   * Useful for comparing data quality
   */
  async fetchCandlesParallel(
    options: FetchDataOptions,
    exchanges?: ExchangeType[],
  ): Promise<Map<ExchangeType, OHLCVData[] | null>> {
    const targetExchanges = exchanges || this.EXCHANGE_PRIORITY;
    const results = new Map<ExchangeType, OHLCVData[] | null>();

    const promises = targetExchanges.map(async exchange => {
      const data = await this.fetchCandlesFromExchange(exchange, options);
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
      const price = await this.getCurrentPriceFromExchange(exchange, symbol);
      if (price) return price;
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
    };
  }
}