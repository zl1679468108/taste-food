import { useCallback, useRef, useState } from 'react';

/**
 * 防重复提交：同一时刻只允许一次异步动作
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (pendingRef.current) return undefined;
    pendingRef.current = true;
    setPending(true);
    try {
      return await action();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}

/**
 * 列表场景防重复提交：按 key 维度互斥（如每行订单的抢单/送达按钮）。
 *
 * 与 useAsyncAction 一样使用 ref 判定，能挡住同一 tick 内的连点；
 * 同时暴露 pendingKey 供按钮渲染 loading 文案与 disabled 态。
 */
export function useKeyedAsyncAction() {
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());

  const isPending = useCallback(
    (key: string) => pendingKeys.includes(key),
    [pendingKeys],
  );

  const run = useCallback(
    async <T,>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
      if (pendingRef.current.has(key)) return undefined;
      pendingRef.current.add(key);
      setPendingKeys(Array.from(pendingRef.current));
      try {
        return await action();
      } finally {
        pendingRef.current.delete(key);
        setPendingKeys(Array.from(pendingRef.current));
      }
    },
    [],
  );

  return { pendingKeys, isPending, run };
}
