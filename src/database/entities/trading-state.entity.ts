import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('trading_state')
export class TradingState {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'current_bankroll' })
  currentBankroll: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'initial_bankroll' })
  initialBankroll: number;

  @Column({ type: 'int', name: 'total_trades', default: 0 })
  totalTrades: number;

  @Column({ type: 'int', name: 'winning_trades', default: 0 })
  winningTrades: number;

  @Column({ type: 'int', name: 'losing_trades', default: 0 })
  losingTrades: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'total_profit_loss', default: 0 })
  totalProfitLoss: number;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;
}
