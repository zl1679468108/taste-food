import React from 'react';
import { Card } from 'antd';
import { brand } from '@/theme';

export interface TableCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** 可选标题（默认不展示，保持纯 children 兼容） */
  title?: React.ReactNode;
  /** 标题栏右侧操作区 */
  extra?: React.ReactNode;
  /** 是否去掉内边距（嵌套 ProTable 时可关） */
  noPadding?: boolean;
  /** 是否启用表头 sticky（给内部 Table 包一层 class） */
  stickyHeader?: boolean;
  /** 透传给 Card 的 bodyStyle */
  bodyStyle?: React.CSSProperties;
}

/**
 * 列表表格统一白卡片容器
 *
 * 用法：
 * ```tsx
 * <TableCard>
 *   <Table size={DEFAULT_TABLE_SIZE} ... />
 * </TableCard>
 *
 * <TableCard title="订单列表" extra={<Button>导出</Button>} stickyHeader>
 *   <Table className="tf-table-sticky" ... />
 * </TableCard>
 * ```
 */
const TableCard: React.FC<TableCardProps> = ({
  children,
  className,
  style,
  title,
  extra,
  noPadding = false,
  stickyHeader = false,
  bodyStyle,
}) => {
  const classes = [
    'tf-table-card',
    stickyHeader ? 'tf-table-card--sticky' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedBodyStyle: React.CSSProperties = {
    padding: noPadding ? 0 : 16,
    ...bodyStyle,
  };

  return (
    <Card
      variant="borderless"
      className={classes}
      title={title}
      extra={extra}
      style={{
        borderRadius: brand.radius,
        boxShadow: brand.shadow,
        background: brand.bgCard,
        ...style,
      }}
      styles={{ body: mergedBodyStyle }}
    >
      {children}
    </Card>
  );
};

export default TableCard;
