import { Component } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatTime } from '../../utils/format';
import { PaginatedData } from '../../types/api';
import { DEFAULT_PAGE_SIZE } from '../../env';
import './user-manage.scss';

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

interface UserManageState {
  users: UserSummary[];
  loading: boolean;
  page: number;
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
}

export default class UserManagePage extends Component<{}, UserManageState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      users: [],
      loading: true,
      page: 1,
      total: 0,
      hasMore: false,
      loadingMore: false,
    };
  }

  componentDidMount() {
    this.loadUsers();
  }

  async loadUsers() {
    this.setState({ loading: true, page: 1 });
    try {
      const res = await get<PaginatedData<UserSummary>>('/users', { page: 1, pageSize: DEFAULT_PAGE_SIZE });
      const { items, total } = res.data;
      this.setState({
        users: items || [],
        total,
        hasMore: (items?.length || 0) < total,
        page: 1,
        loading: false,
      });
    } catch (e) {
      this.setState({ loading: false, page: 1 });
    }
  }

  async loadMore() {
    const { loadingMore, hasMore } = this.state;
    if (loadingMore || !hasMore) return;
    this.setState({ loadingMore: true });
    try {
      const nextPage = this.state.page + 1;
      const res = await get<PaginatedData<UserSummary>>('/users', { page: nextPage, pageSize: DEFAULT_PAGE_SIZE });
      const { items, total } = res.data;
      this.setState(prev => ({
        users: [...prev.users, ...(items || [])],
        total,
        page: nextPage,
        hasMore: prev.users.length + (items?.length || 0) < total,
        loadingMore: false,
      }));
    } catch (e) {
      this.setState({ loadingMore: false });
    }
  }

  getRoleTag(role: string) {
    switch (role) {
      case 'admin': return { text: '管理员', color: '#8b5cf6' };
      case 'rider': return { text: '骑手', color: '#10b981' };
      default: return { text: '顾客', color: '#3b82f6' };
    }
  }

  render() {
    const { users, loading, loadingMore, hasMore, total } = this.state;

    return (
      <View className='user-manage'>
        <View className='header'>
          <Text className='title'>会员管理</Text>
          <Text className='subtitle'>共 {total || users.length} 位成员</Text>
        </View>

        <ScrollView scrollY className='user-list'>
          {loading ? (
            <View className='status-info'>加载中...</View>
          ) : users.length === 0 ? (
            <View className='status-info'>暂无会员数据</View>
          ) : (
            users.map(user => {
              const roleInfo = this.getRoleTag(user.role);
              return (
                <View key={user.id} className='user-card'>
                  <View className='user-card__main'>
                    <View className='user-avatar'>
                      {user.avatarUrl ? <View className='img' style={{ backgroundImage: `url(${user.avatarUrl})` }} /> : <Text>👤</Text>}
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
        </ScrollView>
      </View>
    );
  }
}
