import { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Icon from '../Icon';
import './index.scss';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    Taro.showToast({
      title: '页面加载失败，请重试',
      icon: 'none',
      duration: 2000,
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View className='error-boundary'>
          <View className='error-boundary__icon'><Icon name='warning' size={40} color='#FF6B35' /></View>
          <Text className='error-boundary__title'>页面出错了</Text>
          <Text className='error-boundary__message'>
            {this.state.error?.message || '未知错误'}
          </Text>
          <Button
            className='error-boundary__btn'
            onClick={() => {
              this.setState({ hasError: false, error: null });
              Taro.reLaunch({ url: '/pages/menu/index' });
            }}
          >
            返回首页
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}
