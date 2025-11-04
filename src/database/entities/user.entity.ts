import { TradingConfig } from './trading-config.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', length: 200, default: 'user'})
  role: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => TradingConfig, config => config.user)
  tradingConfigs: TradingConfig[];

  @CreateDateColumn()
  createdAt: Date;
}