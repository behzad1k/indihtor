import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradingConfig } from '@/database/entities/trading-config.entity';
import { UserBuyingQueue } from '@/database/entities/user-buying-queue.entity';
import { UserPosition } from '@/database/entities/user-position.entity';
import { UserPositionHistory } from '@/database/entities/user-position-history.entity';
import { CreateTradingConfigDto, UpdateTradingConfigDto } from './dto/trading-config.dto';

@Controller('trading')
@UseGuards(JwtAuthGuard)
export class TradingController {
  constructor(
    @InjectRepository(TradingConfig)
    private tradingConfigRepo: Repository<TradingConfig>,
    @InjectRepository(UserBuyingQueue)
    private buyingQueueRepo: Repository<UserBuyingQueue>,
    @InjectRepository(UserPosition)
    private positionRepo: Repository<UserPosition>,
    @InjectRepository(UserPositionHistory)
    private historyRepo: Repository<UserPositionHistory>,
  ) {}

  @Post('configs')
  async createConfig(
    @CurrentUser() user: any,
    @Body() createDto: CreateTradingConfigDto,
  ) {
    const config = this.tradingConfigRepo.create({
      ...createDto,
      user: { id: user.userId },
      currentBankroll: createDto.initialBankroll,
    });

    return this.tradingConfigRepo.save(config);
  }

  @Get('configs')
  async listConfigs(@CurrentUser() user: any) {
    return this.tradingConfigRepo.find({
      where: { user: { id: user.userId } },
      order: { createdAt: 'DESC' },
    });
  }

  @Get('configs/:id')
  async getConfig(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tradingConfigRepo.findOne({
      where: { id, user: { id: user.userId } },
    });
  }

  @Patch('configs/:id')
  async updateConfig(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTradingConfigDto,
  ) {
    await this.tradingConfigRepo.update(
      { id, user: { id: user.userId } },
      updateDto,
    );

    return this.tradingConfigRepo.findOne({
      where: { id, user: { id: user.userId } },
    });
  }

  @Post('configs/:id/activate')
  async toggleActive(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    await this.tradingConfigRepo.update(
      { id, user: { id: user.userId } },
      { isActive },
    );

    return { success: true, isActive };
  }

  @Delete('configs/:id')
  async deleteConfig(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // Only allow deletion if no active positions
    const activePositions = await this.positionRepo.count({
      where: { tradingConfig: { id }, status: 'OPEN' },
    });

    if (activePositions > 0) {
      throw new Error('Cannot delete config with active positions');
    }

    await this.tradingConfigRepo.delete({
      id,
      user: { id: user.userId },
    });

    return { success: true };
  }

  @Get('configs/:id/queue')
  async getBuyingQueue(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.buyingQueueRepo.find({
      where: { tradingConfig: { id } },
      order: { addedAt: 'DESC' },
    });
  }

  @Get('configs/:id/positions')
  async getPositions(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.positionRepo.find({
      where: { tradingConfig: { id }, status: 'OPEN' },
      order: { openedAt: 'DESC' },
    });
  }

  @Get('configs/:id/history')
  async getHistory(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit: number = 50,
  ) {
    return this.historyRepo.find({
      where: { tradingConfig: { id } },
      order: { closedAt: 'DESC' },
      take: limit,
    });
  }

  @Get('configs/:id/stats')
  async getStats(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const config = await this.tradingConfigRepo.findOne({
      where: { id, user: { id: user.userId } },
    });

    const [totalTrades, winningTrades] = await Promise.all([
      this.historyRepo.count({ where: { tradingConfig: { id } } }),
      this.historyRepo.count({
        where: { tradingConfig: { id }, profitLoss: 0 }, // > 0 in actual query
      }),
    ]);

    const history = await this.historyRepo.find({
      where: { tradingConfig: { id } },
    });

    const totalProfitLoss = history.reduce((sum, h) => sum + Number(h.profitLoss), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const roi = ((config.currentBankroll - config.initialBankroll) / config.initialBankroll) * 100;

    const activePositions = await this.positionRepo.count({
      where: { tradingConfig: { id }, status: 'OPEN' },
    });

    const queueCount = await this.buyingQueueRepo.count({
      where: { tradingConfig: { id }, status: 'WAITING' },
    });

    return {
      running: config.isActive,
      initialBankroll: config.initialBankroll,
      currentBankroll: config.currentBankroll,
      totalProfitLoss,
      roi,
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate,
      activePositions,
      buyingQueue: queueCount,
      positionLimit: config.maxPositions,
      positionSize: config.initialBankroll / config.splitBankrollTo,
    };
  }
}