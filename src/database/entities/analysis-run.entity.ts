import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('analysis_runs')
export class AnalysisRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'text' })
  timeframes: string;

  @Column({ type: 'int', name: 'total_signals' })
  totalSignals: number;

  @Column({ type: 'int', name: 'buy_signals' })
  buySignals: number;

  @Column({ type: 'int', name: 'sell_signals' })
  sellSignals: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
