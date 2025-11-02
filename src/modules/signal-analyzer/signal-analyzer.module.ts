import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignalAnalyzerService } from './signal-analyzer.service';
import { SignalAnalyzerController } from './signal-analyzer.controller';
import { DataFetcherService } from './services/data-fetcher.service';
import { IndicatorService } from './services/indicator.service';
import { CandlestickAnalyzerService } from './services/candlestick-analyzer.service';
import { MovingAverageAnalyzerService } from './services/moving-average-analyzer.service';
import { MomentumAnalyzerService } from './services/momentum-analyzer.service';
import { VolumeAnalyzerService, VolatilityAnalyzerService, TrendAnalyzerService, PriceActionAnalyzerService, VolumeProfileAnalyzerService } from './services/analyzers.service';
import { CombinationAnalyzerService } from './services/combination-analyzer.service';
import { LiveSignal } from './entities/live-signal.entity';
import { LiveTfCombo } from './entities/live-tf-combo.entity';
import { AnalysisRun } from './entities/analysis-run.entity';
import { TfCombo } from './entities/tf-combo.entity';
import { Signal } from './entities/signal.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      LiveSignal,
      LiveTfCombo,
      AnalysisRun,
      TfCombo,
      Signal,
    ]),
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
  exports: [SignalAnalyzerService],
})
export class SignalAnalyzerModule {}