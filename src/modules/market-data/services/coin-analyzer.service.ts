import { Injectable, Logger } from '@nestjs/common';
import { ExchangeType } from '@/types/exchange.types';
import { ExchangeAggregatorService } from '../../external-api/services/exchange-aggregator.service';
import { SignalAnalyzerService } from '../../signal-analyzer/signal-analyzer.service';

@Injectable()
export class CoinAnalyzerService {
  private readonly logger = new Logger(CoinAnalyzerService.name);
  private readonly TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '2h', '4h'];

  constructor(
    private signalAnalyzer: SignalAnalyzerService,
    private exchangeService: ExchangeAggregatorService,
  ) {}

  async fetchTopSymbols(limit: number = 100): Promise<string[]> {
    try {
      // Fetch from Binance or KuCoin
      const symbols = await this.exchangeService.getAllSymbols(ExchangeType.BINANCE);
      return symbols.slice(0, limit);
    } catch (error) {
      this.logger.error(`Failed to fetch symbols: ${error.message}`);
      return ['BTC', 'ETH', 'SOL']; // Fallback
    }
  }

  async analyzeSymbol(symbol: string): Promise<any> {
    try {
      this.logger.debug(`Analyzing ${symbol}...`);

      // Analyze across all timeframes
      const result = await this.signalAnalyzer.analyzeSymbolAllTimeframes(
        symbol,
        this.TIMEFRAMES,
      );

      await this.signalAnalyzer.saveAnalysisResult(result)

      // Save results (automatically done in SignalAnalyzerService)
      // This creates live_signals, live_tf_combos entries

      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze ${symbol}: ${error.message}`);
      return null;
    }
  }
}