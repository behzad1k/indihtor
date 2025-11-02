import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ExternalApiController } from './external-api.controller';
import { KuCoinService } from './services/kucoin.service';
import { BinanceService } from './services/binance.service';
import { TabdealService } from './services/tabdeal.service';
import { NobitexService } from './services/nobitex.service';
import { ExchangeAggregatorService } from './services/exchange-aggregator.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [ExternalApiController],
  providers: [
    KuCoinService,
    BinanceService,
    TabdealService,
    NobitexService,
    ExchangeAggregatorService,
  ],
  exports: [
    KuCoinService,
    BinanceService,
    TabdealService,
    NobitexService,
    ExchangeAggregatorService,
  ],
})
export class ExternalApiModule {}