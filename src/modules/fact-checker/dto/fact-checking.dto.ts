/**
 * Data Transfer Objects for Fact-Checking API
 */

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class BulkFactCheckDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  useFiltering?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxWorkers?: number;
}

export class FactCheckSingleDto {
  @IsString()
  signalName: string;

  @IsEnum(['BUY', 'SELL'])
  signalType: 'BUY' | 'SELL';

  @IsString()
  timeframe: string;

  @IsDateString()
  detectedAt: string;

  @IsNumber()
  @Min(0)
  priceAtDetection: number;

  @IsString()
  symbol: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  candlesAhead?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  stopLossPct?: number;
}

export class AdjustConfidenceDto {
  @IsString()
  signalName: string;

  @IsString()
  timeframe: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minSamples?: number;
}

export class BulkAdjustDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  minSamples?: number;
}

export class GetSignalAccuracyDto {
  @IsOptional()
  @IsString()
  timeframe?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minSamples?: number;
}