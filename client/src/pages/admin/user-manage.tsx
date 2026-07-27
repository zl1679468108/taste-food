import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get } from '../../utils/request';
import { formatTime } from '../../utils/format';
import { PaginatedData } from '../../types/api';
import { DEFAULT_PAGE_SIZE } from '../../env';
import './user-manage.scss';
import Icon from '../../components/Icon';
import ListEndTip from '../../components/ListEndTip';

interface UserSummary {
  id: string;
  nickName: string;
  avatarUrl: string;
  role: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
  createdAt: string;
}

const UserManagePage = () => {
  // 本地状态
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /** 加载用户列表 */
  const loadUsers = async () => {
    setLoading(true);
    setPage(1);
    try {
      const res = await get<PaginatedData<UserSummary>>('/users', { page: 1, pageSize: DEFAULT_PAGE_SIZE });
      const { items, total } = res.data;
      setUsers(items || []);
      setTotal(total);
      setHasMore((items?.length || 0) < total);
      setPage(1);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setPage(1);
    }
  };

  /** 加载更多 */
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await get<PaginatedData<UserSummary>>('/users', { page: nextPage, pageSize: DEFAULT_PAGE_SIZE });
      const { items, total: newTotal } = res.data;
      const newUsers = [...users, ...(items || [])];
      setUsers(newUsers);
      setTotal(newTotal);
      setPage(nextPage);
      setHasMore(newUsers.length < newTotal);
      setLoadingMore(false);
    } catch (e) {
      setLoadingMore(false);
    }
  };

  /** 获取角色标签 */
  const getRoleTag = (role: string) => {
    switch (role) {
      case 'admin': return { text: '管理员', color: '#8b5cf6' };
      case 'rider': return { text: '骑手', color: '#10b981' };
      default: return { text: '顾客', color: '#3b82f6' };
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className='user-manage'>
      <View className='header'>
        <Text className='title'>会员管理</Text>
        <Text className='subtitle'>共 {total || users.length} 位成员</Text>
      </View>

      <ScrollView scrollY className='user-list' onScrollToLower={() => loadMore()} lowerThreshold={80}>
        {loading ? (
          <View className='status-info'>加载中...</View>
        ) : users.length === 0 ? (
          <View className='status-info'>暂无会员数据</View>
        ) : (
          users.map(user => {
            const roleInfo = getRoleTag(user.role);
            return (
              <View key={user.id} className='user-card'>
                <View className='user-card__main'>
                  <View className='user-avatar'>
                    {user.avatarUrl ? <View className='img' style={{ backgroundImage: `url(${user.avatarUrl})` }} /> : <Icon name='user' size={22} color='#999999' />}
                  </View>
                  <View className='user-info'>
                    <View className='user-info__name-row'>
                      <Text className='name'>{user.nickName || '微信用户'}</Text>
                      <Text className='role-tag' style={{ color: roleInfo.color, borderColor: roleInfo.color }}>
                        {roleInfo.text}
                      </Text>
                    </View>
                    <Text className='join-date'>加入日期：{formatTime(user.createdAt, 'YYYY-MM-DD')}</Text>
                  </View>
                </View>
                <View className='user-card__stats'>
                  <View className='stat-item'>
                    <Text className='label'>消费次数</Text>
                    <Text className='value'>{user.orderCount || 0} 次</Text>
                  </View>
                  <View className='stat-item'>
                    <Text className='label'>累计消费</Text>
                    <Text className='value price'>¥{( (user.totalSpent || 0) / 100).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <ListEndTip
          loading={loadingMore}
          hasMore={hasMore}
          show={users.length > 0 && !loading}
        />
      </ScrollView>
    </View>
  );
};

export default UserManagePage;
