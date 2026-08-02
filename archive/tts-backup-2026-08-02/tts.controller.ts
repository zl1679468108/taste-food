import { Body, Controller, Post, Res, HttpStatus, BadRequestException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { TtsService } from './tts.service';
import { EdgeTtsDto } from './dto/edge-tts.dto';

/**
 * TTS 代理控制器。
 * 浏览器直连微软 Edge TTS 容易被 CORS/网络限制拦截，由后端代为连接并返回音频。
 * Edge TTS 免费、无需 API Key，但微软端点在中国大陆偶发 WebSocket 升级超时，
 * 因此 controller 需把超时转成网关错误，让前端能快速降级到浏览器本地语音合成。
 */
@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Public()
  @Post('edge')
  async edge(@Body() dto: EdgeTtsDto, @Res() res: Response) {
    const text = dto.text?.trim();
    const voice = dto.voice?.trim() || 'zh-CN-XiaoxiaoNeural';
    if (!text) {
      throw new BadRequestException('合成文本不能为空');
    }

    try {
      const buffer = await this.ttsService.edgeTTS(text, voice);
      res.set('Content-Type', 'audio/mpeg');
      res.send(buffer);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('超时')) {
        throw new GatewayTimeoutException('Edge TTS 合成超时，建议前端降级到浏览器语音合成');
      }
      if (msg.includes('WebSocket 错误') || msg.includes('未收到音频数据')) {
        throw new ServiceUnavailableException('Edge TTS 暂不可用：' + msg);
      }
      throw new ServiceUnavailableException('Edge TTS 合成失败：' + msg);
    }
  }
}
