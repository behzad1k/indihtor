import { AnalysisRun } from '@database/entities/analysis-run.entity';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { LiveTfCombo } from '@database/entities/live-tf-combo.entity';
import { Signal } from '@database/entities/signal.entity';
import { TfCombo } from '@database/entities/tf-combo.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignalAnalyzerService } from './signal-analyzer.service';
import { SignalAnalyzerController } from './signal-analyzer.controller';
import { DataFetcherService } from './services/data-fetcher.service';
import { IndicatorService } from './services/indicator.service';
import { CandlestickAnalyzerService } from './services/candlestick-analyzer.service';
import { MovingAverageAnalyzerService } from './services/moving-average-analyzer.service';
import { MomentumAnalyzerService } from './services/momentum-analyzer.service';
import { VolumeAnalyzerService } from './services/volume-analyzer.service';
import { VolatilityAnalyzerService } from './services/volatility-analyzer.service';
import { TrendAnalyzerService } from './services/trend-analyzer.service';
import { PriceActionAnalyzerService } from './services/price-action-analyzer.service';
import { VolumeProfileAnalyzerService } from './services/volume-profile-analyzer.service';
import { CombinationAnalyzerService } from './services/combination-analyzer.service';
import { ExternalApiModule } from '@/modules/external-api/external-api.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiveSignal,
      LiveTfCombo,
      AnalysisRun,
      TfCombo,
      Signal,
    ]),
    ExternalApiModule, // Import to get ExchangeAggregatorService
  ],
  controllers: [SignalAnalyzerController],
  providers: [
    SignalAnalyzerService,
    DataFetcherService,
    IndicatorService,
    CandlestickAnalyzerService,
    MovingAverageAnalyzerService,
    MomentumAnalyzerService,
    VolumeAnalyzerService,
    VolatilityAnalyzerService,
    TrendAnalyzerService,
    PriceActionAnalyzerService,
    VolumeProfileAnalyzerService,
    CombinationAnalyzerService,
  ],
  exports: [SignalAnalyzerService, DataFetcherService],
})
export class SignalAnalyzerModule {}