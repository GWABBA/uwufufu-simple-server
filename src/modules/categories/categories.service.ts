import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';
import { RedisService } from 'src/core/redis/redis.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly redisService: RedisService,
  ) {}

  async getCategories() {
    // 🔍 Check if categories are cached in Redis
    const cachedCategories = await this.redisService.getValue('all-categories');

    if (cachedCategories) {
      return JSON.parse(cachedCategories);
    }

    // 🚀 Fetch from database if not cached
    const categories = await this.categoriesRepository.find();

    // 📝 Cache the result in Redis
    await this.redisService.setValue(
      'all-categories',
      JSON.stringify(categories),
      60 * 60,
    );

    return categories;
  }
}
