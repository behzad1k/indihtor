export interface OHLCVData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EnrichedOHLCVData extends OHLCVData {
  // Moving Averages
  SMA_5?: number;
  SMA_10?: number;
  SMA_20?: number;
  SMA_50?: number;
  SMA_100?: number;
  SMA_200?: number;
  EMA_5?: number;
  EMA_10?: number;
  EMA_12?: number;
  EMA_13?: number;
  EMA_20?: number;
  EMA_26?: number;
  EMA_50?: number;
  EMA_100?: number;
  EMA_200?: number;

  // MACD
  MACD?: number;
  MACD_signal?: number;
  MACD_histogram?: number;

  // RSI
  RSI?: number;

  // Stochastic
  STOCH_K?: number;
  STOCH_D?: number;

  // Bollinger Bands
  BB_middle?: number;
  BB_upper?: number;
  BB_lower?: number;
  BB_std?: number;
  BB_width?: number;

  // ATR
  ATR?: number;

  // Volume
  OBV?: number;
  VWAP?: number;
  volume_sma?: number;

  // ADX
  ADX?: number;
  PLUS_DI?: number;
  MINUS_DI?: number;

  // CCI
  CCI?: number;

  // Williams %R
  WILLR?: number;

  // MFI
  MFI?: number;

  // CMF
  CMF?: number;

  // ROC
  ROC?: number;

  // Aroon
  AROON_UP?: number;
  AROON_DOWN?: number;

  // Elder Ray
  BULL_POWER?: number;
  BEAR_POWER?: number;

  // TSI
  TSI?: number;
  TSI_signal?: number;

  // Donchian
  DONCHIAN_HIGH?: number;
  DONCHIAN_LOW?: number;
  DONCHIAN_MID?: number;

  // Momentum
  MOMENTUM_5?: number;
  MOMENTUM_10?: number;

  // SAR
  SAR?: number;
}

export interface SignalData {
  signal: 'BUY' | 'SELL';
  strength?: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  value?: number;
}

export interface SignalMap {
  [signalName: string]: SignalData;
}

export interface TimeframeAnalysis {
  price: number;
  timestamp: string;
  signals: SignalMap;
  signalCount: number;
  buySignals: number;
  sellSignals: number;
}

export interface TimeframeError {
  error: string;
}

export interface CombinationData {
  comboName: string;
  accuracy: number;
  sampleCount: number;
  signals: string[];
}