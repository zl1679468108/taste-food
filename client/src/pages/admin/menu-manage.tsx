import { useState, useEffect } from 'react';
import { View, Text, Input, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post, patch as httpPatch, del } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { getCategoryIcon } from '../../utils/iconMap';
import { Category } from '../../types/menu';
import { MenuItem } from '../../types/menu';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../../env';
import './menu-manage.scss';

interface FormMode {
  type: 'create' | 'edit';
  title: string;
}

const EMOJI_OPTIONS = ['🍖', '🥩', '🍗', '🥬', '🥦', '🌽', '🥤', '🍺', '🍚', '🍜', '🦐', '🍢', '🧆', '🥟', '🧃', '🍵'];

const MenuManagePage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  // 本地状态
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>({ type: 'create', title: '添加菜品' });
  const [editCategoryVisible, setEditCategoryVisible] = useState(false);
  const [editCategoryItem, setEditCategoryItem] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // 表单字段
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEmoji, setFormEmoji] = useState('🍖');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formPrice, setFormPrice] = useState(''); // 元
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formStatus, setFormStatus] = useState('active');

  // 分类编辑
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategorySort, setEditCategorySort] = useState('0');

  // 新增分类
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySort, setNewCategorySort] = useState('0');
  const [addCategoryVisible, setAddCategoryVisible] = useState(false);

  /** 加载数据 */
  const loadData = async () => {
    setLoading(true);
    try {
      const shopId = DEFAULT_SHOP_ID;

      const [categoriesRes, menuItemsRes] = await Promise.all([
        get<Category[]>(`/categories?shop_id=${shopId}`),
        get<MenuItem[]>(`/menu-items?shop_id=${shopId}`),
      ]);

      const cats = categoriesRes.data;
      const items = menuItemsRes.data;

      setCategories(cats);
      setMenuItems(items);
      setActiveCategoryId(cats.length > 0 ? cats[0].id : null);
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      console.error('加载数据失败:', error);
    }
  };

  /** 检查登录状态 */
  const checkAuth = () => {
    if (!isLoggedIn || user?.role !== 'admin') {
      Taro.showToast({ title: '请先以管理员身份登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    loadData();
  };

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  Taro.useDidShow(() => {
    checkAuth();
  });

  /** 切换分类 */
  const selectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
  };

  /** 获取当前分类下的菜品 */
  const getFilteredItems = (): MenuItem[] => {
    if (!activeCategoryId) return [];
    return menuItems.filter((item) => item.categoryId === activeCategoryId);
  };

  /** 上传图片 */
  const handleUploadImage = async () => {
    try {
      const res = await Taro.chooseMedia({ count: 1, mediaType: ['image'] });
      const tempFilePath = res.tempFiles[0].tempFilePath;

      Taro.showLoading({ title: '上传中...' });

      const uploadRes = await Taro.uploadFile({
        url: `${API_BASE_URL}/storage/images/menu`,
        filePath: tempFilePath,
        name: 'image',
        header: {
          Authorization: `Bearer ${token}`,
        },
        formData: {
          originalName: 'item.jpg',
          userId: user?.userId || '',
        },
      });

      Taro.hideLoading();
      const data = JSON.parse(uploadRes.data);
      if (data.code === 0) {
        setFormImageUrl(data.data.url);
        Taro.showToast({ title: '上传成功', icon: 'success' });
      } else {
        throw new Error(data.message);
      }
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: '上传失败: ' + (e.message || ''), icon: 'none' });
    }
  };

  /** 打开添加菜品表单 */
  const openAddForm = () => {
    setFormVisible(true);
    setFormMode({ type: 'create', title: '添加菜品' });
    setEditingItem(null);
    setFormName('');
    setFormDescription('');
    setFormEmoji('🍖');
    setFormImageUrl('');
    setFormPrice('');
    setFormCategoryId(activeCategoryId || '');
    setFormStatus('active');
  };

  /** 打开编辑菜品表单 */
  const openEditForm = (item: MenuItem) => {
    setFormVisible(true);
    setFormMode({ type: 'edit', title: '编辑菜品' });
    setEditingItem(item);
    setFormName(item.name);
    setFormDescription(item.description || '');
    setFormEmoji('🍖');
    setFormImageUrl(item.imageUrl || '');
    setFormPrice((item.price / 100).toString());
    setFormCategoryId(item.categoryId);
    setFormStatus(item.status);
  };

  /** 保存菜品表单 */
  const saveItemForm = async () => {
    if (!formName || !formPrice) {
      Taro.showToast({ title: '请填写名称和价格', icon: 'none' });
      return;
    }

    const priceInFen = Math.round(parseFloat(formPrice) * 100);
    if (isNaN(priceInFen) || priceInFen < 0) {
      Taro.showToast({ title: '价格格式不正确', icon: 'none' });
      return;
    }

    const data = {
      name: formName,
      description: formDescription,
      price: priceInFen,
      categoryId: formCategoryId,
        shopId: DEFAULT_SHOP_ID,
      status: formStatus,
      imageUrl: formImageUrl,
    };

    try {
      if (formMode.type === 'create') {
        await post<any>('/menu-items', data);
        Taro.showToast({ title: '菜品创建成功', icon: 'success' });
      } else if (editingItem) {
        await httpPatch<any>(`/menu-items/${editingItem.id}`, data);
        Taro.showToast({ title: '菜品更新成功', icon: 'success' });
      }

      setFormVisible(false);
      loadData();
    } catch (error: any) {
      console.error('保存菜品失败:', error);
    }
  };

  /** 切换菜品上下架 */
  const toggleItemStatus = async (item: MenuItem) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await httpPatch(`/menu-items/${item.id}`, { status: newStatus });
      Taro.showToast({ title: newStatus === 'active' ? '已上架' : '已下架', icon: 'success' });
      loadData();
    } catch (error: any) {
      console.error('切换状态失败:', error);
    }
  };

  /** 删除菜品 */
  const deleteItem = (item: MenuItem) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除「${item.name}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/menu-items/${item.id}`);
            Taro.showToast({ title: '删除成功', icon: 'success' });
            loadData();
          } catch (error: any) {
            console.error('删除失败:', error);
          }
        }
      },
    });
  };

  /** 打开编辑分类弹窗 */
  const openEditCategory = (category: Category) => {
    setEditCategoryVisible(true);
    setEditCategoryItem(category);
    setEditCategoryName(category.name);
    setEditCategorySort(category.sortOrder.toString());
  };

  /** 保存分类编辑 */
  const saveCategoryEdit = async () => {
    if (!editCategoryItem) return;

    try {
      await httpPatch(`/categories/${editCategoryItem.id}`, {
        name: editCategoryName,
        sortOrder: parseInt(editCategorySort, 10) || 0,
      });
      Taro.showToast({ title: '分类更新成功', icon: 'success' });
      setEditCategoryVisible(false);
      loadData();
    } catch (error: any) {
      console.error('更新分类失败:', error);
    }
  };

  /** 删除分类 */
  const deleteCategory = (category: Category) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除「${category.name}」及其所有菜品吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/categories/${category.id}`);
            Taro.showToast({ title: '分类删除成功', icon: 'success' });
            setEditCategoryVisible(false);
            loadData();
          } catch (error: any) {
            console.error('删除分类失败:', error);
          }
        }
      },
    });
  };

  /** 添加分类 */
  const addCategory = async () => {
    if (!newCategoryName) {
      Taro.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    try {
      await post<any>('/categories', {
        name: newCategoryName,
      shopId: DEFAULT_SHOP_ID,
        sortOrder: parseInt(newCategorySort, 10) || 0,
      });
      Taro.showToast({ title: '分类创建成功', icon: 'success' });
      setAddCategoryVisible(false);
      setNewCategoryName('');
      setNewCategorySort('0');
      loadData();
    } catch (error: any) {
      console.error('创建分类失败:', error);
    }
  };

  const filteredItems = getFilteredItems();
  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  return (
    <View className='menu-manage'>
      {/* 分类头部 */}
      <View className='category-header'>
        <Text className='category-header__title'>菜品分类</Text>
        <View
          className='category-header__add-btn'
          onClick={() => {
            setAddCategoryVisible(true);
            setNewCategoryName('');
            setNewCategorySort((categories.length + 1).toString());
          }}
        >
          + 添加分类
        </View>
      </View>

      {/* 分类列表 */}
      <ScrollView className='category-scroll' scrollX enhanced showScrollbar={false}>
        {categories.map((cat) => (
          <View
            key={cat.id}
            className={`category-chip ${activeCategoryId === cat.id ? 'category-chip--active' : ''}`}
          >
            <Text onClick={() => selectCategory(cat.id)}>
              {getCategoryIcon(cat.iconKey)} {cat.name}
            </Text>
            <Text
              className='category-chip__edit'
              onClick={(e) => {
                e.stopPropagation();
                openEditCategory(cat);
              }}
            >
              ✏️
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* 主内容 */}
      <ScrollView className='menu-manage__body' scrollY enhanced showScrollbar={false}>
        {loading ? (
          <View className='menu-loading'>
            <Text>加载中...</Text>
          </View>
        ) : (
          <>
            {/* 添加菜品按钮 */}
            {activeCategory && (
              <View
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
                  {activeCategory.name}
                </Text>
                <View
                  style={{
                    padding: '6px 16px',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #e74c3c, #f39c12)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                  onClick={() => openAddForm()}
                >
                  + 添加菜品
                </View>
              </View>
            )}

            {filteredItems.length === 0 ? (
              <View className='empty-category'>
                <Text className='empty-category__icon'>🍽️</Text>
                <Text className='empty-category__text'>该分类下暂无菜品</Text>
              </View>
            ) : (
              <View className='menu-grid'>
                {filteredItems.map((item) => (
                  <View key={item.id} className='menu-item-admin-card'>
                    <View
                      className='menu-item-admin-card__image'
                      style={{
                        background: item.imageUrl ? `url(${item.imageUrl}) center/cover no-repeat` : `linear-gradient(135deg, #ff6b6b, #ffa07a)`,
                      }}
                    >
                      {!item.imageUrl && <Text>{formEmoji}</Text>}
                      <Text className='menu-item-admin-card__status-badge'>
                        {item.status === 'active' ? '上架' : '下架'}
                      </Text>
                    </View>
                    <View className='menu-item-admin-card__info'>
                      <Text className='menu-item-admin-card__name'>{item.name}</Text>
                      <Text className='menu-item-admin-card__desc'>{item.description}</Text>
                      <View className='menu-item-admin-card__bottom'>
                        <Text className='menu-item-admin-card__price'>
                          {formatPriceWithSymbol(item.price)}
                        </Text>
                        <View className='menu-item-admin-card__actions'>
                          <View
                            className={`menu-item-admin-card__action-btn ${
                              item.status === 'active'
                                ? 'menu-item-admin-card__action-btn--toggle'
                                : 'menu-item-admin-card__action-btn--toggle-off'
                            }`}
                            onClick={() => toggleItemStatus(item)}
                          >
                            {item.status === 'active' ? '✓' : '✕'}
                          </View>
                          <View
                            className='menu-item-admin-card__action-btn menu-item-admin-card__action-btn--edit'
                            onClick={() => openEditForm(item)}
                          >
                            ✎
                          </View>
                          <View
                            className='menu-item-admin-card__action-btn menu-item-admin-card__action-btn--delete'
                            onClick={() => deleteItem(item)}
                          >
                            🗑
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 添加/编辑菜品表单弹窗 */}
      {formVisible && (
        <View
          className='form-modal'
          onClick={() => setFormVisible(false)}
        >
          <View
            className='form-modal__content'
            onClick={(e) => e.stopPropagation()}
          >
            <View className='form-modal__header'>
              <Text className='form-modal__title'>{formMode.title}</Text>
              <View
                className='form-modal__close'
                onClick={() => setFormVisible(false)}
              >
                ✕
              </View>
            </View>
            <View className='form-modal__body'>
              <View className='form-field'>
                <Text className='form-field__label'>菜品名称 *</Text>
                <Input
                  className='form-field__input'
                  placeholder='请输入菜品名称'
                  value={formName}
                  onInput={(e) => setFormName(e.detail.value)}
                />
              </View>

              <View className='form-field'>
                <Text className='form-field__label'>菜品描述</Text>
                <Input
                  className='form-field__textarea'
                  placeholder='请输入菜品描述'
                  value={formDescription}
                  onInput={(e) =>
                    setFormDescription(e.detail.value)
                  }
                />
              </View>

              <View className='form-field'>
                <Text className='form-field__label'>菜品图片</Text>
                <View className='image-upload' onClick={() => handleUploadImage()}>
                  {formImageUrl ? (
                    <View className='image-preview' style={{ backgroundImage: `url(${formImageUrl})` }} />
                  ) : (
                    <View className='image-placeholder'>
                      <Text className='icon'>📷</Text>
                      <Text className='text'>点击上传图片</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className='form-field'>
                <Text className='form-field__label'>展示图标</Text>
                <View className='emoji-grid'>
                  {EMOJI_OPTIONS.map((emoji) => (
                    <View
                      key={emoji}
                      className={`emoji-option ${formEmoji === emoji ? 'emoji-option--selected' : ''}`}
                      onClick={() => setFormEmoji(emoji)}
                    >
                      <Text>{emoji}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className='form-field'>
                <Text className='form-field__label'>价格（元）*</Text>
                <Input
                  className='form-field__input'
                  placeholder='请输入价格（如 29.9）'
                  value={formPrice}
                  onInput={(e) => setFormPrice(e.detail.value)}
                  type='digit'
                />
              </View>

              <View className='form-field'>
                <Text className='form-field__label'>所属分类</Text>
                <Picker
                  mode='selector'
                  range={categories.map(cat => cat.name)}
                  value={categories.findIndex(cat => cat.id === formCategoryId)}
                  onChange={(e) => {
                    const index = Number(e.detail.value);
                    if (categories[index]) {
                      setFormCategoryId(categories[index].id);
                    }
                  }}
                >
                  <View className='form-field__select'>
                    <Text style={{ fontSize: 14, color: formCategoryId ? '#333' : '#999' }}>
                      {categories.find(cat => cat.id === formCategoryId)?.name || '请选择分类'}
                    </Text>
                  </View>
                </Picker>
              </View>
            </View>
            <View className='form-modal__footer'>
              <View
                className='form-modal__btn form-modal__btn--cancel'
                onClick={() => setFormVisible(false)}
              >
                取消
              </View>
              <View
                className='form-modal__btn form-modal__btn--submit'
                onClick={() => saveItemForm()}
              >
                {formMode.type === 'create' ? '添加' : '保存'}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 编辑分类弹窗 */}
      {editCategoryVisible && editCategoryItem && (
        <View
          className='edit-category-modal'
          onClick={() => setEditCategoryVisible(false)}
        >
          <View
            className='edit-category-modal__content'
            onClick={(e) => e.stopPropagation()}
          >
            <Text className='edit-category-modal__title'>
              编辑分类 - {editCategoryItem.name}
            </Text>

            <View className='form-field'>
              <Text className='form-field__label'>分类名称</Text>
              <Input
                className='form-field__input'
                value={editCategoryName}
                onInput={(e) =>
                  setEditCategoryName(e.detail.value)
                }
              />
            </View>

            <View className='form-field'>
              <Text className='form-field__label'>排序号</Text>
              <Input
                className='form-field__input'
                value={editCategorySort}
                onInput={(e) =>
                  setEditCategorySort(e.detail.value)
                }
                type='number'
              />
            </View>

            <View className='edit-category-modal__actions' style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <View
                style={{
                  height: 40,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #e74c3c, #f39c12)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                }}
                onClick={() => saveCategoryEdit()}
              >
                保存
              </View>
              <View
                style={{
                  height: 40,
                  borderRadius: 20,
                  background: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  border: '1px solid #ef4444',
                }}
                onClick={() => deleteCategory(editCategoryItem)}
              >
                删除此分类
              </View>
              <View
                style={{
                  height: 40,
                  borderRadius: 20,
                  background: '#f5f5f5',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
                onClick={() => setEditCategoryVisible(false)}
              >
                取消
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 添加分类弹窗 */}
      {addCategoryVisible && (
        <View
          className='edit-category-modal'
          onClick={() => setAddCategoryVisible(false)}
        >
          <View
            className='edit-category-modal__content'
            onClick={(e) => e.stopPropagation()}
          >
            <Text className='edit-category-modal__title'>添加分类</Text>

            <View className='form-field'>
              <Text className='form-field__label'>分类名称</Text>
              <Input
                className='form-field__input'
                placeholder='请输入分类名称'
                value={newCategoryName}
                onInput={(e) =>
                  setNewCategoryName(e.detail.value)
                }
              />
            </View>

            <View className='form-field'>
              <Text className='form-field__label'>排序号</Text>
              <Input
                className='form-field__input'
                placeholder='数字越小越靠前'
                value={newCategorySort}
                onInput={(e) =>
                  setNewCategorySort(e.detail.value)
                }
                type='number'
              />
            </View>

            <View className='edit-category-modal__actions' style={{ display: 'flex', gap: 8 }}>
              <View
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 20,
                  background: '#f5f5f5',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
                onClick={() => setAddCategoryVisible(false)}
              >
                取消
              </View>
              <View
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #e74c3c, #f39c12)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                }}
                onClick={() => addCategory()}
              >
                添加
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default MenuManagePage;
