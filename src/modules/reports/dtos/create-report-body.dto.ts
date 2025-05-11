import { IsInt, IsPositive, IsString } from 'class-validator';

export class CreateReportBodyDto {
  @IsInt()
  @IsPositive()
  readonly gameId: number;

  @IsString()
  readonly reason: string;
}
