import { IsOptional, IsBoolean, IsNumber, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 语音播报配置（T308）。
 * - selection：每状态选中的话术 id（与 alertPhrases.ts 的 VOICE_OPTIONS 对齐）
 * - enabled：总开关
 * - volume：播放音量 0~1
 * - repeat：同一事件重复播报次数 1~3
 */
export interface VoiceAlertConfig {
  selection: Record<string, string>;
  enabled: boolean;
  volume: number;
  repeat: number;
}

/** 更新配置：所有字段可选，缺省字段保持原值（服务端按现有配置合并） */
export class UpdateVoiceAlertConfigDto {
  @IsOptional()
  @IsObject()
  selection?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  volume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(3)
  repeat?: number;
}
