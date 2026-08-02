import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

  // ===== 占位符跑马灯：hover 时由右往左滚动展示完整文字 =====
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [hasValue, setHasValue] = useState(Boolean(searchValue));
  const [box, setBox] = useState<{ left: number; width: number }>({ left: 11, width: 200 });
  const [textW, setTextW] = useState(0);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const inputEl = wrap?.querySelector('.ant-input') as HTMLInputElement | null;
    const textEl = textRef.current;
    if (!wrap || !inputEl || !textEl) return;
    const wrapRect = wrap.getBoundingClientRect();
    const inputRect = inputEl.getBoundingClientRect();
    setBox({
      left: inputRect.left - wrapRect.left,
      width: inputEl.clientWidth,
    });
    setTextW(textEl.offsetWidth);
  }, []);

  // 初次布局 + 受控值变化 + 宽度/文案变化时重新测量
  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [measure, searchPlaceholder, searchWidth, searchValue]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  useEffect(() => {
    setHasValue(Boolean(searchValue));
  }, [searchValue]);

  const overflow = textW > box.width;
  const isOverflow = overflow && !hasValue;

  const handleSearchChange = (value: string) => {
    setHasValue(Boolean(value));
    if (!value) {
      onSearchClear?.();
      onSearch?.('');
    }
  };

  return (
    <div className={['tf-search-filter-bar', className].filter(Boolean).join(' ')} style={style}>
      <Space wrap size={12} className="tf-search-filter-bar__inner">
        {onSearch && (
          <div
            ref={wrapRef}
            className={[
              'tf-search-filter-bar__search-wrap',
              hovered ? 'is-hover' : '',
            ].filter(Boolean).join(' ')}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <Input.Search
              allowClear
              value={searchValue}
              placeholder=""
              prefix={<SearchOutlined className="tf-search-filter-bar__icon" />}
              className="tf-search-filter-bar__search"
              style={{ width: searchWidth }}
              enterButton="搜索"
              onSearch={(value) => onSearch(value.trim())}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <span
              className={[
                'tf-search-filter-bar__ph',
                hasValue ? 'is-hidden' : '',
                isOverflow ? 'is-overflow' : '',
              ].filter(Boolean).join(' ')}
              style={{ left: box.left, width: box.width }}
              aria-hidden
            >
              <span className="tf-search-filter-bar__ph-text">
                <span ref={textRef} className="tf-search-filter-bar__ph-text-segment">
                  {searchPlaceholder}
                </span>
                {isOverflow && (
                  <span className="tf-search-filter-bar__ph-text-segment" aria-hidden>
                    {searchPlaceholder}
                  </span>
                )}
              </span>
            </span>
          </div>
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
