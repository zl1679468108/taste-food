import { Injectable, Logger } from '@nestjs/common';
import { ExportService, ExportJobRow } from './export.service';
import { OrderService } from '../order/order.service';
import { StorageService } from '../storage/storage.service';
import { InboxService } from '../inbox/inbox.service';
import { ExportJobStatus } from '../../common/constants/export';

const ENTITY_LABEL: Record<string, string> = {
  orders: '订单',
};

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * 导出任务异步执行器（T267）。
 * - 提交后立即返回，后台通过 enqueue 触发 run，避免大批量导出阻塞 HTTP 响应
 * - 复用 OrderService.exportOrdersCsv(format:'xlsx') 生成 Excel，仅产出 xlsx，不走 CSV
 * - 完成后上传到私有桶 export-files，并推送站内信通知提交人
 */
@Injectable()
export class ExportRunnerService {
  private readonly logger = new Logger(ExportRunnerService.name);

  constructor(
    private readonly exportService: ExportService,
    private readonly orderService: OrderService,
    private readonly storageService: StorageService,
    private readonly inboxService: InboxService,
  ) {}

  /** 提交后台执行（fire-and-forget，不阻塞 HTTP 响应） */
  enqueue(jobId: string): void {
    Promise.resolve().then(() =>
      this.run(jobId).catch((e) => {
        this.logger.error(`[ExportRunner] 任务 ${jobId} 执行异常:`, e);
        void this.markFailed(jobId, e instanceof Error ? e.message : '未知错误').catch(
          () => {},
        );
      }),
    );
  }

  private async run(jobId: string): Promise<void> {
    const job = await this.exportService.getJob(jobId);
    if (!job) {
      this.logger.warn(`[ExportRunner] 任务不存在: ${jobId}`);
      return;
    }

    try {
      await this.exportService.updateJob(jobId, { status: ExportJobStatus.PROCESSING });

      const params = job.params || {};
      const result = await this.orderService.exportOrdersCsv(job.shopId, {
        status: params.status,
        maxRows: params.maxRows && params.maxRows > 0 ? params.maxRows : 1000,
        format: 'xlsx',
      });

      if (!result.xlsxBase64) {
        throw new Error('导出结果为空（未生成 Excel）');
      }

      const bytes = Buffer.from(result.xlsxBase64, 'base64');
      const fileName =
        result.xlsxFilename || `orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const storagePath = `${job.shopId}/exports/${jobId}.xlsx`;

      await this.storageService.uploadBuffer(bytes, storagePath, {
        contentType: XLSX_CONTENT_TYPE,
      });

      await this.exportService.updateJob(jobId, {
        status: ExportJobStatus.COMPLETED,
        filePath: storagePath,
        fileName,
        rowCount: result.count ?? 0,
        completedAt: new Date().toISOString(),
      });

      await this.inboxService.create({
        userId: job.userId,
        type: 'export_job',
        title: '导出完成',
        content: `您的「${ENTITY_LABEL[job.entity] || job.entity}」导出任务已完成，可在「导出中心」下载。`,
        relatedType: 'export_job',
        relatedId: jobId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误';
      this.logger.error(`[ExportRunner] 任务 ${jobId} 失败:`, e);
      await this.markFailed(jobId, msg).catch(() => {});
    }
  }

  private async markFailed(jobId: string, message: string): Promise<void> {
    await this.exportService.updateJob(jobId, {
      status: ExportJobStatus.FAILED,
      errorMessage: message.slice(0, 500),
    });
  }
}
