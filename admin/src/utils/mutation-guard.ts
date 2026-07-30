/**
 * 全局写操作（POST/PUT/PATCH/DELETE）防重复提交
 * 同一 method + url + body 的请求，同一时刻只允许一次
 */

const inflightMutations = new Map<string, Promise<unknown>>();

function stableStringify(data?: Record<string, unknown>): string {
  if (!data) return '';
  try {
    return JSON.stringify(
      Object.keys(data)
        .sort()
        .reduce((acc, key) => {
          acc[key] = data[key];
          return acc;
        }, {} as Record<string, unknown>),
    );
  } catch {
    return String(data);
  }
}

export function buildMutationKey(
  method: string,
  url: string,
  data?: Record<string, unknown>,
): string {
  return `${method.toUpperCase()}:${url}:${stableStringify(data)}`;
}

export class DuplicateSubmitError extends Error {
  readonly code = 'DUPLICATE_SUBMIT';

  /**
   * 标记为「已处理」错误：重复提交是被主动拦截的正常行为，不是真实失败，
   * 页面不应把它当错误 toast 给用户。
   */
  readonly __tfErrorHandled = true;

  constructor(message = '操作进行中，请勿重复提交') {
    super(message);
    this.name = 'DuplicateSubmitError';
  }
}

export function isDuplicateSubmitError(error: unknown): boolean {
  return (
    error instanceof DuplicateSubmitError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'DUPLICATE_SUBMIT')
  );
}

/**
 * 对相同写请求做互斥：已有进行中的同 key 请求时直接拒绝
 */
export function runExclusiveMutation<T>(
  key: string,
  action: () => Promise<T>,
): Promise<T> {
  const existing = inflightMutations.get(key);
  if (existing) {
    return Promise.reject(new DuplicateSubmitError());
  }

  const pending = action().finally(() => {
    if (inflightMutations.get(key) === pending) {
      inflightMutations.delete(key);
    }
  });

  inflightMutations.set(key, pending);
  return pending as Promise<T>;
}
