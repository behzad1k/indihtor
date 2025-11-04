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
import { BulkFactCheckOptions, BulkFactCheckResults, ConfidenceAdjustment, FactCheckResult, SignalAccuracy, ValidationResult } from '@/types/fact-checking.types';

@Injectable()
export class FactCheckingService {
  private readonly logger = new Logger(FactCheckingService.name);

  // Configuration constants
  private readonly MIN_PROFIT_THRESHOLD_PCT = 0.1; // 0.5% minimum profit
  private readonly STOP_LOSS_PCT = 3.0;
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
    private readonly priceDataService: PriceDataService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly signalFilterService: SignalFilterService,
    private readonly databaseService: DatabaseService,
  ) {
    this.loadValidationWindows();
  }

  /**
   * Load validation windows from database into cache
   */
  private async loadValidationWindows(): Promise<void> {
    try {
      const windows = await this.databaseService.query(
        'SELECT signal_name, timeframe, validation_window FROM signals'
      );

      for (const row of windows) {
        const key = `${row.signal_name}:${row.timeframe}`;
        this.validationWindowCache.set(key, row.validation_window);
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

      // Check final profit
      const finalPrice = candles[candles.length - 1].close;
      const priceChangePct = ((finalPrice - entryPrice) / entryPrice) * 100;

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

      // Check final profit
      const finalPrice = candles[candles.length - 1].close;
      const priceChangePct = ((entryPrice - finalPrice) / entryPrice) * 100;

      if (priceChangePct > this.MIN_PROFIT_THRESHOLD_PCT) {
        return {
          predictedCorrectly: true,
          exitReason: 'PROFIT_TARGET',
          priceChangePct: -priceChangePct,
        };
      } else if (priceChangePct > 0) {
        return {
          predictedCorrectly: false,
          exitReason: 'PROFIT_TOO_SMALL',
          priceChangePct: -priceChangePct,
        };
      } else {
        return {
          predictedCorrectly: false,
          exitReason: 'LOSS',
          priceChangePct: -priceChangePct,
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

    // Fetch price journey
    const candles = await this.priceDataService.fetchPriceJourney(
      symbol,
      detectedAt,
      timeframe,
      validationWindow,
    );

    if (!candles || candles.length < 2) {
      return null;
    }

    // Validate signal
    const validation = await this.validateSignalWithStopLoss(
      priceAtDetection,
      signalType,
      candles,
      stopLossPct,
    );

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

    // Get unchecked signals
    let query = `
      SELECT ls.* 
      FROM live_signals ls
      LEFT JOIN signal_fact_checks sfc 
        ON ls.signal_name = sfc.signal_name 
        AND ls.timeframe = sfc.timeframe 
        AND ls.timestamp = sfc.detected_at
      WHERE sfc.id IS NULL
    `;

    const params: any[] = [];
    if (symbol) {
      query += ' AND ls.symbol = ?';
      params.push(symbol);
    }

    query += ' ORDER BY ls.timestamp DESC';

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const signals = await this.databaseService.query(query, params);

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
          signal.signal_name,
          signal.signal_type,
          signal.timeframe,
          new Date(signal.timestamp),
          signal.price,
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
    await this.databaseService.execute(
      `INSERT INTO signal_fact_checks (
        signal_name, timeframe, detected_at, price_at_detection,
        actual_move, predicted_correctly, price_change_pct,
        checked_at, candles_elapsed, exit_reason, validation_window
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.signalName,
        result.timeframe,
        result.detectedAt,
        result.priceAtDetection,
        result.actualMove,
        result.predictedCorrectly,
        result.priceChangePct,
        result.checkedAt,
        result.candlesElapsed,
        result.exitReason,
        result.validationWindow,
      ]
    );
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

      // Get complete stats from database
      const dbStats = await this.databaseService.queryOne(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN predicted_correctly = 1 THEN 1 ELSE 0 END) as correct,
          AVG(price_change_pct) as avg_change
        FROM signal_fact_checks
        WHERE signal_name = ? AND timeframe = ?`,
        [signalName, timeframe]
      );

      if (dbStats && dbStats.total > 0) {
        const accuracy = (dbStats.correct / dbStats.total) * 100;

        // Update signals table
        await this.databaseService.execute(
          `UPDATE signals
          SET signal_accuracy = ?,
              sample_size = ?,
              updated_at = ?
          WHERE signal_name = ? AND timeframe = ?`,
          [accuracy, dbStats.total, new Date(), signalName, timeframe]
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
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN predicted_correctly = 1 THEN 1 ELSE 0 END) as correct,
        AVG(price_change_pct) as avg_price_change,
        AVG(CASE WHEN predicted_correctly = 1 THEN price_change_pct ELSE 0 END) as avg_win,
        AVG(CASE WHEN predicted_correctly = 0 THEN price_change_pct ELSE 0 END) as avg_loss,
        SUM(CASE WHEN exit_reason LIKE '%STOPPED_OUT%' THEN 1 ELSE 0 END) as stopped_out
      FROM signal_fact_checks
      WHERE signal_name = ?
    `;

    const params: any[] = [signalName];

    if (timeframe) {
      query += ' AND timeframe = ?';
      params.push(timeframe);
    }

    const result = await this.databaseService.queryOne(query, params);

    if (!result || result.total < minSamples) {
      return null;
    }

    const accuracy = (result.correct / result.total) * 100;
    const profitFactor = result.avg_loss !== 0
      ? Math.abs(result.avg_win / result.avg_loss)
      : 0;

    return {
      signalName,
      timeframe,
      totalSamples: result.total,
      correctPredictions: result.correct,
      accuracy,
      avgPriceChange: result.avg_price_change || 0,
      avgWin: result.avg_win || 0,
      avgLoss: result.avg_loss || 0,
      profitFactor,
      stoppedOut: result.stopped_out || 0,
      stoppedOutRate: (result.stopped_out / result.total * 100) || 0,
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

    // Save to database
    await this.databaseService.execute(
      `INSERT OR REPLACE INTO signal_confidence_adjustments (
        signal_name, timeframe, original_confidence, adjusted_confidence,
        accuracy_rate, sample_size, profit_factor, stopped_out_rate,
        sample_weight, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signalName,
        timeframe,
        originalConf,
        adjustedConf,
        accuracyData.accuracy,
        accuracyData.totalSamples,
        accuracyData.profitFactor,
        accuracyData.stoppedOutRate,
        sampleWeight,
        new Date(),
      ]
    );

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
    const combinations = await this.databaseService.query(
      'SELECT DISTINCT signal_name, timeframe FROM signal_fact_checks'
    );

    const results = {
      totalProcessed: 0,
      adjusted: 0,
      skippedInsufficientSamples: 0,
      adjustments: [],
    };

    for (const { signal_name, timeframe } of combinations) {
      results.totalProcessed++;

      const adjustment = await this.adjustSignalConfidence(
        signal_name,
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
    const result = await this.databaseService.queryOne(
      `SELECT adjusted_confidence FROM signal_confidence_adjustments
       WHERE signal_name = ? AND timeframe = ?`,
      [signalName, timeframe]
    );

    return result ? result.adjusted_confidence : 70; // Default
  }

  /**
   * Get all confidence adjustments
   */
  async getAllAdjustments(): Promise<ConfidenceAdjustment[]> {
    return this.databaseService.query(
      `SELECT * FROM signal_confidence_adjustments
       ORDER BY last_updated DESC`
    );
  }

  /**
   * Generate comprehensive validation report
   */
  async generateValidationReport(): Promise<any> {
    // Overall statistics
    const overall = await this.databaseService.queryOne(`
      SELECT 
        COUNT(*) as total_checks,
        SUM(CASE WHEN predicted_correctly = 1 THEN 1 ELSE 0 END) as correct,
        AVG(price_change_pct) as avg_change,
        SUM(CASE WHEN exit_reason LIKE '%STOPPED_OUT%' THEN 1 ELSE 0 END) as stopped_out
      FROM signal_fact_checks
    `);

    // Exit reasons distribution
    const exitReasons = await this.databaseService.query(`
      SELECT exit_reason, COUNT(*) as count
      FROM signal_fact_checks
      GROUP BY exit_reason
      ORDER BY count DESC
    `);

    // Top performing signals
    const topSignals = await this.databaseService.query(`
      SELECT 
        signal_name, timeframe, COUNT(*) as samples,
        ROUND(AVG(CASE WHEN predicted_correctly = 1 THEN 100.0 ELSE 0.0 END), 2) as accuracy,
        ROUND(AVG(price_change_pct), 3) as avg_change
      FROM signal_fact_checks
      GROUP BY signal_name, timeframe
      HAVING samples >= 20
      ORDER BY accuracy DESC
      LIMIT 10
    `);

    return {
      overall: {
        totalChecks: overall.total_checks,
        correct: overall.correct,
        accuracy: overall.total_checks > 0
          ? (overall.correct / overall.total_checks * 100)
          : 0,
        avgChange: overall.avg_change || 0,
        stoppedOut: overall.stopped_out,
        stoppedOutRate: overall.total_checks > 0
          ? (overall.stopped_out / overall.total_checks * 100)
          : 0,
      },
      exitReasons: exitReasons.reduce((acc, row) => {
        acc[row.exit_reason] = row.count;
        return acc;
      }, {}),
      topSignals: topSignals.map(signal => ({
        signal: `${signal.signal_name}[${signal.timeframe}]`,
        samples: signal.samples,
        accuracy: signal.accuracy,
        avgChange: signal.avg_change,
      })),
    };
  }
}