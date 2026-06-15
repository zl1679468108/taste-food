import { Component } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post, patch as httpPatch, del } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { getCategoryIcon } from '../../utils/iconMap';
import { Category } from '../../types/menu';
import { MenuItem, MenuItemStatus } from '../../types/menu';
import './menu-manage.scss';

interface FormMode {
  type: 'create' | 'edit';
  title: string;
}

interface MenuManageState {
  categories: Category[];
  menuItems: MenuItem[];
  activeCategoryId: string | null;
  loading: boolean;
  formVisible: boolean;
  formMode: FormMode;
  editCategoryVisible: boolean;
  editCategoryItem: Category | null;
  editingItem: MenuItem | null;

  // 表单字段
  formName: string;
  formDescription: string;
  formEmoji: string;
  formPrice: string; // 元
  formCategoryId: string;
  formStatus: string;

  // 分类编辑
  editCategoryName: string;
  editCategorySort: string;

  // 新增分类
  newCategoryName: string;
  newCategorySort: string;
  addCategoryVisible: boolean;
}

const EMOJI_OPTIONS = ['🍖', '🥩', '🍗', '🥬', '🥦', '🌽', '🥤', '🍺', '🍚', '🍜', '🦐', '🍢', '🧆', '🥟', '🧃', '🍵'];

export default class MenuManagePage extends Component<{}, MenuManageState> {
  private authStore = useAuthStore;

  constructor(props: {}) {
    super(props);

    this.state = {
      categories: [],
      menuItems: [],
      activeCategoryId: null,
      loading: true,
      formVisible: false,
      formMode: { type: 'create', title: '添加菜品' },
      editCategoryVisible: false,
      editCategoryItem: null,
      editingItem: null,
      formName: '',
      formDescription: '',
      formEmoji: '🍖',
      formPrice: '',
      formCategoryId: '',
      formStatus: 'active',
      editCategoryName: '',
      editCategorySort: '0',
      newCategoryName: '',
      newCategorySort: '0',
      addCategoryVisible: false,
    };
  }

  componentDidMount() {
    this.checkAuth();
  }

  componentDidShow() {
    this.checkAuth();
  }

