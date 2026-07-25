import { Logger } from '@nestjs/common';

Logger.overrideLogger(false);

const originalWarn = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
  const message = args.map((arg) => String(arg)).join(' ');
  if (message.includes('[Supabase] SUPABASE_URL 或 SUPABASE_KEY 未配置')) {
    return;
  }
  originalWarn(...args);
};
