import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class analyzeCombinationsDTO {
  @IsString()
  timeframe: string;

  @IsOptional()
  @IsNumber()
  min_samples?: number;

  @IsOptional()
  @IsNumber()
  min_combo_size?: number;

  @IsOptional()
  @IsNumber()
  max_combo_size?: number;

  @IsOptional()
  @IsNumber()
  min_accuracy?: number;

  @IsOptional()
  @IsNumber()
  max_combinations_per_symbol?: number;
}