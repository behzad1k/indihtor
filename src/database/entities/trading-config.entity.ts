import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('trading_configs')
export class TradingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.tradingConfigs)
  user: User;

  @Column()
  name: string;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'enum', enum: ['PAPER', 'REAL'], default: 'PAPER' })
  tradingMode: 'PAPER' | 'REAL';

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  initialBankroll: number;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  currentBankroll: number;

  // Trading Parameters
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 20.0 })
  maxPriceChange24h: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  minBuyingWindowPct: number;

  @Column({ type: 'int', default: 600 })
  maxBuyingWindowTime: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.5 })
  maxProfitThresholdPct: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 70.0 })
  stopLossPct: number;

  @Column({ type: 'int', default: 5 })
  splitBankrollTo: number;

  @Column({ type: 'int', default: 5 })
  maxPositions: number;

  // Signal Validation Parameters
  @Column({ type: 'int', default: 2 })
  minPatternsThreshold: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 60.0 })
  minAccuracyThreshold: number;

  @Column({ type: 'int', default: 3 })
  minCrossTfAlignment: number;

  @Column({ type: 'int', default: 5 })
  minStrongSignalsPerHour: number;

  @Column({ type: 'int', default: 6 })
  signalCooldownHours: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 66.67 })
  minScalpAgreementPct: number;

  @Column({ type: 'int', default: 2 })
  maxRecentLosses: number;

  // Buying Condition Weights (0-100)
  @Column({ type: 'int', default: 20 })
  weight24hChange: number;

  @Column({ type: 'int', default: 20 })
  weightValidatedPatterns: number;

  @Column({ type: 'int', default: 15 })
  weightCrossTfAlignment: number;

  @Column({ type: 'int', default: 15 })
  weightStrongSignalDensity: number;

  @Column({ type: 'int', default: 10 })
  weightVolumeConfirmation: number;

  @Column({ type: 'int', default: 10 })
  weightScalpAgreement: number;

  @Column({ type: 'int', default: 10 })
  weightMarketStructure: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}