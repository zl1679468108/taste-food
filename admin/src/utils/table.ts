import type { ColumnType, TablePaginationConfig, TableProps } from 'antd/es/table';
import React from 'react';
import EmptyState from '@/components/EmptyState';

/** 管理后台表格默认每页条数 */
export const DEFAULT_PAGE_SIZE = 20;

/** 管理后台表格默认密度 */
export const DEFAULT_TABLE_SIZE: TableProps['size'] = 'small';

/** 管理后台表格默认分页 */
export const DEFAULT_TABLE_PAGINATION: TablePaginationConfig = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total) => `共 ${total} 条`,
  defaultPageSize: DEFAULT_PAGE_SIZE,
  pageSize: DEFAULT_PAGE_SIZE,
};

/** 统一空态文案 */
export const DEFAULT_TABLE_LOCALE: TableProps['locale'] = {
  emptyText: React.createElement(EmptyState, {
    description: '暂无数据',
  }),
};

/** 操作列默认宽度 */
export const DEFAULT_ACTION_COLUMN_WIDTH = 140;

/**
 * 生成右侧固定操作列基础配置。
 * pages 可 spread 后补充 title/render：
 * ```ts
 * {
 *   ...fixedRightActionColumn(160),
 *   title: '操作',
 *   render: (_, row) => <Space>...</Space>,
 * }
 * ```
 */
export function fixedRightActionColumn<T = unknown>(
  width: number = DEFAULT_ACTION_COLUMN_WIDTH,
): Pick<ColumnType<T>, 'key' | 'width' | 'fixed' | 'align'> {
  return {
    key: 'action',
    width,
    fixed: 'right',
    align: 'center',
  };
}

/**
 * 通用关键字过滤（前端本地筛选）。
 * @param list 源列表
 * @param keyword 关键字（自动 trim，空则返回原列表）
 * @param fields 参与匹配的字段取值函数，或字段名数组
 */
export function filterByKeyword<T>(
  list: T[],
  keyword: string | undefined | null,
  fields: Array<((item: T) => unknown) | keyof T>,
): T[] {
  const q = (keyword || '').trim().toLowerCase();
  if (!q) return list;

  return list.filter((item) =>
    fields.some((field) => {
      const raw = typeof field === 'function' ? field(item) : item[field];
      if (raw == null) return false;
      return String(raw).toLowerCase().includes(q);
    }),
  );
}

/**
 * 表格常用 props 合集，pages 可直接展开：
 * ```tsx
 * <Table {...DEFAULT_TABLE_PROPS} columns={...} dataSource={...} />
 * ```
 */
export const DEFAULT_TABLE_PROPS: Pick<
  TableProps,
  'size' | 'pagination' | 'locale' | 'bordered'
> = {
  size: DEFAULT_TABLE_SIZE,
  pagination: DEFAULT_TABLE_PAGINATION,
  locale: DEFAULT_TABLE_LOCALE,
  bordered: false,
};
