import { Component, PropsWithChildren } from 'react';
import Taro from '@tarojs/taro';
import { useAuthStore } from './stores/authStore';
import { connectSocket, joinUserRoom, disconnectSocket } from './services/socket';
import './app.scss';

// 为小程序环境注入 WebSocket polyfill（engine.io-client 需要全局 WebSocket）
import MiniProgramWebSocket from './websocket-polyfill';
if (typeof globalThis !== 'undefined' && !globalThis.WebSocket) {
  (globalThis as any).WebSocket = MiniProgramWebSocket;
}

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    console.log('小买卖点餐系统 - App 初始化');

    // 从 storage 恢复登录态
    const authStore = useAuthStore.getState();
    const restored = authStore.restoreToken();

    if (restored) {
      console.log('已恢复登录态:', authStore.user?.role);
      // 恢复登录后连接 WebSocket
      this.connectWebSocket();
    }

    // 监听登录状态变化 — 用户登录后连接 WebSocket
    useAuthStore.subscribe((state) => {
      if (state.isLoggedIn && state.token && state.user) {
        this.connectWebSocket();
      } else if (!state.isLoggedIn) {
        // 登出时断开
        disconnectSocket();
      }
    });
  }

  connectWebSocket() {
    const authStore = useAuthStore.getState();
    if (authStore.token && authStore.user) {
      connectSocket(authStore.token);
      // 延迟一下让连接建立
      setTimeout(() => {
        joinUserRoom(authStore.user!.userId, authStore.user!.role);
      }, 500);
    }
  }

  componentDidShow() {
    // 小程序切前台时执行
  }

  componentDidHide() {
    // 小程序切后台时执行
  }

  render() {
    return this.props.children;
  }
}

export default App;
