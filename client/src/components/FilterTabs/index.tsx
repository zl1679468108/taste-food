import { memo, useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export interface FilterTabItem {
  key: string;
  label: string;
}

interface FilterTabsProps {
  tabs: FilterTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  /** underline | pill */
  variant?: 'underline' | 'pill';
  scrollable?: boolean;
  className?: string;
}

function tabDomId(key: string) {
  return `filter-tab-${key || 'all'}`;
}

function FilterTabsInner({
  tabs,
  activeKey,
  onChange,
  variant = 'underline',
  scrollable = true,
  className = '',
}: FilterTabsProps) {
  const [scrollIntoView, setScrollIntoView] = useState('');

  useEffect(() => {
    if (!scrollable) return;
    const target = tabDomId(activeKey);
    // 先清空再设置，确保同一 activeKey 重复触发时也能滚入视野
    setScrollIntoView('');
    const timer = setTimeout(() => setScrollIntoView(target), 32);
    return () => clearTimeout(timer);
  }, [activeKey, scrollable, tabs]);

  const content = (
    <View className={`tf-filter-tabs tf-filter-tabs--${variant} ${className}`.trim()}>
      {tabs.map((tab) => {
        const active = activeKey === tab.key;
        return (
          <View
            key={tab.key || 'all'}
            id={tabDomId(tab.key)}
            className={`tf-filter-tabs__item${active ? ' is-active' : ''}`}
            onClick={() => {
              if (tab.key !== activeKey) onChange(tab.key);
            }}
          >
            <Text className='tf-filter-tabs__label'>{tab.label}</Text>
            {variant === 'underline' && active ? (
              <View className='tf-filter-tabs__indicator' />
            ) : null}
          </View>
        );
      })}
    </View>
  );

  if (!scrollable) return content;

  return (
    <View className='tf-filter-tabs-bar'>
      <ScrollView
        scrollX
        enableFlex
        enhanced
        showScrollbar={false}
        scrollWithAnimation
        scrollIntoView={scrollIntoView}
        className='tf-filter-tabs-scroll'
      >
        {content}
      </ScrollView>
    </View>
  );
}

export default memo(FilterTabsInner);
