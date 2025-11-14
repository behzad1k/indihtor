/**
 * OPTIMIZED Signal Combinations Service
 *
 * Analyzes signal combinations for both single-timeframe and cross-timeframe patterns
 *
 * OPTIMIZATIONS APPLIED:
 * 1. Uses signal_fact_checks table ONLY (no live_signals queries)
 * 2. Analyzes ALL fact-checked signals (filtering happens via minSamples/minAccuracy params)
 * 3. Limits combination size to max 3 signals by default
 * 4. Batch processing with progress tracking
 * 5. Caches intermediate results (signal statistics)
 * 6. More efficient database queries with proper indexes
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TfCombo } from '@database/entities/tf-combo.entity';
import { CrossTfCombo } from '@database/entities/cross-tf-combo.entity';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { SignalFactCheck } from '@database/entities/signal-fact-check.entity';
import * as crypto from 'crypto';

interface CombinationStats {
  combination: string;
  sample_count: number;
  correct_predictions: number;
  accuracy: number;
  avg_price_change: number;
  profit_factor: number;
}

interface CrossTfStats {
  combo_signature: string;
  timeframes: string[];
  signal_names: string[];
  sample_count: number;
  correct_predictions: number;
  accuracy: number;
  avg_price_change: number;
  profit_factor: number;
  num_timeframes: number;
}

export interface AnalysisResults {
  analyzed: number;
  skipped_insufficient_samples: number;
  combinations: CombinationStats[];
}

export interface CrossTfAnalysisResults {
  analyzed: number;
  skipped_insufficient_samples: number;
  combinations: CrossTfStats[];
}

// OPTIMIZATION 6: Cache structure
interface SignalCacheEntry {
  signalName: string;
  timeframe: string;
  accuracy: number;
  sampleSize: number;
  profitFactor: number;
  timestamp: number;
}

@Injectable()
export class SignalCombinationService {
  private readonly logger = new Logger(SignalCombinationService.name);

  private readonly MIN_SAMPLE_SIZE = 20;
  private readonly MIN_ACCURACY = 60.0;

  // OPTIMIZATION 3: Limit combination size
  private readonly MAX_COMBO_SIZE = 3;

  // OPTIMIZATION 4: Batch processing
  private readonly BATCH_SIZE = 500;

  // OPTIMIZATION 6: Caching
  private signalCache: Map<string, SignalCacheEntry> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(
    @InjectRepository(TfCombo)
    private tfComboRepository: Repository<TfCombo>,
    @InjectRepository(CrossTfCombo)
    private crossTfComboRepository: Repository<CrossTfCombo>,
    @InjectRepository(LiveSignal)
    private liveSignalRepository: Repository<LiveSignal>,
    @InjectRepository(SignalFactCheck)
    private signalFactCheckRepository: Repository<SignalFactCheck>,
  ) {}

  /**
   * Analyze single-timeframe signal combinations
   * OPTIMIZED: Uses signal_fact_checks directly with pre-filtering
   */
  async analyzeCombinations(
    timeframe: string,
    minSamples: number = 20,
    minComboSize: number = 2,
    maxComboSize: number = 5,
    minAccuracy: number = 60,
    maxCombinations?: number,
  ): Promise<AnalysisResults> {
    const startTime = Date.now();

    // OPTIMIZATION 3: Cap max combo size
    const effectiveMaxSize = Math.min(maxComboSize, this.MAX_COMBO_SIZE);

    this.logger.log(
      `Analyzing combinations for ${timeframe} (size: ${minComboSize}-${effectiveMaxSize}, minAccuracy: ${minAccuracy}%)`,
    );

    const results: AnalysisResults = {
      analyzed: 0,
      skipped_insufficient_samples: 0,
      combinations: [],
    };

    // OPTIMIZATION 1: Get all fact-checked signals from signal_fact_checks
    const signalNames = await this.getAllFactCheckedSignals(timeframe);

    if (signalNames.length === 0) {
      this.logger.warn(`No fact-checked signals found for ${timeframe}`);
      return results;
    }

    this.logger.log(`Found ${signalNames.length} fact-checked signals for ${timeframe}`);

    // Generate and process combinations size by size (don't load all at once)
    for (let size = minComboSize; size <= effectiveMaxSize; size++) {
      this.logger.log(`Processing combinations of size ${size}...`);

      const combinations = this.generateCombinations(signalNames, size);
      const totalForSize = combinations.length;

      this.logger.log(`  Generated ${totalForSize} combinations of size ${size}`);

      // OPTIMIZATION 4: Batch processing
      const batches = this.createBatches(combinations, this.BATCH_SIZE);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];

        const batchResults = await Promise.all(
          batch.map(combo => this.analyzeSingleCombination(combo, timeframe, minSamples))
        );

        for (const stats of batchResults) {
          if (stats) {
            // Only save if meets minimum accuracy
            if (stats.accuracy >= minAccuracy) {
              results.analyzed++;
              results.combinations.push(stats);

              await this.saveTfCombinationResult(stats, timeframe);

              // Check if we've hit max combinations limit
              if (maxCombinations && results.analyzed >= maxCombinations) {
                this.logger.log(`Reached max combinations limit: ${maxCombinations}`);
                const elapsed = (Date.now() - startTime) / 1000;
                this.logger.log(`Analysis completed in ${elapsed.toFixed(2)}s`);
                return results;
              }
            }
          } else {
            results.skipped_insufficient_samples++;
          }
        }

        // Progress logging
        const processedInSize = Math.min((batchIdx + 1) * this.BATCH_SIZE, totalForSize);
        const progressPct = (processedInSize / totalForSize * 100).toFixed(1);
        this.logger.log(`    Progress: ${processedInSize}/${totalForSize} (${progressPct}%) - ${results.analyzed} saved so far`);
      }

      this.logger.log(`  ✓ Completed size ${size}`);
    }

    const elapsed = (Date.now() - startTime) / 1000;
    this.logger.log(
      `✅ Analysis complete in ${elapsed.toFixed(2)}s: ${results.analyzed} combinations saved`,
    );

    return results;
  }

  /**
   * Analyze cross-timeframe signal combinations
   * OPTIMIZED: Uses signal_fact_checks directly
   */
  async analyzeCrossTfCombinations(
    minSamples: number = 20,
    minComboSize: number = 2,
    maxComboSize: number = 4,
    minAccuracy: number = 60,
    minTimeframes: number = 2,
    maxTimeframes?: number,
    maxCombinations?: number,
  ): Promise<CrossTfAnalysisResults> {
    const startTime = Date.now();

    // OPTIMIZATION 3: Cap max combo size
    const effectiveMaxSize = Math.min(maxComboSize, this.MAX_COMBO_SIZE);

    this.logger.log(
      `Analyzing cross-timeframe combinations (size: ${minComboSize}-${effectiveMaxSize}, TFs: ${minTimeframes}${maxTimeframes ? '-' + maxTimeframes : '+'})`,
    );

    const results: CrossTfAnalysisResults = {
      analyzed: 0,
      skipped_insufficient_samples: 0,
      combinations: [],
    };

    // OPTIMIZATION 1: Get all signal-timeframe pairs from signal_fact_checks
    const signalPairs = await this.getAllFactCheckedSignalPairs();

    if (signalPairs.length === 0) {
      this.logger.warn('No fact-checked signal pairs found');
      return results;
    }

    this.logger.log(`Found ${signalPairs.length} unique signal-timeframe pairs`);

    // Generate cross-timeframe combinations for each size
    const allCombinations: Array<Array<{ signalName: string; timeframe: string }>> = [];
    let totalCombinations = 0;

    for (let size = minComboSize; size <= effectiveMaxSize; size++) {
      const combinations = this.generateCrossTfCombinations(signalPairs, size);

      // Filter by timeframe count requirements
      const filteredCombos = combinations.filter(combo => {
        const uniqueTfs = new Set(combo.map(sp => sp.timeframe));
        const tfCount = uniqueTfs.size;
        return (
          tfCount >= minTimeframes &&
          (!maxTimeframes || tfCount <= maxTimeframes)
        );
      });

      allCombinations.push(...filteredCombos);
      totalCombinations += filteredCombos.length;
    }

    this.logger.log(`Generated ${totalCombinations} cross-tf combinations to analyze`);

    // OPTIMIZATION 4: Batch processing
    const batches = this.createBatches(allCombinations, this.BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      const batchResults = await Promise.all(
        batch.map(combo => this.analyzeCrossTfCombination(combo, minSamples))
      );

      for (const stats of batchResults) {
        if (stats) {
          // Only save if meets minimum accuracy
          if (stats.accuracy >= minAccuracy) {
            results.analyzed++;
            results.combinations.push(stats);

            await this.saveCrossTfCombinationResult(stats);

            // Check if we've hit max combinations limit
            if (maxCombinations && results.analyzed >= maxCombinations) {
              this.logger.log(`Reached max combinations limit: ${maxCombinations}`);
              const elapsed = (Date.now() - startTime) / 1000;
              this.logger.log(`Cross-TF analysis completed in ${elapsed.toFixed(2)}s`);
              return results;
            }
          }
        } else {
          results.skipped_insufficient_samples++;
        }
      }

      // Progress logging
      const progress = Math.min((batchIdx + 1) * this.BATCH_SIZE, totalCombinations);
      const progressPct = (progress / totalCombinations * 100).toFixed(1);
      this.logger.log(`Progress: ${progress}/${totalCombinations} (${progressPct}%)`);
    }

    const elapsed = (Date.now() - startTime) / 1000;
    this.logger.log(
      `Cross-TF analysis complete in ${elapsed.toFixed(2)}s: ${results.analyzed}/${totalCombinations} combinations analyzed`,
    );

    return results;
  }

  /**
   * OPTIMIZATION 1: Get ALL fact-checked signals (no pre-filtering)
   * Filtering happens later based on minSamples and minAccuracy parameters
   */
  private async getAllFactCheckedSignals(timeframe: string): Promise<string[]> {
    // Check cache first (OPTIMIZATION 6)
    const cacheKey = `signals:${timeframe}`;
    const cachedSignals = this.getCachedSignals(timeframe);
    if (cachedSignals.length > 0) {
      this.logger.debug(`Using cached signals for ${timeframe} (${cachedSignals.length} signals)`);
      return cachedSignals.map(s => s.signalName);
    }

    this.logger.debug('Fetching ALL fact-checked signals from signal_fact_checks...');

    // Query ALL signals with fact-checks - no filtering
    const query = `
      SELECT DISTINCT
        signal_name as signalName,
        COUNT(*) as sampleSize,
        AVG(CASE WHEN predicted_correctly = 1 THEN 100.0 ELSE 0.0 END) as accuracy
      FROM signal_fact_checks
      WHERE timeframe = ?
      GROUP BY signal_name
      ORDER BY signal_name
    `;

    const results = await this.signalFactCheckRepository.query(query, [timeframe]);

    // Cache all signals (no filtering)
    const signalNames: string[] = [];

    for (const row of results) {
      signalNames.push(row.signalName);

      // OPTIMIZATION 6: Cache the signal stats
      const cacheEntry: SignalCacheEntry = {
        signalName: row.signalName,
        timeframe,
        accuracy: parseFloat(row.accuracy),
        sampleSize: parseInt(row.sampleSize),
        profitFactor: 0, // Not calculated upfront anymore
        timestamp: Date.now(),
      };
      this.signalCache.set(`${row.signalName}:${timeframe}`, cacheEntry);
    }

    this.logger.debug(
      `Found ${signalNames.length} signals with fact-checks for ${timeframe}`
    );

    return signalNames;
  }

  /**
   * OPTIMIZATION 1: Get ALL signal-timeframe pairs from signal_fact_checks (no pre-filtering)
   */
  private async getAllFactCheckedSignalPairs(): Promise<Array<{ signalName: string; timeframe: string }>> {
    const query = `
      SELECT DISTINCT
        signal_name as signalName,
        timeframe
      FROM signal_fact_checks
      ORDER BY timeframe, signal_name
    `;

    const results = await this.signalFactCheckRepository.query(query);

    this.logger.debug(`Found ${results.length} signal-timeframe pairs with fact-checks`);

    return results;
  }

  /**
   * OPTIMIZATION 6: Get cached signals
   */
  private getCachedSignals(timeframe: string): SignalCacheEntry[] {
    const now = Date.now();
    const cached: SignalCacheEntry[] = [];

    for (const [key, entry] of this.signalCache.entries()) {
      if (entry.timeframe === timeframe && (now - entry.timestamp) < this.CACHE_TTL) {
        cached.push(entry);
      }
    }

    return cached;
  }

  /**
   * Calculate profit factor for a signal
   */
  private async calculateProfitFactor(signalName: string, timeframe: string): Promise<number> {
    const wins = await this.signalFactCheckRepository.find({
      where: {
        signalName,
        timeframe,
        predictedCorrectly: true,
      },
      select: ['priceChangePct'],
    });

    const losses = await this.signalFactCheckRepository.find({
      where: {
        signalName,
        timeframe,
        predictedCorrectly: false,
      },
      select: ['priceChangePct'],
    });

    if (wins.length === 0) return 0;
    if (losses.length === 0) return 999; // All wins

    const avgWin = wins.reduce((sum, w) => sum + Math.abs(Number(w.priceChangePct)), 0) / wins.length;
    const avgLoss = losses.reduce((sum, l) => sum + Math.abs(Number(l.priceChangePct)), 0) / losses.length;

    return avgLoss > 0 ? avgWin / avgLoss : 0;
  }

  /**
   * OPTIMIZATION 4: Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Analyze a single combination
   * OPTIMIZED: Uses signal_fact_checks directly
   */
  private async analyzeSingleCombination(
    signalNames: string[],
    timeframe: string,
    minSamples: number,
  ): Promise<CombinationStats | null> {
    // OPTIMIZATION 1: Query signal_fact_checks directly to find co-occurrences
    // Group by timestamp to find when signals occurred together
    const query = `
      SELECT 
        detected_at,
        COUNT(DISTINCT signal_name) as signal_count,
        AVG(CASE WHEN predicted_correctly = 1 THEN 1 ELSE 0 END) as correct,
        AVG(price_change_pct) as avg_change
      FROM signal_fact_checks
      WHERE 
        timeframe = ?
        AND signal_name IN (${signalNames.map(() => '?').join(',')})
      GROUP BY detected_at
      HAVING COUNT(DISTINCT signal_name) = ?
    `;

    const params = [timeframe, ...signalNames, signalNames.length];
    const occurrences = await this.signalFactCheckRepository.query(query, params);

    if (occurrences.length < minSamples) {
      return null;
    }

    // Calculate statistics
    let correctPredictions = 0;
    let totalPriceChange = 0;

    for (const occ of occurrences) {
      if (Number(occ.correct) === 1) {
        correctPredictions++;
      }
      totalPriceChange += Number(occ.avg_change);
    }

    const accuracy = (correctPredictions / occurrences.length) * 100;
    const avgPriceChange = totalPriceChange / occurrences.length;

    // Calculate profit factor
    const wins = occurrences.filter(o => Number(o.correct) === 1);
    const losses = occurrences.filter(o => Number(o.correct) === 0);

    const avgWin = wins.length > 0
      ? wins.reduce((sum, w) => sum + Math.abs(Number(w.avg_change)), 0) / wins.length
      : 0;

    const avgLoss = losses.length > 0
      ? losses.reduce((sum, l) => sum + Math.abs(Number(l.avg_change)), 0) / losses.length
      : 0;

    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

    return {
      combination: signalNames.join(' + '),
      sample_count: occurrences.length,
      correct_predictions: correctPredictions,
      accuracy,
      avg_price_change: avgPriceChange,
      profit_factor: profitFactor,
    };
  }

  /**
   * Analyze a cross-timeframe combination
   * OPTIMIZED: Uses signal_fact_checks with time-window matching
   */
  private async analyzeCrossTfCombination(
    signalPairs: Array<{ signalName: string; timeframe: string }>,
    minSamples: number,
  ): Promise<CrossTfStats | null> {
    const timeframesSet = new Set(signalPairs.map(sp => sp.timeframe));
    const timeframes = Array.from(timeframesSet);
    const signalNames = signalPairs.map(sp => sp.signalName);

    // Find base timeframe (shortest interval)
    const baseSignalPair = signalPairs[0];

    // Get base signal fact checks
    const baseChecks = await this.signalFactCheckRepository.find({
      where: {
        signalName: baseSignalPair.signalName,
        timeframe: baseSignalPair.timeframe,
      },
      order: { detectedAt: 'DESC' },
      take: 500, // Limit for performance
    });

    let validCombos = 0;
    let correctPredictions = 0;
    let totalPriceChange = 0;

    // For each base occurrence, check if other signals existed within time window
    const timeWindow = 3600000; // 1 hour

    for (const baseCheck of baseChecks) {
      let allSignalsPresent = true;

      for (const sp of signalPairs) {
        if (sp.signalName === baseSignalPair.signalName && sp.timeframe === baseSignalPair.timeframe) {
          continue;
        }

        // Check if this signal existed within time window
        const found = await this.signalFactCheckRepository
        .createQueryBuilder('sfc')
        .where('sfc.signalName = :signalName', { signalName: sp.signalName })
        .andWhere('sfc.timeframe = :timeframe', { timeframe: sp.timeframe })
        .andWhere('ABS(TIMESTAMPDIFF(SECOND, sfc.detectedAt, :baseTime)) <= :window', {
          baseTime: baseCheck.detectedAt,
          window: timeWindow / 1000,
        })
        .getOne();

        if (!found) {
          allSignalsPresent = false;
          break;
        }
      }

      if (allSignalsPresent) {
        validCombos++;

        if (baseCheck.predictedCorrectly) {
          correctPredictions++;
        }
        totalPriceChange += Number(baseCheck.priceChangePct);
      }
    }

    if (validCombos < minSamples) {
      return null;
    }

    const accuracy = (correctPredictions / validCombos) * 100;
    const avgPriceChange = totalPriceChange / validCombos;

    // Create signature
    const signatureParts = signalPairs.map(sp => `${sp.signalName}@${sp.timeframe}`);
    const comboSignature = signatureParts.sort().join('+');

    // Calculate profit factor (simplified)
    const profitFactor = accuracy > 50 ? (avgPriceChange > 0 ? 1.5 : 0.5) : 0.5;

    return {
      combo_signature: comboSignature,
      timeframes,
      signal_names: signalNames,
      sample_count: validCombos,
      correct_predictions: correctPredictions,
      accuracy,
      avg_price_change: avgPriceChange,
      profit_factor: profitFactor,
      num_timeframes: timeframes.length,
    };
  }

  /**
   * Save single-timeframe combination to tf_combos table
   */
  private async saveTfCombinationResult(
    stats: CombinationStats,
    timeframe: string,
  ): Promise<void> {
    try {
      const combo = this.tfComboRepository.create({
        signalName: stats.combination,
        signalNameHash: this.hashString(stats.combination),
        timeframe,
        accuracy: stats.accuracy,
        signalsCount: stats.sample_count,
        avgPriceChange: stats.avg_price_change,
        profitFactor: stats.profit_factor,
        comboSize: stats.combination.split(' + ').length,
        correctPredictions: stats.correct_predictions,
      });

      await this.tfComboRepository.save(combo);
    } catch (error) {
      // Likely duplicate, ignore
      if (!error.message?.includes('Duplicate')) {
        this.logger.warn(`Failed to save tf_combo: ${error.message}`);
      }
    }
  }

  /**
   * Save cross-timeframe combination to cross_tf_combos table
   */
  private async saveCrossTfCombinationResult(stats: CrossTfStats): Promise<void> {
    try {
      const combo = this.crossTfComboRepository.create({
        comboSignature: stats.combo_signature,
        comboSignatureHash: this.hashString(stats.combo_signature),
        timeframes: stats.timeframes.join(','),
        signalNames: stats.signal_names.join(','),
        accuracy: stats.accuracy,
        signalsCount: stats.sample_count,
        correctPredictions: stats.correct_predictions,
        avgPriceChange: stats.avg_price_change,
        profitFactor: stats.profit_factor,
        comboSize: stats.signal_names.length,
        numTimeframes: stats.num_timeframes,
      });

      await this.crossTfComboRepository.save(combo);
    } catch (error) {
      // Likely duplicate, ignore
      if (!error.message?.includes('Duplicate')) {
        this.logger.warn(`Failed to save cross_tf_combo: ${error.message}`);
      }
    }
  }

  /**
   * Get top performing combinations
   */
  async getTopCombinations(
    timeframe?: string,
    limit: number = 20,
    minAccuracy: number = 60,
  ): Promise<any[]> {
    const query = this.tfComboRepository
    .createQueryBuilder('combo')
    .where('combo.accuracy >= :minAccuracy', { minAccuracy })
    .andWhere('combo.signalsCount >= :minSamples', { minSamples: this.MIN_SAMPLE_SIZE });

    if (timeframe) {
      query.andWhere('combo.timeframe = :timeframe', { timeframe });
    }

    query
    .orderBy('combo.accuracy', 'DESC')
    .addOrderBy('combo.profitFactor', 'DESC')
    .limit(limit);

    return query.getMany();
  }

  /**
   * Get top cross-timeframe combinations
   */
  async getTopCrossTfCombinations(
    minAccuracy: number = 60,
    minTimeframes: number = 2,
    limit: number = 20,
  ): Promise<any[]> {
    return this.crossTfComboRepository
    .createQueryBuilder('combo')
    .where('combo.accuracy >= :minAccuracy', { minAccuracy })
    .andWhere('combo.signalsCount >= :minSamples', { minSamples: this.MIN_SAMPLE_SIZE })
    .andWhere('combo.num_timeframes >= :minTimeframes', { minTimeframes })
    .orderBy('combo.accuracy', 'DESC')
    .addOrderBy('combo.profitFactor', 'DESC')
    .limit(limit)
    .getMany();
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.signalCache.clear();
    this.logger.log('Signal cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;

    for (const entry of this.signalCache.values()) {
      if (now - entry.timestamp < this.CACHE_TTL) {
        validEntries++;
      }
    }

    return {
      totalEntries: this.signalCache.size,
      validEntries,
      cacheTTL: this.CACHE_TTL,
    };
  }

  /**
   * Generate all combinations of size k from array (iterative to avoid stack overflow)
   */
  private generateCombinations<T>(arr: T[], k: number): T[][] {
    const result: T[][] = [];
    const n = arr.length;

    if (k > n || k <= 0) {
      return result;
    }

    if (k === 1) {
      return arr.map(item => [item]);
    }

    // Use iterative approach with indices
    const indices: number[] = Array.from({ length: k }, (_, i) => i);

    while (true) {
      // Add current combination
      result.push(indices.map(i => arr[i]));

      // Find the rightmost index that can be incremented
      let i = k - 1;
      while (i >= 0 && indices[i] === n - k + i) {
        i--;
      }

      // No more combinations
      if (i < 0) {
        break;
      }

      // Increment this index
      indices[i]++;

      // Reset all indices to the right
      for (let j = i + 1; j < k; j++) {
        indices[j] = indices[j - 1] + 1;
      }
    }

    return result;
  }

  /**
   * Generate cross-timeframe combinations
   */
  private generateCrossTfCombinations(
    signalPairs: Array<{ signalName: string; timeframe: string }>,
    size: number,
  ): Array<Array<{ signalName: string; timeframe: string }>> {
    return this.generateCombinations(signalPairs, size);
  }

  /**
   * Hash string using SHA-256
   */
  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}