import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserBuyingQueue } from '@/database/entities/user-buying-queue.entity';
import { TradingConfig } from '@/database/entities/trading-config.entity';
import { PositionManagerService } from './position-manager.service';
import { ExchangeAggregatorService } from '@/modules/external-api/services/exchange-aggregator.service';

@Injectable()
export class BuyingQueueService {
  private readonly logger = new Logger(BuyingQueueService.name);
  private readonly EXCHANGE_FEE = 0.1; // 0.1%

  constructor(
    @InjectRepository(UserBuyingQueue)
    private queueRepo: Repository<UserBuyingQueue>,
    private positionManager: PositionManagerService,
    private exchangeService: ExchangeAggregatorService,
  ) {}

  async hasSymbol(configId: number, symbol: string): Promise<boolean> {
    const count = await this.queueRepo.count({
      where: {
        tradingConfig: { id: configId },
        symbol,
        status: 'WAITING',
      },
    });

    return count > 0;
  }

  async addToQueue(
    config: TradingConfig,
    symbol: string,
    validation: any,
  ): Promise<void> {
    const currentPrice = validation.data.currentPrice || 0;
    const targetPrice = currentPrice * (1 - config.minBuyingWindowPct / 100);
    const expiresAt = new Date(Date.now() + config.maxBuyingWindowTime * 1000);

    const queueItem = this.queueRepo.create({
      tradingConfig: config,
      symbol,
      detectedPrice: currentPrice,
      targetPrice,
      signalScore: validation.score,
      expiresAt,
      status: 'WAITING',
      validationData: validation.data,
    });

    await this.queueRepo.save(queueItem);
    this.logger.log(`Added ${symbol} to queue for config ${config.id}`);
  }

  async processQueue(config: TradingConfig): Promise<void> {
    // Clean expired entries first
    await this.queueRepo.update(
      {
        tradingConfig: { id: config.id },
        status: 'WAITING',
        expiresAt: LessThan(new Date()),
      },
      { status: 'EXPIRED' },
    );

    // Get active queue items
    const queueItems = await this.queueRepo.find({
      where: {
        tradingConfig: { id: config.id },
        status: 'WAITING',
      },
      order: { signalScore: 'DESC' },
    });

    for (const item of queueItems) {
      try {
        await this.checkAndExecuteBuy(config, item);
      } catch (error) {
        this.logger.error(`Error processing queue item ${item.id}: ${error.message}`);
      }
    }
  }

  private async checkAndExecuteBuy(
    config: TradingConfig,
    queueItem: UserBuyingQueue,
  ): Promise<void> {
    // Check if max positions reached
    const activePositions = await this.positionManager.countActivePositions(config.id);
    if (activePositions >= config.maxPositions) {
      return;
    }

    // Check if enough bankroll
    const positionSize = config.initialBankroll / config.splitBankrollTo;
    if (config.currentBankroll < positionSize) {
      return;
    }

    // Get current price
    const priceData = await this.exchangeService.getCurrentPrice(queueItem.symbol);
    if (!priceData) {
      this.logger.warn(`Could not fetch price for ${queueItem.symbol}`);
      return;
    }

    const currentPrice = priceData.price;

    // Check if price dropped to target (or just execute immediately if minBuyingWindowPct is 0)
    if (currentPrice <= queueItem.targetPrice || config.minBuyingWindowPct === 0) {
      this.logger.log(`Executing buy for ${queueItem.symbol} at ${currentPrice}`);

      // Execute buy
      await this.executeBuy(config, queueItem, currentPrice);

      // Mark as executed
      await this.queueRepo.update(queueItem.id, { status: 'EXECUTED' });
    }
  }

  private async executeBuy(
    config: TradingConfig,
    queueItem: UserBuyingQueue,
    entryPrice: number,
  ): Promise<void> {
    const positionSize = config.initialBankroll / config.splitBankrollTo;
    const entryFee = positionSize * (this.EXCHANGE_FEE / 100);
    const netInvestment = positionSize - entryFee;
    const quantity = netInvestment / entryPrice;

    const targetProfitPrice = entryPrice * (1 + config.maxProfitThresholdPct / 100);
    const stopLossPrice = entryPrice * (1 - config.stopLossPct / 100);

    await this.positionManager.openPosition({
      tradingConfig: config,
      symbol: queueItem.symbol,
      entryPrice,
      entryFee,
      positionSize,
      quantity,
      targetProfitPrice,
      stopLossPrice,
      entryValidationData: queueItem.validationData,
    });

    // Update bankroll
    config.currentBankroll -= positionSize;
    await this.updateConfigBankroll(config.id, config.currentBankroll);

    this.logger.log(
      `Position opened: ${queueItem.symbol} @ ${entryPrice}, size: ${positionSize}`,
    );
  }

  private async updateConfigBankroll(configId: number, newBankroll: number): Promise<void> {
    await this.queueRepo.manager.update(
      TradingConfig,
      { id: configId },
      { currentBankroll: newBankroll },
    );
  }
}