import { Transform } from 'class-transformer';
import { IsNumber, IsPositive, IsString } from 'class-validator';

export class GetStartedGameParamsDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  id: number;

  @IsString()
  slug: string;
}
