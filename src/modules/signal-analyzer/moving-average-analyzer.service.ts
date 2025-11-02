import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '../types/analysis.types';

@Injectable()
export class MovingAverageAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 200) {
      return signals;
    }

    const curr = data[data.length - 1];
    const prev = data[data.length - 2];

    // Golden/Death Cross
    if (curr.SMA_50 !== undefined && curr.SMA_200 !== undefined) {
      if (curr.SMA_50 > curr.SMA_200 && prev.SMA_50 <= prev.SMA_200) {
        signals.ma_cross_golden = { signal: 'BUY', strength: 'STRONG' };
      }

      if (curr.SMA_50 < curr.SMA_200 && prev.SMA_50 >= prev.SMA_200) {
        signals.ma_cross_death = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    // Price vs MA20
    if (curr.SMA_20 !== undefined) {
      if (curr.close > curr.SMA_20 && prev.close <= prev.SMA_20) {
        signals.price_above_ma20 = { signal: 'BUY', strength: 'MODERATE' };
      }

      if (curr.close < curr.SMA_20 && prev.close >= prev.SMA_20) {
        signals.price_below_ma20 = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    // MA Ribbon
    if (curr.EMA_5 !== undefined && curr.EMA_10 !== undefined && curr.EMA_20 !== undefined) {
      if (curr.EMA_5 > curr.EMA_10 && curr.EMA_10 > curr.EMA_20) {
        signals.ma_ribbon_bullish = { signal: 'BUY', strength: 'STRONG' };
      }

      if (curr.EMA_5 < curr.EMA_10 && curr.EMA_10 < curr.EMA_20) {
        signals.ma_ribbon_bearish = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    return signals;
  }
}