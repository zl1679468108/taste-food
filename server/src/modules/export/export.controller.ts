import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Res,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MerchantOnly } from '../../common/decorators/shop-scope.decorator';
import { UserRole } from '../../common/constants/enums';
import { resolveAdminTargetShopId } from '../../common/utils/admin-shop-scope';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { ExportService, ExportJobRow } from './export.service';
import { ExportRunnerService } from './export-runner.service';
import { StorageService } from '../storage/storage.service';
import { CreateExportJobDto } from './dto/create-export-job.dto';
import { ExportJobStatus } from '../../common/constants/export';

/**
 * 批量异步导出（T267；T300.5 迁入 /api/merchant 双入口前缀）
 * POST   /api/merchant/export-jobs        提交导出任务（后台异步执行）
 * GET    /api/merchant/export-jobs        列表（按店铺隔离）
 * GET    /api/merchant/export-jobs/:id    任务详情
 * GET    /api/merchant/export-jobs/:id/download  下载产物（仅 completed，流式返回 xlsx）
 *
 * 纯商家后台能力，client/ 无调用，故整体迁前缀并 @MerchantOnly。
 */
@Controller('merchant/export-jobs')
@Roles(UserRole.ADMIN, UserRole.MERCHANT)
@MerchantOnly()
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly exportRunner: ExportRunnerService,
    private readonly storageService: StorageService,
  ) {}

  private resolveShop(user: CurrentUserPayload, requestedShopId?: string): string {
    return resolveAdminTargetShopId(user.shopId, requestedShopId, {
      lockToBoundShop: !!user.shopId,
    });
  }

  @Post()
  async create(
    @Body() dto: CreateExportJobDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<ExportJobRow>> {
    const shopId = this.resolveShop(user, dto.shop_id);
    const job = await this.exportService.createJob({
      shopId,
      userId: user.userId,
      entity: dto.entity,
      format: 'xlsx',
      params: { status: dto.status, maxRows: dto.maxRows },
    });
    // 后台异步执行，不阻塞响应
    this.exportRunner.enqueue(job.id);
    return success(job, '导出任务已提交，完成后可在「导出中心」下载');
  }

  @Get()
  async list(
    @Query('status') status: string | undefined,
    @Query('shop_id') shopIdQuery: string | undefined,
    @Query('page') pageRaw: string | undefined,
    @Query('pageSize') pageSizeRaw: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<{ items: ExportJobRow[]; total: number; page: number; pageSize: number }>> {
    const shopId = this.resolveShop(user, shopIdQuery);
    const page = pageRaw ? parseInt(pageRaw, 10) : 1;
    const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 20;
    const result = await this.exportService.listJobs({ shopId, status, page, pageSize });
    return success(result);
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @Query('shop_id') shopIdQuery: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<ExportJobRow>> {
    const shopId = this.resolveShop(user, shopIdQuery);
    const job = await this.exportService.getJob(id);
    if (!job) throw new NotFoundException('导出任务不存在');
    if (job.shopId !== shopId) throw new ForbiddenException('无权访问该导出任务');
    return success(job);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('shop_id') shopIdQuery: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ): Promise<void> {
    const shopId = this.resolveShop(user, shopIdQuery);
    const job = await this.exportService.getJob(id);
    if (!job) throw new NotFoundException('导出任务不存在');
    if (job.shopId !== shopId) throw new ForbiddenException('无权访问该导出任务');
    if (job.status !== ExportJobStatus.COMPLETED) {
      throw new ConflictException('导出任务尚未完成，请稍后再试');
    }
    if (!job.filePath) throw new NotFoundException('导出文件缺失');

    const file = await this.storageService.downloadBuffer(job.filePath);
    if (!file) throw new NotFoundException('导出文件不存在或已过期');

    const fileName = job.fileName || 'export.xlsx';
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Content-Length', file.buffer.length);
    res.send(file.buffer);
  }
}
