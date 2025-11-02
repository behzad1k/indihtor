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
