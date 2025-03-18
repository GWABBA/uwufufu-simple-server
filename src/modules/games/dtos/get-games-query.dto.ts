import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { GamesListSortBy } from 'src/core/enums/games-list-sort-by.enum';

export class GetGamesQueryDto {
  @IsOptional()
  @IsString()
  @IsEnum(GamesListSortBy)
  @Transform(({ value }) => value ?? GamesListSortBy.Latest) // Replace with your default
  sortBy: GamesListSortBy;

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

  @IsBoolean()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  includeNsfw?: boolean;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : value ? [Number(value)] : [],
  )
  @IsNumber({}, { each: true }) // ✅ Ensures each value is a number
  categories: number[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  @IsString({ each: true })
  locale: string[];
}
