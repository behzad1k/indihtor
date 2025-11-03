import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ExchangeAggregatorService } from './services/exchange-aggregator.service';
import { ExchangeType, FetchDataOptions } from '@/types/exchange.types';

@Controller('external-api')
export class ExternalApiController {
  constructor(private readonly aggregatorService: ExchangeAggregatorService) {}

  @Get('candles/:symbol')
  async getCandles(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe: string = '1h',
    @Query('limit') limit: number = 200,
    @Query('exchange') exchange?: ExchangeType,
  ) {
    try {
      const options: FetchDataOptions = {
        symbol: symbol.toUpperCase(),
        timeframe,
        limit: Number(limit),
      };

      let data;
      if (exchange) {
        data = await this.aggregatorService.fetchCandlesFromExchange(exchange, options);
      } else {
        data = await this.aggregatorService.fetchCandlesWithFallback(options);
      }

      if (!data) {
        throw new HttpException(
          { success: false, error: 'Failed to fetch candles' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        symbol,
        timeframe,
        count: data.length,
        data,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('price/:symbol')
  async getCurrentPrice(
    @Param('symbol') symbol: string,
    @Query('exchange') exchange?: ExchangeType,
  ) {
    try {
      let price;
      if (exchange) {
        price = await this.aggregatorService.getCurrentPriceFromExchange(
          exchange,
          symbol.toUpperCase(),
        );
      } else {
        price = await this.aggregatorService.getCurrentPrice(symbol.toUpperCase());
      }

      if (!price) {
        throw new HttpException(
          { success: false, error: 'Price not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        ...price,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('price/:symbol/all')
  async getAllPrices(@Param('symbol') symbol: string) {
    try {
      const prices = await this.aggregatorService.getAllPrices(symbol.toUpperCase());

      if (prices.length === 0) {
        throw new HttpException(
          { success: false, error: 'No prices found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        symbol,
        exchanges: prices.length,
        prices,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats/:symbol')
  async get24hrStats(
    @Param('symbol') symbol: string,
    @Query('exchange') exchange: ExchangeType = ExchangeType.BINANCE,
  ) {
    try {
      const stats = await this.aggregatorService.get24hrStats(
        exchange,
        symbol.toUpperCase(),
      );

      if (!stats) {
        throw new HttpException(
          { success: false, error: 'Stats not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        symbol,
        exchange,
        stats,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('symbols')
  async getAllSymbols(@Query('exchange') exchange: ExchangeType = ExchangeType.BINANCE) {
    try {
      const symbols = await this.aggregatorService.getAllSymbols(exchange);

      return {
        success: true,
        exchange,
        count: symbols.length,
        symbols,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('symbols/common')
  async getCommonSymbols(@Query('exchanges') exchangesStr: string) {
    try {
      const exchanges = exchangesStr
        ? (exchangesStr.split(',') as ExchangeType[])
        : [ExchangeType.KUCOIN, ExchangeType.BINANCE];

      const symbols = await this.aggregatorService.getCommonSymbols(exchanges);

      return {
        success: true,
        exchanges,
        count: symbols.length,
        symbols,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('orderbook/:symbol')
  async getOrderBook(
    @Param('symbol') symbol: string,
    @Query('exchange') exchange: ExchangeType = ExchangeType.BINANCE,
    @Query('limit') limit: number = 100,
  ) {
    try {
      const orderbook = await this.aggregatorService.getOrderBook(
        exchange,
        symbol.toUpperCase(),
        Number(limit),
      );

      if (!orderbook) {
        throw new HttpException(
          { success: false, error: 'Orderbook not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        symbol,
        exchange,
        orderbook,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  async getExchangesHealth() {
    try {
      const health = await this.aggregatorService.getAllExchangesHealth();

      return {
        success: true,
        health,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health/:exchange')
  async getExchangeHealth(@Param('exchange') exchange: ExchangeType) {
    try {
      const isHealthy = await this.aggregatorService.getExchangeHealth(exchange);

      return {
        success: true,
        exchange,
        healthy: isHealthy,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('usdt-rate')
  async getUSDTLocalRate() {
    try {
      const rates = await this.aggregatorService.getUSDTLocalRate();

      return {
        success: true,
        rates,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}