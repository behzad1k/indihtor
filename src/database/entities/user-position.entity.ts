import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn } from 'typeorm';
import { TradingConfig } from './trading-config.entity';

@Entity('user_positions')
@Index(['tradingConfig', 'symbol'])
export class UserPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TradingConfig)
  tradingConfig: TradingConfig;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  entryFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  positionSize: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  targetProfitPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  stopLossPrice: number;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  @Column({ type: 'json', nullable: true })
  entryValidationData: any;

  @CreateDateColumn()
  openedAt: Date;
}