import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoinAnalyzerService } from './services/coin-analyzer.service';
import { LiveSignal } from '../../database/entities/live-signal.entity';
import { LiveTfCombo } from '../../database/entities/live-tf-combo.entity';
import { AnalysisRun } from '../../database/entities/analysis-run.entity';
import { SignalAnalyzerModule } from '../signal-analyzer/signal-analyzer.module';
import { ExternalApiModule } from '../external-api/external-api.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LiveSignal, LiveTfCombo, AnalysisRun]),
    SignalAnalyzerModule,
    ExternalApiModule,
  ],
  providers: [CoinAnalyzerService],
  exports: [CoinAnalyzerService],
})
export class MarketDataModule {}