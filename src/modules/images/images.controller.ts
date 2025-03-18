import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/core/s3/s3.service';
import { UploadImageDto } from './dtos/uploadImage.dto';

@Controller('images')
export class ImagesController {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB limit
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|gif|png|webp)$/)) {
          return callback(
            new BadRequestException('Unsupported file type.'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadImageDto,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    const { type } = body;

    const fileUrl = await this.s3Service.uploadFile(file, type);
    return { ...fileUrl };
  }
}
