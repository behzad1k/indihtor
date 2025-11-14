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
} from '@/types/exchange.types';

@Injectable()
export class CoinbaseService {
  private readonly logger = new Logger(CoinbaseService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('COINBASE_BASE_URL', 'https://api.exchange.coinbase.com');
    this.timeout = this.configService.get<number>('COINBASE_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200, startTime, endTime } = options;
      const symbolPair = `${symbol}-USD`;

      // Coinbase uses granularity in seconds
      const granularityMap: Record<string, number> = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '6h': 21600,
        '1d': 86400,
      };

      const granularity = granularityMap[timeframe];
      if (!granularity) {
        this.logger.warn(`Unsupported timeframe for Coinbase: ${timeframe}`);
        return null;
      }

      const end = endTime || Math.floor(Date.now() / 1000);
      const start = startTime || end - (granularity * limit);

      const url = `${this.baseUrl}/products/${symbolPair}/candles`;
      const params = {
        start: new Date(start * 1000).toISOString(),
        end: new Date(end * 1000).toISOString(),
        granularity,
      };

      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(`Coinbase API returned invalid response for ${symbolPair}`);
        return null;
      }

      // Coinbase returns: [timestamp, low, high, open, close, volume]
      const data: OHLCVData[] = response.data.map((row: any[]) => ({
        timestamp: new Date(Number(row[0]) * 1000),
        low: Number(row[1]),
        high: Number(row[2]),
        open: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }));

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Coinbase fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const symbolPair = `${symbol}-USD`;
      const url = `${this.baseUrl}/products/${symbolPair}/ticker`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: this.timeout,
        }),
      );

      if (!response.data || !response.data.price) {
        return null;
      }

      return {
        symbol,
        price: Number(response.data.price),
        exchange: ExchangeType.COINBASE,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Coinbase price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}-USD`;
      const url = `${this.baseUrl}/products/${symbolPair}/stats`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: this.timeout,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Coinbase stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/products`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      return response.data
        .filter((item: any) => item.quote_currency === 'USD' && item.status === 'online')
        .map((item: any) => item.base_currency);
    } catch (error) {
      this.logger.error(`Coinbase symbols fetch failed: ${error.message}`);
      return [];
    }
  }
}