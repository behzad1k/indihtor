import { SignalValidatorService } from '@modules/trading/signal-validator.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TradingConfig } from '@/database/entities/trading-config.entity';
import { CoinAnalyzerService } from '@/modules/market-data/services/coin-analyzer.service';
import { BuyingQueueService } from '@/modules/trading/buying-queue.service';
import { PositionManagerService } from '@/modules/trading/position-manager.service';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private isRunning = false;
  private currentSymbolIndex = 0;
  private symbols: string[] = [];

  constructor(
    @InjectRepository(TradingConfig)
    private tradingConfigRepo: Repository<TradingConfig>,
    private coinAnalyzer: CoinAnalyzerService,
    private signalValidator: SignalValidatorService,
    private buyingQueueService: BuyingQueueService,
    private positionManager: PositionManagerService,
  ) {}

  async onModuleInit() {
    await this.loadSymbols();
    this.startMonitoring();
  }

  private async loadSymbols() {
    // Fetch from exchange API
    this.symbols = await this.coinAnalyzer.fetchTopSymbols(500);
    this.logger.log(`Loaded ${this.symbols.length} symbols`);
  }

  private startMonitoring() {
    this.isRunning = true;
    this.monitorLoop();
  }

  private async monitorLoop() {
    while (this.isRunning) {
      try {
        // Get next symbol
        const symbol = this.symbols[this.currentSymbolIndex];
        this.currentSymbolIndex = (this.currentSymbolIndex + 1) % this.symbols.length;

        // Analyze symbol (saves to DB automatically)
        const analysis = await this.coinAnalyzer.analyzeSymbol(symbol);

        // Check against all active trading configs
        const activeConfigs = await this.tradingConfigRepo.find({
          where: { isActive: true },
          relations: ['user'],
        });

        for (const config of activeConfigs) {
          await this.evaluateForUser(config, symbol, analysis);
        }

        // Small delay between symbols
        await this.sleep(1000);

      } catch (error) {
        this.logger.error(`Monitoring error: ${error.message}`);
        await this.sleep(5000);
      }
    }
  }

  private async evaluateForUser(config: TradingConfig, symbol: string, analysis: any) {
    // Check if user already has this symbol in queue or positions
    const existing = await this.buyingQueueService.hasSymbol(config.id, symbol);
    if (existing) return;

    const hasPosition = await this.positionManager.hasPosition(config.id, symbol);
    if (hasPosition) return;

    // Validate against user's criteria
    const validation = await this.signalValidator.validate(config, symbol, analysis);

    if (validation.passed && validation.score >= 70) {
      await this.buyingQueueService.addToQueue(config, symbol, validation);
      this.logger.log(`Added ${symbol} to queue for user ${config.user.email}`);
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processBuyingQueues() {
    const activeConfigs = await this.tradingConfigRepo.find({
      where: { isActive: true },
    });

    for (const config of activeConfigs) {
      await this.buyingQueueService.processQueue(config);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorPositions() {
    const activeConfigs = await this.tradingConfigRepo.find({
      where: { isActive: true },
    });

    for (const config of activeConfigs) {
      await this.positionManager.monitorPositions(config);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}