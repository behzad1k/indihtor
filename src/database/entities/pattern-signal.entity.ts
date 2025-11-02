import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pattern_signals')
export class PatternSignal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 10 })
  signal: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'pattern_confidence' })
  patternConfidence: number;

  @Column({ type: 'int', name: 'pattern_count' })
  patternCount: number;

  @Column({ type: 'varchar', length: 500, name: 'best_pattern' })
  bestPattern: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'best_pattern_accuracy' })
  bestPatternAccuracy: number;

  @Column({ type: 'text', name: 'all_patterns', nullable: true })
  allPatterns: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'stop_loss', nullable: true })
  stopLoss: number;

  @Column({ type: 'text', name: 'scalp_validation', nullable: true })
  scalpValidation: string;

  @CreateDateColumn({ name: 'datetime_created' })
  datetimeCreated: Date;
}
