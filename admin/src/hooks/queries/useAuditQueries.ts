import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/services/audit';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

export function useAuditLogs(params: {
  page: number;
  pageSize: number;
  method?: string;
  keyword?: string;
}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params),
    queryFn: () => getAuditLogs(params),
    staleTime: STALE_TIMES.STANDARD,
  });
}
