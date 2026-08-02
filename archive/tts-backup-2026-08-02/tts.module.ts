import { Module } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

/**
 * Edge TTS 模块（T309 决策：保留作「开发期工具」，生产不用）。
 *
 * 现网语音播报已改用豆包预生成 MP3（admin/public/sounds/alert/），
 * 本模块全仓唯一调用方是开发期试听页 `new-order-voice-demo.html`。
 * 故它属于「已注册但业务零调用」的死代码，暂保留以便开发期生成/试听，
 * 不擅自删除以免破坏试听链路；是否下线移出模块注册待后续决策（见 T309）。
 */
@Module({
  controllers: [TtsController],
  providers: [TtsService],
  exports: [TtsService],
})
export class TtsModule {}
