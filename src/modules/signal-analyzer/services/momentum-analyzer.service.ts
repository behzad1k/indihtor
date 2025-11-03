import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '@/types/analysis.types';

@Injectable()
export class MomentumAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 50) {
      return signals;
    }

    const curr = data[data.length - 1];
    const prev = data[data.length - 2];

    // RSI
    if (curr.RSI !== undefined) {
      if (curr.RSI < 30) {
        signals.rsi_oversold = { signal: 'BUY', strength: 'MODERATE', value: curr.RSI };
      }

      if (curr.RSI > 70) {
        signals.rsi_overbought = { signal: 'SELL', strength: 'MODERATE', value: curr.RSI };
      }

      if (curr.RSI > 50 && prev.RSI <= 50) {
        signals.rsi_centerline_cross_up = { signal: 'BUY', strength: 'MODERATE' };
      }

      if (curr.RSI < 50 && prev.RSI >= 50) {
        signals.rsi_centerline_cross_down = { signal: 'SELL', strength: 'MODERATE' };
      }

      // RSI Divergence
      if (data.length >= 20) {
        const priceSlice = data.slice(-20).map(d => d.close);
        const rsiSlice = data.slice(-20).map(d => d.RSI || 0);
        const priceTrend = this.isMonotonicIncreasing(priceSlice);
        const rsiTrend = this.isMonotonicIncreasing(rsiSlice);

        if (priceTrend && !rsiTrend) {
          signals.rsi_divergence_bearish = { signal: 'SELL', strength: 'VERY_STRONG' };
        }

        if (!priceTrend && rsiTrend) {
          signals.rsi_divergence_bullish = { signal: 'BUY', strength: 'VERY_STRONG' };
        }
      }
    }

    // MACD
    if (curr.MACD !== undefined && curr.MACD_signal !== undefined) {
      if (curr.MACD > curr.MACD_signal && prev.MACD <= prev.MACD_signal) {
        signals.macd_cross_bullish = { signal: 'BUY', strength: 'STRONG' };
      }

      if (curr.MACD < curr.MACD_signal && prev.MACD >= prev.MACD_signal) {
        signals.macd_cross_bearish = { signal: 'SELL', strength: 'STRONG' };
      }

      // Histogram reversal
      if (curr.MACD_histogram > 0 && prev.MACD_histogram <= 0) {
        signals.macd_histogram_reversal_bullish = { signal: 'BUY', strength: 'MODERATE' };
      }

      if (curr.MACD_histogram < 0 && prev.MACD_histogram >= 0) {
        signals.macd_histogram_reversal_bearish = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    // Stochastic
    if (curr.STOCH_K !== undefined && curr.STOCH_D !== undefined) {
      if (curr.STOCH_D < 20) {
        signals.stoch_oversold = { signal: 'BUY', strength: 'MODERATE', value: curr.STOCH_D };
      }

      if (curr.STOCH_D > 80) {
        signals.stoch_overbought = { signal: 'SELL', strength: 'MODERATE', value: curr.STOCH_D };
      }

      if (curr.STOCH_K > curr.STOCH_D && prev.STOCH_K <= prev.STOCH_D) {
        signals.stoch_cross_bullish = { signal: 'BUY', strength: 'MODERATE' };
      }

      if (curr.STOCH_K < curr.STOCH_D && prev.STOCH_K >= prev.STOCH_D) {
        signals.stoch_cross_bearish = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    // CCI
    if (curr.CCI !== undefined) {
      if (curr.CCI < -100) {
        signals.cci_oversold = { signal: 'BUY', strength: 'MODERATE', value: curr.CCI };
      }

      if (curr.CCI > 100) {
        signals.cci_overbought = { signal: 'SELL', strength: 'MODERATE', value: curr.CCI };
      }
    }

    // Williams %R
    if (curr.WILLR !== undefined) {
      if (curr.WILLR < -80) {
        signals.williams_r_oversold = { signal: 'BUY', strength: 'MODERATE', value: curr.WILLR };
      }

      if (curr.WILLR > -20) {
        signals.williams_r_overbought = { signal: 'SELL', strength: 'MODERATE', value: curr.WILLR };
      }
    }

    // Momentum
    if (curr.MOMENTUM_5 !== undefined) {
      if (curr.MOMENTUM_5 > 0.03) {
        signals.momentum_5 = { signal: 'BUY', strength: 'MODERATE', value: curr.MOMENTUM_5 };
      } else if (curr.MOMENTUM_5 < -0.03) {
        signals.momentum_5 = { signal: 'SELL', strength: 'MODERATE', value: curr.MOMENTUM_5 };
      }
    }

    if (curr.MOMENTUM_10 !== undefined) {
      if (curr.MOMENTUM_10 > 0.05) {
        signals.momentum_10 = { signal: 'BUY', strength: 'MODERATE', value: curr.MOMENTUM_10 };
      } else if (curr.MOMENTUM_10 < -0.05) {
        signals.momentum_10 = { signal: 'SELL', strength: 'MODERATE', value: curr.MOMENTUM_10 };
      }
    }

    // MFI
    if (curr.MFI !== undefined) {
      if (curr.MFI < 20) {
        signals.mfi_oversold = { signal: 'BUY', strength: 'STRONG', value: curr.MFI };
      }

      if (curr.MFI > 80) {
        signals.mfi_overbought = { signal: 'SELL', strength: 'STRONG', value: curr.MFI };
      }

      // MFI Divergence
      if (data.length >= 20) {
        const priceSlice = data.slice(-20).map(d => d.close);
        const mfiSlice = data.slice(-20).map(d => d.MFI || 0);
        const priceTrend = this.isMonotonicIncreasing(priceSlice);
        const mfiTrend = this.isMonotonicIncreasing(mfiSlice);

        if (priceTrend && !mfiTrend) {
          signals.mfi_divergence_bearish = { signal: 'SELL', strength: 'VERY_STRONG' };
        }

        if (!priceTrend && mfiTrend) {
          signals.mfi_divergence_bullish = { signal: 'BUY', strength: 'VERY_STRONG' };
        }
      }
    }

    // ROC
    if (curr.ROC !== undefined) {
      if (curr.ROC > 5) {
        signals.roc_bullish = { signal: 'BUY', strength: 'MODERATE', value: curr.ROC };
      }

      if (curr.ROC < -5) {
        signals.roc_bearish = { signal: 'SELL', strength: 'MODERATE', value: curr.ROC };
      }
    }

    // TSI
    if (curr.TSI !== undefined && curr.TSI_signal !== undefined) {
      if (curr.TSI > curr.TSI_signal && prev.TSI <= prev.TSI_signal) {
        signals.tsi_cross_bullish = { signal: 'BUY', strength: 'STRONG' };
      }

      if (curr.TSI < curr.TSI_signal && prev.TSI >= prev.TSI_signal) {
        signals.tsi_cross_bearish = { signal: 'SELL', strength: 'STRONG' };
      }
    }

    return signals;
  }

  private isMonotonicIncreasing(arr: number[]): boolean {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) return false;
    }
    return true;
  }
}