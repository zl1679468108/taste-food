/** Admin 设计令牌 — 与 client design-tokens 对齐 */
export const brand = {
  primary: '#FF6B35',
  primaryLight: '#FFF0EB',
  primaryDark: '#E55A2B',
  primaryEnd: '#FF8F65',
  success: '#00C853',
  warning: '#FFB300',
  danger: '#FF5252',
  info: '#2196F3',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray500: '#9E9E9E',
  gray800: '#424242',
  textPrimary: '#212121',
  textSecondary: '#757575',
  radius: 8,
  shadow: '0 2px 8px rgba(0,0,0,0.06)',
} as const;

export const antdTheme = {
  token: {
    colorPrimary: brand.primary,
    colorLink: brand.primary,
    colorSuccess: brand.success,
    colorWarning: brand.warning,
    colorError: brand.danger,
    colorInfo: brand.info,
    borderRadius: brand.radius,
  },
};
