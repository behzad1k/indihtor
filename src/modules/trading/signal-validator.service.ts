import { CrossTfCombo } from '@/database/entities/cross-tf-combo.entity';
import { LiveSignal } from '@/database/entities/live-signal.entity';
import { LiveTfCombo } from '@/database/entities/live-tf-combo.entity';
import { TradingConfig } from '@/database/entities/trading-config.entity';
import { UserPositionHistory } from '@/database/entities/user-position-history.entity';
import { ExchangeAggregatorService } from '@/modules/external-api/services/exchange-aggregator.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExchangeType } from '@/types/exchange.types';
import { Repository } from 'typeorm';

interface ValidationResult {
  passed: boolean;
  score: number;
  reasons: string[];
  data: any;
}

@Injectable()
export class SignalValidatorService {
  private readonly logger = new Logger(SignalValidatorService.name);

  constructor(
    @InjectRepository(LiveSignal)
    private liveSignalRepo: Repository<LiveSignal>,
    @InjectRepository(LiveTfCombo)
    private liveTfComboRepo: Repository<LiveTfCombo>,
    @InjectRepository(CrossTfCombo)
    private crossTfComboRepo: Repository<CrossTfCombo>,
    @InjectRepository(UserPositionHistory)
    private historyRepo: Repository<UserPositionHistory>,
    private exchangeService: ExchangeAggregatorService,
  ) {}

  async validate(
    config: TradingConfig,
    symbol: string,
    analysis: any,
  ): Promise<ValidationResult> {
    const scores: Record<string, number> = {};
    const reasons: string[] = [];
    const data: any = {};

    try {
      // 1. Check 24h price change (BLOCKING)
      const priceChange24h = await this.get24hPriceChange(symbol);
      if (priceChange24h === null) {
        return {
          passed: false,
          score: 0,
          reasons: ['Could not fetch 24h price data'],
          data: {},
        };
      }

      if (priceChange24h > config.maxPriceChange24h) {
        return {
          passed: false,
          score: 0,
          reasons: [`24h change ${priceChange24h.toFixed(2)}% exceeds limit ${config.maxPriceChange24h}%`],
          data: { priceChange24h },
        };
      }
      scores.priceChange = this.calculatePriceChangeScore(priceChange24h, config);
      data.priceChange24h = priceChange24h;

      // 2. Check validated patterns (BLOCKING)
      const patterns = await this.getValidatedPatterns(symbol, config);
      if (patterns.count < config.minPatternsThreshold) {
        return {
          passed: false,
          score: 0,
          reasons: [`Only ${patterns.count} patterns (need ${config.minPatternsThreshold})`],
          data: { patterns },
        };
      }

      if (patterns.avgAccuracy < config.minAccuracyThreshold) {
        return {
          passed: false,
          score: 0,
          reasons: [`Average accuracy ${patterns.avgAccuracy.toFixed(1)}% below threshold ${config.minAccuracyThreshold}%`],
          data: { patterns },
        };
      }

      scores.patterns = (patterns.avgAccuracy / 100) * config.weightValidatedPatterns;
      data.patterns = patterns;

      // 3. Cross-TF alignment (BLOCKING)
      const alignment = await this.checkCrossTfAlignment(symbol);
      if (alignment.count < config.minCrossTfAlignment) {
        return {
          passed: false,
          score: 0,
          reasons: [`Only ${alignment.count} aligned TFs (need ${config.minCrossTfAlignment})`],
          data: { alignment },
        };
      }
      scores.alignment = Math.min(alignment.count / 10, 1) * config.weightCrossTfAlignment;
      data.alignment = alignment;

      // 4. Strong signal density
      const density = await this.checkStrongSignalDensity(symbol, config);
      if (!density.passed) {
        reasons.push(`Low signal density: ${density.count} (need ${config.minStrongSignalsPerHour})`);
      }
      scores.density = (density.score / 10) * config.weightStrongSignalDensity;
      data.density = density;

      // 5. Volume confirmation
      const volume = await this.checkVolumeConfirmation(symbol);
      scores.volume = volume.confirmed ? config.weightVolumeConfirmation : 0;
      data.volume = volume;
      if (!volume.confirmed) {
        reasons.push('No volume confirmation');
      }

      // 6. Scalp agreement
      const scalp = await this.checkScalpAgreement(symbol, config);
      scores.scalp = (scalp.agreement / 100) * config.weightScalpAgreement;
      data.scalp = scalp;
      if (!scalp.passed) {
        reasons.push(`Low scalp agreement: ${scalp.agreement.toFixed(1)}%`);
      }

      // 7. Market structure
      const structure = await this.checkMarketStructure(symbol);
      scores.structure = structure.confirmed ? config.weightMarketStructure : 0;
      data.structure = structure;
      if (!structure.confirmed) {
        reasons.push('No market structure confirmation');
      }

      // 8. Recent loss check (BLOCKING)
      const recentLosses = await this.checkRecentLosses(config.id, symbol);
      if (recentLosses >= config.maxRecentLosses) {
        return {
          passed: false,
          score: 0,
          reasons: [`${recentLosses} recent losses on ${symbol} (max ${config.maxRecentLosses})`],
          data: { recentLosses },
        };
      }
      data.recentLosses = recentLosses;

      // 9. Signal cooldown check (BLOCKING)
      const cooldownPassed = await this.checkSignalCooldown(config.id, symbol, config.signalCooldownHours);
      if (!cooldownPassed) {
        return {
          passed: false,
          score: 0,
          reasons: [`Signal in cooldown period (${config.signalCooldownHours}h)`],
          data: { cooldown: true },
        };
      }

      // Calculate total score
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

      // Get current price for reference
      const currentPriceData = await this.exchangeService.getCurrentPrice(symbol);
      data.currentPrice = currentPriceData?.price || 0;

      return {
        passed: totalScore >= 70,
        score: totalScore,
        reasons,
        data,
      };

    } catch (error) {
      this.logger.error(`Validation error for ${symbol}: ${error.message}`);
      return {
        passed: false,
        score: 0,
        reasons: [`Validation error: ${error.message}`],
        data: {},
      };
    }
  }

