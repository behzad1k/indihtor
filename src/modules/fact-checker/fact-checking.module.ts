import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FactCheckingService } from './services/fact-checking.service';
import { FactCheckingController } from './fact-checking.controller';
import { PriceDataService } from './services/price-data.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { SignalFilterService } from './services/signal-filter.service';
import { ExternalApiModule } from '@modules/external-api/external-api.module';

// Import your existing entities
import { LiveSignal } from '@database/entities/live-signal.entity';
import { Signal } from '@database/entities/signal.entity';
import { TfCombo } from '@database/entities/tf-combo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiveSignal,
      Signal,
      TfCombo,
    ]),
    ExternalApiModule, // Import to use ExchangeAggregatorService
  ],
  controllers: [FactCheckingController],
  providers: [
    FactCheckingService,
    PriceDataService,
    RateLimiterService,
    SignalFilterService,
    DatabaseService,
  ],
  exports: [FactCheckingService],
})
export class FactCheckingModule {}