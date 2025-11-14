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
export class GateService {
  private readonly logger = new Logger(GateService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('GATE_BASE_URL', 'https://api.gateio.ws');
    this.timeout = this.configService.get<number>('GATE_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200, startTime, endTime } = options;
      const symbolPair = `${symbol}_USDT`;

      // Gate.io interval mapping
      const intervalMap: Record<string, string> = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '8h': '8h',
        '1d': '1d',
        '1w': '7d',
      };

      const interval = intervalMap[timeframe];
      if (!interval) {
        this.logger.warn(`Unsupported timeframe for Gate.io: ${timeframe}`);
        return null;
      }

      const url = `${this.baseUrl}/api/v4/spot/candlesticks`;
      const params: any = {
        currency_pair: symbolPair,
        interval,
        limit,
      };

      if (startTime) {
        params.from = startTime;
      }
      if (endTime) {
        params.to = endTime;
      }

      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn(`Gate.io API returned invalid response for ${symbolPair}`);
        return null;
      }

      // Gate.io returns: [timestamp, volume, close, high, low, open]
      const data: OHLCVData[] = response.data.map((row: any[]) => ({
        timestamp: new Date(Number(row[0]) * 1000),
        volume: Number(row[1]),
        close: Number(row[2]),
        high: Number(row[3]),
        low: Number(row[4]),
        open: Number(row[5]),
      }));

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Gate.io fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const symbolPair = `${symbol}_USDT`;
      const url = `${this.baseUrl}/api/v4/spot/tickers`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { currency_pair: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        return null;
      }

      const ticker = response.data[0];

      return {
        symbol,
        price: Number(ticker.last),
        exchange: ExchangeType.GATE,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Gate.io price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}_USDT`;
      const url = `${this.baseUrl}/api/v4/spot/tickers`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { currency_pair: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        return null;
      }

      return response.data[0];
    } catch (error) {
      this.logger.error(`Gate.io stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/api/v4/spot/currency_pairs`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      return response.data
      .filter((item: any) => item.quote === 'USDT' && item.trade_status === 'tradable')
      .map((item: any) => item.base);
    } catch (error) {
      this.logger.error(`Gate.io symbols fetch failed: ${error.message}`);
      return [];
    }
  }
}