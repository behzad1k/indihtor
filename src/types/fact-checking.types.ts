/**
 * Fact-Checking Interfaces and Types
 */

export interface ValidationResult {
  predictedCorrectly: boolean;
  exitReason: string;
  priceChangePct: number;
}

export interface FactCheckResult {
  signalName: string;
  timeframe: string;
  detectedAt: Date;
  priceAtDetection: number;
  actualMove: 'UP' | 'DOWN' | 'FLAT';
  predictedCorrectly: boolean;
  priceChangePct: number;
  exitReason: string;
  checkedAt: Date;
  candlesElapsed: number;
  validationWindow: number;
}

export interface BulkFactCheckOptions {
  symbol?: string;
  limit?: number;
  useFiltering?: boolean;
  maxWorkers?: number;
}

export interface FilteringStats {
  total: number;
  toCheck: number;
  toSkip: number;
  checkRate: number;
  reasons: Record<string, number>;
}

export interface BulkFactCheckResults {
  totalChecked: number;
  correctPredictions: number;
  incorrectPredictions: number;
  stoppedOut: number;
  accuracy: number;
  profitFactor: number;
  details: FactCheckResult[];
  exitReasons: Record<string, number>;
  filteringStats?: FilteringStats;
}

export interface SignalAccuracy {
  signalName: string;
  timeframe?: string;
  totalSamples: number;
  correctPredictions: number;
  accuracy: number;
  avgPriceChange: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  stoppedOut: number;
  stoppedOutRate: number;
}

export interface ConfidenceAdjustment {
  signalName: string;
  timeframe: string;
  originalConfidence: number;
  adjustedConfidence: number;
  accuracyRate: number;
  sampleSize: number;
  profitFactor: number;
  confidenceChange: number;
}

export interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalFilterDecision {
  shouldCheck: boolean;
  reason: string;
}

export interface SignalFilterResult {
  signalsToCheck: any[];
  stats: FilteringStats;
}