import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Locales } from 'src/core/enums/locales.enum';
import { Visibility } from 'src/core/enums/visibility.enum';

export class UpdateGameBodyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  visibility: Visibility;

  @IsBoolean()
  isNsfw: boolean;

  @IsNumber()
  categoryId: number;

  @IsString()
  @IsOptional()
  coverImage: string;

  @IsEnum(Locales)
  locale: Locales;
}
