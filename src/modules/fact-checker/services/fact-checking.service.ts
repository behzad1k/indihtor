/**
 * Signal Fact-Checking Service
 *
 * Core service for validating trading signals against historical price data
 * Implements parallel processing, rate limiting, and accuracy tracking
 */

import { PriceDataService } from '@modules/fact-checker/services/price-data.service';
import { RateLimiterService } from '@modules/fact-checker/services/rate-limiter.service';
import { SignalFilterService } from '@modules/fact-checker/services/signal-filter.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkFactCheckOptions, BulkFactCheckResults, ConfidenceAdjustment, FactCheckResult, SignalAccuracy, ValidationResult } from '@/types/fact-checking.types';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { Signal } from '@database/entities/signal.entity';
import { SignalFactCheck } from '@database/entities/signal-fact-check.entity';
import { SignalConfidenceAdjustment } from '@database/entities/signal-confidence-adjustment.entity';

@Injectable()
export class FactCheckingService {
  private readonly logger = new Logger(FactCheckingService.name);

  // Configuration constants
  private readonly MIN_PROFIT_THRESHOLD_PCT = 0.1; // 0.5% minimum profit
  private readonly STOP_LOSS_PCT = 5.0;
  private readonly MAX_WORKERS = 10;

  // Fallback validation windows (if not in database)
  private readonly FALLBACK_VALIDATION_WINDOWS = {
    '1m': 10, '3m': 10, '5m': 12, '15m': 8,
    '30m': 8, '1h': 8, '2h': 6, '4h': 6,
    '6h': 8, '8h': 6, '12h': 8, '1d': 5,
    '3d': 5, '1w': 4,
  };

  private readonly TIMEFRAME_MINUTES = {
    '1m': 1, '3m': 3, '5m': 5, '15m': 15,
    '30m': 30, '1h': 60, '2h': 120, '4h': 240,
    '6h': 360, '8h': 480, '12h': 720, '1d': 1440,
    '3d': 4320, '1w': 10080,
  };

  // Cache for validation windows
  private validationWindowCache: Map<string, number> = new Map();

  constructor(
    @InjectRepository(LiveSignal)
    private liveSignalRepository: Repository<LiveSignal>,
    @InjectRepository(Signal)
    private signalRepository: Repository<Signal>,
    @InjectRepository(SignalFactCheck)
    private signalFactCheckRepository: Repository<SignalFactCheck>,
    @InjectRepository(SignalConfidenceAdjustment)
    private signalConfidenceAdjustmentRepository: Repository<SignalConfidenceAdjustment>,
    private readonly priceDataService: PriceDataService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly signalFilterService: SignalFilterService,
  ) {
    this.loadValidationWindows();
  }

  /**
   * Load validation windows from database into cache
   */
  private async loadValidationWindows(): Promise<void> {
    try {
      const signals = await this.signalRepository.find({
        select: ['signalName', 'timeframe', 'validationWindow'],
      });

      for (const signal of signals) {
        const key = `${signal.signalName}:${signal.timeframe}`;
        this.validationWindowCache.set(key, signal.validationWindow);
      }

      this.logger.log(
        `✅ Loaded ${this.validationWindowCache.size} validation windows from database`
      );
    } catch (error) {
      this.logger.warn('⚠️  Could not load validation windows from database, using fallbacks');
    }
  }

  /**
   * Get validation window for signal-timeframe combination
   */
  private getValidationWindow(signalName: string, timeframe: string): number {
    const key = `${signalName}:${timeframe}`;

    // Check cache
    if (this.validationWindowCache.has(key)) {
      return this.validationWindowCache.get(key);
    }

    // Return fallback
    return this.FALLBACK_VALIDATION_WINDOWS[timeframe] || 5;
  }

