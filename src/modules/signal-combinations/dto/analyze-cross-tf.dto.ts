import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class analyzeCrossTfCombinationsDTO {
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
  max_combinations_per_symbol?: number;
  @IsOptional()
  @IsNumber()
  min_time_frames?:number

  @IsOptional()
  @IsNumber()
  max_time_frames?: number;
}