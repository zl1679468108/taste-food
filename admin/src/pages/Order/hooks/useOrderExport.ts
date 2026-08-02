import { useState } from 'react';
import { antdMessage as message } from '@/utils/antdApp';
import { createExportJob } from '@/services/export';

/**
 * 订单导出：改为提交后台异步导出任务（T267）。
 * 大批量数据不再阻塞页面，完成后在「导出中心」下载 Excel（仅 xlsx，不走 CSV）。
 */
export function useOrderExport(params: { shopId: string; status?: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await createExportJob({
        entity: 'orders',
        status: params.status,
        maxRows: 1000,
        shop_id: params.shopId,
      });
      message.success('已提交后台导出任务，完成后可在「导出中心」下载');
    } catch (e) {
      console.error('提交导出任务失败:', e);
    } finally {
      setExporting(false);
    }
  };

  return { exporting, handleExport };
}
