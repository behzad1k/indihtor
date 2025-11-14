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
export class NobitexService {
  private readonly logger = new Logger(NobitexService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('NOBITEX_BASE_URL', 'https://api.nobitex.ir');
    this.timeout = this.configService.get<number>('NOBITEX_TIMEOUT', 10000);
  }

  async fetchCandles(options: FetchDataOptions): Promise<OHLCVData[] | null> {
    try {
      const { symbol, timeframe, limit = 200 } = options;

      // Nobitex uses RLS (Rials) as base currency
      const symbolPair = `${symbol}RLS`;
      const url = `${this.baseUrl}/market/udf/history`;

      const resolution = this.convertTimeframe(timeframe);
      const to = Math.floor(Date.now() / 1000);
      const from = to - this.getTimeframeSeconds(timeframe) * limit;

      const params = {
        symbol: symbolPair,
        resolution,
        from,
        to,
      };

      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          timeout: this.timeout,
        }),
      );

      if (response.data.s !== 'ok' || !response.data.t) {
        this.logger.warn(`Nobitex API returned invalid response for ${symbol}`);
        return null;
      }

      const data: OHLCVData[] = [];
      for (let i = 0; i < response.data.t.length; i++) {
        data.push({
          timestamp: new Date(response.data.t[i] * 1000),
          open: Number(response.data.o[i]),
          high: Number(response.data.h[i]),
          low: Number(response.data.l[i]),
          close: Number(response.data.c[i]),
          volume: Number(response.data.v[i]),
        });
      }

      return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Nobitex fetch failed for ${options.symbol}: ${error.message}`);
      return null;
    }
  }

  async getCurrentPrice(symbol: string): Promise<CurrentPriceResponse | null> {
    try {
      const url = `${this.baseUrl}/v2/orderbook/${symbol}RLS`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (response.data.status !== 'ok' || !response.data.lastTradePrice) {
        return null;
      }

      return {
        symbol,
        price: Number(response.data.lastTradePrice),
        exchange: ExchangeType.NOBITEX,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Nobitex price fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getMarketStats(symbols?: string[]): Promise<any> {
    try {
      const url = `${this.baseUrl}/market/stats`;

      const params: any = {
        srcCurrency: symbols ? symbols.join(',') : 'btc,eth,usdt,bnb,doge',
        dstCurrency: 'rls',
      };

      const response = await firstValueFrom(
        this.httpService.post(url, params, { timeout: this.timeout }),
      );

      if (response.data.status !== 'ok') {
        return null;
      }

      return response.data.stats;
    } catch (error) {
      this.logger.error(`Nobitex market stats fetch failed: ${error.message}`);
      return null;
    }
  }

  async get24hrStats(symbol: string): Promise<any> {
    try {
      const stats = await this.getMarketStats([symbol.toLowerCase()]);
      if (!stats) return null;

      const key = `${symbol.toLowerCase()}-rls`;
      return stats[key];
    } catch (error) {
      this.logger.error(`Nobitex 24hr stats fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getAllSymbols(): Promise<string[]> {
    try {
      // Nobitex has a limited set of supported cryptocurrencies
      // Fetch from market stats to get active pairs
      const stats = await this.getMarketStats();
      if (!stats) return [];

      return Object.keys(stats)
      .filter(key => key.endsWith('-rls'))
      .map(key => key.replace('-rls', '').toUpperCase());
    } catch (error) {
      this.logger.error(`Nobitex symbols fetch failed: ${error.message}`);
      return [];
    }
  }

  async getOrderBook(symbol: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/v2/orderbook/${symbol}RLS`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (response.data.status !== 'ok') {
        return null;
      }

      return {
        bids: response.data.bids,
        asks: response.data.asks,
        lastUpdate: response.data.lastUpdate,
        lastTradePrice: response.data.lastTradePrice,
      };
    } catch (error) {
      this.logger.error(`Nobitex orderbook fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getTrades(symbol: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/v2/trades/${symbol}RLS`;

      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: this.timeout }),
      );

      if (response.data.status !== 'ok') {
        return null;
      }

      return response.data.trades;
    } catch (error) {
      this.logger.error(`Nobitex trades fetch failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getUSDTtoRLSRate(): Promise<number | null> {
    try {
      const response = await this.getCurrentPrice('USDT');
      return response ? response.price : null;
    } catch (error) {
      this.logger.error(`Failed to fetch USDT/RLS rate: ${error.message}`);
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

  private getTimeframeSeconds(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '1d': 86400,
      '1w': 604800,
    };
    return map[timeframe] || 3600;
  }
}