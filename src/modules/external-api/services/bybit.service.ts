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
export class BybitService {
  private readonly logger = new Logger(BybitService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('BYBIT_BASE_URL', 'https://api.bybit.com');
    this.timeout = this.configService.get<number>('BYBIT_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200, startTime, endTime } = options;
      const symbolPair = `${symbol}USDT`;

      // Bybit interval mapping
      const intervalMap: Record<string, string> = {
        '1m': '1',
        '3m': '3',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1h': '60',
        '2h': '120',
        '4h': '240',
        '6h': '360',
        '12h': '720',
        '1d': 'D',
        '1w': 'W',
      };

      const interval = intervalMap[timeframe];
      if (!interval) {
        this.logger.warn(`Unsupported timeframe for Bybit: ${timeframe}`);
        return null;
      }

      const end = endTime || Math.floor(Date.now() / 1000);
      const start = startTime || end - (this.getTimeframeSeconds(timeframe) * limit);

      const url = `${this.baseUrl}/v5/market/kline`;
      const params = {
        category: 'spot',
        symbol: symbolPair,
        interval,
        start: start * 1000, // Bybit uses milliseconds
        end: end * 1000,
        limit,
      };

      this.logger.debug(`Fetching Bybit candles: ${symbolPair} ${timeframe}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.retCode !== 0 || !response.data.result?.list) {
        this.logger.warn(`Bybit API returned invalid response for ${symbolPair}`);
        return null;
      }

      // Bybit returns: [timestamp, open, high, low, close, volume, turnover]
      const data: OHLCVData[] = response.data.result.list.map((row: any[]) => ({
        timestamp: new Date(Number(row[0])),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }));

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Bybit fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const symbolPair = `${symbol}USDT`;
      const url = `${this.baseUrl}/v5/market/tickers`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            category: 'spot',
            symbol: symbolPair,
          },
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.retCode !== 0 || !response.data.result?.list?.[0]) {
        return null;
      }

      const ticker = response.data.result.list[0];

      return {
        symbol,
        price: Number(ticker.lastPrice),
        exchange: ExchangeType.BYBIT,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Bybit price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}USDT`;
      const url = `${this.baseUrl}/v5/market/tickers`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            category: 'spot',
            symbol: symbolPair,
          },
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.retCode !== 0) {
        return null;
      }

      return response.data.result?.list?.[0];
    } catch (error) {
      this.logger.error(`Bybit stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/v5/market/instruments-info`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            category: 'spot',
          },
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.retCode !== 0 || !response.data.result?.list) {
        return [];
      }

      return response.data.result.list
      .filter((item: any) => item.quoteCoin === 'USDT' && item.status === 'Trading')
      .map((item: any) => item.baseCoin);
    } catch (error) {
      this.logger.error(`Bybit symbols fetch failed: ${error.message}`);
      return [];
    }
  }

  private getTimeframeSeconds(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400,
      '1w': 604800,
    };
    return map[timeframe] || 3600;
  }
}