  checkAuth() {
    const authState = this.authStore.getState();
    if (!authState.isLoggedIn || authState.user?.role !== 'admin') {
      Taro.showToast({ title: '请先以管理员身份登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    this.loadData();
  }

  async loadData() {
    this.setState({ loading: true });
    try {
      const shopId = '00000000-0000-0000-0000-000000000001';

      const [categoriesRes, menuItemsRes] = await Promise.all([
        get<Category[]>(`/categories?shop_id=${shopId}`),
        get<MenuItem[]>(`/menu-items?shop_id=${shopId}`),
      ]);

      const categories = categoriesRes.data;
      const menuItems = menuItemsRes.data;

      this.setState({
        categories,
        menuItems,
        activeCategoryId: categories.length > 0 ? categories[0].id : null,
        loading: false,
      });
    } catch (error: any) {
      this.setState({ loading: false });
      console.error('加载数据失败:', error);
    }
  }

  /** 切换分类 */
  selectCategory(categoryId: string) {
    this.setState({ activeCategoryId: categoryId });
  }

  /** 获取当前分类下的菜品 */
  getFilteredItems(): MenuItem[] {
    const { menuItems, activeCategoryId } = this.state;
    if (!activeCategoryId) return [];
    return menuItems.filter((item) => item.categoryId === activeCategoryId);
  }

  /** 打开添加菜品表单 */
  openAddForm() {
    const { activeCategoryId } = this.state;
    this.setState({
      formVisible: true,
      formMode: { type: 'create', title: '添加菜品' },
      editingItem: null,
      formName: '',
      formDescription: '',
      formEmoji: '🍖',
      formPrice: '',
      formCategoryId: activeCategoryId || '',
      formStatus: 'active',
    });
  }

  /** 打开编辑菜品表单 */
  openEditForm(item: MenuItem) {
    this.setState({
      formVisible: true,
      formMode: { type: 'edit', title: '编辑菜品' },
      editingItem: item,
      formName: item.name,
      formDescription: item.description || '',
      formEmoji: '🍖',
      formPrice: (item.price / 100).toString(),
      formCategoryId: item.categoryId,
      formStatus: item.status,
    });
  }

  /** 保存菜品表单 */
  async saveItemForm() {
    const { formMode, editingItem, formName, formDescription, formPrice, formCategoryId } = this.state;

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
      shopId: '00000000-0000-0000-0000-000000000001',
      status: this.state.formStatus,
      imageUrl: '',
    };

    try {
      if (formMode.type === 'create') {
        await post<any>('/menu-items', data);
        Taro.showToast({ title: '菜品创建成功', icon: 'success' });
      } else if (editingItem) {
        await httpPatch<any>(`/menu-items/${editingItem.id}`, data);
        Taro.showToast({ title: '菜品更新成功', icon: 'success' });
      }

      this.setState({ formVisible: false });
      this.loadData();
    } catch (error: any) {
      console.error('保存菜品失败:', error);
    }
  }

  /** 切换菜品上下架 */
  async toggleItemStatus(item: MenuItem) {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await httpPatch(`/menu-items/${item.id}`, { status: newStatus });
      Taro.showToast({ title: newStatus === 'active' ? '已上架' : '已下架', icon: 'success' });
      this.loadData();
    } catch (error: any) {
      console.error('切换状态失败:', error);
    }
  }

  /** 删除菜品 */
  async deleteItem(item: MenuItem) {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除「${item.name}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/menu-items/${item.id}`);
            Taro.showToast({ title: '删除成功', icon: 'success' });
            this.loadData();
          } catch (error: any) {
            console.error('删除失败:', error);
          }
        }
      },
    });
  }

  /** 打开编辑分类弹窗 */
  openEditCategory(category: Category) {
    this.setState({
      editCategoryVisible: true,
      editCategoryItem: category,
      editCategoryName: category.name,
      editCategorySort: category.sortOrder.toString(),
    });
  }

  /** 保存分类编辑 */
  async saveCategoryEdit() {
    const { editCategoryItem, editCategoryName, editCategorySort } = this.state;
    if (!editCategoryItem) return;

    try {
      await httpPatch(`/categories/${editCategoryItem.id}`, {
        name: editCategoryName,
        sortOrder: parseInt(editCategorySort, 10) || 0,
      });
      Taro.showToast({ title: '分类更新成功', icon: 'success' });
      this.setState({ editCategoryVisible: false });
      this.loadData();
    } catch (error: any) {
      console.error('更新分类失败:', error);
    }
  }

  /** 删除分类 */
  async deleteCategory(category: Category) {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除「${category.name}」及其所有菜品吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await del(`/categories/${category.id}`);
            Taro.showToast({ title: '分类删除成功', icon: 'success' });
            this.setState({ editCategoryVisible: false });
            this.loadData();
          } catch (error: any) {
            console.error('删除分类失败:', error);
          }
        }
      },
    });
  }

  /** 添加分类 */
  async addCategory() {
    const { newCategoryName, newCategorySort } = this.state;
    if (!newCategoryName) {
      Taro.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    try {
      await post<any>('/categories', {
        name: newCategoryName,
        shopId: '00000000-0000-0000-0000-000000000001',
        sortOrder: parseInt(newCategorySort, 10) || 0,
      });
      Taro.showToast({ title: '分类创建成功', icon: 'success' });
      this.setState({
        addCategoryVisible: false,
        newCategoryName: '',
        newCategorySort: '0',
      });
      this.loadData();
    } catch (error: any) {
      console.error('创建分类失败:', error);
    }
  }

  render() {
    const {
      categories,
      activeCategoryId,
      loading,
      formVisible,
      formMode,
      editCategoryVisible,
      editCategoryItem,
      formName,
      formDescription,
      formEmoji,
      formPrice,
      formCategoryId,
      addCategoryVisible,
      newCategoryName,
      newCategorySort,
      editCategoryName,
      editCategorySort,
    } = this.state;

    const filteredItems = this.getFilteredItems();
    const activeCategory = categories.find((c) => c.id === activeCategoryId);

    return (
      <View className='menu-manage'>
        {/* 分类头部 */}
        <View className='category-header'>
          <Text className='category-header__title'>菜品分类</Text>
          <View
            className='category-header__add-btn'
            onClick={() =>
              this.setState({
                addCategoryVisible: true,
                newCategoryName: '',
                newCategorySort: (categories.length + 1).toString(),
              })
            }
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
              <Text onClick={() => this.selectCategory(cat.id)}>
                {getCategoryIcon(cat.iconKey)} {cat.name}
              </Text>
              <Text
                className='category-chip__edit'
                onClick={(e) => {
                  e.stopPropagation();
                  this.openEditCategory(cat);
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
                    onClick={() => this.openAddForm()}
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
                          background: `linear-gradient(135deg, #ff6b6b, #ffa07a)`,
                        }}
                      >
                        <Text>{formEmoji}</Text>
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
                              onClick={() => this.toggleItemStatus(item)}
                            >
                              {item.status === 'active' ? '✓' : '✕'}
                            </View>
                            <View
                              className='menu-item-admin-card__action-btn menu-item-admin-card__action-btn--edit'
                              onClick={() => this.openEditForm(item)}
                            >
                              ✎
                            </View>
                            <View
                              className='menu-item-admin-card__action-btn menu-item-admin-card__action-btn--delete'
                              onClick={() => this.deleteItem(item)}
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
            onClick={() => this.setState({ formVisible: false })}
          >
            <View
              className='form-modal__content'
              onClick={(e) => e.stopPropagation()}
            >
              <View className='form-modal__header'>
                <Text className='form-modal__title'>{formMode.title}</Text>
                <View
                  className='form-modal__close'
                  onClick={() => this.setState({ formVisible: false })}
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
                    onInput={(e) => this.setState({ formName: e.detail.value })}
                  />
                </View>

                <View className='form-field'>
                  <Text className='form-field__label'>菜品描述</Text>
                  <Input
                    className='form-field__textarea'
                    placeholder='请输入菜品描述'
                    value={formDescription}
                    onInput={(e) =>
                      this.setState({ formDescription: e.detail.value })
                    }
                  />
                </View>

                <View className='form-field'>
                  <Text className='form-field__label'>展示图标</Text>
                  <View className='emoji-grid'>
                    {EMOJI_OPTIONS.map((emoji) => (
                      <View
                        key={emoji}
                        className={`emoji-option ${formEmoji === emoji ? 'emoji-option--selected' : ''}`}
                        onClick={() => this.setState({ formEmoji: emoji })}
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
                    onInput={(e) => this.setState({ formPrice: e.detail.value })}
                    type='digit'
                  />
                </View>

                <View className='form-field'>
                  <Text className='form-field__label'>所属分类</Text>
                  <View
                    className='form-field__select'
                  >
                    <select
                      value={formCategoryId}
                      onChange={(e: any) =>
                        this.setState({ formCategoryId: e.target.value || e.detail.value })
                      }
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: 'transparent',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </View>
                </View>
              </View>
              <View className='form-modal__footer'>
                <View
                  className='form-modal__btn form-modal__btn--cancel'
                  onClick={() => this.setState({ formVisible: false })}
                >
                  取消
                </View>
                <View
                  className='form-modal__btn form-modal__btn--submit'
                  onClick={() => this.saveItemForm()}
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
            onClick={() => this.setState({ editCategoryVisible: false })}
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
                    this.setState({ editCategoryName: e.detail.value })
                  }
                />
              </View>

              <View className='form-field'>
                <Text className='form-field__label'>排序号</Text>
                <Input
                  className='form-field__input'
                  value={editCategorySort}
                  onInput={(e) =>
                    this.setState({ editCategorySort: e.detail.value })
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
                  onClick={() => this.saveCategoryEdit()}
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
                  onClick={() => this.deleteCategory(editCategoryItem)}
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
                  onClick={() => this.setState({ editCategoryVisible: false })}
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
            onClick={() => this.setState({ addCategoryVisible: false })}
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
                    this.setState({ newCategoryName: e.detail.value })
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
                    this.setState({ newCategorySort: e.detail.value })
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
                  onClick={() => this.setState({ addCategoryVisible: false })}
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
                  onClick={() => this.addCategory()}
                >
                  添加
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }
}
