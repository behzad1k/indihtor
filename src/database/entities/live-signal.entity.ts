import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('live_signals')
@Index(['symbol', 'timestamp'])
@Index(['signalName', 'timeframe'])
export class LiveSignal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'varchar', length: 100 })
  signalName: string;

  @Column({ type: 'varchar', length: 20 })
  signalType: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  strength: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  signalValue: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}