import { CrossTfCombo } from '@database/entities/cross-tf-combo.entity';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { LiveTfCombo } from '@database/entities/live-tf-combo.entity';
import { TradingConfig } from '@database/entities/trading-config.entity';
import { UserBuyingQueue } from '@database/entities/user-buying-queue.entity';
import { UserPositionHistory } from '@database/entities/user-position-history.entity';
import { UserPosition } from '@database/entities/user-position.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TradingController } from './trading.controller';
import { MonitoringService } from '@/modules/monitor/monitoring.service';
import { SignalValidatorService } from './signal-validator.service';
import { BuyingQueueService } from './buying-queue.service';
import { PositionManagerService } from './position-manager.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { ExternalApiModule } from '../external-api/external-api.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      TradingConfig,
      UserBuyingQueue,
      UserPosition,
      UserPositionHistory,
      LiveSignal,
      LiveTfCombo,
      CrossTfCombo,
    ]),
    MarketDataModule,
    ExternalApiModule,
  ],
  controllers: [TradingController],
  providers: [
    MonitoringService,
    SignalValidatorService,
    BuyingQueueService,
    PositionManagerService,
  ],
  exports: [MonitoringService],
})
export class TradingModule {}