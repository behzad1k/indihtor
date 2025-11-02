import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('signals')
@Index(['signalName', 'timeframe'], { unique: true })
export class Signal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'int', name: 'initial_validation_window' })
  initialValidationWindow: number;

  @Column({ type: 'int', name: 'validation_window' })
  validationWindow: number;

  @Column({ type: 'int', name: 'max_validation_window' })
  maxValidationWindow: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'initial_signal_accuracy' })
  initialSignalAccuracy: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_accuracy' })
  signalAccuracy: number;

  @Column({ type: 'int', name: 'sample_size', default: 0 })
  sampleSize: number;

  @Column({ type: 'datetime', name: 'last_optimized', nullable: true })
  lastOptimized: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
