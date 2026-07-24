import { memo } from 'react';
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

function FilterTabsInner({
  tabs,
  activeKey,
  onChange,
  variant = 'underline',
  scrollable = true,
  className = '',
}: FilterTabsProps) {
  const content = (
    <View className={`tf-filter-tabs tf-filter-tabs--${variant} ${className}`.trim()}>
      {tabs.map((tab) => (
        <View
          key={tab.key}
          className={`tf-filter-tabs__item${activeKey === tab.key ? ' is-active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          <Text className='tf-filter-tabs__label'>{tab.label}</Text>
        </View>
      ))}
    </View>
  );

  if (!scrollable) return content;

  return (
    <ScrollView scrollX enhanced showScrollbar={false} className='tf-filter-tabs-scroll'>
      {content}
    </ScrollView>
  );
}

export default memo(FilterTabsInner);
