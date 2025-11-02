#!/bin/bash
cat > src/types/signal.types.ts << 'EOF'
export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export enum SignalStrength {
  WEAK = 'WEAK',
  MODERATE = 'MODERATE',
  STRONG = 'STRONG',
  VERY_STRONG = 'VERY_STRONG',
}

export interface SignalConfidence {
  confidence: number;
  timeframes: string[];
  category: string;
}

export interface SignalResult {
  signal: SignalType;
  strength?: SignalStrength;
  value?: number;
}
EOF

cat > src/types/trading.types.ts << 'EOF'
export interface TradingPosition {
  id: number;
  symbol: string;
  entryPrice: number;
  entryFee: number;
  positionSize: number;
  quantity: number;
  targetProfitPrice: number;
  stopLossPrice: number;
  openedAt: Date;
  signalConfidence: number;
  signalPatterns: number;
  status: string;
}

export interface BuyingQueueItem {
  id: number;
  symbol: string;
  detectedPrice: number;
  targetPrice: number;
  signalConfidence: number;
  signalPatterns: number;
  addedAt: Date;
  expiresAt: Date;
  status: string;
}

export interface TradingStats {
  running: boolean;
  initialBankroll: number;
  currentBankroll: number;
  totalProfitLoss: number;
  roi: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  activePositions: number;
  buyingQueue: number;
}
EOF

cat > src/types/analysis.types.ts << 'EOF'
export interface TimeframeAnalysis {
  price: number;
  timestamp: string;
  signals: Record<string, any>;
  signalCount: number;
  buySignals: number;
  sellSignals: number;
}

export interface SymbolAnalysis {
  symbol: string;
  timestamp: string;
  timeframes: Record<string, TimeframeAnalysis>;
  combinations?: any[];
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
EOF

cat > src/types/api-response.types.ts << 'EOF'
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}
EOF

# ============================================================
# ENTITIES
# ============================================================

cat > src/database/entities/pattern-signal.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pattern_signals')
export class PatternSignal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 10 })
  signal: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'pattern_confidence' })
  patternConfidence: number;

  @Column({ type: 'int', name: 'pattern_count' })
  patternCount: number;

  @Column({ type: 'varchar', length: 500, name: 'best_pattern' })
  bestPattern: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'best_pattern_accuracy' })
  bestPatternAccuracy: number;

  @Column({ type: 'text', name: 'all_patterns', nullable: true })
  allPatterns: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'stop_loss', nullable: true })
  stopLoss: number;

  @Column({ type: 'text', name: 'scalp_validation', nullable: true })
  scalpValidation: string;

  @CreateDateColumn({ name: 'datetime_created' })
  datetimeCreated: Date;
}
EOF

cat > src/database/entities/live-signal.entity.ts << 'EOF'
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
EOF

cat > src/database/entities/analysis-run.entity.ts << 'EOF'
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
EOF

cat > src/database/entities/signal-fact-check.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('signal_fact_checks')
export class SignalFactCheck {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'datetime', name: 'detected_at' })
  detectedAt: Date;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'price_at_detection' })
  priceAtDetection: number;

  @Column({ type: 'varchar', length: 10, name: 'actual_move', nullable: true })
  actualMove: string;

  @Column({ type: 'boolean', name: 'predicted_correctly', nullable: true })
  predictedCorrectly: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_change_pct', nullable: true })
  priceChangePct: number;

  @Column({ type: 'datetime', name: 'checked_at' })
  checkedAt: Date;

  @Column({ type: 'int', name: 'candles_elapsed' })
  candlesElapsed: number;

  @Column({ type: 'varchar', length: 50, name: 'exit_reason', nullable: true })
  exitReason: string;

  @Column({ type: 'int', name: 'validation_window', nullable: true })
  validationWindow: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
EOF

cat > src/database/entities/signal.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('signals')
@Index(['signalName', 'timeframe'], { unique: true })
export class Signal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'int', name: 'initial_validation_window' })
  initialValidationWindow: number;

  @Column({ type: 'int', name: 'validation_window' })
  validationWindow: number;

  @Column({ type: 'int', name: 'max_validation_window' })
  maxValidationWindow: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'initial_signal_accuracy' })
  initialSignalAccuracy: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_accuracy' })
  signalAccuracy: number;

  @Column({ type: 'int', name: 'sample_size', default: 0 })
  sampleSize: number;

  @Column({ type: 'datetime', name: 'last_optimized', nullable: true })
  lastOptimized: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
EOF

cat > src/database/entities/signal-confidence-adjustment.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('signal_confidence_adjustments')
@Index(['signalName', 'timeframe'], { unique: true })
export class SignalConfidenceAdjustment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'int', name: 'original_confidence' })
  originalConfidence: number;

  @Column({ type: 'int', name: 'adjusted_confidence' })
  adjustedConfidence: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'accuracy_rate' })
  accuracyRate: number;

  @Column({ type: 'int', name: 'sample_size' })
  sampleSize: number;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;
}
EOF

