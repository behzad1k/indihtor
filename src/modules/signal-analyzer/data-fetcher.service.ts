import { Injectable, Logger } from '@nestjs/common';
import { OHLCVData } from '../types/analysis.types';
import { ExchangeFactoryService } from '../../external-api/services/exchange-factory.service';
import { ExchangeName } from '../../external-api/interfaces/exchange-api.interface';

@Injectable()
export class DataFetcherService {
  private readonly logger = new Logger(DataFetcherService.name);

  constructor(private readonly exchangeFactory: ExchangeFactoryService) {}

  async fetchData(
    symbol: string,
    timeframe: string,
    limit: number = 200,
    preferredExchange?: ExchangeName,
  ): Promise<OHLCVData[] | null> {
    const result = await this.exchangeFactory.fetchOHLCVWithFallback(
      symbol,
      timeframe,
      limit,
      preferredExchange,
    );

    if (!result.data) {
      this.logger.error(`Failed to fetch data for ${symbol} ${timeframe} from any exchange`);
      return null;
    }

    this.logger.log(`Successfully fetched ${result.data.length} candles from ${result.source}`);
    return result.data;
  }

  async fetchDataRace(
    symbol: string,
    timeframe: string,
    limit: number = 200,
    exchanges?: ExchangeName[],
  ): Promise<OHLCVData[] | null> {
    const result = await this.exchangeFactory.fetchOHLCVRace(
      symbol,
      timeframe,
      limit,
      exchanges,
    );

    if (!result.data) {
      this.logger.error(`Race failed for ${symbol} ${timeframe}`);
      return null;
    }

    this.logger.log(`Race won by ${result.source} with ${result.data.length} candles`);
    return result.data;
  }

  async fetchFromSpecificExchange(
    exchange: ExchangeName,
    symbol: string,
    timeframe: string,
    limit: number = 200,
  ): Promise<OHLCVData[] | null> {
    return this.exchangeFactory.fetchOHLCV(exchange, symbol, timeframe, limit);
  }
}