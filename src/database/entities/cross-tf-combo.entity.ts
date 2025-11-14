import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('cross_tf_combos')
@Index(['comboSignatureHash'], { unique: true })
@Index(['accuracy'])
@Index(['comboSize', 'numTimeframes', 'accuracy'])
@Index(['numTimeframes', 'accuracy'])
export class CrossTfCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', name: 'combo_signature' })
  comboSignature: string;

  @Column({ length: 64, unique: true })  // SHA-256 hash
  comboSignatureHash: string;

  @Column({ type: 'varchar', length: 100 })
  timeframes: string;

  @Column({ type: 'varchar', length: 500, name: 'signal_names' })
  signalNames: string;

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

  @Column({ type: 'int', name: 'num_timeframes' })
  numTimeframes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
