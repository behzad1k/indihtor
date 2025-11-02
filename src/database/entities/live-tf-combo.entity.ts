import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('live_tf_combos')
@Index(['symbol', 'timestamp'])
@Index(['comboSignalName', 'timeframe'])
@Index(['accuracy'])
export class LiveTfCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 500, name: 'combo_signal_name' })
  comboSignalName: string;

  @Column({ type: 'text', name: 'signal_accuracies' })
  signalAccuracies: string;

  @Column({ type: 'text', name: 'signal_samples' })
  signalSamples: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'combo_price_change' })
  comboPriceChange: number;

  @Column({ type: 'int', name: 'min_window' })
  minWindow: number;

  @Column({ type: 'int', name: 'max_window' })
  maxWindow: number;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  accuracy: number;

  @CreateDateColumn()
  timestamp: Date;
}
