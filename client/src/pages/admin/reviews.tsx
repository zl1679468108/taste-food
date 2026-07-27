import { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, patch, isRetryableError } from '../../utils/request';
import { PaginatedData } from '../../types/api';
import { shortOrderId, formatTime } from '../../utils/format';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import './reviews.scss';
import Icon from '../../components/Icon';
import ListEndTip from '../../components/ListEndTip';

interface ReviewItem {
  id: string;
  orderId: string;
  shopId: string;
  userId: string;
  rating: number;
  content: string;
  replyContent?: string;
  replyAt?: string;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 20;

  const loadReviews = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) {
      setLoading(true);
      setLoadError(false);
      setCanRetry(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await get<PaginatedData<ReviewItem>>(
        '/reviews',
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
      console.error('加载评价失败:', error);
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


  const handleReply = (item: ReviewItem) => {
    Taro.showModal({
      title: '回复评价',
      ...( { editable: true, placeholderText: '请输入回复内容' } as Record<string, unknown>),
      success: async (res: Taro.showModal.SuccessCallbackResult & { content?: string }) => {
        if (!res.confirm) return;
        const reply = (res.content || '').trim();
        if (!reply) {
          Taro.showToast({ title: '回复不能为空', icon: 'none' });
          return;
        }
        try {
          const updated = await patch<ReviewItem>(`/reviews/${item.id}/reply`, { reply });
          const data = updated.data;
          setReviews((prev) =>
            prev.map((r) =>
              r.id === item.id
                ? {
                    ...r,
                    replyContent: data?.replyContent || reply,
                    replyAt: data?.replyAt || new Date().toISOString(),
                  }
                : r,
            ),
          );
          Taro.showToast({ title: '已回复', icon: 'success' });
        } catch (e) {
          console.error('回复失败', e);
          Taro.showToast({ title: '回复失败', icon: 'none' });
        }
      },
    });
  };

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews]);

  Taro.usePullDownRefresh(() => {
    loadReviews(1).finally(() => Taro.stopPullDownRefresh());
  });

  if (loading) {
    return (
      <View className='admin-reviews-page'>
        <SkeletonLoader mode='list' count={5} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className='admin-reviews-page'>
        <EmptyState
          icon='warning'
          title='加载失败'
          description={canRetry ? '网络不太稳，点一下再试试' : '评价暂时加载不出来'}
          actionText={canRetry ? '再试一次' : '重新加载'}
          onAction={() => loadReviews(1)}
        />
      </View>
    );
  }

  if (reviews.length === 0) {
    return (
      <View className='admin-reviews-page'>
        <EmptyState
          icon='star'
          title='暂无评价'
          description='顾客完成订单后会显示在这里'
        />
      </View>
    );
  }

  return (
    <View className='admin-reviews-page'>
      {reviews.map((item) => (
        <View key={item.id} className='review-card'>
          <View className='review-card__header'>
            <View className='review-card__stars'>
              {[1, 2, 3, 4, 5].map((star) => (
                <View
                  key={star}
                  className={`review-card__star ${star <= item.rating ? 'review-card__star--active' : ''}`}
                >
                  <Icon
                    name={star <= item.rating ? 'star-filled' : 'star'}
                    size={16}
                    color={star <= item.rating ? '#FF6B35' : '#DDDDDD'}
                  />
                </View>
              ))}
              <Text className='review-card__score'>{item.rating} 分</Text>
            </View>
            <Text className='review-card__time'>
              {formatTime(item.createdAt, 'MM-DD HH:mm')}
            </Text>
          </View>
          <Text className='review-card__content'>
            {item.content?.trim() ? item.content : '（无文字评价）'}
          </Text>
          <Text className='review-card__order'>订单号：{shortOrderId(item.orderId)}</Text>
          {item.replyContent ? (
            <View className='review-card__reply'>
              <Text className='review-card__reply-label'>商家回复</Text>
              <Text className='review-card__reply-text'>{item.replyContent}</Text>
            </View>
          ) : (
            <View className='review-card__reply-btn' onClick={() => handleReply(item)}>
              <Text>回复</Text>
            </View>
          )}
        </View>
      ))}

      {hasMore ? (
        <View
          className='admin-reviews-page__more'
          onClick={() => !loadingMore && loadReviews(page + 1)}
        >
          <Text>{loadingMore ? '加载中...' : '加载更多'}</Text>
        </View>
      ) : (
        <ListEndTip show={reviews.length > 0} hasMore={false} />
      )}
    </View>
  );
}