  private async get24hPriceChange(symbol: string): Promise<number | null> {
    try {
      const stats = await this.exchangeService.get24hrStats(ExchangeType.BINANCE, symbol);
      if (stats && stats.priceChangePercent !== undefined) {
        return Math.abs(parseFloat(stats.priceChangePercent));
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to get 24h stats for ${symbol}: ${error.message}`);
      return null;
    }
  }

  private calculatePriceChangeScore(change: number, config: TradingConfig): number {
    // Lower change = higher score
    const ratio = change / config.maxPriceChange24h;
    return (1 - ratio) * config.weight24hChange;
  }

  private async getValidatedPatterns(symbol: string, config: TradingConfig) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Get same-timeframe combos
    const sameTfCombos = await this.liveTfComboRepo
    .createQueryBuilder('combo')
    .where('combo.symbol = :symbol', { symbol })
    .andWhere('combo.accuracy >= :minAcc', { minAcc: config.minAccuracyThreshold })
    .andWhere('combo.timestamp >= :since', { since: twoHoursAgo })
    .getMany();

    const count = sameTfCombos.length;
    const avgAccuracy = count > 0
      ? sameTfCombos.reduce((sum, p) => sum + Number(p.accuracy), 0) / count
      : 0;

    return {
      count,
      avgAccuracy,
      patterns: sameTfCombos.map(c => ({
        name: c.comboSignalName,
        timeframe: c.timeframe,
        accuracy: c.accuracy,
      })),
    };
  }

  private async checkCrossTfAlignment(symbol: string) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const result = await this.liveSignalRepo
    .createQueryBuilder('signal')
    .select('signal.timeframe', 'timeframe')
    .addSelect('COUNT(*)', 'buyCount')
    .where('signal.symbol = :symbol', { symbol })
    .andWhere('signal.signalType = :type', { type: 'BUY' })
    .andWhere('signal.timestamp >= :since', { since: twoHoursAgo })
    .groupBy('signal.timeframe')
    .having('buyCount >= 2')
    .getRawMany();

    return {
      count: result.length,
      timeframes: result.map(r => r.timeframe),
      details: result,
    };
  }

  private async checkStrongSignalDensity(symbol: string, config: TradingConfig) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await this.liveSignalRepo
    .createQueryBuilder('signal')
    .where('signal.symbol = :symbol', { symbol })
    .andWhere('signal.signalType = :type', { type: 'BUY' })
    .andWhere('signal.confidence >= 75')
    .andWhere('signal.timestamp >= :since', { since: oneHourAgo })
    .getCount();

    return {
      count,
      score: Math.min(count, 10),
      passed: count >= config.minStrongSignalsPerHour,
    };
  }

  private async checkVolumeConfirmation(symbol: string) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const volumeSignals = [
      'volume_spike_bullish',
      'volume_climax_bullish',
      'obv_bullish',
      'cmf_bullish',
    ];

    const count = await this.liveSignalRepo
    .createQueryBuilder('signal')
    .where('signal.symbol = :symbol', { symbol })
    .andWhere('signal.signalName IN (:...signals)', { signals: volumeSignals })
    .andWhere('signal.timestamp >= :since', { since: twoHoursAgo })
    .getCount();

    return {
      confirmed: count >= 1,
      count,
    };
  }

  private async checkScalpAgreement(symbol: string, config: TradingConfig) {
    const shortTfs = ['1m', '5m', '15m'];
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const results = await Promise.all(
      shortTfs.map(async tf => {
        const [buyCount, sellCount] = await Promise.all([
          this.liveSignalRepo
          .createQueryBuilder('signal')
          .where('signal.symbol = :symbol', { symbol })
          .andWhere('signal.timeframe = :tf', { tf })
          .andWhere('signal.signalType = :type', { type: 'BUY' })
          .andWhere('signal.timestamp >= :since', { since: thirtyMinutesAgo })
          .getCount(),
          this.liveSignalRepo
          .createQueryBuilder('signal')
          .where('signal.symbol = :symbol', { symbol })
          .andWhere('signal.timeframe = :tf', { tf })
          .andWhere('signal.signalType = :type', { type: 'SELL' })
          .andWhere('signal.timestamp >= :since', { since: thirtyMinutesAgo })
          .getCount(),
        ]);
        return { tf, buyCount, sellCount, agrees: buyCount > sellCount };
      }),
    );

    const agreementCount = results.filter(r => r.agrees).length;
    const agreement = (agreementCount / shortTfs.length) * 100;

    return {
      agreement,
      passed: agreement >= config.minScalpAgreementPct,
      details: results,
    };
  }

  private async checkMarketStructure(symbol: string) {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const structureSignals = [
      'break_of_structure_bullish',
      'choch_bullish',
      'higher_high',
      'support_bounce',
      'resistance_break',
    ];

    const count = await this.liveSignalRepo
    .createQueryBuilder('signal')
    .where('signal.symbol = :symbol', { symbol })
    .andWhere('signal.signalName IN (:...signals)', { signals: structureSignals })
    .andWhere('signal.timestamp >= :since', { since: threeHoursAgo })
    .getCount();

    return {
      confirmed: count >= 1,
      count,
    };
  }

  private async checkRecentLosses(configId: number, symbol: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const losses = await this.historyRepo
    .createQueryBuilder('history')
    .where('history.tradingConfigId = :configId', { configId })
    .andWhere('history.symbol = :symbol', { symbol })
    .andWhere('history.exitReason IN (:...reasons)', {
      reasons: ['STOP_LOSS', 'STRONG_SELL_SIGNALS']
    })
    .andWhere('history.closedAt >= :since', { since: sevenDaysAgo })
    .getCount();

    return losses;
  }

  private async checkSignalCooldown(
    configId: number,
    symbol: string,
    cooldownHours: number,
  ): Promise<boolean> {
    const cooldownDate = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

    const recentEntry = await this.historyRepo
    .createQueryBuilder('history')
    .where('history.tradingConfigId = :configId', { configId })
    .andWhere('history.symbol = :symbol', { symbol })
    .andWhere('history.openedAt >= :since', { since: cooldownDate })
    .getOne();

    return recentEntry === null;
  }
}