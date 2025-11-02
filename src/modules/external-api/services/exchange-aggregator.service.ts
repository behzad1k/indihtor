import { Injectable, Logger } from '@nestjs/common';
import { KuCoinService } from './kucoin.service';
import { BinanceService } from './binance.service';
import { TabdealService } from './tabdeal.service';
import { NobitexService } from './nobitex.service';
import {
  OHLCVData,
  FetchDataOptions,
  CurrentPriceResponse,
  ExchangeType,
} from '../types/exchange.types';

@Injectable()
export class ExchangeAggregatorService {
  private readonly logger = new Logger(ExchangeAggregatorService.name);

  constructor(
    private readonly kucoinService: KuCoinService,
    private readonly binanceService: BinanceService,
    private readonly tabdealService: TabdealService,
    private readonly nobitexService: NobitexService,
  ) {}

  /**
   * Fetch OHLCV data with automatic fallback across exchanges
   * Priority: KuCoin -> Binance -> Tabdeal -> Nobitex
   */
  async fetchCandlesWithFallback(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    this.logger.log(`Fetching candles for ${options.symbol} on ${options.timeframe}`);

    // Try KuCoin first
    let data = await this.kucoinService.fetchCandles(options);
    if (data && data.length >= 50) {
      this.logger.debug(`✅ Data fetched from KuCoin`);
      return data;
    }

    // Fallback to Binance
    data = await this.binanceService.fetchCandles(options);
    if (data && data.length >= 50) {
      this.logger.debug(`✅ Data fetched from Binance (fallback)`);
      return data;
    }

    // Fallback to Tabdeal (for Iranian users or specific pairs)
    data = await this.tabdealService.fetchCandles(options);
    if (data && data.length >= 50) {
      this.logger.debug(`✅ Data fetched from Tabdeal (fallback)`);
      return data;
    }

    // Last resort: Nobitex
    data = await this.nobitexService.fetchCandles(options);
    if (data && data.length >= 50) {
      this.logger.debug(`✅ Data fetched from Nobitex (fallback)`);
      return data;
    }

    this.logger.error(`❌ Failed to fetch data for ${options.symbol} from all exchanges`);
    return null;
  }

  /**
   * Fetch data from a specific exchange
   */
  async fetchCandlesFromExchange(
    exchange: ExchangeType,
    options: FetchDataOptions,
  ): Promise<OHLCVData[] | null> {
    switch (exchange) {
      case ExchangeType.KUCOIN:
        return this.kucoinService.fetchCandles(options);
      case ExchangeType.BINANCE:
        return this.binanceService.fetchCandles(options);
      case ExchangeType.TABDEAL:
        return this.tabdealService.fetchCandles(options);
      case ExchangeType.NOBITEX:
        return this.nobitexService.fetchCandles(options);
      default:
        this.logger.warn(`Unknown exchange: ${exchange}`);
        return null;
    }
  }

  /**
   * Get current price with fallback
   */
  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    // Try KuCoin first
    let price = await this.kucoinService.getCurrentPrice(symbol);
    if (price) return price;

    // Fallback to Binance
    price = await this.binanceService.getCurrentPrice(symbol);
    if (price) return price;

    // Fallback to Tabdeal
    price = await this.tabdealService.getCurrentPrice(symbol);
    if (price) return price;

    // Last resort: Nobitex
    price = await this.nobitexService.getCurrentPrice(symbol);
    return price;
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
      default:
        return null;
    }
  }

  /**
   * Get prices from all exchanges for comparison
   */
  async getAllPrices(symbol: string): Promise<CurrentPriceResponse[]> {
    const prices = await Promise.all([
      this.kucoinService.getCurrentPrice(symbol),
      this.binanceService.getCurrentPrice(symbol),
      this.tabdealService.getCurrentPrice(symbol),
      this.nobitexService.getCurrentPrice(symbol),
    ]);

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
      case ExchangeType.KUCOIN:
        return null; // KuCoin orderbook not implemented in basic service
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
    const [kucoin, binance, tabdeal, nobitex] = await Promise.all([
      this.getExchangeHealth(ExchangeType.KUCOIN),
      this.getExchangeHealth(ExchangeType.BINANCE),
      this.getExchangeHealth(ExchangeType.TABDEAL),
      this.getExchangeHealth(ExchangeType.NOBITEX),
    ]);

    return {
      [ExchangeType.KUCOIN]: kucoin,
      [ExchangeType.BINANCE]: binance,
      [ExchangeType.TABDEAL]: tabdeal,
      [ExchangeType.NOBITEX]: nobitex,
    };
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
}