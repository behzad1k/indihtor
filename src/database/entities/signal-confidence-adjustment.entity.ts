import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('signal_confidence_adjustments')
@Index(['signalName', 'timeframe'], { unique: true })
export class SignalConfidenceAdjustment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'int', name: 'original_confidence' })
  originalConfidence: number;

  @Column({ type: 'int', name: 'adjusted_confidence' })
  adjustedConfidence: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'accuracy_rate' })
  accuracyRate: number;

  @Column({ type: 'int', name: 'sample_size' })
  sampleSize: number;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;
}
