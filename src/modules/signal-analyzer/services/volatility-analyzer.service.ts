import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '@/types/analysis.types';

@Injectable()
export class VolatilityAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 20) {
      return signals;
    }

    const curr = data[data.length - 1];
    const prev = data[data.length - 2];

    // Bollinger Bands
    if (curr.BB_upper !== undefined && curr.BB_lower !== undefined) {
      // Squeeze
      if (curr.BB_width !== undefined && curr.BB_width < 0.02) {
        signals.bollinger_squeeze = { signal: 'BUY', strength: 'STRONG' };
      }

      // Breakout
      if (curr.close > curr.BB_upper && prev.close <= prev.BB_upper) {
        signals.bollinger_breakout_up = { signal: 'BUY', strength: 'STRONG' };
      } else if (curr.close < curr.BB_lower && prev.close >= prev.BB_lower) {
        signals.bollinger_breakout_down = { signal: 'SELL', strength: 'STRONG' };
      }

      // Bounce
      if (prev.close <= prev.BB_lower && curr.close > curr.BB_lower) {
        signals.bollinger_bounce_up = { signal: 'BUY', strength: 'MODERATE' };
      } else if (prev.close >= prev.BB_upper && curr.close < curr.BB_upper) {
        signals.bollinger_bounce_down = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    // ATR expansion
    if (curr.ATR !== undefined && prev.ATR !== undefined) {
      if (curr.ATR > prev.ATR * 1.5) {
        signals.atr_expansion = { signal: 'BUY', strength: 'MODERATE' };
      }
    }

    // Donchian Channel breakouts
    if (curr.DONCHIAN_HIGH !== undefined && curr.DONCHIAN_LOW !== undefined) {
      if (curr.close > curr.DONCHIAN_HIGH) {
        signals.donchian_breakout_up = { signal: 'BUY', strength: 'STRONG' };
      } else if (curr.close < curr.DONCHIAN_LOW) {
        signals.donchian_breakout_down = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    return signals;
  }
}