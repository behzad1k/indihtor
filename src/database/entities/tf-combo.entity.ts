import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('tf_combos')
@Index(['signalNameHash', 'timeframe'])
@Index(['accuracy'])
export class TfCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  signalName: string;

  @Column({ length: 64, unique: true })
  signalNameHash: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  accuracy: number;

  @Column({ type: 'int' })
  signalsCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  avgPriceChange: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  profitFactor: number;

  @Column({ type: 'int' })
  comboSize: number;

  @Column({ type: 'int' })
  correctPredictions: number;
}