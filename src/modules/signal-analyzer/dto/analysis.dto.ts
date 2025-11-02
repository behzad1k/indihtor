import { IsString, IsArray, IsOptional, IsNumber } from 'class-validator';
import { TimeframeAnalysis, TimeframeError, CombinationData } from '../types/analysis.types';

export class AnalyzeSymbolDto {
  @IsString()
  symbol: string;

  @IsArray()
  @IsString({ each: true })
  timeframes: string[];
}

export class AnalysisResultDto {
  @IsString()
  symbol: string;

  @IsString()
  timestamp: string;

  timeframes: Record<string, TimeframeAnalysis | TimeframeError>;

  @IsOptional()
  combinations?: Record<string, CombinationData[]>;
}

export class SignalInfoDto {
  @IsString()
  name: string;

  @IsNumber()
  confidence: number;

  @IsArray()
  @IsString({ each: true })
  timeframes: string[];

  @IsString()
  category: string;
}