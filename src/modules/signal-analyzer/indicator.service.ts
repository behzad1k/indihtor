import { Injectable } from '@nestjs/common';
import { OHLCVData, EnrichedOHLCVData } from '../types/analysis.types';

@Injectable()
export class IndicatorService {
  calculateAllIndicators(data: OHLCVData[]): EnrichedOHLCVData[] {
    if (data.length < 50) {
      return data as EnrichedOHLCVData[];
    }

    const enrichedData: EnrichedOHLCVData[] = data.map(d => ({ ...d }));

    // Moving Averages
    for (const period of [5, 10, 20, 50, 100, 200]) {
      if (data.length >= period) {
        this.calculateSMA(enrichedData, period);
        this.calculateEMA(enrichedData, period);
      }
    }

    // MACD
    this.calculateMACD(enrichedData);

    // RSI
    this.calculateRSI(enrichedData);

    // Stochastic
    this.calculateStochastic(enrichedData);

    // Bollinger Bands
    this.calculateBollingerBands(enrichedData);

    // ATR
    this.calculateATR(enrichedData);

    // OBV
    this.calculateOBV(enrichedData);

    // VWAP
    this.calculateVWAP(enrichedData);

    // ADX
    this.calculateADX(enrichedData);

    // CCI
    this.calculateCCI(enrichedData);

    // Williams %R
    this.calculateWilliamsR(enrichedData);

    // MFI
    this.calculateMFI(enrichedData);

    // CMF
    this.calculateCMF(enrichedData);

    // ROC
    this.calculateROC(enrichedData);

    // Aroon
    this.calculateAroon(enrichedData);

    // Elder Ray
    this.calculateElderRay(enrichedData);

    // TSI
    this.calculateTSI(enrichedData);

    // Donchian Channel
    this.calculateDonchian(enrichedData);

    // Momentum
    this.calculateMomentum(enrichedData);

    // SAR
    this.calculateSAR(enrichedData);

    return enrichedData;
  }

