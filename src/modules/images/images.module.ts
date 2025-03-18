import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { S3Service } from 'src/core/s3/s3.service';

@Module({
  controllers: [ImagesController],
  providers: [S3Service],
  exports: [],
})
export class ImagesModule {}
