import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('signal_fact_checks')
export class SignalFactCheck {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'datetime', name: 'detected_at' })
  detectedAt: Date;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'price_at_detection' })
  priceAtDetection: number;

  @Column({ type: 'varchar', length: 10, name: 'actual_move', nullable: true })
  actualMove: string;

  @Column({ type: 'boolean', name: 'predicted_correctly', nullable: true })
  predictedCorrectly: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_change_pct', nullable: true })
  priceChangePct: number;

  @Column({ type: 'datetime', name: 'checked_at' })
  checkedAt: Date;

  @Column({ type: 'int', name: 'candles_elapsed' })
  candlesElapsed: number;

  @Column({ type: 'varchar', length: 50, name: 'exit_reason', nullable: true })
  exitReason: string;

  @Column({ type: 'int', name: 'validation_window', nullable: true })
  validationWindow: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
