import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '@/types/analysis.types';

@Injectable()
export class VolumeAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 20) {
      return signals;
    }

    const curr = data[data.length - 1];
    const prev = data[data.length - 2];

    // Volume spike
    if (curr.volume_sma !== undefined) {
      if (curr.volume > curr.volume_sma * 2) {
        if (curr.close > curr.open) {
          signals.volume_spike_bullish = { signal: 'BUY', strength: 'STRONG' };
        } else {
          signals.volume_spike_bearish = { signal: 'SELL', strength: 'STRONG' };
        }
      }

      // Volume climax (extreme spike)
      if (curr.volume > curr.volume_sma * 3) {
        if (curr.close > curr.open) {
          signals.volume_climax_bullish = { signal: 'BUY', strength: 'VERY_STRONG' };
        } else {
          signals.volume_climax_bearish = { signal: 'SELL', strength: 'VERY_STRONG' };
        }
      }
    }

    // OBV
    if (curr.OBV !== undefined && prev.OBV !== undefined) {
      if (curr.OBV > prev.OBV && curr.close > prev.close) {
        signals.obv_bullish = { signal: 'BUY', strength: 'MODERATE' };
      } else if (curr.OBV < prev.OBV && curr.close < prev.close) {
        signals.obv_bearish = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    // VWAP
    if (curr.VWAP !== undefined) {
      if (curr.close > curr.VWAP && prev.close <= prev.VWAP) {
        signals.vwap_cross_above = { signal: 'BUY', strength: 'STRONG' };
      } else if (curr.close < curr.VWAP && prev.close >= prev.VWAP) {
        signals.vwap_cross_below = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    // CMF
    if (curr.CMF !== undefined) {
      if (curr.CMF > 0.1) {
        signals.cmf_bullish = { signal: 'BUY', strength: 'STRONG' };
      } else if (curr.CMF < -0.1) {
        signals.cmf_bearish = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    return signals;
  }
}