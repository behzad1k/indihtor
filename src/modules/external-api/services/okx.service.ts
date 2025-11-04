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
export class OKXService {
  private readonly logger = new Logger(OKXService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('OKX_BASE_URL', 'https://www.okx.com');
    this.timeout = this.configService.get<number>('OKX_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200, startTime, endTime } = options;
      const symbolPair = `${symbol}-USDT`;

      // OKX bar size mapping
      const barMap: Record<string, string> = {
        '1m': '1m',
        '3m': '3m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1H',
        '2h': '2H',
        '4h': '4H',
        '6h': '6H',
        '12h': '12H',
        '1d': '1D',
        '1w': '1W',
      };

      const bar = barMap[timeframe];
      if (!bar) {
        this.logger.warn(`Unsupported timeframe for OKX: ${timeframe}`);
        return null;
      }

      const url = `${this.baseUrl}/api/v5/market/candles`;
      const params: any = {
        instId: symbolPair,
        bar,
        limit,
      };

      if (startTime) {
        params.after = startTime * 1000; // OKX uses milliseconds
      }
      if (endTime) {
        params.before = endTime * 1000;
      }

      this.logger.debug(`Fetching OKX candles: ${symbolPair} ${timeframe}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.code !== '0' || !response.data.data) {
        this.logger.warn(`OKX API returned invalid response for ${symbolPair}`);
        return null;
      }

      // OKX returns: [timestamp, open, high, low, close, volume, volCcy, volCcyQuote, confirm]
      const data: OHLCVData[] = response.data.data.map((row: any[]) => ({
        timestamp: new Date(Number(row[0])),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }));

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`OKX fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const symbolPair = `${symbol}-USDT`;
      const url = `${this.baseUrl}/api/v5/market/ticker`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { instId: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.code !== '0' || !response.data.data?.[0]) {
        return null;
      }

      const ticker = response.data.data[0];

      return {
        symbol,
        price: Number(ticker.last),
        exchange: ExchangeType.OKX,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`OKX price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}-USDT`;
      const url = `${this.baseUrl}/api/v5/market/ticker`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { instId: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.code !== '0') {
        return null;
      }

      return response.data.data?.[0];
    } catch (error) {
      this.logger.error(`OKX stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/api/v5/public/instruments`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            instType: 'SPOT',
          },
          timeout: this.timeout,
        }),
      );

      if (!response.data || response.data.code !== '0' || !response.data.data) {
        return [];
      }

      return response.data.data
      .filter((item: any) => item.quoteCcy === 'USDT' && item.state === 'live')
      .map((item: any) => item.baseCcy);
    } catch (error) {
      this.logger.error(`OKX symbols fetch failed: ${error.message}`);
      return [];
    }
  }
}