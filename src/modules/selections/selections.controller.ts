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
import { UpdateSelectionNameBodyDto } from './dtos/update-selection-name-body.dto';
import { GetSelectionsParams } from './dtos/get-selections-params.dto';

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
  async createSelectionWithImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateSelectionWithImageDto,
    @Req() req: AuthRequest,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    const user = req.user;
    const { type, worldcupId } = body;

    const uploadedFileObject = await this.s3Service.uploadFile(file, type);
    return await this.selectionsService.createSelectionWithImage(
      uploadedFileObject.fileName,
      worldcupId,
      uploadedFileObject.url,
      user,
    );
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

  @Patch('/name')
  @UseGuards(JwtAuthGuard)
  async updateSelectionName(
    @Body() body: UpdateSelectionNameBodyDto,
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
