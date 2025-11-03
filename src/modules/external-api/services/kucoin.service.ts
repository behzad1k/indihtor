import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  OHLCVData,
  FetchDataOptions,
  KuCoinCandleResponse,
  CurrentPriceResponse,
  ExchangeType,
  TIMEFRAME_MAPPING,
} from '@/types/exchange.types';

@Injectable()
export class KuCoinService {
  private readonly logger = new Logger(KuCoinService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('KUCOIN_BASE_URL', 'https://api.kucoin.com');
    this.timeout = this.configService.get<number>('KUCOIN_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200, startTime, endTime } = options;
      const symbolPair = `${symbol}-USDT`;

      const tfMap = TIMEFRAME_MAPPING.kucoin;
      if (!tfMap[timeframe]) {
        this.logger.warn(`Unsupported timeframe for KuCoin: ${timeframe}`);
        return null;
      }

      const end = endTime || Math.floor(Date.now() / 1000);
      const timeframeMinutes = this.getTimeframeMinutes(timeframe);
      const start = startTime || end - timeframeMinutes * 60 * limit;

      const url = `${this.baseUrl}/api/v1/market/candles`;
      const params = {
        symbol: symbolPair,
        type: tfMap[timeframe],
        startAt: start,
        endAt: end,
      };

      this.logger.debug(`Fetching KuCoin candles: ${symbolPair} ${timeframe}`);

      const response = await firstValueFrom(
        this.httpService.get<KuCoinCandleResponse>(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (response.data.code !== '200000' || !response.data.data) {
        this.logger.warn(`KuCoin API returned invalid response for ${symbolPair}`);
        return null;
      }

      const data: OHLCVData[] = response.data.data.map((row: string[]) => ({
        timestamp: new Date(Number(row[0]) * 1000),
        open: Number(row[1]),
        close: Number(row[2]),
        high: Number(row[3]),
        low: Number(row[4]),
        volume: Number(row[5]),
      }));

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`KuCoin fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const symbolPair = `${symbol}-USDT`;
      const url = `${this.baseUrl}/api/v1/market/orderbook/level1`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (response.data.code !== '200000' || !response.data.data) {
        return null;
      }

      return {
        symbol,
        price: Number(response.data.data.price),
        exchange: ExchangeType.KUCOIN,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`KuCoin price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const symbolPair = `${symbol}-USDT`;
      const url = `${this.baseUrl}/api/v1/market/stats`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { symbol: symbolPair },
          timeout: this.timeout,
        }),
      );

      if (response.data.code !== '200000') {
        return null;
      }

      return response.data.data;
    } catch (error) {
      this.logger.error(`KuCoin stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/api/v1/symbols`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (response.data.code !== '200000' || !response.data.data) {
        return [];
      }

      return response.data.data
      .filter((item: any) => item.quoteCurrency === 'USDT' && item.enableTrading)
      .map((item: any) => item.baseCurrency);
    } catch (error) {
      this.logger.error(`KuCoin symbols fetch failed: ${error.message}`);
      return [];
    }
  }

  private getTimeframeMinutes(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 1,
      '3m': 3,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '2h': 120,
      '4h': 240,
      '6h': 360,
      '8h': 480,
      '12h': 720,
      '1d': 1440,
      '3d': 4320,
      '1w': 10080,
    };
    return map[timeframe] || 60;
  }
}