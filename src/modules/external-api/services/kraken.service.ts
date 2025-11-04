import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  OHLCVData,
  FetchDataOptions,
  CurrentPriceResponse,
  ExchangeType,
} from '@/types/exchange.types';

@Injectable()
export class KrakenService {
  private readonly logger = new Logger(KrakenService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('KRAKEN_BASE_URL', 'https://api.kraken.com');
    this.timeout = this.configService.get<number>('KRAKEN_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200 } = options;

      // Kraken uses special pair formatting
      const symbolPair = this.formatSymbolPair(symbol);

      // Kraken interval mapping (in minutes)
      const intervalMap: Record<string, number> = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440,
        '1w': 10080,
      };

      const interval = intervalMap[timeframe];
      if (!interval) {
        this.logger.warn(`Unsupported timeframe for Kraken: ${timeframe}`);
        return null;
      }

      const url = `${this.baseUrl}/0/public/OHLC`;
      const params = {
        pair: symbolPair,
        interval,
      };

      this.logger.debug(`Fetching Kraken candles: ${symbolPair} ${timeframe}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data || !response.data.result) {
        this.logger.warn(`Kraken API returned invalid response for ${symbolPair}`);
        return null;
      }

      // Get the data array (pair name is dynamic in response)
      const pairData = Object.values(response.data.result)[0] as any[];

      if (!Array.isArray(pairData)) {
        return null;
      }

      // Kraken returns: [timestamp, open, high, low, close, vwap, volume, count]
      const data: OHLCVData[] = pairData
      .slice(-limit)
      .map((row: any[]) => ({
        timestamp: new Date(Number(row[0]) * 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[6]),
      }));

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Kraken fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const symbolPair = this.formatSymbolPair(symbol);
      const url = `${this.baseUrl}/0/public/Ticker`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { pair: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || !response.data.result) {
        return null;
      }

      const pairData = Object.values(response.data.result)[0] as any;

      if (!pairData || !pairData.c) {
        return null;
      }

      return {
        symbol,
        price: Number(pairData.c[0]), // c[0] is last trade price
        exchange: ExchangeType.KRAKEN,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Kraken price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const symbolPair = this.formatSymbolPair(symbol);
      const url = `${this.baseUrl}/0/public/Ticker`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { pair: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || !response.data.result) {
        return null;
      }

      return Object.values(response.data.result)[0];
    } catch (error) {
      this.logger.error(`Kraken stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/0/public/AssetPairs`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (!response.data || !response.data.result) {
        return [];
      }

      const pairs = response.data.result;
      const symbols = new Set<string>();

      for (const [pairName, pairData] of Object.entries(pairs as any)) {
        if ((pairData as any).quote === 'ZUSD' || (pairData as any).quote === 'USD') {
          // Extract base currency
          const base = (pairData as any).base.replace(/^X|^Z/, '');
          symbols.add(base);
        }
      }

      return Array.from(symbols);
    } catch (error) {
      this.logger.error(`Kraken symbols fetch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Format symbol pair for Kraken API
   */
  private formatSymbolPair(symbol: string): string {
    // Return mapped value or construct default
    return `${symbol}USDT`;
  }
}