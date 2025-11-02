import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('tf_combos')
@Index(['signalName', 'timeframe'], { unique: true })
@Index(['timeframe', 'accuracy'])
@Index(['comboSize', 'accuracy'])
export class TfCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  accuracy: number;

  @Column({ type: 'int', name: 'signals_count' })
  signalsCount: number;

  @Column({ type: 'int', name: 'correct_predictions' })
  correctPredictions: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'avg_price_change', nullable: true })
  avgPriceChange: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'profit_factor', nullable: true })
  profitFactor: number;

  @Column({ type: 'int', name: 'combo_size' })
  comboSize: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
