import React from 'react';
import { Input, Select, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

export interface SearchFilterOption {
  label: string;
  value: string;
}

export interface SearchFilterBarProps {
  searchPlaceholder?: string;
  /** 受控搜索框值（可选；不传则为非受控） */
  searchValue?: string;
  onSearch?: (value: string) => void;
  onSearchClear?: () => void;
  /** 搜索框宽度，默认 240 */
  searchWidth?: number | string;

  filterPlaceholder?: string;
  filterValue?: string;
  filterOptions?: SearchFilterOption[];
  onFilterChange?: (value: string | undefined) => void;
  /** 筛选框宽度，默认 160 */
  filterWidth?: number | string;

  /** 可选第二筛选（兼容扩展，pages 可不传） */
  filter2Placeholder?: string;
  filter2Value?: string;
  filter2Options?: SearchFilterOption[];
  onFilter2Change?: (value: string | undefined) => void;
  filter2Width?: number | string;

  /** 右侧额外内容（按钮、日期等） */
  extra?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 列表页搜索 + 下拉筛选组合条
 *
 * 用法：
 * ```tsx
 * <SearchFilterBar
 *   searchPlaceholder="搜索菜品名称"
 *   onSearch={setKeyword}
 *   filterPlaceholder="按分类筛选"
 *   filterValue={categoryId}
 *   filterOptions={options}
 *   onFilterChange={setCategoryId}
 *   // 可选第二筛选
 *   filter2Placeholder="状态"
 *   filter2Options={statusOptions}
 *   onFilter2Change={setStatus}
 *   extra={<Button>导出</Button>}
 * />
 * ```
 */
const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchPlaceholder = '搜索',
  searchValue,
  onSearch,
  onSearchClear,
  searchWidth = 240,
  filterPlaceholder = '筛选',
  filterValue,
  filterOptions,
  onFilterChange,
  filterWidth = 160,
  filter2Placeholder = '筛选',
  filter2Value,
  filter2Options,
  onFilter2Change,
  filter2Width = 160,
  extra,
  className,
  style,
}) => {
  const showFilter = Boolean(filterOptions && onFilterChange);
  const showFilter2 = Boolean(filter2Options && onFilter2Change);

  const handleSearchChange = (value: string) => {
    if (!value) {
      onSearchClear?.();
      onSearch?.('');
    }
  };

  return (
    <div className={['tf-search-filter-bar', className].filter(Boolean).join(' ')} style={style}>
      <Space wrap size={12} className="tf-search-filter-bar__inner">
        {onSearch && (
          <Input.Search
            allowClear
            value={searchValue}
            placeholder={searchPlaceholder}
            prefix={<SearchOutlined className="tf-search-filter-bar__icon" />}
            className="tf-search-filter-bar__search"
            style={{ width: searchWidth }}
            enterButton="搜索"
            onSearch={(value) => onSearch(value.trim())}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        )}

        {showFilter && (
          <Select
            allowClear
            placeholder={filterPlaceholder}
            className="tf-search-filter-bar__select"
            style={{ width: filterWidth }}
            value={filterValue}
            onChange={(v) => onFilterChange?.(v)}
            options={filterOptions}
          />
        )}

        {showFilter2 && (
          <Select
            allowClear
            placeholder={filter2Placeholder}
            className="tf-search-filter-bar__select"
            style={{ width: filter2Width }}
            value={filter2Value}
            onChange={(v) => onFilter2Change?.(v)}
            options={filter2Options}
          />
        )}

        {extra ? <div className="tf-search-filter-bar__extra">{extra}</div> : null}
      </Space>
    </div>
  );
};

export default SearchFilterBar;
