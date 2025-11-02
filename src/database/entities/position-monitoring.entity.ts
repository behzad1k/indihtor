import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('position_monitoring')
@Index(['positionId', 'checkedAt'])
export class PositionMonitoring {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'position_id' })
  positionId: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'profit_loss_pct' })
  profitLossPct: number;

  @Column({ type: 'int', name: 'signal_count' })
  signalCount: number;

  @Column({ type: 'int', name: 'buy_signals' })
  buySignals: number;

  @Column({ type: 'int', name: 'sell_signals' })
  sellSignals: number;

  @Column({ type: 'text', name: 'strong_signals', nullable: true })
  strongSignals: string;

  @CreateDateColumn({ name: 'checked_at' })
  checkedAt: Date;
}
