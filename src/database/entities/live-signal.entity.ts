import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('live_signals')
@Index(['symbol', 'timeframe', 'createdAt'])
export class LiveSignal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'varchar', length: 100, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10, name: 'signal_type' })
  signalType: string;

  @Column({ type: 'int' })
  confidence: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  strength: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'signal_value', nullable: true })
  signalValue: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'datetime' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
