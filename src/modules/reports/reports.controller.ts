import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { AuthRequest } from '../auth/types/auth-request.interface';
import { CreateReportBodyDto } from './dtos/create-report-body.dto';
import { MessageResponseDto } from 'src/core/dtos/message-response.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createReport(
    @Req() req: AuthRequest,
    @Body() createReportBodyDto: CreateReportBodyDto,
  ): Promise<MessageResponseDto> {
    const user = req.user;
    return this.reportsService.createReport(createReportBodyDto, user);
  }
}
