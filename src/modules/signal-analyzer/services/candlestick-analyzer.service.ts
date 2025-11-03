import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '@/types/analysis.types';

@Injectable()
export class CandlestickAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 3) {
      return signals;
    }

    const curr = data[data.length - 1];
    const prev = data[data.length - 2];
    const prev2 = data[data.length - 3];

    // Current candle properties
    const currBody = Math.abs(curr.close - curr.open);
    const currRange = curr.high - curr.low;
    const currIsBullish = curr.close > curr.open;
    const currIsBearish = curr.close < curr.open;

    // Previous candle properties
    const prevBody = Math.abs(prev.close - prev.open);
    const prevIsBullish = prev.close > prev.open;
    const prevIsBearish = prev.close < prev.open;

    // Engulfing patterns
    if (currIsBullish && prevIsBearish) {
      if (curr.close > prev.open && curr.open < prev.close && currBody > prevBody) {
        signals.engulfing_bullish = { signal: 'BUY', strength: 'STRONG' };
      }
    }

    if (currIsBearish && prevIsBullish) {
      if (curr.close < prev.open && curr.open > prev.close && currBody > prevBody) {
        signals.engulfing_bearish = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    // Hammer (bullish reversal at bottom)
    const lowerShadow = currIsBullish ? curr.open - curr.low : curr.close - curr.low;
    const upperShadow = currIsBullish ? curr.high - curr.close : curr.high - curr.open;

    if (lowerShadow > currBody * 2 && upperShadow < currBody * 0.5) {
      signals.hammer = { signal: 'BUY', strength: 'MODERATE' };
    }

    // Shooting star (bearish reversal at top)
    if (upperShadow > currBody * 2 && lowerShadow < currBody * 0.5) {
      signals.shooting_star = { signal: 'SELL', strength: 'MODERATE' };
    }

    // Doji (indecision)
    if (currBody < currRange * 0.1) {
      if (prevIsBullish && data.length > 10) {
        const recentTrend = data.slice(-10, -1).filter(d => d.close > d.open).length;
        if (recentTrend >= 6) {
          signals.doji_reversal = { signal: 'SELL', strength: 'MODERATE' };
        }
      } else if (prevIsBearish && data.length > 10) {
        const recentTrend = data.slice(-10, -1).filter(d => d.close < d.open).length;
        if (recentTrend >= 6) {
          signals.doji_reversal = { signal: 'BUY', strength: 'MODERATE' };
        }
      }
    }

    // Morning Star (3-candle bullish reversal)
    if (data.length >= 3) {
      const prev2IsBearish = prev2.close < prev2.open;
      const prevIsSmall = prevBody < (prev2.high - prev2.low) * 0.3;

      if (prev2IsBearish && prevIsSmall && currIsBullish && curr.close > (prev2.open + prev2.close) / 2) {
        signals.morning_star = { signal: 'BUY', strength: 'VERY_STRONG' };
      }
    }

    // Evening Star (3-candle bearish reversal)
    if (data.length >= 3) {
      const prev2IsBullish = prev2.close > prev2.open;
      const prevIsSmall = prevBody < (prev2.high - prev2.low) * 0.3;

      if (prev2IsBullish && prevIsSmall && currIsBearish && curr.close < (prev2.open + prev2.close) / 2) {
        signals.evening_star = { signal: 'SELL', strength: 'VERY_STRONG' };
      }
    }

    // Three White Soldiers
    if (data.length >= 3) {
      const allBullish = currIsBullish && prevIsBullish && (prev2.close > prev2.open);
      const consecutive = curr.close > prev.close && prev.close > prev2.close;

      if (allBullish && consecutive) {
        signals.three_white_soldiers = { signal: 'BUY', strength: 'VERY_STRONG' };
      }
    }

    // Three Black Crows
    if (data.length >= 3) {
      const allBearish = currIsBearish && prevIsBearish && (prev2.close < prev2.open);
      const consecutive = curr.close < prev.close && prev.close < prev2.close;

      if (allBearish && consecutive) {
        signals.three_black_crows = { signal: 'SELL', strength: 'VERY_STRONG' };
      }
    }

    // Marubozu (strong candle with no/minimal shadows)
    if (currBody > currRange * 0.95) {
      if (currIsBullish) {
        signals.marubozu_bullish = { signal: 'BUY', strength: 'STRONG' };
      } else {
        signals.marubozu_bearish = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    return signals;
  }
}