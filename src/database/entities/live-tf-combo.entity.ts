import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('live_tf_combos')
@Index(['symbol', 'timestamp'])
@Index(['comboSignalName', 'timeframe'])
@Index(['accuracy'])
@Unique(['symbol', 'comboSignalName', 'timeframe', 'timestamp'])
export class LiveTfCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'text' })
  comboSignalName: string;

  @Column({ type: 'text' })
  signalAccuracies: string;

  @Column({ type: 'text' })
  signalSamples: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  comboPriceChange: number;

  @Column({ type: 'int' })
  minWindow: number;

  @Column({ type: 'int' })
  maxWindow: number;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  accuracy: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}