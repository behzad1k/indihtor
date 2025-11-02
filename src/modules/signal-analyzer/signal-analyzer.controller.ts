import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { SignalAnalyzerService } from './signal-analyzer.service';
import { AnalyzeSymbolDto, SignalInfoDto } from './dto/analysis.dto';
import { SignalConfidence } from './constants/signal-confidence.constant';

@Controller('live-analysis')
export class SignalAnalyzerController {
  constructor(private readonly signalAnalyzerService: SignalAnalyzerService) {}

  @Post('analyze')
  async analyzeSymbol(@Body() dto: AnalyzeSymbolDto) {
    try {
      const result = await this.signalAnalyzerService.analyzeSymbolAllTimeframes(
        dto.symbol.toUpperCase(),
        dto.timeframes,
      );

      // Save result
      await this.signalAnalyzerService.saveAnalysisResult(result);

      return {
        success: true,
        symbol: result.symbol,
        timestamp: result.timestamp,
        timeframes: result.timeframes,
        combinations: result.combinations,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('signal-info/:signalName')
  getSignalInfo(@Param('signalName') signalName: string) {
    const info = SignalConfidence[signalName];

    if (!info) {
      throw new HttpException(
        { success: false, error: 'Signal not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      signal_name: signalName,
      confidence: info.confidence,
      suitable_timeframes: info.timeframes,
      category: info.category,
    };
  }

  @Get('all-signals')
  getAllSignalDefinitions() {
    const signals: SignalInfoDto[] = [];

    for (const [signalName, info] of Object.entries(SignalConfidence)) {
      signals.push({
        name: signalName,
        confidence: info.confidence,
        timeframes: info.timeframes,
        category: info.category,
      });
    }

    signals.sort((a, b) => b.confidence - a.confidence);

    return {
      success: true,
      signals,
      total: signals.length,
    };
  }
}