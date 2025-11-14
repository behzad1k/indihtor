import { AnalysisRun } from '@database/entities/analysis-run.entity';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { LiveTfCombo } from '@database/entities/live-tf-combo.entity';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { AnalysisResultDto } from './dto/analysis-result.dto';
import { SignalConfidence } from './constants/signal-confidence.constant';

@Injectable()
export class SignalAnalyzerService {
  private readonly logger = new Logger(SignalAnalyzerService.name);

  constructor(
    @InjectRepository(LiveSignal)
    private liveSignalRepository: Repository<LiveSignal>,
    @InjectRepository(LiveTfCombo)
    private liveTfComboRepository: Repository<LiveTfCombo>,
    @InjectRepository(AnalysisRun)
    private analysisRunRepository: Repository<AnalysisRun>,
    private dataFetcher: DataFetcherService,
    private indicatorService: IndicatorService,
    private candlestickAnalyzer: CandlestickAnalyzerService,
    private movingAverageAnalyzer: MovingAverageAnalyzerService,
    private momentumAnalyzer: MomentumAnalyzerService,
    private volumeAnalyzer: VolumeAnalyzerService,
    private volatilityAnalyzer: VolatilityAnalyzerService,
    private trendAnalyzer: TrendAnalyzerService,
    private priceActionAnalyzer: PriceActionAnalyzerService,
    private volumeProfileAnalyzer: VolumeProfileAnalyzerService,
    private combinationAnalyzer: CombinationAnalyzerService,
  ) {}

  async analyzeSymbolAllTimeframes(
    symbol: string,
    timeframes: string[],
  ): Promise<AnalysisResultDto> {
    const result: AnalysisResultDto = {
      symbol,
      timestamp: new Date().toISOString(),
      timeframes: {},
      combinations: {},
    };
    for (const tf of timeframes) {

      const data = await this.dataFetcher.fetchData(symbol, tf, 200);

      if (!data || data.length < 50) {
        result.timeframes[tf] = { error: 'Insufficient data' };
        continue;
      }

      // Calculate indicators
      const enrichedData = this.indicatorService.calculateAllIndicators(data);

      // Run all analyses
      const signals = {
        ...this.candlestickAnalyzer.analyze(enrichedData),
        ...this.movingAverageAnalyzer.analyze(enrichedData),
        ...this.momentumAnalyzer.analyze(enrichedData),
        ...this.volumeAnalyzer.analyze(enrichedData),
        ...this.volatilityAnalyzer.analyze(enrichedData),
        ...this.trendAnalyzer.analyze(enrichedData),
        ...this.priceActionAnalyzer.analyze(enrichedData),
        ...this.volumeProfileAnalyzer.analyze(enrichedData),
      };

      const curr = enrichedData[enrichedData.length - 1];
      const buySignals = Object.values(signals).filter(
        (s: any) => s.signal === 'BUY',
      ).length;
      const sellSignals = Object.values(signals).filter(
        (s: any) => s.signal === 'SELL',
      ).length;

      result.timeframes[tf] = {
        price: curr.close,
        timestamp: curr.timestamp.toISOString(),
        signals,
        signalCount: Object.keys(signals).length,
        buySignals,
        sellSignals,
      };
    }

    // Analyze signal combinations
    try {
      const combinations = await this.combinationAnalyzer.analyzeLiveCombinations(
        symbol,
        result,
        60.0,
      );
      if (combinations) {
        result.combinations = combinations;
      }
    } catch (error) {
      this.logger.error(`Error in combination analysis: ${error.message}`);
    }

    return result;
  }

  async saveAnalysisResult(result: AnalysisResultDto): Promise<void> {
    let totalSignals = 0;
    let totalBuy = 0;
    let totalSell = 0;

    // Save signals from each timeframe
    for (const [tf, data] of Object.entries(result.timeframes)) {
      if ('error' in data) continue;

      totalSignals += data.signalCount;
      totalBuy += data.buySignals;
      totalSell += data.sellSignals;

      // Save each signal
      for (const [signalName, signalData] of Object.entries(data.signals)) {
        const signalInfo: any = SignalConfidence[signalName] || {};
        const confidence = signalInfo.confidence || 0;

        const liveSignal = this.liveSignalRepository.create({
          symbol: result.symbol,
          timeframe: tf,
          signalName,
          signalType: signalData.signal || 'UNKNOWN',
          confidence,
          strength: signalData.strength,
          signalValue: signalData.value,
          price: data.price,
          timestamp: new Date(data.timestamp),
        });

        await this.liveSignalRepository.save(liveSignal);
      }
    }

    // Save analysis run summary
    const analysisRun = this.analysisRunRepository.create({
      symbol: result.symbol,
      timeframes: JSON.stringify(Object.keys(result.timeframes)),
      totalSignals,
      buySignals: totalBuy,
      sellSignals: totalSell,
    });

    await this.analysisRunRepository.save(analysisRun);

    this.logger.log(`✅ Saved analysis for ${result.symbol}: ${totalSignals} signals`);
  }
}