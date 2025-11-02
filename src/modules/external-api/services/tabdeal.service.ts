import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  OHLCVData,
  FetchDataOptions,
  CurrentPriceResponse,
  ExchangeType,
} from '../types/exchange.types';

@Injectable()
export class TabdealService {
  private readonly logger = new Logger(TabdealService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('TABDEAL_BASE_URL', 'https://api.tabdeal.org');
    this.timeout = this.configService.get<number>('TABDEAL_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200 } = options;

      // Tabdeal API endpoint for OHLCV data
      const url = `${this.baseUrl}/v1/market/kline`;
      const params = {
        symbol: `${symbol}IRT`, // Tabdeal uses IRT (Iranian Rial) as quote currency
        resolution: this.convertTimeframe(timeframe),
        limit,
      };

      this.logger.debug(`Fetching Tabdeal candles: ${symbol} ${timeframe}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data || !response.data.data) {
        this.logger.warn(`Tabdeal API returned invalid response for ${symbol}`);
        return null;
      }

      const data: OHLCVData[] = response.data.data.map((row: any) => ({
        timestamp: new Date(row.time * 1000),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      }));

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Tabdeal fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const url = `${this.baseUrl}/v1/market/ticker`;
      const symbolPair = `${symbol}IRT`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || !response.data.data) {
        return null;
      }

      return {
        symbol,
        price: Number(response.data.data.lastPrice),
        exchange: ExchangeType.TABDEAL,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Tabdeal price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/v1/market/ticker/24hr`;
      const symbolPair = `${symbol}IRT`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair },
          timeout: this.timeout,
        }),
      );

      return response.data?.data;
    } catch (error) {
      this.logger.error(`Tabdeal stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/v1/market/symbols`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (!response.data || !response.data.data) {
        return [];
      }

      return response.data.data
      .filter((item: any) => item.quoteAsset === 'IRT' && item.active)
      .map((item: any) => item.baseAsset);
    } catch (error) {
      this.logger.error(`Tabdeal symbols fetch failed: ${error.message}`);
      return [];
    }
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<any> {
    try {
      const url = `${this.baseUrl}/v1/market/depth`;
      const symbolPair = `${symbol}IRT`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair, limit },
          timeout: this.timeout,
        }),
      );

      return response.data?.data;
    } catch (error) {
      this.logger.error(`Tabdeal orderbook fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getUSDTtoIRTRate(): Promise<number | null> {
    try {
      const response = await this.getCurrentPrice('USDT');
      return response ? response.price : null;
    } catch (error) {
      this.logger.error(`Failed to fetch USDT/IRT rate: ${error.message}`);
      return null;
    }
  }

  private convertTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '30m': '30',
      '1h': '60',
      '2h': '120',
      '4h': '240',
      '1d': 'D',
      '1w': 'W',
    };
    return map[timeframe] || '60';
  }
}