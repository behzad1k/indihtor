import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn } from 'typeorm';
import { TradingConfig } from './trading-config.entity';

@Entity('user_buying_queue')
@Index(['tradingConfig', 'symbol'])
export class UserBuyingQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TradingConfig)
  tradingConfig: TradingConfig;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  detectedPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  targetPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  signalScore: number;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'WAITING' })
  status: string;

  @Column({ type: 'json', nullable: true })
  validationData: any;

  @CreateDateColumn()
  addedAt: Date;
}