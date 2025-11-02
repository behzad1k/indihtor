import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  OHLCVData,
  FetchDataOptions,
  CurrentPriceResponse,
  ExchangeType,
  TIMEFRAME_MAPPING,
} from '../types/exchange.types';

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('BINANCE_BASE_URL', 'https://api.binance.com');
    this.timeout = this.configService.get<number>('BINANCE_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200, startTime, endTime } = options;
      const symbolPair = `${symbol}USDT`;

      const tfMap = TIMEFRAME_MAPPING.binance;
      if (!tfMap[timeframe]) {
        this.logger.warn(`Unsupported timeframe for Binance: ${timeframe}`);
        return null;
      }

      const url = `${this.baseUrl}/api/v3/klines`;
      const params: any = {
        symbol: symbolPair,
        interval: tfMap[timeframe],
        limit,
      };

      if (startTime) {
        params.startTime = startTime * 1000; // Binance uses milliseconds
      }
      if (endTime) {
        params.endTime = endTime * 1000;
      }

      this.logger.debug(`Fetching Binance candles: ${symbolPair} ${timeframe}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(`Binance API returned invalid response for ${symbolPair}`);
        return null;
      }

      const data: OHLCVData[] = response.data.map((row: any) => ({
        timestamp: new Date(Number(row[0])),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }));

      return data;
    } catch (error) {
      this.logger.error(`Binance fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const symbolPair = `${symbol}USDT`;
      const url = `${this.baseUrl}/api/v3/ticker/price`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || !response.data.price) {
        return null;
      }

      return {
        symbol,
        price: Number(response.data.price),
        exchange: ExchangeType.BINANCE,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Binance price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}USDT`;
      const url = `${this.baseUrl}/api/v3/ticker/24hr`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair },
          timeout: this.timeout,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Binance stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/api/v3/exchangeInfo`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (!response.data || !response.data.symbols) {
        return [];
      }

      return response.data.symbols
      .filter((item: any) => item.quoteAsset === 'USDT' && item.status === 'TRADING')
      .map((item: any) => item.baseAsset);
    } catch (error) {
      this.logger.error(`Binance symbols fetch failed: ${error.message}`);
      return [];
    }
  }

  async getOrderBook(symbol: string, limit: number = 100): Promise<any> {
    try {
      const symbolPair = `${symbol}USDT`;
      const url = `${this.baseUrl}/api/v3/depth`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair, limit },
          timeout: this.timeout,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Binance orderbook fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getRecentTrades(symbol: string, limit: number = 100): Promise<any> {
    try {
      const symbolPair = `${symbol}USDT`;
      const url = `${this.baseUrl}/api/v3/trades`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair, limit },
          timeout: this.timeout,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Binance trades fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }
}