import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('buying_queue')
@Index(['symbol'], { unique: true })
export class BuyingQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'detected_price' })
  detectedPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'target_price' })
  targetPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_confidence' })
  signalConfidence: number;

  @Column({ type: 'int', name: 'signal_patterns' })
  signalPatterns: number;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'WAITING' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_24h_change', nullable: true })
  price24hChange: number;

  @Column({ type: 'int', name: 'validated_patterns_count', nullable: true })
  validatedPatternsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'avg_pattern_accuracy', nullable: true })
  avgPatternAccuracy: number;
}
