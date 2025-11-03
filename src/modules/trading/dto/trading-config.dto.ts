import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
  Max
} from 'class-validator';

export class CreateTradingConfigDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(100)
  initialBankroll: number;

  @IsOptional()
  @IsEnum(['PAPER', 'REAL'])
  tradingMode?: 'PAPER' | 'REAL' = 'PAPER';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPriceChange24h?: number = 20.0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  minBuyingWindowPct?: number = 0;

  @IsOptional()
  @IsNumber()
  maxBuyingWindowTime?: number = 600;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  maxProfitThresholdPct?: number = 2.5;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  stopLossPct?: number = 70.0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  splitBankrollTo?: number = 5;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxPositions?: number = 5;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPatternsThreshold?: number = 2;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minAccuracyThreshold?: number = 60.0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minCrossTfAlignment?: number = 3;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStrongSignalsPerHour?: number = 5;

  @IsOptional()
  @IsNumber()
  @Min(0)
  signalCooldownHours?: number = 6;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minScalpAgreementPct?: number = 66.67;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRecentLosses?: number = 2;

  // Weights
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight24hChange?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightValidatedPatterns?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightCrossTfAlignment?: number = 15;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightStrongSignalDensity?: number = 15;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightVolumeConfirmation?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightScalpAgreement?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightMarketStructure?: number = 10;
}

export class UpdateTradingConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPriceChange24h?: number;

  // ... (same optional fields as Create)
}