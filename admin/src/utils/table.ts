import type { TablePaginationConfig } from 'antd/es/table';

/** 管理后台表格默认分页 */
export const DEFAULT_TABLE_PAGINATION: TablePaginationConfig = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total) => `共 ${total} 条`,
  defaultPageSize: 10,
};
