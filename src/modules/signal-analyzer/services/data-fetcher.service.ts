import { Injectable, Logger } from '@nestjs/common';
import { ExchangeType, OHLCVData } from '@/types/exchange.types';
import { ExchangeAggregatorService } from '../../external-api/services/exchange-aggregator.service';

@Injectable()
export class DataFetcherService {
  private readonly logger = new Logger(DataFetcherService.name);

  constructor(
    private readonly exchangeAggregator: ExchangeAggregatorService,
  ) {}

  async fetchData(
    symbol: string,
    timeframe: string,
    limit: number = 200,
    preferredExchange?: ExchangeType,
  ): Promise<OHLCVData[] | null> {
    try {
      let data: OHLCVData[] | null = null;

      if (preferredExchange) {
        // Try preferred exchange first
        data = await this.exchangeAggregator.fetchCandlesFromExchange(
          preferredExchange,
          { symbol, timeframe, limit },
        );
      }

      // Fallback to automatic exchange selection
      if (!data || data.length < 50) {
        data = await this.exchangeAggregator.fetchCandlesWithFallback({
          symbol,
          timeframe,
          limit,
        });
      }

      if (!data || data.length < 50) {
        this.logger.error(`Failed to fetch sufficient data for ${symbol} ${timeframe}`);
        return null;
      }

      this.logger.debug(`Successfully fetched ${data.length} candles for ${symbol} ${timeframe}`);
      return data;
    } catch (error) {
      this.logger.error(`Error fetching data for ${symbol} ${timeframe}: ${error.message}`);
      return null;
    }
  }

  async fetchDataRace(
    symbol: string,
    timeframe: string,
    limit: number = 200,
    exchanges?: ExchangeType[],
  ): Promise<OHLCVData[] | null> {
    try {
      const exchangesToTry = exchanges || [
        ExchangeType.KUCOIN,
        ExchangeType.BINANCE,
        ExchangeType.TABDEAL,
      ];

      // Race all exchanges
      const promises = exchangesToTry.map(exchange =>
        this.exchangeAggregator.fetchCandlesFromExchange(exchange, {
          symbol,
          timeframe,
          limit,
        }),
      );

      // Get first successful response
      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value && result.value.length >= 50) {
          this.logger.debug(`Race won with ${result.value.length} candles for ${symbol}`);
          return result.value;
        }
      }

      this.logger.error(`Race failed for ${symbol} ${timeframe} - no exchange returned data`);
      return null;
    } catch (error) {
      this.logger.error(`Race error for ${symbol} ${timeframe}: ${error.message}`);
      return null;
    }
  }

  async fetchFromSpecificExchange(
    exchange: ExchangeType,
    symbol: string,
    timeframe: string,
    limit: number = 200,
  ): Promise<OHLCVData[] | null> {
    try {
      const data = await this.exchangeAggregator.fetchCandlesFromExchange(
        exchange,
        { symbol, timeframe, limit },
      );

      if (!data || data.length < 50) {
        this.logger.warn(`Insufficient data from ${exchange} for ${symbol} ${timeframe}`);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching from ${exchange} for ${symbol} ${timeframe}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Fetch data with automatic retry and fallback logic
   */
  async fetchDataWithRetry(
    symbol: string,
    timeframe: string,
    limit: number = 200,
    maxRetries: number = 3,
  ): Promise<OHLCVData[] | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const data = await this.fetchData(symbol, timeframe, limit);

      if (data && data.length >= 50) {
        return data;
      }

      if (attempt < maxRetries) {
        this.logger.warn(
          `Retry ${attempt}/${maxRetries} for ${symbol} ${timeframe}`,
        );
        await this.sleep(1000 * attempt); // Exponential backoff
      }
    }

    this.logger.error(
      `Failed to fetch data after ${maxRetries} retries for ${symbol} ${timeframe}`,
    );
    return null;
  }

  /**
   * Fetch multiple symbols in parallel
   */
  async fetchMultipleSymbols(
    symbols: string[],
    timeframe: string,
    limit: number = 200,
  ): Promise<Map<string, OHLCVData[] | null>> {
    const results = new Map<string, OHLCVData[] | null>();

    const promises = symbols.map(async symbol => {
      const data = await this.fetchData(symbol, timeframe, limit);
      return { symbol, data };
    });

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.symbol, result.value.data);
      }
    }

    return results;
  }

  /**
   * Fetch data for multiple timeframes of a single symbol
   */
  async fetchMultipleTimeframes(
    symbol: string,
    timeframes: string[],
    limit: number = 200,
  ): Promise<Map<string, OHLCVData[] | null>> {
    const results = new Map<string, OHLCVData[] | null>();

    const promises = timeframes.map(async timeframe => {
      const data = await this.fetchData(symbol, timeframe, limit);
      return { timeframe, data };
    });

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.timeframe, result.value.data);
      }
    }

    return results;
  }

  /**
   * Check data quality
   */
  validateData(data: OHLCVData[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!data || data.length === 0) {
      issues.push('No data provided');
      return { isValid: false, issues };
    }

    if (data.length < 50) {
      issues.push(`Insufficient data: ${data.length} candles (minimum 50 required)`);
    }

    // Check for missing timestamps
    const hasTimestamps = data.every(d => d.timestamp instanceof Date);
    if (!hasTimestamps) {
      issues.push('Invalid or missing timestamps');
    }

    // Check for invalid prices
    const hasValidPrices = data.every(
      d =>
        d.open > 0 &&
        d.high > 0 &&
        d.low > 0 &&
        d.close > 0 &&
        d.high >= d.low &&
        d.high >= d.open &&
        d.high >= d.close &&
        d.low <= d.open &&
        d.low <= d.close,
    );

    if (!hasValidPrices) {
      issues.push('Invalid price data detected');
    }

    // Check for gaps in data
    if (data.length > 1) {
      const timestamps = data.map(d => d.timestamp.getTime());
      timestamps.sort((a, b) => a - b);

      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const hasGaps = intervals.some(interval => interval > avgInterval * 2);

      if (hasGaps) {
        issues.push('Data contains significant gaps');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}