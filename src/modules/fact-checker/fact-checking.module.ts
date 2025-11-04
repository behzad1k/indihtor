import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FactCheckingService } from './services/fact-checking.service';
import { FactCheckingController } from './fact-checking.controller';
import { PriceDataService } from './services/price-data.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { SignalFilterService } from './services/signal-filter.service';
import { CandleCacheService } from './services/candle-cache.service';
import { ExternalApiModule } from '@modules/external-api/external-api.module';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { Signal } from '@database/entities/signal.entity';
import { TfCombo } from '@database/entities/tf-combo.entity';
import { SignalFactCheck } from '@database/entities/signal-fact-check.entity';
import { SignalConfidenceAdjustment } from '@database/entities/signal-confidence-adjustment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiveSignal,
      Signal,
      TfCombo,
      SignalFactCheck,
      SignalConfidenceAdjustment,
    ]),
    ExternalApiModule, // Import to use ExchangeAggregatorService
  ],
  controllers: [FactCheckingController],
  providers: [
    FactCheckingService,
    PriceDataService,
    RateLimiterService,
    SignalFilterService,
    CandleCacheService, // New: Candle cache for efficiency
  ],
  exports: [FactCheckingService, PriceDataService, CandleCacheService],
})
export class FactCheckingModule {}