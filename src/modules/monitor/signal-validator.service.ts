import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TradingConfig } from '@/database/entities/trading-config.entity';
import { LiveSignal } from '@/database/entities/live-signal.entity';
import { LiveTfCombo } from '@/database/entities/live-tf-combo.entity';
import { CrossTfCombo } from '@/database/entities/cross-tf-combo.entity';

interface ValidationResult {
  passed: boolean;
  score: number;
  reasons: string[];
  data: any;
}

@Injectable()
export class SignalValidatorService {
  constructor(
    @InjectRepository(LiveSignal)
    private liveSignalRepo: Repository<LiveSignal>,
    @InjectRepository(LiveTfCombo)
    private liveTfComboRepo: Repository<LiveTfCombo>,
    @InjectRepository(CrossTfCombo)
    private crossTfComboRepo: Repository<CrossTfCombo>,
  ) {}

  async validate(
    config: TradingConfig,
    symbol: string,
    analysis: any,
  ): Promise<ValidationResult> {
    const scores: Record<string, number> = {};
    const reasons: string[] = [];
    const data: any = {};

    // 1. Check 24h price change
    const priceChange24h = await this.get24hPriceChange(symbol);
    if (priceChange24h > config.maxPriceChange24h) {
      return {
        passed: false,
        score: 0,
        reasons: [`24h change ${priceChange24h.toFixed(2)}% exceeds limit`],
        data: { priceChange24h },
      };
    }
    scores.priceChange = this.calculatePriceChangeScore(priceChange24h, config);

    // 2. Check validated patterns
    const patterns = await this.getValidatedPatterns(symbol, config);
    if (patterns.count < config.minPatternsThreshold) {
      return {
        passed: false,
        score: 0,
        reasons: [`Only ${patterns.count} patterns (need ${config.minPatternsThreshold})`],
        data: patterns,
      };
    }
    scores.patterns = (patterns.avgAccuracy / 100) * config.weightValidatedPatterns;
    data.patterns = patterns;

    // 3. Cross-TF alignment
    const alignment = await this.checkCrossTfAlignment(symbol);
    if (alignment.count < config.minCrossTfAlignment) {
      return {
        passed: false,
        score: 0,
        reasons: [`Only ${alignment.count} aligned TFs (need ${config.minCrossTfAlignment})`],
        data: alignment,
      };
    }
    scores.alignment = (alignment.count / 10) * config.weightCrossTfAlignment;
    data.alignment = alignment;

    // 4. Strong signal density
    const density = await this.checkStrongSignalDensity(symbol, config);
    scores.density = (density.score / 10) * config.weightStrongSignalDensity;
    data.density = density;

    // 5. Volume confirmation
    const volume = await this.checkVolumeConfirmation(symbol);
    scores.volume = volume.confirmed ? config.weightVolumeConfirmation : 0;
    data.volume = volume;

    // 6. Scalp agreement
    const scalp = await this.checkScalpAgreement(symbol, config);
    scores.scalp = (scalp.agreement / 100) * config.weightScalpAgreement;
    data.scalp = scalp;

    // 7. Market structure
    const structure = await this.checkMarketStructure(symbol);
    scores.structure = structure.confirmed ? config.weightMarketStructure : 0;
    data.structure = structure;

    // 8. Recent loss check
    const recentLosses = await this.checkRecentLosses(config.id, symbol);
    if (recentLosses >= config.maxRecentLosses) {
      return {
        passed: false,
        score: 0,
        reasons: [`${recentLosses} recent losses on ${symbol}`],
        data: { recentLosses },
      };
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    return {
      passed: totalScore >= 70,
      score: totalScore,
      reasons,
      data,
    };
  }

  private async get24hPriceChange(symbol: string): Promise<number> {
    // Implement using exchange API
    return 0;
  }

  private calculatePriceChangeScore(change: number, config: TradingConfig): number {
    const ratio = change / config.maxPriceChange24h;
    return (1 - ratio) * config.weight24hChange;
  }

  private async getValidatedPatterns(symbol: string, config: TradingConfig) {
    const patterns = await this.liveTfComboRepo
    .createQueryBuilder('combo')
    .where('combo.symbol = :symbol', { symbol })
    .andWhere('combo.accuracy >= :minAcc', { minAcc: config.minAccuracyThreshold })
    .andWhere('combo.timestamp >= NOW() - INTERVAL 2 HOUR')
    .getMany();

    const count = patterns.length;
    const avgAccuracy = count > 0
      ? patterns.reduce((sum, p) => sum + p.accuracy, 0) / count
      : 0;

    return { count, avgAccuracy, patterns };
  }

  private async checkCrossTfAlignment(symbol: string) {
    const signals = await this.liveSignalRepo
    .createQueryBuilder('signal')
    .select('DISTINCT signal.timeframe')
    .addSelect('COUNT(*)', 'buyCount')
    .where('signal.symbol = :symbol', { symbol })
    .andWhere('signal.signalType = :type', { type: 'BUY' })
    .andWhere('signal.timestamp >= NOW() - INTERVAL 2 HOUR')
    .groupBy('signal.timeframe')
    .having('buyCount >= 2')
    .getRawMany();

    return {
      count: signals.length,
      timeframes: signals.map(s => s.timeframe),
    };
  }

  private async checkStrongSignalDensity(symbol: string, config: TradingConfig) {
    const count = await this.liveSignalRepo.count({
      where: {
        symbol,
        signalType: 'BUY',
        confidence: 75, // >= 75
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // last hour
      },
    });

    return {
      count,
      score: Math.min(count, 10),
      passed: count >= config.minStrongSignalsPerHour,
    };
  }

  private async checkVolumeConfirmation(symbol: string) {
    const volumeSignals = await this.liveSignalRepo.count({
      where: {
        symbol,
        signalName: In(['volume_spike_bullish', 'volume_climax_bullish', 'obv_bullish', 'cmf_bullish']),
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });

    return {
      confirmed: volumeSignals >= 1,
      count: volumeSignals,
    };
  }

  private async checkScalpAgreement(symbol: string, config: TradingConfig) {
    const shortTfs = ['1m', '5m', '15m'];
    const results = await Promise.all(
      shortTfs.map(async tf => {
        const [buyCount, sellCount] = await Promise.all([
          this.liveSignalRepo.count({
            where: { symbol, timeframe: tf, signalType: 'BUY' },
          }),
          this.liveSignalRepo.count({
            where: { symbol, timeframe: tf, signalType: 'SELL' },
          }),
        ]);
        return buyCount > sellCount;
      }),
    );

    const agreement = (results.filter(Boolean).length / shortTfs.length) * 100;

    return {
      agreement,
      passed: agreement >= config.minScalpAgreementPct,
    };
  }

  private async checkMarketStructure(symbol: string) {
    const structureSignals = [
      'break_of_structure_bullish',
      'choch_bullish',
      'higher_high',
      'support_bounce',
      'resistance_break',
    ];

    const count = await this.liveSignalRepo.count({
      where: {
        symbol,
        signalName: In(structureSignals),
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });

    return {
      confirmed: count >= 1,
      count,
    };
  }

  private async checkRecentLosses(configId: number, symbol: string): Promise<number> {
    // Implement by checking position history
    return 0;
  }
}