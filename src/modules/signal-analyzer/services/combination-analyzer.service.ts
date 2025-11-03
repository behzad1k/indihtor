import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveTfCombo } from '@/database/entities/live-tf-combo.entity';
import { TfCombo } from '@/database/entities/tf-combo.entity';
import { Signal } from '@/database/entities/signal.entity';

@Injectable()
export class CombinationAnalyzerService {
  private readonly logger = new Logger(CombinationAnalyzerService.name);

  constructor(
    @InjectRepository(LiveTfCombo)
    private liveTfComboRepo: Repository<LiveTfCombo>,
    @InjectRepository(TfCombo)
    private tfComboRepo: Repository<TfCombo>,
    @InjectRepository(Signal)
    private signalRepo: Repository<Signal>,
  ) {}

  async analyzeLiveCombinations(
    symbol: string,
    analysisResult: any,
    minAccuracy: number,
  ): Promise<Record<string, any[]>> {
    const combinations: Record<string, any[]> = {};

    try {
      for (const [timeframe, tfData] of Object.entries(analysisResult.timeframes)) {
        if ('error' in (tfData as any)) continue;

        const signals = Object.keys((tfData as any).signals);
        if (signals.length < 2) continue;

        // Get matching combinations from tf_combos
        const matchingCombos = await this.findMatchingCombinations(
          signals,
          timeframe,
          minAccuracy,
        );

        if (matchingCombos.length > 0) {
          // Save live combos
          for (const combo of matchingCombos) {
            await this.saveLiveCombo(symbol, timeframe, combo, tfData);
          }

          combinations[timeframe] = matchingCombos;
        }
      }

      return combinations;
    } catch (error) {
      this.logger.error(`Combination analysis error: ${error.message}`);
      return {};
    }
  }

  private async findMatchingCombinations(
    activeSignals: string[],
    timeframe: string,
    minAccuracy: number,
  ): Promise<any[]> {
    const signalSet = new Set(activeSignals);
    const matches: any[] = [];

    // Get all combos for this timeframe with min accuracy
    const combos = await this.tfComboRepo
    .createQueryBuilder('combo')
    .where('combo.timeframe = :timeframe', { timeframe })
    .andWhere('combo.accuracy >= :minAcc', { minAcc: minAccuracy })
    .getMany();

    for (const combo of combos) {
      const comboSignals = combo.signalName.split('+');
      const allPresent = comboSignals.every(sig => signalSet.has(sig));

      if (allPresent) {
        matches.push(combo);
      }
    }

    return matches;
  }

  private async saveLiveCombo(
    symbol: string,
    timeframe: string,
    combo: any,
    tfData: any,
  ): Promise<void> {
    try {
      // Check if already exists (within last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existing = await this.liveTfComboRepo.findOne({
        where: {
          symbol,
          timeframe,
          comboSignalName: combo.signalName,
          timestamp: oneHourAgo,
        },
      });

      if (existing) {
        return; // Don't duplicate
      }

      const liveCombo = this.liveTfComboRepo.create({
        symbol,
        timeframe,
        comboSignalName: combo.signalName,
        accuracy: combo.accuracy,
        signalAccuracies: JSON.stringify({}),
        signalSamples: JSON.stringify({}),
        comboPriceChange: combo.avgPriceChange || 0,
        minWindow: 0,
        maxWindow: 0,
        timestamp: new Date(tfData.timestamp),
      });

      await this.liveTfComboRepo.save(liveCombo);
    } catch (error) {
      // Ignore duplicate errors
      if (!error.message.includes('UNIQUE constraint')) {
        this.logger.error(`Failed to save live combo: ${error.message}`);
      }
    }
  }
}