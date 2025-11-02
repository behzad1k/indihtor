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