cat > src/database/entities/tf-combo.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('tf_combos')
@Index(['signalName', 'timeframe'], { unique: true })
@Index(['timeframe', 'accuracy'])
@Index(['comboSize', 'accuracy'])
export class TfCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500, name: 'signal_name' })
  signalName: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
EOF

cat > src/database/entities/cross-tf-combo.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('cross_tf_combos')
@Index(['comboSignature'], { unique: true })
@Index(['accuracy'])
@Index(['comboSize', 'numTimeframes', 'accuracy'])
export class CrossTfCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 1000, name: 'combo_signature' })
  comboSignature: string;

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
EOF

cat > src/database/entities/live-tf-combo.entity.ts << 'EOF'
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
EOF

cat > src/database/entities/trading-state.entity.ts << 'EOF'
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
EOF

cat > src/database/entities/buying-queue.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('buying_queue')
@Index(['symbol'], { unique: true })
export class BuyingQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'detected_price' })
  detectedPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'target_price' })
  targetPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_confidence' })
  signalConfidence: number;

  @Column({ type: 'int', name: 'signal_patterns' })
  signalPatterns: number;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'WAITING' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_24h_change', nullable: true })
  price24hChange: number;

  @Column({ type: 'int', name: 'validated_patterns_count', nullable: true })
  validatedPatternsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'avg_pattern_accuracy', nullable: true })
  avgPatternAccuracy: number;
}
EOF

cat > src/database/entities/active-position.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('active_positions')
@Index(['symbol'], { unique: true })
export class ActivePosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_price' })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_fee' })
  entryFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'position_size' })
  positionSize: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'target_profit_price' })
  targetProfitPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'stop_loss_price' })
  stopLossPrice: number;

  @CreateDateColumn({ name: 'opened_at' })
  openedAt: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_confidence' })
  signalConfidence: number;

  @Column({ type: 'int', name: 'signal_patterns' })
  signalPatterns: number;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_24h_change', nullable: true })
  price24hChange: number;

  @Column({ type: 'int', name: 'validated_patterns_count', nullable: true })
  validatedPatternsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'avg_pattern_accuracy', nullable: true })
  avgPatternAccuracy: number;
}
EOF

cat > src/database/entities/position-history.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('position_history')
@Index(['symbol', 'closedAt'])
export class PositionHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_price' })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'exit_price' })
  exitPrice: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'entry_fee' })
  entryFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'exit_fee' })
  exitFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'position_size' })
  positionSize: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'profit_loss' })
  profitLoss: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'profit_loss_pct' })
  profitLossPct: number;

  @Column({ type: 'datetime', name: 'opened_at' })
  openedAt: Date;

  @CreateDateColumn({ name: 'closed_at' })
  closedAt: Date;

  @Column({ type: 'int', name: 'duration_seconds' })
  durationSeconds: number;

  @Column({ type: 'varchar', length: 50, name: 'exit_reason' })
  exitReason: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'signal_confidence' })
  signalConfidence: number;

  @Column({ type: 'int', name: 'signal_patterns' })
  signalPatterns: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'price_24h_change', nullable: true })
  price24hChange: number;

  @Column({ type: 'int', name: 'validated_patterns_count', nullable: true })
  validatedPatternsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'avg_pattern_accuracy', nullable: true })
  avgPatternAccuracy: number;
}
EOF

cat > src/database/entities/position-monitoring.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('position_monitoring')
@Index(['positionId', 'checkedAt'])
export class PositionMonitoring {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'position_id' })
  positionId: number;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'profit_loss_pct' })
  profitLossPct: number;

  @Column({ type: 'int', name: 'signal_count' })
  signalCount: number;

  @Column({ type: 'int', name: 'buy_signals' })
  buySignals: number;

  @Column({ type: 'int', name: 'sell_signals' })
  sellSignals: number;

  @Column({ type: 'text', name: 'strong_signals', nullable: true })
  strongSignals: string;

  @CreateDateColumn({ name: 'checked_at' })
  checkedAt: Date;
}
EOF

echo "📁 All entity files created!"

# ============================================================
# AUTH MODULE
# ============================================================

cat > src/modules/auth/auth.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
EOF

cat > src/modules/auth/auth.controller.ts << 'EOF'
import { Controller, Post, Get, Body, Session, Redirect } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Session() session: Record<string, any>) {
    const result = await this.authService.validateUser(loginDto.username, loginDto.password);
    if (result.success) {
      session.logged_in = true;
    }
    return result;
  }

  @Get('logout')
  @Redirect('/login')
  logout(@Session() session: Record<string, any>) {
    session.logged_in = false;
    return { url: '/login' };
  }
}
EOF