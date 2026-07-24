/** 中国大陆手机号 */
export const PHONE_REG = /^1[3-9]\d{9}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_REG.test((phone || '').trim());
}

export function isNonEmpty(value: string): boolean {
  return (value || '').trim().length > 0;
}
