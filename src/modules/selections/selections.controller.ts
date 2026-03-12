import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SelectionsService } from './selections.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateSelectionWithImageDto } from './dtos/create-selection-with-image-body.dto';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { AuthRequest } from '../auth/types/auth-request.interface';
import { S3Service } from 'src/core/s3/s3.service';
import { GetSelectionsForEditParams } from './dtos/get-selections-for-edit-params.dtos';
import { SelectionsListResponseDto } from './dtos/selections-list-response.dto';
import { CreateSelectionWithVideoBodyDto } from './dtos/create-selection-with-video-body.dto';
import { UpdateSelectionBodyDto } from './dtos/update-selection-body.dto';
import { GetSelectionsParams } from './dtos/get-selections-params.dto';
import { diskStorage } from 'multer';
import * as os from 'os';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import {
  getSafeDisplayNameFromOriginalName,
  toAsciiSafeFilename,
} from 'src/core/utils/filename.utils';

@Controller('selections')
export class SelectionsController {
  constructor(
    private readonly selectionsService: SelectionsService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  async getSelections(
    @Query() params: GetSelectionsParams,
  ): Promise<SelectionsListResponseDto> {
    return await this.selectionsService.getSelections(params);
  }

  @Get('mine')
  async getSelectionsForEdit(
    @Query() params: GetSelectionsForEditParams,
  ): Promise<SelectionsListResponseDto> {
    return await this.selectionsService.getSelectionsForEdit(params);
  }

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (req, file, cb) => {
          const safe = toAsciiSafeFilename(file.originalname);
          cb(null, `${Date.now()}-${randomUUID()}-${safe}`);
        },
      }),
      limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
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
  async createSelectionWithImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateSelectionWithImageDto,
    @Req() req: AuthRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const user = req.user;
    const { type, worldcupId } = body;

    const selectionName = getSafeDisplayNameFromOriginalName(file.originalname);

    try {
      const uploaded = await this.s3Service.uploadFileFromPath(file, type);

      return await this.selectionsService.createSelectionWithImage(
        selectionName, // ✅ DB에 넣을 이름(원본 유지)
        worldcupId,
        uploaded.url,
        user,
        uploaded.isVideo, // ✅ webm이면 true
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Upload service is temporarily unavailable',
      );
    } finally {
      // ✅ tmp 파일 무조건 삭제 (실패해도)
      if (file?.path) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
  }

  @Post('video')
  @UseGuards(JwtAuthGuard)
  async createSelectionWithVideo(
    @Body() createSelectionWithVideoBodyDto: CreateSelectionWithVideoBodyDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user;
    return await this.selectionsService.createSelectionWithVideo(
      createSelectionWithVideoBodyDto,
      user,
    );
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async updateSelectionName(
    @Body() body: UpdateSelectionBodyDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user;
    return await this.selectionsService.updateSelectionName(body, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteSelection(@Req() req: AuthRequest, @Param('id') id: string) {
    const user = req.user;
    return await this.selectionsService.deleteSelection(Number(id), user);
  }
}
