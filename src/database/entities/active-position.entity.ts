import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('active_positions')
@Index(['symbol'], { unique: true })
export class ActivePosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_price' })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_fee' })
  entryFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'position_size' })
  positionSize: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'target_profit_price' })
  targetProfitPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'stop_loss_price' })
  stopLossPrice: number;

  @CreateDateColumn({ name: 'opened_at' })
  openedAt: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_confidence' })
  signalConfidence: number;

  @Column({ type: 'int', name: 'signal_patterns' })
  signalPatterns: number;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_24h_change', nullable: true })
  price24hChange: number;

  @Column({ type: 'int', name: 'validated_patterns_count', nullable: true })
  validatedPatternsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'avg_pattern_accuracy', nullable: true })
  avgPatternAccuracy: number;
}
