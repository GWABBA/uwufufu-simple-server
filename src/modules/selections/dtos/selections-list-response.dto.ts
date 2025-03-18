import { Exclude, Expose, Type } from 'class-transformer';
import { SelectionResponseDto } from './selection-response.dto';

@Exclude()
export class SelectionsListResponseDto {
  @Expose()
  perPage: number;

  @Expose()
  page: number;

  @Expose()
  total: number;

  @Expose()
  @Type(() => SelectionResponseDto)
  data: SelectionResponseDto[];
}
