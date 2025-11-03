import { TradingConfig } from '@database/entities/trading-config.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => TradingConfig, config => config.user)
  tradingConfigs: TradingConfig[];

  @CreateDateColumn()
  createdAt: Date;
}