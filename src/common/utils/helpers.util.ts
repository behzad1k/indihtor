export class Helpers {
  static calculateValidityHours(confidence: number, patternCount: number): number {
    const base = 12;
    const confidenceFactor = (confidence - 0.7) / 0.3;
    const patternFactor = Math.min(patternCount / 200, 1.0);
    const totalFactor = confidenceFactor * 0.6 + patternFactor * 0.4;
    const validity = base + 48 * totalFactor;
    return Math.floor(validity);
  }

  static roundToDecimals(value: number, decimals: number): number {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
}