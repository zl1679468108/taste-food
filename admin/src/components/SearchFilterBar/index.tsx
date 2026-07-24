import React from 'react';
import { Input, Select, Space } from 'antd';

export interface SearchFilterOption {
  label: string;
  value: string;
}

interface SearchFilterBarProps {
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  onSearchClear?: () => void;
  filterPlaceholder?: string;
  filterValue?: string;
  filterOptions?: SearchFilterOption[];
  onFilterChange?: (value: string | undefined) => void;
  extra?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * 列表页搜索 + 下拉筛选组合条
 */
const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchPlaceholder = '搜索',
  onSearch,
  onSearchClear,
  filterPlaceholder = '筛选',
  filterValue,
  filterOptions,
  onFilterChange,
  extra,
  style,
}) => {
  return (
    <Space style={{ marginBottom: 16, ...style }} wrap>
      {onSearch && (
        <Input.Search
          allowClear
          placeholder={searchPlaceholder}
          style={{ width: 220 }}
          onSearch={onSearch}
          onChange={(e) => {
            if (!e.target.value) {
              onSearchClear?.();
              onSearch('');
            }
          }}
        />
      )}
      {filterOptions && onFilterChange && (
        <Select
          allowClear
          placeholder={filterPlaceholder}
          style={{ width: 180 }}
          value={filterValue}
          onChange={(v) => onFilterChange(v)}
          options={filterOptions}
        />
      )}
      {extra}
    </Space>
  );
};

export default SearchFilterBar;
