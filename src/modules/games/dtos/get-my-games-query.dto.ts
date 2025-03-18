import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class GetMyGamesQueryDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  page: number = 1; // Default value

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  perPage: number = 10; // Default value

  @IsString()
  @IsOptional()
  search?: string;
}
