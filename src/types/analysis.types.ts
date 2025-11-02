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
