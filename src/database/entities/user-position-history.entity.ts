import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { TradingConfig } from './trading-config.entity';

@Entity('user_position_history')
@Index(['tradingConfig', 'closedAt'])
export class UserPositionHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TradingConfig)
  tradingConfig: TradingConfig;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  exitPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  entryFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  exitFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  positionSize: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  profitLoss: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  profitLossPct: number;

  @Column({ type: 'datetime' })
  openedAt: Date;

  @CreateDateColumn()
  closedAt: Date;

  @Column({ type: 'int' })
  durationSeconds: number;

  @Column({ type: 'varchar', length: 50 })
  exitReason: string;

  @Column({ type: 'json', nullable: true })
  entryValidationData: any;
}