import { useMemo, useRef } from 'react';
import { filterByKeyword } from '@/utils/table';

/** 参与关键词匹配的字段：字段名，或从行数据取值的函数（可拼接多字段） */
export type KeywordField<T> = ((item: T) => unknown) | keyof T;

/**
 * 通用「关键词 + 待筛数据 + 参与匹配字段」本地筛选。
 * 复用 {@link filterByKeyword}：关键词自动 trim + 转小写，空关键词原样返回列表。
 *
 * ```ts
 * const filtered = useKeywordFilter(users, searchText, ['nickName', 'id', 'openid']);
 * ```
 *
 * fields 通过 ref 读取，因此调用方可以直接内联字面量数组而不会破坏 memo；
 * 代价是 fields 必须是「渲染无关」的静态描述（不要在里面闭包 state）。
 */
export function useKeywordFilter<T>(
  list: T[],
  keyword: string | undefined | null,
  fields: Array<KeywordField<T>>,
): T[] {
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  return useMemo(() => filterByKeyword(list, keyword, fieldsRef.current), [list, keyword]);
}
