/**
 * Signal Combination Analysis Controller
 *
 * Endpoints for analyzing and retrieving signal combinations
 */

import { analyzeCombinationsDTO } from '@modules/signal-combinations/dto/analyze-combinations.dto';
import { analyzeCrossTfCombinationsDTO } from '@modules/signal-combinations/dto/analyze-cross-tf.dto';
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
import { SignalCombinationService } from './signal-combination-analyzer.service';

@Controller('api/combo-analysis')
export class SignalCombinationController {
  private readonly logger = new Logger(SignalCombinationController.name);

  constructor(
    private readonly comboAnalyzerService: SignalCombinationService,
  ) {}

  /**
   * POST /api/combo-analysis/analyze
   * Trigger single-timeframe combination analysis
   */
  @Post('analyze')
  async analyzeCombinations(@Body() body: analyzeCombinationsDTO) {
    try {
      const {
        timeframe,
        min_samples = 20,
        min_combo_size = 2,
        max_combo_size = 4,
        min_accuracy = 70,
        max_combinations_per_symbol = 500,
      } = body;

      // Validate combo sizes
      if (min_combo_size < 2 || max_combo_size > 10) {
        throw new HttpException(
          'Combo size must be between 2 and 10',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`🚀 Starting combination analysis...`);
      this.logger.log(`   Min samples: ${min_samples}`);
      this.logger.log(`   Combo size: ${min_combo_size}-${max_combo_size}`);

      let result;
      result = await this.comboAnalyzerService.analyzeCombinations(
        timeframe,
        min_samples,
        min_combo_size,
        max_combo_size,
        min_accuracy,
        max_combinations_per_symbol,
      );

      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error(`❌ Combination analysis failed: ${error.message}`);
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
   * POST /api/combo-analysis/analyze-cross-tf
   * Trigger cross-timeframe combination analysis
   */
  @Post('analyze-cross-tf')
  async analyzeCrossTfCombinations(@Body() body: analyzeCrossTfCombinationsDTO) {
    try {
      const {
        min_samples = 20,
        min_combo_size = 2,
        max_combo_size = 4,
        max_combinations_per_symbol = 500,
        min_time_frames = 2,
        max_time_frames = 4
      } = body;

      // Validate combo sizes
      if (min_combo_size < 2 || max_combo_size > 10) {
        throw new HttpException(
          'Combo size must be between 2 and 10',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`🚀 Starting cross-timeframe combination analysis...`);
      this.logger.log(`   Min samples: ${min_samples}`);
      this.logger.log(`   Combo size: ${min_combo_size}-${max_combo_size}`);

      const results = await this.comboAnalyzerService.analyzeCrossTfCombinations(
        min_samples,
        min_combo_size,
        max_combo_size,
        min_time_frames,
        max_time_frames,
        max_combinations_per_symbol,
      );

      return {
        success: true,
        result: results,
      };
    } catch (error) {
      this.logger.error(`❌ Cross-TF combination analysis failed: ${error.message}`);
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
   * GET /api/combo-analysis/top
   * Get top performing same-timeframe combinations
   */
  @Get('top')
  async getTopCombinations(
    @Query('timeframe') timeframe?: string,
    @Query('min_accuracy') minAccuracy?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const combinations = await this.comboAnalyzerService.getTopCombinations(
        timeframe,
        minAccuracy ? parseFloat(minAccuracy) : 60.0,
        limit ? parseInt(limit, 10) : 20,
      );

      return {
        success: true,
        combinations,
        count: combinations.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get top combinations: ${error.message}`);
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
   * GET /api/combo-analysis/top-cross-tf
   * Get top performing cross-timeframe combinations
   */
  @Get('top-cross-tf')
  async getTopCrossTfCombinations(
    @Query('min_accuracy') minAccuracy?: string,
    @Query('min_timeframes') minTimeframes?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const combinations = await this.comboAnalyzerService.getTopCrossTfCombinations(
        minAccuracy ? parseFloat(minAccuracy) : 60.0,
        minTimeframes ? parseInt(minTimeframes, 10) : 2,
        limit ? parseInt(limit, 10) : 20,
      );

      return {
        success: true,
        combinations,
        count: combinations.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get top cross-TF combinations: ${error.message}`);
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
   * GET /api/combo-analysis/timeframe/:timeframe
   * Get all combinations for a specific timeframe
   */
  @Get('timeframe/:timeframe')
  async getTimeframeCombinations(
    @Param('timeframe') timeframe: string,
    @Query('min_accuracy') minAccuracy?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const combinations = await this.comboAnalyzerService.getTopCombinations(
        timeframe,
        minAccuracy ? parseFloat(minAccuracy) : 50.0,
        limit ? parseInt(limit, 10) : 50,
      );

      return {
        success: true,
        timeframe,
        combinations,
        count: combinations.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get timeframe combinations: ${error.message}`);
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