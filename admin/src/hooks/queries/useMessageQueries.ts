import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sendShopMessage,
  getShopMessages,
  GetShopMessagesParams,
} from '@/services/message';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

/** 商家发件箱（可按顾客过滤） */
export function useShopMessages(params: GetShopMessagesParams) {
  return useQuery({
    queryKey: queryKeys.messages.list(params),
    queryFn: () => getShopMessages(params),
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: (prev) => prev,
  });
}

/** 发送站内信（商家 → 顾客） */
export function useSendShopMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ toUserId, content }: { toUserId: string; content: string }) =>
      sendShopMessage(toUserId, content),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: queryKeys.messages.list({ toUserId: variables.toUserId }),
      });
      qc.invalidateQueries({ queryKey: queryKeys.messages.all() });
    },
  });
}
