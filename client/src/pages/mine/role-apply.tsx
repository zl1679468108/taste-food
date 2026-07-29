import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import EmptyState from '../../components/EmptyState';
import './role-apply.scss';

type ApplyRole = 'merchant' | 'rider';
type AppStatus = 'pending' | 'approved' | 'rejected';

interface RoleApplication {
  id: string;
  applyRole: ApplyRole;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  contactName?: string;
  contactPhone?: string;
  status: AppStatus;
  rejectReason?: string;
  createdAt?: string;
  reviewedAt?: string;
}

interface RoleApplicationEligibility {
  eligible: boolean;
  reason?: string;
}

const STATUS_LABEL: Record<AppStatus, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已驳回',
};

export default function RoleApplyPage() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const initialRole = (router.params?.role === 'rider' ? 'rider' : 'merchant') as ApplyRole;
  const [applyRole, setApplyRole] = useState<ApplyRole>(initialRole);
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [contactName, setContactName] = useState(user?.nickName || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [list, setList] = useState<RoleApplication[]>([]);
  const [eligibility, setEligibility] = useState<RoleApplicationEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadMine = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await get<RoleApplication[]>('/role-applications/mine', undefined, { showError: false });
      setList(res.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkEligibility = useCallback(async (role: ApplyRole, name?: string) => {
    try {
      const res = await get<RoleApplicationEligibility>(
        '/role-applications/check-eligibility',
        {
          applyRole: role,
          ...(role === 'merchant' && name?.trim() ? { shopName: name.trim() } : {}),
        },
        { showError: false, useCache: false },
      );
      setEligibility(res.data || null);
      return res.data || null;
    } catch {
      setEligibility(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadMine();
    fetchMe();
  }, [isLoggedIn, loadMine, fetchMe]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setTimeout(() => {
      checkEligibility(applyRole, shopName);
    }, 350);
    return () => clearTimeout(timer);
  }, [isLoggedIn, applyRole, shopName, checkEligibility]);

  const latestForRole = useMemo(() => {
    const rows = list
      .filter((a) => a.applyRole === applyRole)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return rows[0];
  }, [list, applyRole]);

  const canSubmit =
    !latestForRole ||
    latestForRole.status === 'rejected' ||
    latestForRole.status === 'approved';

  // 已有 pending 时禁止重复提交；approved 仍可展示但提示已通过
  const blockedByPending = latestForRole?.status === 'pending';
  const blockedByEligibility = Boolean(eligibility && !eligibility.eligible);

  const handleSubmit = async () => {
    if (submitting || blockedByPending) return;
    if (applyRole === 'merchant') {
      if (!shopName.trim() || !shopAddress.trim() || !shopPhone.trim()) {
        Taro.showToast({ title: '请填写店名、地址、电话', icon: 'none' });
        return;
      }
    } else {
      if (!contactName.trim() || !contactPhone.trim()) {
        Taro.showToast({ title: '请填写联系人与电话', icon: 'none' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const checked = await checkEligibility(applyRole, shopName);
      if (checked && !checked.eligible) {
        Taro.showToast({ title: checked.reason || '当前不可提交申请', icon: 'none' });
        return;
      }
      await post(
        '/role-applications',
        {
          applyRole,
          shopName: shopName.trim() || undefined,
          shopAddress: shopAddress.trim() || undefined,
          shopPhone: shopPhone.trim() || undefined,
          contactName: contactName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        },
        { showError: true },
      );
      Taro.showToast({ title: '申请已提交', icon: 'success' });
      await loadMine();
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <View className='role-apply-page'>
        <EmptyState
          icon='lock'
          title='请先登录'
          description='登录后才能提交身份申请'
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
      </View>
    );
  }

  return (
    <View className='role-apply-page'>
      <View className='role-apply-page__tabs'>
        {(['merchant', 'rider'] as ApplyRole[]).map((r) => (
          <View
            key={r}
            className={`role-apply-page__tab${applyRole === r ? ' is-active' : ''}`}
            onClick={() => setApplyRole(r)}
          >
            <Text>{r === 'merchant' ? '商家入驻' : '骑手申请'}</Text>
          </View>
        ))}
      </View>

      {latestForRole && (
        <View className={`role-apply-page__status role-apply-page__status--${latestForRole.status}`}>
          <Text className='role-apply-page__status-title'>
            最近申请：{STATUS_LABEL[latestForRole.status]}
          </Text>
          {latestForRole.status === 'rejected' && latestForRole.rejectReason && (
            <Text className='role-apply-page__status-reason'>
              驳回原因：{latestForRole.rejectReason}
            </Text>
          )}
          {latestForRole.status === 'approved' && (
            <Text className='role-apply-page__status-reason'>
              已通过，可在「我的」切换到对应角色
            </Text>
          )}
          {latestForRole.status === 'pending' && (
            <Text className='role-apply-page__status-reason'>审核中，请耐心等待</Text>
          )}
        </View>
      )}

      {eligibility && !eligibility.eligible && (
        <View className='role-apply-page__status role-apply-page__status--rejected'>
          <Text className='role-apply-page__status-title'>暂不可申请</Text>
          <Text className='role-apply-page__status-reason'>
            {eligibility.reason || '当前不可提交申请'}
          </Text>
        </View>
      )}

      {(!blockedByPending || latestForRole?.status === 'rejected') && (
        <View className='role-apply-page__form'>
          {applyRole === 'merchant' ? (
            <>
              <View className='role-apply-page__field'>
                <Text className='role-apply-page__label'>
                  店铺名称
                  <Text className='form-required'>*</Text>
                </Text>
                <Input
                  className='role-apply-page__input'
                  placeholder='例如：小买卖面馆'
                  value={shopName}
                  onInput={(e) => setShopName(e.detail.value)}
                />
              </View>
              <View className='role-apply-page__field'>
                <Text className='role-apply-page__label'>
                  店铺地址
                  <Text className='form-required'>*</Text>
                </Text>
                <Input
                  className='role-apply-page__input'
                  placeholder='详细地址'
                  value={shopAddress}
                  onInput={(e) => setShopAddress(e.detail.value)}
                />
              </View>
              <View className='role-apply-page__field'>
                <Text className='role-apply-page__label'>
                  店铺电话
                  <Text className='form-required'>*</Text>
                </Text>
                <Input
                  className='role-apply-page__input'
                  type='number'
                  placeholder='联系电话'
                  value={shopPhone}
                  onInput={(e) => setShopPhone(e.detail.value)}
                />
              </View>
            </>
          ) : (
            <>
              <View className='role-apply-page__field'>
                <Text className='role-apply-page__label'>
                  联系人
                  <Text className='form-required'>*</Text>
                </Text>
                <Input
                  className='role-apply-page__input'
                  placeholder='真实姓名'
                  value={contactName}
                  onInput={(e) => setContactName(e.detail.value)}
                />
              </View>
              <View className='role-apply-page__field'>
                <Text className='role-apply-page__label'>
                  联系电话
                  <Text className='form-required'>*</Text>
                </Text>
                <Input
                  className='role-apply-page__input'
                  type='number'
                  placeholder='手机号'
                  value={contactPhone}
                  onInput={(e) => setContactPhone(e.detail.value)}
                />
              </View>
            </>
          )}

          <View
            className={`role-apply-page__btn${
              submitting || (!canSubmit && blockedByPending) || blockedByEligibility ? ' is-disabled' : ''
            }`}
            onClick={() => !submitting && !blockedByPending && !blockedByEligibility && handleSubmit()}
          >
            <Text>
              {submitting
                ? '提交中...'
                : latestForRole?.status === 'rejected'
                  ? '重新提交申请'
                  : '提交申请'}
            </Text>
          </View>
        </View>
      )}

      <View className='role-apply-page__history'>
        <Text className='role-apply-page__history-title'>我的申请记录</Text>
        {loading ? (
          <Text className='role-apply-page__empty'>加载中...</Text>
        ) : list.length === 0 ? (
          <Text className='role-apply-page__empty'>暂无申请记录</Text>
        ) : (
          list.map((item) => (
            <View key={item.id} className='role-apply-page__item'>
              <View className='role-apply-page__item-row'>
                <Text className='role-apply-page__item-role'>
                  {item.applyRole === 'merchant' ? '商家' : '骑手'}
                </Text>
                <Text className={`role-apply-page__badge role-apply-page__badge--${item.status}`}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
              {item.shopName && (
                <Text className='role-apply-page__item-meta'>店铺：{item.shopName}</Text>
              )}
              {item.contactPhone && (
                <Text className='role-apply-page__item-meta'>电话：{item.contactPhone}</Text>
              )}
              {item.rejectReason && (
                <Text className='role-apply-page__item-meta'>原因：{item.rejectReason}</Text>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
