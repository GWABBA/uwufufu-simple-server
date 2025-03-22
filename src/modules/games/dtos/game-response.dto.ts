import { Exclude, Expose, Type } from 'class-transformer';
import { CategoryResponseDto } from 'src/modules/categories/dtos/category-response.dto';

class User {
  @Expose()
  id: number;
  @Expose()
  name: string;
  @Expose()
  profileImage: string;
}

@Exclude()
export class GameResponseDto {
  @Expose()
  id: number;

  @Expose()
  title: string;

  @Expose()
  description: string;

  @Expose()
  visibility: string;

  @Expose()
  coverImage: string;

  @Expose()
  slug: string;

  @Expose()
  isNsfw: boolean;

  @Expose()
  categoryId: number;

  @Expose()
  @Type(() => CategoryResponseDto)
  category: CategoryResponseDto;

  @Expose()
  locale: string;

  @Expose()
  selectionCount: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => User)
  user: User;

  @Expose()
  plays: number;

  @Expose()
  selectionsCount: number;
}
