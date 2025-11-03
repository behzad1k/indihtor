import { AnalysisRun } from '@database/entities/analysis-run.entity';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { LiveTfCombo } from '@database/entities/live-tf-combo.entity';
import { Signal } from '@database/entities/signal.entity';
import { TfCombo } from '@database/entities/tf-combo.entity';
import { ExternalApiModule } from '@modules/external-api/external-api.module';
import { CoinAnalyzerService } from '@modules/market-data/services/coin-analyzer.service';
import { MonitoringService } from '@modules/monitor/monitoring.service';
import { SignalValidatorService } from '@modules/monitor/signal-validator.service';
import { CandlestickAnalyzerService } from '@modules/signal-analyzer/services/candlestick-analyzer.service';
import { CombinationAnalyzerService } from '@modules/signal-analyzer/services/combination-analyzer.service';
import { DataFetcherService } from '@modules/signal-analyzer/services/data-fetcher.service';
import { IndicatorService } from '@modules/signal-analyzer/services/indicator.service';
import { MomentumAnalyzerService } from '@modules/signal-analyzer/services/momentum-analyzer.service';
import { MovingAverageAnalyzerService } from '@modules/signal-analyzer/services/moving-average-analyzer.service';
import { PriceActionAnalyzerService } from '@modules/signal-analyzer/services/price-action-analyzer.service';
import { TrendAnalyzerService } from '@modules/signal-analyzer/services/trend-analyzer.service';
import { VolatilityAnalyzerService } from '@modules/signal-analyzer/services/volatility-analyzer.service';
import { VolumeAnalyzerService } from '@modules/signal-analyzer/services/volume-analyzer.service';
import { VolumeProfileAnalyzerService } from '@modules/signal-analyzer/services/volume-profile-analyzer.service';
import { SignalAnalyzerController } from '@modules/signal-analyzer/signal-analyzer.controller';
import { SignalAnalyzerService } from '@modules/signal-analyzer/signal-analyzer.service';
import { BuyingQueueService } from '@modules/trading/buying-queue.service';
import { PositionManagerService } from '@modules/trading/position-manager.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiveSignal,
      LiveTfCombo,
      AnalysisRun,
      TfCombo,
      Signal,
    ]),
    ExternalApiModule,
  ],
  providers: [
    CoinAnalyzerService,
    BuyingQueueService,
    PositionManagerService,
  ],
  exports: [SignalValidatorService, MonitoringService],
})
export class MonitoringModule {}