import { IsNumber, IsString, IsUrl } from 'class-validator';

export class AddResultImage {
  @IsNumber()
  startedGameId: number;

  @IsString()
  @IsUrl()
  imageUrl: string;
}
