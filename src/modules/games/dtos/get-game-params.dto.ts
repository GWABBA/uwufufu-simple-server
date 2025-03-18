import { Transform } from 'class-transformer';
import { IsNumber, IsPositive, IsString } from 'class-validator';

export class GetGameParamsDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  id: number;
}

export class GetGameBySlugParamsDto {
  @IsString()
  slug: string;
}
