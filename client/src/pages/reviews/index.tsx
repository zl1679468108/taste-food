import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, isRetryableError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatTime, shortOrderId } from '../../utils/format';
import { PaginatedData } from '../../types/api';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import ListEndTip from '../../components/ListEndTip';
import Icon from '../../components/Icon';
import FooterBar from '../../components/FooterBar';
import './index.scss';

interface MyReviewItem {
  id: string;
  orderId: string;
  orderNo?: string;
  shopId: string;
  userId: string;
  rating: number;
  content: string;
  replyContent?: string;
  replyAt?: string;
  createdAt: string;
}

export default function MyReviewsPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [reviews, setReviews] = useState<MyReviewItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  const loadReviews = useCallback(async (pageNum = 1) => {
    if (!useAuthStore.getState().isLoggedIn) {
      setReviews([]);
      setLoading(false);
      setLoadError(false);
      setHasMore(false);
      return;
    }

    if (pageNum === 1) {
      setLoading(true);
      setLoadError(false);
      setCanRetry(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await get<PaginatedData<MyReviewItem>>(
        '/reviews/mine',
        { page: pageNum, pageSize },
        { useCache: false },
      );
      const items = res.data?.items || [];
      const total = res.data?.total || 0;
      const maxPage = Math.ceil(total / pageSize) || 1;
      setReviews((prev) => (pageNum === 1 ? items : [...prev, ...items]));
      setPage(pageNum);
      setHasMore(pageNum < maxPage);
      setLoadError(false);
      setCanRetry(false);
    } catch (error) {
      console.error('加载我的评价失败:', error);
      if (pageNum === 1) {
        setReviews([]);
        setLoadError(true);
        setCanRetry(isRetryableError(error));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews, isLoggedIn]);

  Taro.usePullDownRefresh(() => {
    loadReviews(1).finally(() => {
      Taro.stopPullDownRefresh();
    });
  });

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    loadReviews(page + 1);
  };

  const goOrderDetail = (orderId: string) => {
    if (!orderId) return;
    Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${orderId}` });
  };

  if (!isLoggedIn) {
    return (
      <View className='my-reviews-page'>
        <EmptyState
          icon='lock'
          title='请先登录'
          description='登录后就能查看已评价的订单'
        />
        <FooterBar
          actionOnly
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className='my-reviews-page'>
        <SkeletonLoader mode='review' count={4} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className='my-reviews-page'>
        <EmptyState
          icon='warning'
          title='加载失败'
          description={canRetry ? '网络不太稳，点一下再试试' : '评价暂时加载不出来'}
        />
        <FooterBar
          actionOnly
          actionText={canRetry ? '再试一次' : '重新加载'}
          onAction={() => loadReviews(1)}
        />
      </View>
    );
  }

  if (reviews.length === 0) {
    return (
      <View className='my-reviews-page'>
        <EmptyState
          icon='star'
          title='还没有评价'
          description='完成订单后去评价，记录会显示在这里'
        />
        <FooterBar
          actionOnly
          actionText='去看看订单'
          onAction={() => Taro.switchTab({ url: '/pages/order-list/index' })}
        />
      </View>
    );
  }

  return (
    <ScrollView
      scrollY
      className='my-reviews-page'
      style={{ height: '100vh' }}
      onScrollToLower={loadMore}
      lowerThreshold={80}
      enhanced
      showScrollbar={false}
    >
      {reviews.map((item) => (
        <View
          key={item.id}
          className='my-review-card'
          onClick={() => goOrderDetail(item.orderId)}
          aria-label={`评价订单 ${shortOrderId(item.orderId, item.orderNo)}`}
        >
          <View className='my-review-card__header'>
            <View className='my-review-card__stars'>
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name={star <= item.rating ? 'star-filled' : 'star'}
                  size={16}
                  color={star <= item.rating ? '#FF6B35' : '#DDDDDD'}
                />
              ))}
              <Text className='my-review-card__score'>{item.rating} 分</Text>
            </View>
            <Text className='my-review-card__time'>
              {formatTime(item.createdAt, 'MM-DD HH:mm')}
            </Text>
          </View>
          <Text className='my-review-card__content'>
            {item.content?.trim() ? item.content : '（无文字评价）'}
          </Text>
          <Text className='my-review-card__order'>订单号：{shortOrderId(item.orderId, item.orderNo)}</Text>
          {item.replyContent ? (
            <View className='my-review-card__reply'>
              <Text className='my-review-card__reply-label'>商家回复</Text>
              <Text className='my-review-card__reply-text'>{item.replyContent}</Text>
            </View>
          ) : null}
        </View>
      ))}

      <ListEndTip
        loading={loadingMore}
        hasMore={hasMore}
        show={reviews.length > 0}
      />
    </ScrollView>
  );
}
