import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '@/types/analysis.types';

@Injectable()
export class PriceActionAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 20) {
      return signals;
    }

    const curr = data[data.length - 1];
    const recent = data.slice(-20);

    // Higher High / Lower Low
    const recentHighs = recent.map(d => d.high);
    const recentLows = recent.map(d => d.low);
    const maxHigh = Math.max(...recentHighs);
    const minLow = Math.min(...recentLows);

    if (curr.high === maxHigh) {
      signals.higher_high = { signal: 'BUY', strength: 'MODERATE' };
    }

    if (curr.low === minLow) {
      signals.lower_low = { signal: 'SELL', strength: 'MODERATE' };
    }

    // Support/Resistance levels
    const support = this.findSupport(recent);
    const resistance = this.findResistance(recent);

    if (support && curr.low <= support * 1.005 && curr.close > support) {
      signals.support_bounce = { signal: 'BUY', strength: 'MODERATE' };
    }

    if (resistance && curr.high >= resistance * 0.995 && curr.close < resistance) {
      signals.resistance_rejection = { signal: 'SELL', strength: 'MODERATE' };
    }

    if (support && curr.close < support * 0.99) {
      signals.support_break = { signal: 'SELL', strength: 'STRONG' };
    }

    if (resistance && curr.close > resistance * 1.01) {
      signals.resistance_break = { signal: 'BUY', strength: 'STRONG' };
    }

    // Break of Structure
    const prevSwingHigh = this.findPreviousSwingHigh(data.slice(-50));
    const prevSwingLow = this.findPreviousSwingLow(data.slice(-50));

    if (prevSwingHigh && curr.close > prevSwingHigh) {
      signals.break_of_structure_bullish = { signal: 'BUY', strength: 'VERY_STRONG' };
    }

    if (prevSwingLow && curr.close < prevSwingLow) {
      signals.break_of_structure_bearish = { signal: 'SELL', strength: 'VERY_STRONG' };
    }

    // Round numbers
    const roundNumber = Math.round(curr.close / 1000) * 1000;
    if (Math.abs(curr.close - roundNumber) / roundNumber < 0.005) {
      if (curr.close > roundNumber) {
        signals.round_number_resistance = { signal: 'SELL', strength: 'WEAK' };
      } else {
        signals.round_number_support = { signal: 'BUY', strength: 'WEAK' };
      }
    }

    return signals;
  }

  private findSupport(data: EnrichedOHLCVData[]): number | null {
    const lows = data.map(d => d.low);
    const sorted = [...lows].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.2)];
  }

  private findResistance(data: EnrichedOHLCVData[]): number | null {
    const highs = data.map(d => d.high);
    const sorted = [...highs].sort((a, b) => b - a);
    return sorted[Math.floor(sorted.length * 0.2)];
  }

  private findPreviousSwingHigh(data: EnrichedOHLCVData[]): number | null {
    if (data.length < 10) return null;

    for (let i = data.length - 3; i >= 5; i--) {
      const curr = data[i];
      const isSwingHigh =
        curr.high > data[i - 1].high &&
        curr.high > data[i - 2].high &&
        curr.high > data[i + 1].high &&
        curr.high > data[i + 2].high;

      if (isSwingHigh) {
        return curr.high;
      }
    }

    return null;
  }

  private findPreviousSwingLow(data: EnrichedOHLCVData[]): number | null {
    if (data.length < 10) return null;

    for (let i = data.length - 3; i >= 5; i--) {
      const curr = data[i];
      const isSwingLow =
        curr.low < data[i - 1].low &&
        curr.low < data[i - 2].low &&
        curr.low < data[i + 1].low &&
        curr.low < data[i + 2].low;

      if (isSwingLow) {
        return curr.low;
      }
    }

    return null;
  }
}