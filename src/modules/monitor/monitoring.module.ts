import { SignalValidatorService } from '@modules/trading/signal-validator.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TradingConfig } from '@/database/entities/trading-config.entity';
import { LiveSignal } from '@/database/entities/live-signal.entity';
import { LiveTfCombo } from '@/database/entities/live-tf-combo.entity';
import { CrossTfCombo } from '@/database/entities/cross-tf-combo.entity';
import { UserBuyingQueue } from '@/database/entities/user-buying-queue.entity';
import { UserPosition } from '@/database/entities/user-position.entity';
import { UserPositionHistory } from '@/database/entities/user-position-history.entity';
import { MonitoringService } from './monitoring.service';
import { MarketDataModule } from '@/modules/market-data/market-data.module';
import { ExternalApiModule } from '@/modules/external-api/external-api.module';
import { BuyingQueueService } from '@/modules/trading/buying-queue.service';
import { PositionManagerService } from '@/modules/trading/position-manager.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      LiveSignal,
      LiveTfCombo,
      CrossTfCombo,
      UserPositionHistory,
      TradingConfig,
      UserBuyingQueue,
      UserPosition,
    ]),
    MarketDataModule,
    ExternalApiModule,
  ],
  providers: [
    MonitoringService,
    SignalValidatorService,
    BuyingQueueService,
    PositionManagerService,
  ],
  exports: [
    MonitoringService,
  ],
})
export class MonitoringModule {}