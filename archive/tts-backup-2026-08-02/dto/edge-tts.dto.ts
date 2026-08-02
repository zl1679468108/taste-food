import { IsOptional, IsString } from 'class-validator';

/**
 * Edge TTS（微软在线语音合成）代理请求 DTO。
 * 完全免费、无需 API Key，后端代为连接微软 WebSocket 端点并返回音频。
 */
export class EdgeTtsDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  voice?: string;
}
