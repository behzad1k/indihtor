import { Injectable } from '@nestjs/common';
import { EnrichedOHLCVData, SignalMap } from '@/types/analysis.types';

@Injectable()
export class VolumeProfileAnalyzerService {
  analyze(data: EnrichedOHLCVData[]): SignalMap {
    const signals: SignalMap = {};

    if (data.length < 50) {
      return signals;
    }

    const curr = data[data.length - 1];

    // Calculate volume profile
    const profile = this.calculateVolumeProfile(data.slice(-50));

    if (!profile) {
      return signals;
    }

    const { poc, vah, val, highVolumeNodes, lowVolumeNodes } = profile;

    // POC as support/resistance
    if (Math.abs(curr.close - poc) / poc < 0.01) {
      if (curr.close > poc) {
        signals.poc_support = { signal: 'BUY', strength: 'MODERATE' };
      } else {
        signals.poc_resistance = { signal: 'SELL', strength: 'MODERATE' };
      }
    }

    // Value Area High/Low
    if (Math.abs(curr.close - vah) / vah < 0.01) {
      signals.value_area_high = { signal: 'SELL', strength: 'MODERATE' };
    }

    if (Math.abs(curr.close - val) / val < 0.01) {
      signals.value_area_low = { signal: 'BUY', strength: 'MODERATE' };
    }

    // High volume nodes
    const nearHVN = highVolumeNodes.some(node => Math.abs(curr.close - node) / node < 0.01);
    if (nearHVN) {
      signals.high_volume_node = { signal: 'BUY', strength: 'MODERATE' };
    }

    // Low volume nodes
    const nearLVN = lowVolumeNodes.some(node => Math.abs(curr.close - node) / node < 0.01);
    if (nearLVN) {
      signals.low_volume_node = { signal: 'BUY', strength: 'WEAK' };
    }

    return signals;
  }

  private calculateVolumeProfile(data: EnrichedOHLCVData[]) {
    if (data.length === 0) return null;

    const priceRange = {
      min: Math.min(...data.map(d => d.low)),
      max: Math.max(...data.map(d => d.high)),
    };

    const bucketCount = 20;
    const bucketSize = (priceRange.max - priceRange.min) / bucketCount;
    const buckets: number[] = new Array(bucketCount).fill(0);

    // Distribute volume into price buckets
    for (const candle of data) {
      const avgPrice = (candle.high + candle.low + candle.close) / 3;
      const bucketIndex = Math.min(
        Math.floor((avgPrice - priceRange.min) / bucketSize),
        bucketCount - 1,
      );
      buckets[bucketIndex] += candle.volume;
    }

    // Find POC (Point of Control) - highest volume bucket
    const maxVolume = Math.max(...buckets);
    const pocIndex = buckets.indexOf(maxVolume);
    const poc = priceRange.min + (pocIndex + 0.5) * bucketSize;

    // Find Value Area (70% of volume)
    const totalVolume = buckets.reduce((sum, v) => sum + v, 0);
    const targetVolume = totalVolume * 0.7;

    let vaVolume = buckets[pocIndex];
    let vaLowIndex = pocIndex;
    let vaHighIndex = pocIndex;

    while (vaVolume < targetVolume && (vaLowIndex > 0 || vaHighIndex < bucketCount - 1)) {
      const lowVol = vaLowIndex > 0 ? buckets[vaLowIndex - 1] : 0;
      const highVol = vaHighIndex < bucketCount - 1 ? buckets[vaHighIndex + 1] : 0;

      if (lowVol > highVol && vaLowIndex > 0) {
        vaLowIndex--;
        vaVolume += buckets[vaLowIndex];
      } else if (vaHighIndex < bucketCount - 1) {
        vaHighIndex++;
        vaVolume += buckets[vaHighIndex];
      } else {
        break;
      }
    }

    const vah = priceRange.min + (vaHighIndex + 1) * bucketSize;
    const val = priceRange.min + vaLowIndex * bucketSize;

    // Find high/low volume nodes
    const avgVolume = totalVolume / bucketCount;
    const highVolumeNodes = buckets
    .map((vol, idx) => ({ vol, price: priceRange.min + (idx + 0.5) * bucketSize }))
    .filter(node => node.vol > avgVolume * 1.5)
    .map(node => node.price);

    const lowVolumeNodes = buckets
    .map((vol, idx) => ({ vol, price: priceRange.min + (idx + 0.5) * bucketSize }))
    .filter(node => node.vol < avgVolume * 0.5)
    .map(node => node.price);

    return {
      poc,
      vah,
      val,
      highVolumeNodes,
      lowVolumeNodes,
    };
  }
}