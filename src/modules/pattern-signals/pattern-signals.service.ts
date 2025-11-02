// src/pattern-analyzer/pattern-analyzer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs/promises';
import { PatternSignal } from './entities/pattern-signal.entity';
import { PatternDto } from './dto/pattern.dto';

@Injectable()
export class PatternAnalyzerService {
  private readonly logger = new Logger(PatternAnalyzerService.name);
  private indicatorPatterns: PatternDto[] = [];
  private running = false;
  private readonly minPatternAccuracy = 0.7;
  private readonly timeframes = {
    '30m': 30, '1h': 60, '2h': 120, '4h': 240,
    '6h': 360, '8h': 480, '12h': 720
  };

  constructor(
    @InjectRepository(PatternSignal)
    private patternSignalRepository: Repository<PatternSignal>,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    await this.loadPatterns();
  }

  async loadPatterns(): Promise<void> {
    try {
      const patternFile = 'patterns.json';
      const exists = await fs.access(patternFile).then(() => true).catch(() => false);

      if (exists) {
        const data = await fs.readFile(patternFile, 'utf-8');
        const patterns: PatternDto[] = JSON.parse(data);

        this.indicatorPatterns = patterns
        .filter(p => p.accuracy >= this.minPatternAccuracy)
        .map(p => ({
          ...p,
          parsed: this.parsePattern(p.indicator)
        }))
        .sort((a, b) => b.accuracy - a.accuracy);

        this.logger.log(`Loaded ${this.indicatorPatterns.length} patterns`);
      }
    } catch (error) {
      this.logger.error(`Failed to load patterns: ${error.message}`);
    }
  }

  parsePattern(patternString: string): ParsedPattern {
    const components = patternString.split(' + ');
    const parsed: ParsedPattern = {
      timeframeIndicators: {},
      requiredCount: components.length
    };

    for (const component of components) {
      const startIdx = component.indexOf('[');
      const endIdx = component.indexOf(']');

      if (startIdx !== -1 && endIdx !== -1) {
        const timeframe = component.substring(startIdx + 1, endIdx);
        const indicator = component.substring(endIdx + 2).trim();

        if (!parsed.timeframeIndicators[timeframe]) {
          parsed.timeframeIndicators[timeframe] = [];
        }
        parsed.timeframeIndicators[timeframe].push(indicator);
      }
    }

    return parsed;
  }

  async getPriorityCoins(): Promise<string[]> {
    try {
      const priorityFile = 'priority_coins.json';
      const exists = await fs.access(priorityFile).then(() => true).catch(() => false);

      if (exists) {
        const data = await fs.readFile(priorityFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logger.error(`Failed to load priority coins: ${error.message}`);
    }
    return [];
  }

  async fetchTabdealSymbols(limit = 100): Promise<string[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://apiv2.tabdeal.ir/market/stats', {
          timeout: 10000
        })
      );

      const coins: Array<{ symbol: string; dayChange: string }> = [];

      for (const [key, val] of Object.entries(response.data.stats)) {
        if (val && typeof val === 'object' && 'dayChange' in val) {
          coins.push({
            symbol: key,
            dayChange: (val as any).dayChange
          });
        }
      }

      const sortedCoins = coins
      .filter(x => x.symbol.toLowerCase().includes('usdt') && parseFloat(x.dayChange) > 0)
      .sort((a, b) => parseFloat(b.dayChange) - parseFloat(a.dayChange));

      return sortedCoins.slice(0, limit).map(c => c.symbol.split('-')[0].toUpperCase());
    } catch (error) {
      this.logger.error(`Failed to fetch tabdeal symbols: ${error.message}`);
      return ['BTC', 'ETH', 'SOL'];
    }
  }

  async monitorAndSave(symbol: string): Promise<void> {
    this.logger.log(`Monitoring ${symbol}...`);
    // Implement monitoring logic
  }

  async startMonitoring(topCoins = 100): Promise<void> {
    this.running = true;
    this.logger.log('Starting pattern monitoring...');

    while (this.running) {
      try {
        const priority = await this.getPriorityCoins();
        const tabdeal = await this.fetchTabdealSymbols(topCoins);

        const symbols = [...priority, ...tabdeal.filter(s => !priority.includes(s))];

        this.logger.log(`Monitoring ${symbols.length} symbols...`);

        for (const symbol of symbols) {
          if (!this.running) break;
          await this.monitorAndSave(symbol);
          await this.sleep(1000);
        }
      } catch (error) {
        this.logger.error(`Monitoring error: ${error.message}`);
        await this.sleep(60000);
      }
    }
  }

  stopMonitoring(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface ParsedPattern {
  timeframeIndicators: Record<string, string[]>;
  requiredCount: number;
}