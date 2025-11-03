import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '@/types/analysis.types';

@Injectable()
export class TrendAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 25) {
      return signals;
    }

    const curr = data[data.length - 1];
    const prev = data[data.length - 2];

    // ADX
    if (curr.ADX !== undefined) {
      if (curr.ADX > 25) {
        signals.adx_strong_trend = {
          signal: curr.PLUS_DI > curr.MINUS_DI ? 'BUY' : 'SELL',
          strength: 'STRONG'
        };
      } else if (curr.ADX < 20) {
        signals.adx_weak_trend = { signal: 'BUY', strength: 'WEAK' };
      }

      // ADX reversal
      if (prev.ADX !== undefined && curr.ADX > prev.ADX * 1.2 && curr.ADX > 20) {
        signals.adx_reversal = {
          signal: curr.PLUS_DI > curr.MINUS_DI ? 'BUY' : 'SELL',
          strength: 'STRONG'
        };
      }
    }

    // Parabolic SAR
    if (curr.SAR !== undefined) {
      if (curr.close > curr.SAR && prev.close <= prev.SAR) {
        signals.parabolic_sar_flip_bullish = { signal: 'BUY', strength: 'MODERATE' };
      } else if (curr.close < curr.SAR && prev.close >= prev.SAR) {
        signals.parabolic_sar_flip_bearish = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    // Aroon
    if (curr.AROON_UP !== undefined && curr.AROON_DOWN !== undefined) {
      if (curr.AROON_UP > 70 && curr.AROON_DOWN < 30) {
        signals.aroon_bullish = { signal: 'BUY', strength: 'STRONG' };
      } else if (curr.AROON_DOWN > 70 && curr.AROON_UP < 30) {
        signals.aroon_bearish = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    // Elder Ray
    if (curr.BULL_POWER !== undefined && curr.BEAR_POWER !== undefined) {
      if (curr.BULL_POWER > 0 && curr.BEAR_POWER > prev.BEAR_POWER) {
        signals.elder_ray_bullish = { signal: 'BUY', strength: 'MODERATE' };
      } else if (curr.BEAR_POWER < 0 && curr.BULL_POWER < prev.BULL_POWER) {
        signals.elder_ray_bearish = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    return signals;
  }
}