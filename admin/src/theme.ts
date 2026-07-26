/** Admin 设计令牌 — 与 client/src/styles/_design-tokens.scss 语义对齐 */
export const brand = {
  /* ---------- 品牌色 ---------- */
  primary: '#FF6B35',
  primaryLight: '#FFF0EB',
  primaryDark: '#E55A2B',
  primaryEnd: '#FF8F65',

  /* ---------- 功能色 ---------- */
  success: '#00C853',
  warning: '#FFB300',
  danger: '#FF5252',
  info: '#2196F3',

  /* ---------- 中性色阶 ---------- */
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',

  /* ---------- 语义色：文字 ---------- */
  textPrimary: '#212121',
  textSecondary: '#757575',
  textTertiary: '#9E9E9E',
  textHint: '#BDBDBD',
  textInverse: '#FFFFFF',
  textPrice: '#FF6B35',

  /* ---------- 语义色：表面 / 背景 ---------- */
  bgPage: '#F5F5F5',
  bgCard: '#FFFFFF',
  bgMuted: '#FAFAFA',

  /* ---------- 语义色：边框 / 分割 ---------- */
  border: '#EEEEEE',
  divider: '#F5F5F5',

  /* ---------- 字号阶梯（px number，与小程序一致） ---------- */
  font2xs: 10,
  fontXs: 12,
  fontSm: 13,
  fontBase: 14,
  fontMd: 15,
  fontLg: 16,
  fontXl: 17,
  font2xl: 18,
  font3xl: 20,
  font4xl: 22,
  font5xl: 24,
  font6xl: 28,
  font7xl: 34,

  /* ---------- 间距阶梯（px number） ---------- */
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space7: 28,
  space8: 32,
  space10: 40,
  space12: 48,

  /* ---------- 圆角 ---------- */
  /** antd 默认圆角（兼容现有 brand.radius 引用） */
  radius: 8,
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
  radiusXl: 16,

  /* ---------- 阴影 ---------- */
  /** 默认卡片阴影（兼容现有 brand.shadow 引用） */
  shadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  shadowSm: '0 1px 3px rgba(0, 0, 0, 0.06)',
  shadowMd: '0 2px 8px rgba(0, 0, 0, 0.08)',

  /* ---------- 字体族 ---------- */
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const;

export type BrandTokens = typeof brand;

export const antdTheme = {
  token: {
    colorPrimary: brand.primary,
    colorLink: brand.primary,
    colorSuccess: brand.success,
    colorWarning: brand.warning,
    colorError: brand.danger,
    colorInfo: brand.info,
    colorText: brand.textPrimary,
    colorTextSecondary: brand.textSecondary,
    colorTextTertiary: brand.textTertiary,
    colorBgLayout: brand.bgPage,
    colorBgContainer: brand.bgCard,
    colorBorder: brand.border,
    colorSplit: brand.divider,
    borderRadius: brand.radius,
    fontSize: brand.fontBase,
    fontFamily: brand.fontFamily,
  },
};
