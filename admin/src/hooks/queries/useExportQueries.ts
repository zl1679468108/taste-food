import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listExportJobs, createExportJob } from '@/services/export';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

export interface UseExportJobsParams {
  shopId: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/** 导出任务列表（按店铺隔离） */
export function useExportJobs(params: UseExportJobsParams) {
  return useQuery({
    queryKey: queryKeys.exportJobs.list(params),
    queryFn: () => listExportJobs(params),
    enabled: !!params.shopId,
    staleTime: STALE_TIMES.REALTIME,
  });
}

/** 提交导出任务 */
export function useCreateExportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { entity?: string; status?: string; maxRows?: number; shop_id?: string }) =>
      createExportJob(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exportJobs.all() });
    },
  });
}
