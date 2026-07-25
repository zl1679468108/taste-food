import type { TablePaginationConfig } from 'antd/es/table';
import type { TableProps } from 'antd';
import React from 'react';
import EmptyState from '@/components/EmptyState';

/** 管理后台表格默认分页 */
export const DEFAULT_TABLE_PAGINATION: TablePaginationConfig = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total) => `共 ${total} 条`,
  defaultPageSize: 10,
};

/** 统一空态文案 */
export const DEFAULT_TABLE_LOCALE: TableProps['locale'] = {
  emptyText: React.createElement(EmptyState, {
    description: '暂无数据',
  }),
};
