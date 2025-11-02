import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('position_history')
@Index(['symbol', 'closedAt'])
export class PositionHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_price' })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'exit_price' })
  exitPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_fee' })
  entryFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'exit_fee' })
  exitFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'position_size' })
  positionSize: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'profit_loss' })
  profitLoss: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'profit_loss_pct' })
  profitLossPct: number;

  @Column({ type: 'datetime', name: 'opened_at' })
  openedAt: Date;

  @CreateDateColumn({ name: 'closed_at' })
  closedAt: Date;

  @Column({ type: 'int', name: 'duration_seconds' })
  durationSeconds: number;

  @Column({ type: 'varchar', length: 50, name: 'exit_reason' })
  exitReason: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_confidence' })
  signalConfidence: number;

  @Column({ type: 'int', name: 'signal_patterns' })
  signalPatterns: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_24h_change', nullable: true })
  price24hChange: number;

  @Column({ type: 'int', name: 'validated_patterns_count', nullable: true })
  validatedPatternsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'avg_pattern_accuracy', nullable: true })
  avgPatternAccuracy: number;
}
