import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ExternalApiController } from './external-api.controller';
import { KuCoinService } from './services/kucoin.service';
import { BinanceService } from './services/binance.service';
import { TabdealService } from './services/tabdeal.service';
import { NobitexService } from './services/nobitex.service';
import { CoinbaseService } from './services/coinbase.service';
import { KrakenService } from './services/kraken.service';
import { BybitService } from './services/bybit.service';
import { OKXService } from './services/okx.service';
import { GateService } from './services/gate.service';
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
    // Original exchanges
    KuCoinService,
    BinanceService,
    TabdealService,
    NobitexService,

    // New exchanges for high-volume fact-checking
    CoinbaseService,
    KrakenService,
    BybitService,
    OKXService,
    GateService,

    ExchangeAggregatorService,
  ],
  exports: [
    KuCoinService,
    BinanceService,
    TabdealService,
    NobitexService,
    CoinbaseService,
    KrakenService,
    BybitService,
    OKXService,
    GateService,
    ExchangeAggregatorService,
  ],
})
export class ExternalApiModule {}