import { Alert } from 'antd';
import { useShopContext } from '@/hooks/useShopContext';

/**
 * 全店视角提示条。
 * 当顶栏选择「全店」且当前模块强绑定具体门店（菜品/促销/桌台/规格/店铺）时，
 * 这些模块仍围绕当前默认门店展示，用提示告知用户——避免误以为下方是全店聚合数据。
 */
const AllShopsScopeAlert: React.FC = () => {
  const { scope, currentShop } = useShopContext();
  if (scope !== 'all') return null;
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 'var(--tf-space-4)' }}
      message={
        <span>
          当前为<strong>全店视角</strong>，下方展示「{currentShop?.name || '当前门店'}」的数据；
          如需管理其他门店，请在顶栏切换至具体门店。
        </span>
      }
    />
  );
};

export default AllShopsScopeAlert;
