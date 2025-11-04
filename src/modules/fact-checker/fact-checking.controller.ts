/**
 * Fact-Checking Controller
 *
 * REST API endpoints for signal validation and accuracy tracking
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FactCheckingService } from './fact-checking.service';
import {
  BulkFactCheckDto,
  FactCheckSingleDto,
  AdjustConfidenceDto,
  BulkAdjustDto,
} from './dto/fact-checking.dto';

@Controller('api/fact-check')
export class FactCheckingController {
  private readonly logger = new Logger(FactCheckingController.name);

  constructor(private readonly factCheckingService: FactCheckingService) {}

  /**
   * POST /api/fact-check/bulk-signals
   * Bulk fact-check live signals with parallel processing
   */
  @Post('bulk-signals')
  async bulkFactCheckLiveSignals(@Body() dto: BulkFactCheckDto) {
    try {
      this.logger.log('Starting bulk fact-check...');

      const startTime = Date.now();
      const results = await this.factCheckingService.bulkFactCheckLiveSignals({
        symbol: dto.symbol,
        limit: dto.limit,
        useFiltering: dto.useFiltering ?? true,
        maxWorkers: dto.maxWorkers,
      });

      const elapsed = Date.now() - startTime;

      this.logger.log('Bulk fact-check completed');
      this.logger.log(`Time taken: ${(elapsed / 60000).toFixed(1)} minutes`);
      this.logger.log(`Total combinations: ${results.totalChecked}`);
      this.logger.log(`Successfully optimized: ${results.correctPredictions}`);
      this.logger.log(`Failed: ${results.incorrectPredictions}`);

      return {
        success: true,
        results,
        timeElapsed: elapsed,
      };
    } catch (error) {
      this.logger.error(`Error in bulk fact-check: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/fact-check/single
   * Fact-check a single signal
   */
  @Post('single')
  async factCheckSingleSignal(@Body() dto: FactCheckSingleDto) {
    try {
      const result = await this.factCheckingService.factCheckSignal(
        dto.signalName,
        dto.signalType,
        dto.timeframe,
        new Date(dto.detectedAt),
        dto.priceAtDetection,
        dto.symbol,
        dto.candlesAhead,
        dto.stopLossPct,
      );

      if (!result) {
        throw new HttpException(
          { success: false, error: 'Insufficient data for fact-checking' },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error(`Error fact-checking signal: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/fact-check/signal-accuracy/:signalName
   * Get accuracy statistics for a specific signal
   */
  @Get('signal-accuracy/:signalName')
  async getSignalAccuracy(
    @Param('signalName') signalName: string,
    @Query('timeframe') timeframe?: string,
    @Query('minSamples') minSamples?: string,
  ) {
    try {
      const accuracy = await this.factCheckingService.calculateSignalAccuracy(
        signalName,
        timeframe,
        minSamples ? parseInt(minSamples, 10) : 10,
      );

      if (!accuracy) {
        throw new HttpException(
          {
            success: false,
            error: 'Insufficient data',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        accuracy,
      };
    } catch (error) {
      this.logger.error(`Error getting accuracy: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/fact-check/adjust-confidence
   * Adjust confidence for a specific signal based on historical performance
   */
  @Post('adjust-confidence')
  async adjustSignalConfidence(@Body() dto: AdjustConfidenceDto) {
    try {
      const result = await this.factCheckingService.adjustSignalConfidence(
        dto.signalName,
        dto.timeframe,
        dto.minSamples || 10,
      );

      if (!result) {
        throw new HttpException(
          {
            success: false,
            error: 'Insufficient samples',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        adjustment: result,
      };
    } catch (error) {
      this.logger.error(`Error adjusting confidence: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/fact-check/bulk-adjust
   * Adjust all signals with sufficient data
   */
  @Post('bulk-adjust')
  async bulkAdjustSignals(@Body() dto: BulkAdjustDto) {
    try {
      const results = await this.factCheckingService.bulkAdjustAllSignals(
        dto.minSamples || 10,
      );

      return {
        success: true,
        results,
      };
    } catch (error) {
      this.logger.error(`Error in bulk adjust: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/fact-check/adjusted-confidence/:signalName
   * Get adjusted confidence for a signal
   */
  @Get('adjusted-confidence/:signalName')
  async getAdjustedConfidence(
    @Param('signalName') signalName: string,
    @Query('timeframe') timeframe: string,
  ) {
    try {
      if (!timeframe) {
        throw new HttpException(
          {
            success: false,
            error: 'Timeframe parameter required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const confidence = await this.factCheckingService.getAdjustedConfidence(
        signalName,
        timeframe,
      );

      return {
        success: true,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Error getting adjusted confidence: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/fact-check/adjustments
   * Get all confidence adjustments
   */
  @Get('adjustments')
  async getAllAdjustments() {
    try {
      const adjustments = await this.factCheckingService.getAllAdjustments();

      return {
        success: true,
        adjustments,
        total: adjustments.length,
      };
    } catch (error) {
      this.logger.error(`Error getting adjustments: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/fact-check/report
   * Generate comprehensive validation report
   */
  @Get('report')
  async generateReport() {
    try {
      const report = await this.factCheckingService.generateValidationReport();

      return {
        success: true,
        report,
      };
    } catch (error) {
      this.logger.error(`Error generating report: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}