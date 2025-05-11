import { Transform } from 'class-transformer';
import { IsNumber, IsPositive, IsString } from 'class-validator';

export class GetStartedGameWithoutSlugParamsDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  id: number;
}
