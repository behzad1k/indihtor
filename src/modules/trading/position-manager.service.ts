import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPosition } from '@/database/entities/user-position.entity';
import { UserPositionHistory } from '@/database/entities/user-position-history.entity';
import { TradingConfig } from '@/database/entities/trading-config.entity';
import { LiveSignal } from '@/database/entities/live-signal.entity';
import { ExchangeAggregatorService } from '@/modules/external-api/services/exchange-aggregator.service';

@Injectable()
export class PositionManagerService {
  private readonly logger = new Logger(PositionManagerService.name);
  private readonly EXCHANGE_FEE = 0.1;

  constructor(
    @InjectRepository(UserPosition)
    private positionRepo: Repository<UserPosition>,
    @InjectRepository(UserPositionHistory)
    private historyRepo: Repository<UserPositionHistory>,
    @InjectRepository(TradingConfig)
    private configRepo: Repository<TradingConfig>,
    @InjectRepository(LiveSignal)
    private liveSignalRepo: Repository<LiveSignal>,
    private exchangeService: ExchangeAggregatorService,
  ) {}

  async hasPosition(configId: number, symbol: string): Promise<boolean> {
    const count = await this.positionRepo.count({
      where: {
        tradingConfig: { id: configId },
        symbol,
        status: 'OPEN',
      },
    });

    return count > 0;
  }

  async countActivePositions(configId: number): Promise<number> {
    return this.positionRepo.count({
      where: {
        tradingConfig: { id: configId },
        status: 'OPEN',
      },
    });
  }

  async openPosition(positionData: Partial<UserPosition>): Promise<UserPosition> {
    const position = this.positionRepo.create(positionData);
    return this.positionRepo.save(position);
  }

  async monitorPositions(config: TradingConfig): Promise<void> {
    const positions = await this.positionRepo.find({
      where: {
        tradingConfig: { id: config.id },
        status: 'OPEN',
      },
    });

    for (const position of positions) {
      try {
        await this.checkExitConditions(config, position);
      } catch (error) {
        this.logger.error(`Error monitoring position ${position.id}: ${error.message}`);
      }
    }
  }

  private async checkExitConditions(
    config: TradingConfig,
    position: UserPosition,
  ): Promise<void> {
    // Get current price
    const priceData = await this.exchangeService.getCurrentPrice(position.symbol);
    if (!priceData) {
      return;
    }

    const currentPrice = priceData.price;
    let exitReason: string | null = null;

    // Check take profit
    if (currentPrice >= position.targetProfitPrice) {
      exitReason = 'TAKE_PROFIT';
    }

    // Check stop loss
    // if (currentPrice <= position.stopLossPrice) {
    //   exitReason = 'STOP_LOSS';
    // }

    // Check strong sell signals
    const strongSellCount = await this.liveSignalRepo.count({
      where: {
        symbol: position.symbol,
        signalType: 'SELL',
        confidence: 75, // >= 75
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // last 30 min
      },
    });

    if (strongSellCount >= 5) {
      exitReason = 'STRONG_SELL_SIGNALS';
    }

    if (exitReason) {
      await this.executeExit(config, position, currentPrice, exitReason);
    }
  }

  private async executeExit(
    config: TradingConfig,
    position: UserPosition,
    exitPrice: number,
    exitReason: string,
  ): Promise<void> {
    const grossExitValue = position.quantity * exitPrice;
    const exitFee = grossExitValue * (this.EXCHANGE_FEE / 100);
    const netExitValue = grossExitValue - exitFee;

    const totalFees = position.entryFee + exitFee;
    const profitLoss = netExitValue - (position.positionSize - position.entryFee);
    const profitLossPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

    const durationSeconds = Math.floor(
      (Date.now() - position.openedAt.getTime()) / 1000,
    );

    // Save to history
    const history = this.historyRepo.create({
      tradingConfig: config,
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      exitPrice,
      entryFee: position.entryFee,
      exitFee,
      positionSize: position.positionSize,
      quantity: position.quantity,
      profitLoss,
      profitLossPct,
      openedAt: position.openedAt,
      durationSeconds,
      exitReason,
      entryValidationData: position.entryValidationData,
    });

    await this.historyRepo.save(history);

    // Update bankroll
    config.currentBankroll += netExitValue;
    await this.configRepo.update(config.id, { currentBankroll: config.currentBankroll });

    // Remove position
    await this.positionRepo.delete(position.id);

    const emoji = profitLoss > 0 ? '🟢' : '🔴';
    this.logger.log(
      `${emoji} Position closed: ${position.symbol} | Reason: ${exitReason} | P/L: ${profitLoss.toFixed(2)} (${profitLossPct.toFixed(2)}%)`,
    );
  }
}