import { Transform, Type } from 'class-transformer';
import { IsNumber, IsPositive, IsOptional } from 'class-validator';

export class GetSelectionsForEditParams {
  @Type(() => Number)
  @IsNumber()
  worldcupId: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10)) // ✅ Ensures default value
  perPage: number = 10;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1)) // ✅ Ensures default value
  page: number = 1;

  @IsOptional()
  keyword?: string;
}
