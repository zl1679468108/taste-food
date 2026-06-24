import { Component } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '../../stores/authStore';
import './index.scss';

interface RoleSwitcherProps {
  /** 紧凑模式 — 只在小按钮里用 */
  compact?: boolean;
}

interface RoleSwitcherState {
  currentRole: string;
  popupVisible: boolean;
}

/**
 * 角色切换组件
 * compact 模式：放在页面 header 旁的小圆钮
 * 非 compact：悬浮按钮（右上角）
 */
export default class RoleSwitcher extends Component<RoleSwitcherProps, RoleSwitcherState> {
  private authStore = useAuthStore;
  private unsubscribe: (() => void) | null = null;

  constructor(props: RoleSwitcherProps) {
    super(props);
    const user = this.authStore.getState().user;
    this.state = {
      currentRole: user?.role || 'customer',
      popupVisible: false,
    };
  }

  componentDidMount() {
    this.unsubscribe = this.authStore.subscribe((state) => {
      if (state.user) {
        this.setState({ currentRole: state.user.role });
      }
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  togglePopup = () => {
    this.setState((s) => ({ popupVisible: !s.popupVisible }));
  };

  closePopup = () => {
    this.setState({ popupVisible: false });
  };

  handleSwitch = async (targetRole: 'customer' | 'admin') => {
    if (this.state.currentRole === targetRole) return;
    try {
      await this.authStore.getState().switchRole(targetRole);
      this.setState({ currentRole: targetRole });
      this.closePopup();
    } catch {
      Taro.showToast({ title: '切换失败', icon: 'none' });
    }
  };

  handleLogout = () => {
    this.authStore.getState().logout();
    this.closePopup();
  };

  renderCompact() {
    const isAdmin = this.state.currentRole === 'admin';
    return (
      <View className='role-switcher-inline'>
        <View className='role-switcher-inline__btn' onClick={this.togglePopup}>
          <Text className='role-switcher-inline__icon'>
            {isAdmin ? '👨‍🍳' : '🛒'}
          </Text>
        </View>
        {this.state.popupVisible && this.renderPopup()}
      </View>
    );
  }

  renderPopup() {
    const isAdmin = this.state.currentRole === 'admin';

    return (
      <View className='role-switcher__popup'>
        <View className='role-switcher__popup-header'>
          <Text className='role-switcher__popup-header-title'>切换视角</Text>
          <Text className='role-switcher__popup-header-subtitle'>
            {isAdmin ? '当前：商家后台' : '当前：顾客点餐'}
          </Text>
        </View>

        <View className='role-switcher__popup-body'>
          <View
            className={`role-switcher__popup-option ${!isAdmin ? 'role-switcher__popup-option--active' : ''}`}
            onClick={() => this.handleSwitch('customer')}
          >
            <Text className='role-switcher__popup-option-icon'>🛒</Text>
            <View className='role-switcher__popup-option-text'>
              <Text className='role-switcher__popup-option-label'>顾客</Text>
              <Text className='role-switcher__popup-option-desc'>浏览菜单 · 下单点餐</Text>
            </View>
            {!isAdmin && <View className='role-switcher__popup-option-check'>✓</View>}
          </View>

          <View className='role-switcher__popup-divider' />

          <View
            className={`role-switcher__popup-option ${isAdmin ? 'role-switcher__popup-option--active' : ''}`}
            onClick={() => this.handleSwitch('admin')}
          >
            <Text className='role-switcher__popup-option-icon'>👨‍🍳</Text>
            <View className='role-switcher__popup-option-text'>
              <Text className='role-switcher__popup-option-label'>商家</Text>
              <Text className='role-switcher__popup-option-desc'>管理订单 · 菜品</Text>
            </View>
            {isAdmin && <View className='role-switcher__popup-option-check'>✓</View>}
          </View>
        </View>

        <View className='role-switcher__popup-footer'>
          <View className='role-switcher__popup-footer-btn' onClick={this.handleLogout}>
            退出登录
          </View>
        </View>
      </View>
    );
  }

  render() {
    if (this.props.compact) {
      return this.renderCompact();
    }

    // 悬浮模式（全局固定定位）
    return (
      <>
        <View
          className='role-switcher__fab'
          onClick={this.togglePopup}
        >
          <Text className='role-switcher__fab-icon'>
            {this.state.currentRole === 'admin' ? '👨‍🍳' : '🛒'}
          </Text>
        </View>
        {this.state.popupVisible && this.renderPopup()}
      </>
    );
  }
}
