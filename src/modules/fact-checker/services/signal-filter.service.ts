/**
 * Signal Filter Service
 *
 * Implements smart filtering to determine which signals should be fact-checked
 * Balances thoroughness with efficiency
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilteringStats, SignalFilterDecision, SignalFilterResult } from '@/types/fact-checking.types';
import { TfCombo } from '@database/entities/tf-combo.entity';
import { SignalFactCheck } from '@database/entities/signal-fact-check.entity';

@Injectable()
export class SignalFilterService {
  private readonly logger = new Logger(SignalFilterService.name);

  private readonly MIN_ACCURACY_THRESHOLD = 60.0;
  private readonly WEAK_SIGNAL_SAMPLE_RATE = 0.3; // Check 30% of weak signals

  constructor(
    @InjectRepository(TfCombo)
    private tfComboRepository: Repository<TfCombo>,
    @InjectRepository(SignalFactCheck)
    private signalFactCheckRepository: Repository<SignalFactCheck>,
  ) {}

  /**
   * Filter signals and determine which should be fact-checked
   */
  async filterSignals(signals: any[]): Promise<SignalFilterResult> {
    const stats: FilteringStats = {
      total: signals.length,
      toCheck: 0,
      toSkip: 0,
      checkRate: 0,
      reasons: {},
    };

    const signalsToCheck: any[] = [];

    for (const signal of signals) {
      const decision = await this.shouldFactCheck(signal);

      if (decision.shouldCheck) {
        signalsToCheck.push({
          ...signal,
          filterReason: decision.reason,
        });
        stats.toCheck++;
      } else {
        stats.toSkip++;
      }

      stats.reasons[decision.reason] = (stats.reasons[decision.reason] || 0) + 1;
    }

    stats.checkRate = stats.total > 0 ? (stats.toCheck / stats.total) * 100 : 0;

    return {
      signalsToCheck,
      stats,
    };
  }

  /**
   * Determine if a signal should be fact-checked
   */
  private async shouldFactCheck(signal: any): Promise<SignalFilterDecision> {
    const signalName = signal.signalName || signal.signal_name;
    const strength = signal.strength || 'WEAK';
    const confidence = signal.confidence || 0;
    const timeframe = signal.timeframe;

    // Priority 1: Always check strong signals
    if (strength === 'VERY_STRONG' || strength === 'STRONG') {
      return {
        shouldCheck: true,
        reason: 'STRONG_SIGNAL'
      };
    }

    // Priority 2: Always check moderate signals
    if (strength === 'MODERATE') {
      return {
        shouldCheck: true,
        reason: 'MODERATE_SIGNAL'
      };
    }

    // Priority 3: Check high-confidence weak signals (might be mislabeled)
    if (confidence >= 75) {
      return {
        shouldCheck: true,
        reason: 'HIGH_CONFIDENCE'
      };
    }

    // Priority 4: Check if signal is part of winning combinations
    const isInWinningCombos = await this.isInWinningCombos(signalName, timeframe);
    if (isInWinningCombos) {
      return {
        shouldCheck: true,
        reason: 'WINNING_COMBO_MEMBER'
      };
    }

    // Priority 5: Check if signal has insufficient data
    const sampleSize = await this.getSampleSize(signalName, timeframe);
    if (sampleSize < 20) {
      return {
        shouldCheck: true,
        reason: 'INSUFFICIENT_DATA'
      };
    }

    // Priority 6: Random sampling of weak signals for discovery
    if (Math.random() < this.WEAK_SIGNAL_SAMPLE_RATE) {
      return {
        shouldCheck: true,
        reason: 'RANDOM_SAMPLE'
      };
    }

    if (timeframe == '2h' || timeframe == '6h'){
      return {
        shouldCheck: false,
        reason: 'TIMEFRAME_NOT_STANDARD'
      }
    }

    // Skip this weak signal
    return {
      shouldCheck: false,
      reason: 'WEAK_SIGNAL_SKIP'
    };
  }

  /**
   * Check if signal appears in high-accuracy combinations
   */
  private async isInWinningCombos(
    signalName: string,
    timeframe: string,
  ): Promise<boolean> {
    const count = await this.tfComboRepository
    .createQueryBuilder('combo')
    .where('combo.signalName LIKE :signalName', { signalName: `%${signalName}%` })
    .andWhere('combo.timeframe = :timeframe', { timeframe })
    .andWhere('combo.accuracy >= :minAccuracy', { minAccuracy: this.MIN_ACCURACY_THRESHOLD })
    .getCount();

    return count > 0;
  }

  /**
   * Get existing sample size for signal
   */
  private async getSampleSize(
    signalName: string,
    timeframe: string,
  ): Promise<number> {
    const count = await this.signalFactCheckRepository
    .createQueryBuilder('sfc')
    .where('sfc.signalName = :signalName', { signalName })
    .andWhere('sfc.timeframe = :timeframe', { timeframe })
    .getCount();

    return count;
  }

  /**
   * Get filtering statistics for a batch
   */
  getFilteringStats(signals: any[], decisions: SignalFilterDecision[]): FilteringStats {
    const stats: FilteringStats = {
      total: signals.length,
      toCheck: 0,
      toSkip: 0,
      checkRate: 0,
      reasons: {},
    };

    for (const decision of decisions) {
      if (decision.shouldCheck) {
        stats.toCheck++;
      } else {
        stats.toSkip++;
      }

      stats.reasons[decision.reason] = (stats.reasons[decision.reason] || 0) + 1;
    }

    stats.checkRate = stats.total > 0 ? (stats.toCheck / stats.total) * 100 : 0;

    return stats;
  }
}