  /**
   * Validate a single signal against price movement
   */
  private async validateSignalWithStopLoss(
    entryPrice: number,
    signalType: 'BUY' | 'SELL',
    candles: any[],
    stopLossPct?: number,
  ): Promise<ValidationResult> {
    if (!candles || candles.length < 2) {
      return {
        predictedCorrectly: false,
        exitReason: 'INSUFFICIENT_DATA',
        priceChangePct: 0,
      };
    }

    const finalPrice = candles[candles.length - 1].close;

    // =================================================================
    // 🚨 CRITICAL: Sanity check for price unit mismatch
    // =================================================================
    const priceRatio = finalPrice / entryPrice;

    // If prices differ by more than 10x, something is wrong
    if (priceRatio > 10 || priceRatio < 0.1) {
      this.logger.error(
        `❌ PRICE UNIT MISMATCH DETECTED!\n` +
        `   Entry Price: ${entryPrice}\n` +
        `   Final Price: ${finalPrice}\n` +
        `   Ratio: ${priceRatio.toFixed(2)}x\n` +
        `   This suggests prices are in different units!`
      );
      return {
        predictedCorrectly: false,
        exitReason: 'PRICE_UNIT_MISMATCH',
        priceChangePct: 0,
      };
    }

    const stopLoss = stopLossPct || this.STOP_LOSS_PCT;

    if (signalType === 'BUY') {
      const stopLossPrice = entryPrice * (1 - stopLoss / 100);

      // Check stop-loss
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].low <= stopLossPrice) {
          return {
            predictedCorrectly: false,
            exitReason: `STOPPED_OUT_CANDLE_${i}`,
            priceChangePct: -stopLoss,
          };
        }
      }

      // Calculate price change
      const priceChangePct = ((finalPrice - entryPrice) / entryPrice) * 100;

      // =================================================================
      // 🚨 CRITICAL: Validate percentage is reasonable
      // =================================================================
      if (Math.abs(priceChangePct) > 50) {
        this.logger.error(
          `❌ INVALID PRICE CHANGE DETECTED!\n` +
          `   Percentage: ${priceChangePct.toFixed(2)}%\n` +
          `   Entry: ${entryPrice}\n` +
          `   Final: ${finalPrice}\n` +
          `   This is unrealistic for crypto in a few candles!`
        );
        return {
          predictedCorrectly: false,
          exitReason: 'INVALID_PRICE_CHANGE',
          priceChangePct: 0,
        };
      }

      // Determine result
      if (priceChangePct > this.MIN_PROFIT_THRESHOLD_PCT) {
        return {
          predictedCorrectly: true,
          exitReason: 'PROFIT_TARGET',
          priceChangePct,
        };
      } else if (priceChangePct > 0) {
        return {
          predictedCorrectly: false,
          exitReason: 'PROFIT_TOO_SMALL',
          priceChangePct,
        };
      } else {
        return {
          predictedCorrectly: false,
          exitReason: 'LOSS',
          priceChangePct,
        };
      }
    } else if (signalType === 'SELL') {
      const stopLossPrice = entryPrice * (1 + stopLoss / 100);

      // Check stop-loss
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].high >= stopLossPrice) {
          return {
            predictedCorrectly: false,
            exitReason: `STOPPED_OUT_CANDLE_${i}`,
            priceChangePct: -stopLoss,
          };
        }
      }

      // Calculate price change (for SELL: profit when price goes down)
      const priceChangePct = ((entryPrice - finalPrice) / entryPrice) * 100;

      // =================================================================
      // 🚨 CRITICAL: Validate percentage is reasonable
      // =================================================================
      if (Math.abs(priceChangePct) > 50) {
        this.logger.error(
          `❌ INVALID PRICE CHANGE DETECTED!\n` +
          `   Percentage: ${priceChangePct.toFixed(2)}%\n` +
          `   Entry: ${entryPrice}\n` +
          `   Final: ${finalPrice}\n` +
          `   This is unrealistic for crypto in a few candles!`
        );
        return {
          predictedCorrectly: false,
          exitReason: 'INVALID_PRICE_CHANGE',
          priceChangePct: 0,
        };
      }

      // Determine result
      if (priceChangePct > this.MIN_PROFIT_THRESHOLD_PCT) {
        return {
          predictedCorrectly: true,
          exitReason: 'PROFIT_TARGET',
          priceChangePct,
        };
      } else if (priceChangePct > 0) {
        return {
          predictedCorrectly: false,
          exitReason: 'PROFIT_TOO_SMALL',
          priceChangePct,
        };
      } else {
        return {
          predictedCorrectly: false,
          exitReason: 'LOSS',
          priceChangePct,
        };
      }
    }

    return {
      predictedCorrectly: false,
      exitReason: 'INVALID_SIGNAL_TYPE',
      priceChangePct: 0,
    };
  }


  /**
   * Fact-check a single signal
   */
  async factCheckSignal(
    signalName: string,
    signalType: 'BUY' | 'SELL',
    timeframe: string,
    detectedAt: Date,
    priceAtDetection: number,
    symbol: string,
    candlesAhead?: number,
    stopLossPct?: number,
  ): Promise<FactCheckResult | null> {
    // Get validation window
    const validationWindow = candlesAhead || this.getValidationWindow(signalName, timeframe);

  // 🔍 DEBUG: Log the fact-check attempt
  this.logger.debug(
    `Fact-checking: ${signalName} [${timeframe}] ${symbol}\n` +
    `   Signal Type: ${signalType}\n` +
    `   Price at Detection: ${priceAtDetection}\n` +
    `   Detected At: ${detectedAt.toISOString()}\n` +
    `   Validation Window: ${validationWindow} candles`
  );

    // Fetch price journey
    const candles = await this.priceDataService.fetchPriceJourney(
      symbol,
      detectedAt,
      timeframe,
      validationWindow,
    );

    if (!candles || candles.length < 2) {
    this.logger.warn(`Insufficient candles for ${symbol}`);
      return null;
    }

  // 🔍 DEBUG: Log candle data
  this.logger.debug(
    `Candles fetched: ${candles.length}\n` +
    `   First candle: open=${candles[0].open}, close=${candles[0].close}\n` +
    `   Last candle: open=${candles[candles.length - 1].open}, close=${candles[candles.length - 1].close}\n` +
    `   Price range: ${Math.min(...candles.map(c => c.low))} - ${Math.max(...candles.map(c => c.high))}`
  );

    // Validate signal
    const validation = await this.validateSignalWithStopLoss(
      priceAtDetection,
      signalType,
      candles,
      stopLossPct,
    );

  // 🔍 DEBUG: Log validation result
  this.logger.debug(
    `Validation result:\n` +
    `   Predicted Correctly: ${validation.predictedCorrectly}\n` +
    `   Price Change: ${validation.priceChangePct.toFixed(4)}%\n` +
    `   Exit Reason: ${validation.exitReason}`
  );

  // ... rest of the method stays the same

    // Determine actual move
    let actualMove: 'UP' | 'DOWN' | 'FLAT';
    if (validation.priceChangePct > this.MIN_PROFIT_THRESHOLD_PCT) {
      actualMove = 'UP';
    } else if (validation.priceChangePct < -this.MIN_PROFIT_THRESHOLD_PCT) {
      actualMove = 'DOWN';
    } else {
      actualMove = 'FLAT';
    }

    return {
      signalName,
      timeframe,
      detectedAt,
      priceAtDetection,
      actualMove,
      predictedCorrectly: validation.predictedCorrectly,
      priceChangePct: validation.priceChangePct,
      exitReason: validation.exitReason,
      checkedAt: new Date(),
      candlesElapsed: candles.length - 1,
      validationWindow,
    };
  }

  /**
   * Bulk fact-check signals with parallel processing
   */
  async bulkFactCheckLiveSignals(
    options: BulkFactCheckOptions,
  ): Promise<BulkFactCheckResults> {
    const { symbol, limit, useFiltering = true, maxWorkers } = options;

    this.logger.log('🚀 Starting bulk fact-checking...');

    // Get unchecked signals using TypeORM query builder
    let queryBuilder = this.liveSignalRepository
    .createQueryBuilder('ls')
    .leftJoin(
      SignalFactCheck,
      'sfc',
      'ls.signalName = sfc.signalName AND ls.timeframe = sfc.timeframe AND ls.timestamp = sfc.detectedAt'
    )
    .where('sfc.id IS NULL').orderBy('ls.timestamp', 'ASC');

    if (symbol) {
      queryBuilder = queryBuilder.andWhere('ls.symbol = :symbol', { symbol });
    }

    queryBuilder = queryBuilder.orderBy('ls.timestamp', 'DESC');

    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    const signals = await queryBuilder.getMany();
    const totalSignals = signals.length;
    this.logger.log(`Found ${totalSignals} signals to check`);

    if (totalSignals === 0) {
      return {
        totalChecked: 0,
        correctPredictions: 0,
        incorrectPredictions: 0,
        stoppedOut: 0,
        accuracy: 0,
        profitFactor: 0,
        details: [],
        exitReasons: {},
      };
    }

    // Apply filtering if enabled
    let signalsToCheck = signals;
    let filteringStats = null;

    if (useFiltering) {
      const filtered = await this.signalFilterService.filterSignals(signals);
      signalsToCheck = filtered.signalsToCheck;
      filteringStats = filtered.stats;

      this.logger.log(
        `📊 Filtering: ${filtered.stats.toCheck}/${filtered.stats.total} signals (${filtered.stats.checkRate.toFixed(1)}%)`
      );
    }

    // Parallel processing
    const workers = maxWorkers || this.MAX_WORKERS;
    const startTime = Date.now();

    const results: BulkFactCheckResults = {
      totalChecked: 0,
      correctPredictions: 0,
      incorrectPredictions: 0,
      stoppedOut: 0,
      accuracy: 0,
      profitFactor: 0,
      details: [],
      exitReasons: {},
      filteringStats,
    };

    // Process in batches
    const batchSize = workers;
    for (let i = 0; i < signalsToCheck.length; i += batchSize) {
      const batch = signalsToCheck.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(signal => this.factCheckSignal(
          signal.signalName,
          signal.signalType as 'BUY' | 'SELL',
          signal.timeframe,
          new Date(signal.timestamp),
          Number(signal.price),
          signal.symbol,
        ))
      );

      // Process batch results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          const factCheck = result.value;

          // Save to database
          await this.saveFactCheck(factCheck);

          // Update statistics
          results.details.push(factCheck);
          results.totalChecked++;

          if (factCheck.predictedCorrectly) {
            results.correctPredictions++;
          } else {
            results.incorrectPredictions++;
            if (factCheck.exitReason.includes('STOPPED_OUT')) {
              results.stoppedOut++;
            }
          }

          // Track exit reasons
          results.exitReasons[factCheck.exitReason] =
            (results.exitReasons[factCheck.exitReason] || 0) + 1;
        }
      }

      // Progress logging
      const completed = Math.min(i + batchSize, signalsToCheck.length);
      if (completed % 50 === 0 || completed === signalsToCheck.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = completed / elapsed;
        const eta = (signalsToCheck.length - completed) / rate;

        this.logger.log(
          `Progress: ${completed}/${signalsToCheck.length} (${(completed / signalsToCheck.length * 100).toFixed(1)}%) - ${rate.toFixed(1)}/s - ETA: ${eta.toFixed(0)}s`
        );
      }
    }

    // Calculate final statistics
    const elapsed = (Date.now() - startTime) / 1000;

    if (results.totalChecked > 0) {
      results.accuracy = (results.correctPredictions / results.totalChecked) * 100;

      const winningSum = results.details
      .filter(d => d.predictedCorrectly)
      .reduce((sum, d) => sum + Math.abs(d.priceChangePct), 0);

      const losingSum = results.details
      .filter(d => !d.predictedCorrectly)
      .reduce((sum, d) => sum + Math.abs(d.priceChangePct), 0);

      results.profitFactor = losingSum > 0 ? winningSum / losingSum : winningSum;
    }

    this.logger.log(`✅ Completed: ${results.totalChecked} checks in ${elapsed.toFixed(1)}s`);
    this.logger.log(`   Accuracy: ${results.accuracy.toFixed(1)}%`);
    this.logger.log(`   Profit Factor: ${results.profitFactor.toFixed(2)}`);
    this.logger.log(
      `   Stopped Out: ${results.stoppedOut} (${(results.stoppedOut / Math.max(results.totalChecked, 1) * 100).toFixed(1)}%)`
    );

    // Update signal accuracies in database
    await this.updateSignalAccuracies(results.details);

    return results;
  }

  /**
   * Save fact-check result to database
   */
  private async saveFactCheck(result: FactCheckResult): Promise<void> {
    const factCheck = this.signalFactCheckRepository.create({
      signalName: result.signalName,
      timeframe: result.timeframe,
      detectedAt: result.detectedAt,
      priceAtDetection: result.priceAtDetection,
      actualMove: result.actualMove,
      predictedCorrectly: result.predictedCorrectly,
      priceChangePct: result.priceChangePct,
      checkedAt: result.checkedAt,
      candlesElapsed: result.candlesElapsed,
      exitReason: result.exitReason,
      validationWindow: result.validationWindow,
    });

    await this.signalFactCheckRepository.save(factCheck);
  }

  /**
   * Update signal accuracies in signals table
   */
  private async updateSignalAccuracies(results: FactCheckResult[]): Promise<void> {
    // Group by signal-timeframe
    const signalStats = new Map<string, { total: number; correct: number }>();

    for (const result of results) {
      const key = `${result.signalName}:${result.timeframe}`;
      if (!signalStats.has(key)) {
        signalStats.set(key, { total: 0, correct: 0 });
      }
      const stats = signalStats.get(key);
      stats.total++;
      if (result.predictedCorrectly) {
        stats.correct++;
      }
    }

    // Update database
    for (const [key, stats] of signalStats) {
      const [signalName, timeframe] = key.split(':');

      // Get complete stats from database using TypeORM
      const factChecks = await this.signalFactCheckRepository.find({
        where: {
          signalName,
          timeframe,
        },
      });

      if (factChecks.length > 0) {
        const total = factChecks.length;
        const correct = factChecks.filter(fc => fc.predictedCorrectly).length;
        const accuracy = (correct / total) * 100;

        // Update signals table
        await this.signalRepository.update(
          { signalName, timeframe },
          {
            signalAccuracy: accuracy,
            sampleSize: total,
            updatedAt: new Date(),
          }
        );
      }
    }

    this.logger.log(`✅ Updated accuracies for ${signalStats.size} signal-timeframe combinations`);
  }

  /**
   * Calculate accuracy statistics for a signal
   */
  async calculateSignalAccuracy(
    signalName: string,
    timeframe?: string,
    minSamples: number = 10,
  ): Promise<SignalAccuracy | null> {
    const queryBuilder = this.signalFactCheckRepository
    .createQueryBuilder('sfc')
    .where('sfc.signalName = :signalName', { signalName });

    if (timeframe) {
      queryBuilder.andWhere('sfc.timeframe = :timeframe', { timeframe });
    }

    const factChecks = await queryBuilder.getMany();

    if (!factChecks || factChecks.length < minSamples) {
      return null;
    }

    const total = factChecks.length;
    const correct = factChecks.filter(fc => fc.predictedCorrectly).length;
    const accuracy = (correct / total) * 100;

    const avgPriceChange = factChecks.reduce((sum, fc) => sum + Number(fc.priceChangePct), 0) / total;

    const winningChecks = factChecks.filter(fc => fc.predictedCorrectly);
    const losingChecks = factChecks.filter(fc => !fc.predictedCorrectly);

    const avgWin = winningChecks.length > 0
      ? winningChecks.reduce((sum, fc) => sum + Number(fc.priceChangePct), 0) / winningChecks.length
      : 0;

    const avgLoss = losingChecks.length > 0
      ? losingChecks.reduce((sum, fc) => sum + Number(fc.priceChangePct), 0) / losingChecks.length
      : 0;

    const stoppedOut = factChecks.filter(fc => fc.exitReason.includes('STOPPED_OUT')).length;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

    return {
      signalName,
      timeframe,
      totalSamples: total,
      correctPredictions: correct,
      accuracy,
      avgPriceChange,
      avgWin,
      avgLoss,
      profitFactor,
      stoppedOut,
      stoppedOutRate: (stoppedOut / total * 100) || 0,
    };
  }

  /**
   * Adjust signal confidence based on historical performance
   */
  async adjustSignalConfidence(
    signalName: string,
    timeframe: string,
    minSamples: number = 10,
  ): Promise<ConfidenceAdjustment | null> {
    const accuracyData = await this.calculateSignalAccuracy(
      signalName,
      timeframe,
      minSamples,
    );

    if (!accuracyData) {
      return null;
    }

    // Get original confidence from signal definitions
    const originalConf = 70; // Default, should be fetched from SIGNAL_CONFIDENCE

    // Calculate adjustment
    const sampleWeight = Math.min(1.0, accuracyData.totalSamples / 500);
    const baseAdjusted =
      originalConf * (1 - sampleWeight) +
      accuracyData.accuracy * sampleWeight;

    // Profit factor bonus/penalty
    let profitBonus = 0;
    if (accuracyData.profitFactor > 2.0) {
      profitBonus = Math.min(10, (accuracyData.profitFactor - 2.0) * 5);
    } else if (accuracyData.profitFactor < 1.0) {
      profitBonus = Math.max(-15, (accuracyData.profitFactor - 1.0) * 15);
    }

    // Stop-out penalty
    const stopPenalty =
      accuracyData.stoppedOutRate > 30
        ? Math.max(0, (accuracyData.stoppedOutRate - 30) * 0.3)
        : 0;

    const adjustedConf = Math.max(0, Math.min(100,
      Math.round(baseAdjusted + profitBonus - stopPenalty)
    ));

    // Save to database using upsert
    const adjustment = this.signalConfidenceAdjustmentRepository.create({
      signalName,
      timeframe,
      originalConfidence: originalConf,
      adjustedConfidence: adjustedConf,
      accuracyRate: accuracyData.accuracy,
      sampleSize: accuracyData.totalSamples,
      lastUpdated: new Date(),
    });

    await this.signalConfidenceAdjustmentRepository.save(adjustment);

    this.logger.log(
      `✅ Adjusted ${signalName}[${timeframe}]: ${originalConf}→${adjustedConf}`
    );

    return {
      signalName,
      timeframe,
      originalConfidence: originalConf,
      adjustedConfidence: adjustedConf,
      accuracyRate: accuracyData.accuracy,
      sampleSize: accuracyData.totalSamples,
      profitFactor: accuracyData.profitFactor,
      confidenceChange: adjustedConf - originalConf,
    };
  }

  /**
   * Bulk adjust all signals with sufficient data
   */
  async bulkAdjustAllSignals(minSamples: number = 10): Promise<{
    totalProcessed: number;
    adjusted: number;
    skippedInsufficientSamples: number;
    adjustments: ConfidenceAdjustment[];
  }> {
    // Get distinct signal-timeframe combinations
    const combinations = await this.signalFactCheckRepository
    .createQueryBuilder('sfc')
    .select('DISTINCT sfc.signalName', 'signalName')
    .addSelect('sfc.timeframe', 'timeframe')
    .getRawMany();

    const results = {
      totalProcessed: 0,
      adjusted: 0,
      skippedInsufficientSamples: 0,
      adjustments: [],
    };

    for (const { signalName, timeframe } of combinations) {
      results.totalProcessed++;

      const adjustment = await this.adjustSignalConfidence(
        signalName,
        timeframe,
        minSamples,
      );

      if (adjustment) {
        results.adjusted++;
        results.adjustments.push(adjustment);
      } else {
        results.skippedInsufficientSamples++;
      }
    }

    this.logger.log(
      `✅ Bulk adjust: ${results.adjusted}/${results.totalProcessed}`
    );

    return results;
  }

  /**
   * Get adjusted confidence for a signal
   */
  async getAdjustedConfidence(
    signalName: string,
    timeframe: string,
  ): Promise<number> {
    const adjustment = await this.signalConfidenceAdjustmentRepository.findOne({
      where: {
        signalName,
        timeframe,
      },
    });

    return adjustment ? adjustment.adjustedConfidence : 70; // Default
  }

  /**
   * Get all confidence adjustments
   */
  async getAllAdjustments(): Promise<ConfidenceAdjustment[]> {
    const adjustments = await this.signalConfidenceAdjustmentRepository.find({
      order: {
        lastUpdated: 'DESC',
      },
    });

    return adjustments.map(adj => ({
      signalName: adj.signalName,
      timeframe: adj.timeframe,
      originalConfidence: adj.originalConfidence,
      adjustedConfidence: adj.adjustedConfidence,
      accuracyRate: adj.accuracyRate,
      sampleSize: adj.sampleSize,
      profitFactor: 0, // Not stored in adjustment table
      confidenceChange: adj.adjustedConfidence - adj.originalConfidence,
    }));
  }

  /**
   * Generate comprehensive validation report
   */
  async generateValidationReport(): Promise<any> {
    // Overall statistics
    const allChecks = await this.signalFactCheckRepository.find();

    const totalChecks = allChecks.length;
    const correct = allChecks.filter(fc => fc.predictedCorrectly).length;
    const avgChange = allChecks.reduce((sum, fc) => sum + Number(fc.priceChangePct), 0) / totalChecks;
    const stoppedOut = allChecks.filter(fc => fc.exitReason.includes('STOPPED_OUT')).length;

    // Exit reasons distribution
    const exitReasonsMap = new Map<string, number>();
    allChecks.forEach(fc => {
      exitReasonsMap.set(fc.exitReason, (exitReasonsMap.get(fc.exitReason) || 0) + 1);
    });

    const exitReasons = {};
    exitReasonsMap.forEach((count, reason) => {
      exitReasons[reason] = count;
    });

    // Top performing signals (with at least 20 samples)
    const signalTimeframes = await this.signalFactCheckRepository
    .createQueryBuilder('sfc')
    .select('sfc.signalName', 'signalName')
    .addSelect('sfc.timeframe', 'timeframe')
    .addSelect('COUNT(*)', 'samples')
    .addSelect('AVG(CASE WHEN sfc.predictedCorrectly = true THEN 100.0 ELSE 0.0 END)', 'accuracy')
    .addSelect('AVG(sfc.priceChangePct)', 'avgChange')
    .groupBy('sfc.signalName')
    .addGroupBy('sfc.timeframe')
    .having('COUNT(*) >= 20')
    .orderBy('accuracy', 'DESC')
    .limit(10)
    .getRawMany();

    return {
      overall: {
        totalChecks,
        correct,
        accuracy: totalChecks > 0 ? (correct / totalChecks * 100) : 0,
        avgChange: avgChange || 0,
        stoppedOut,
        stoppedOutRate: totalChecks > 0 ? (stoppedOut / totalChecks * 100) : 0,
      },
      exitReasons,
      topSignals: signalTimeframes.map(signal => ({
        signal: `${signal.signalName}[${signal.timeframe}]`,
        samples: parseInt(signal.samples),
        accuracy: parseFloat(signal.accuracy).toFixed(2),
        avgChange: parseFloat(signal.avgChange).toFixed(3),
      })),
    };
  }
}