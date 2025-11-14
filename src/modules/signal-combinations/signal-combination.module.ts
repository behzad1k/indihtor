/**
 * Signal Combination Analysis Module
 *
 * Provides services and controllers for analyzing signal combinations
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignalCombinationService } from './signal-combination-analyzer.service';
import { SignalCombinationController } from './signal-combination.controller';
import { LiveSignal } from '@database/entities/live-signal.entity';
import { SignalFactCheck } from '@database/entities/signal-fact-check.entity';
import { TfCombo } from '@database/entities/tf-combo.entity';
import { CrossTfCombo } from '@database/entities/cross-tf-combo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiveSignal,
      SignalFactCheck,
      TfCombo,
      CrossTfCombo,
    ]),
  ],
  controllers: [SignalCombinationController],
  providers: [SignalCombinationService],
  exports: [SignalCombinationService],
})
export class SignalCombinationModule {}