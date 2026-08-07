import * as TaroImport from '@tarojs/taro';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDev: boolean;
  private minLevel: LogLevel;

  constructor() {
    // 微信小程序环境判断
    this.isDev = process.env.NODE_ENV === 'development' || 
                 process.env.TARO_ENV === 'weapp' && 
                 (typeof __wxConfig !== 'undefined' && __wxConfig.debug);
    
    // 生产环境只输出 warn 和 error
    this.minLevel = this.isDev ? 'debug' : 'warn';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }

  // 业务专用：错误上报（可对接 Sentry 等）
  reportError(error: Error, context?: LogContext): void {
    this.error(error.message, { 
      stack: error.stack, 
      ...context 
    });
    // TODO: 生产环境可接入 Sentry / 自定义上报
  }
}

export const logger = new Logger();

// 便捷导出
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  reportError: logger.reportError.bind(logger),
};

export default logger;