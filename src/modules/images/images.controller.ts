import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';

import { S3Service } from 'src/core/s3/s3.service';
import { UploadImageDto } from './dtos/uploadImage.dto';

@Controller('images')
export class ImagesController {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (req, file, cb) => {
          const safe = path
            .basename(file.originalname)
            .replace(/[^a-zA-Z0-9._-]/g, '');
          cb(null, `${Date.now()}-${randomUUID()}-${safe}`);
        },
      }),
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
    if (!file) return { message: 'No file uploaded' };

    const { type } = body;

    try {
      // ✅ RAM(buffer) 업로드 금지: path 기반 업로드 함수 사용
      const uploaded = await this.s3Service.uploadFileFromPath(file, type);
      return { ...uploaded };
    } finally {
      // ✅ tmp 파일 무조건 삭제
      if (file?.path) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
  }
}