  private calculateSMA(data: EnrichedOHLCVData[], period: number): void {
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
      data[i][`SMA_${period}`] = sum / period;
    }
  }

  private calculateEMA(data: EnrichedOHLCVData[], period: number): void {
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((acc, d) => acc + d.close, 0) / period;

    for (let i = period - 1; i < data.length; i++) {
      if (i === period - 1) {
        data[i][`EMA_${period}`] = ema;
      } else {
        ema = (data[i].close - ema) * multiplier + ema;
        data[i][`EMA_${period}`] = ema;
      }
    }
  }

  private calculateMACD(data: EnrichedOHLCVData[]): void {
    this.calculateEMA(data, 12);
    this.calculateEMA(data, 26);

    for (let i = 0; i < data.length; i++) {
      if (data[i].EMA_12 !== undefined && data[i].EMA_26 !== undefined) {
        data[i].MACD = data[i].EMA_12 - data[i].EMA_26;
      }
    }

    // MACD Signal line (9-period EMA of MACD)
    const macdValues = data.map(d => d.MACD || 0);
    const signalMultiplier = 2 / (9 + 1);
    let signalEma = macdValues.slice(0, 9).reduce((acc, v) => acc + v, 0) / 9;

    for (let i = 8; i < data.length; i++) {
      if (i === 8) {
        data[i].MACD_signal = signalEma;
      } else {
        signalEma = (macdValues[i] - signalEma) * signalMultiplier + signalEma;
        data[i].MACD_signal = signalEma;
      }
      if (data[i].MACD !== undefined && data[i].MACD_signal !== undefined) {
        data[i].MACD_histogram = data[i].MACD - data[i].MACD_signal;
      }
    }
  }

  private calculateRSI(data: EnrichedOHLCVData[], period: number = 14): void {
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    for (let i = period; i < data.length; i++) {
      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const rs = avgGain / (avgLoss || 0.001);
      data[i].RSI = 100 - 100 / (1 + rs);
    }
  }

  private calculateStochastic(data: EnrichedOHLCVData[], period: number = 14): void {
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const low = Math.min(...slice.map(d => d.low));
      const high = Math.max(...slice.map(d => d.high));
      data[i].STOCH_K = ((data[i].close - low) / (high - low || 1)) * 100;
    }

    // %D is 3-period SMA of %K
    for (let i = period + 1; i < data.length; i++) {
      const sum = data.slice(i - 2, i + 1).reduce((acc, d) => acc + (d.STOCH_K || 0), 0);
      data[i].STOCH_D = sum / 3;
    }
  }

  private calculateBollingerBands(data: EnrichedOHLCVData[], period: number = 20): void {
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((acc, d) => acc + d.close, 0) / period;
      const variance = slice.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / period;
      const std = Math.sqrt(variance);

      data[i].BB_middle = mean;
      data[i].BB_std = std;
      data[i].BB_upper = mean + std * 2;
      data[i].BB_lower = mean - std * 2;
      data[i].BB_width = (data[i].BB_upper - data[i].BB_lower) / mean;
    }
  }

  private calculateATR(data: EnrichedOHLCVData[], period: number = 14): void {
    const trueRanges: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const highLow = data[i].high - data[i].low;
      const highClose = Math.abs(data[i].high - data[i - 1].close);
      const lowClose = Math.abs(data[i].low - data[i - 1].close);
      trueRanges.push(Math.max(highLow, highClose, lowClose));
    }

    for (let i = period; i < data.length; i++) {
      const atr = trueRanges.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      data[i].ATR = atr;
    }
  }

  private calculateOBV(data: EnrichedOHLCVData[]): void {
    let obv = 0;
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        data[i].OBV = data[i].volume;
      } else {
        const sign = data[i].close > data[i - 1].close ? 1 : data[i].close < data[i - 1].close ? -1 : 0;
        obv += sign * data[i].volume;
        data[i].OBV = obv;
      }
    }
  }

  private calculateVWAP(data: EnrichedOHLCVData[]): void {
    let cumulativeVolume = 0;
    let cumulativeVolumePrice = 0;

    for (let i = 0; i < data.length; i++) {
      const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
      cumulativeVolumePrice += typicalPrice * data[i].volume;
      cumulativeVolume += data[i].volume;
      data[i].VWAP = cumulativeVolumePrice / cumulativeVolume;
    }
  }

  private calculateADX(data: EnrichedOHLCVData[], period: number = 14): void {
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const trueRanges: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const highDiff = data[i].high - data[i - 1].high;
      const lowDiff = data[i - 1].low - data[i].low;

      plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

      const highLow = data[i].high - data[i].low;
      const highClose = Math.abs(data[i].high - data[i - 1].close);
      const lowClose = Math.abs(data[i].low - data[i - 1].close);
      trueRanges.push(Math.max(highLow, highClose, lowClose));
    }

    for (let i = period; i < data.length; i++) {
      const atr = trueRanges.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const plusDMSum = plusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
      const minusDMSum = minusDM.slice(i - period, i).reduce((a, b) => a + b, 0);

      const plusDI = (plusDMSum / atr) * 100;
      const minusDI = (minusDMSum / atr) * 100;
      const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1)) * 100;

      data[i].PLUS_DI = plusDI;
      data[i].MINUS_DI = minusDI;

      if (i >= period * 2) {
        const dxSlice = [];
        for (let j = i - period + 1; j <= i; j++) {
          if (data[j].PLUS_DI !== undefined && data[j].MINUS_DI !== undefined) {
            const dxVal = (Math.abs(data[j].PLUS_DI - data[j].MINUS_DI) / (data[j].PLUS_DI + data[j].MINUS_DI || 1)) * 100;
            dxSlice.push(dxVal);
          }
        }
        data[i].ADX = dxSlice.reduce((a, b) => a + b, 0) / dxSlice.length;
      }
    }
  }

  private calculateCCI(data: EnrichedOHLCVData[], period: number = 20): void {
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const typicalPrices = slice.map(d => (d.high + d.low + d.close) / 3);
      const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
      const meanDeviation = typicalPrices.reduce((acc, tp) => acc + Math.abs(tp - sma), 0) / period;
      const currentTP = (data[i].high + data[i].low + data[i].close) / 3;
      data[i].CCI = (currentTP - sma) / (0.015 * meanDeviation || 1);
    }
  }

  private calculateWilliamsR(data: EnrichedOHLCVData[], period: number = 14): void {
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const high = Math.max(...slice.map(d => d.high));
      const low = Math.min(...slice.map(d => d.low));
      data[i].WILLR = ((high - data[i].close) / (high - low || 1)) * -100;
    }
  }

  private calculateMFI(data: EnrichedOHLCVData[], period: number = 14): void {
    const moneyFlows: number[] = [];
    const positiveFlows: number[] = [];
    const negativeFlows: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
      const moneyFlow = typicalPrice * data[i].volume;
      moneyFlows.push(moneyFlow);

      if (i > 0) {
        const prevTP = (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3;
        positiveFlows.push(typicalPrice > prevTP ? moneyFlow : 0);
        negativeFlows.push(typicalPrice < prevTP ? moneyFlow : 0);
      }
    }

    for (let i = period; i < data.length; i++) {
      const posSum = positiveFlows.slice(i - period, i).reduce((a, b) => a + b, 0);
      const negSum = negativeFlows.slice(i - period, i).reduce((a, b) => a + b, 0);
      const moneyRatio = posSum / (negSum || 0.001);
      data[i].MFI = 100 - 100 / (1 + moneyRatio);
    }
  }

  private calculateCMF(data: EnrichedOHLCVData[], period: number = 20): void {
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      let mfVolumeSum = 0;
      let volumeSum = 0;

      for (const d of slice) {
        const mfMultiplier = ((d.close - d.low) - (d.high - d.close)) / (d.high - d.low || 1);
        mfVolumeSum += mfMultiplier * d.volume;
        volumeSum += d.volume;
      }

      data[i].CMF = mfVolumeSum / (volumeSum || 1);
    }
  }

  private calculateROC(data: EnrichedOHLCVData[], period: number = 12): void {
    for (let i = period; i < data.length; i++) {
      data[i].ROC = ((data[i].close - data[i - period].close) / data[i - period].close) * 100;
    }
  }

  private calculateAroon(data: EnrichedOHLCVData[], period: number = 25): void {
    for (let i = period; i < data.length; i++) {
      const slice = data.slice(i - period, i + 1);
      const highs = slice.map(d => d.high);
      const lows = slice.map(d => d.low);

      const highIndex = highs.indexOf(Math.max(...highs));
      const lowIndex = lows.indexOf(Math.min(...lows));

      data[i].AROON_UP = ((period - (period - highIndex)) / period) * 100;
      data[i].AROON_DOWN = ((period - (period - lowIndex)) / period) * 100;
    }
  }

  private calculateElderRay(data: EnrichedOHLCVData[]): void {
    this.calculateEMA(data, 13);

    for (let i = 0; i < data.length; i++) {
      if (data[i].EMA_13 !== undefined) {
        data[i].BULL_POWER = data[i].high - data[i].EMA_13;
        data[i].BEAR_POWER = data[i].low - data[i].EMA_13;
      }
    }
  }

  private calculateTSI(data: EnrichedOHLCVData[]): void {
    const priceChanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      priceChanges.push(data[i].close - data[i - 1].close);
    }

    // Double smoothed (25, 13)
    const ema25 = this.emaArray(priceChanges, 25);
    const ema13of25 = this.emaArray(ema25, 13);

    const absPriceChanges = priceChanges.map(Math.abs);
    const ema25Abs = this.emaArray(absPriceChanges, 25);
    const ema13of25Abs = this.emaArray(ema25Abs, 13);

    for (let i = 40; i < data.length; i++) {
      const idx = i - 1;
      if (idx < ema13of25.length) {
        data[i].TSI = (ema13of25[idx] / (ema13of25Abs[idx] || 0.001)) * 100;
      }
    }

    // TSI Signal (7-period EMA of TSI)
    const tsiValues = data.map(d => d.TSI || 0);
    const tsiSignal = this.emaArray(tsiValues, 7);
    for (let i = 0; i < data.length && i < tsiSignal.length; i++) {
      data[i].TSI_signal = tsiSignal[i];
    }
  }

  private emaArray(values: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period - 1; i < values.length; i++) {
      if (i === period - 1) {
        result.push(ema);
      } else {
        ema = (values[i] - ema) * multiplier + ema;
        result.push(ema);
      }
    }
    return result;
  }

  private calculateDonchian(data: EnrichedOHLCVData[], period: number = 20): void {
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      data[i].DONCHIAN_HIGH = Math.max(...slice.map(d => d.high));
      data[i].DONCHIAN_LOW = Math.min(...slice.map(d => d.low));
      data[i].DONCHIAN_MID = (data[i].DONCHIAN_HIGH + data[i].DONCHIAN_LOW) / 2;
    }
  }

  private calculateMomentum(data: EnrichedOHLCVData[]): void {
    for (let i = 5; i < data.length; i++) {
      data[i].MOMENTUM_5 = (data[i].close - data[i - 5].close) / data[i - 5].close;
    }

    for (let i = 10; i < data.length; i++) {
      data[i].MOMENTUM_10 = (data[i].close - data[i - 10].close) / data[i - 10].close;
    }
  }

  private calculateSAR(data: EnrichedOHLCVData[]): void {
    // Simplified SAR using 5-period rolling mean
    for (let i = 4; i < data.length; i++) {
      const slice = data.slice(i - 4, i + 1);
      data[i].SAR = slice.reduce((acc, d) => acc + d.close, 0) / 5;
    }
  }
}