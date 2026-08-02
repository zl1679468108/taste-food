import { Injectable } from '@nestjs/common';
import { randomUUID, createHash, randomBytes } from 'crypto';
import WebSocket from 'ws';

/**
 * TTS 代理服务：对接 Edge TTS（微软在线神经语音）。
 * 免费、无需 Key，适合小项目替代浏览器本地机械语音。
 *
 * 注意：微软 Edge TTS 端点要求携带 Sec-MS-GEC 时间窗口 DRM 令牌，
 * 否则返回 403。令牌为 SHA256(时间窗口刻度 + 固定客户端令牌) 的大写十六进制。
 *
 * 协议实现尽量对齐 edge-tts 上游：
 * https://github.com/rany2/edge-tts/tree/master/src/edge_tts
 */
@Injectable()
export class TtsService {
  private readonly EDGE_WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
  private readonly EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  private readonly OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

  // 微软 Windows 纪元（秒）：1601-01-01 相对 1970-01-01
  private readonly WIN_EPOCH = 11644473600;
  private readonly S_TO_NS = 1e9;
  // 候选版本号，逐个尝试以提升成功率（首位须为当前 Edge 大版本）
  private readonly GEC_VERSIONS = ['1-143.0.3650.75', '1-132.0.2957.140'];
  // 单条 WebSocket 连接超时（秒）：微软端点在中国大陆偶发升级挂死，不能等太久
  private readonly WS_TIMEOUT_MS = 8000;
  // 简易熔断：连续失败达到阈值后，一段时间内直接快速失败，避免反复挂起后端
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private readonly CIRCUIT_FAILURE_THRESHOLD = 3;
  private readonly CIRCUIT_OPEN_MS = 120000;

  /**
   * 生成 Sec-MS-GEC 时间窗口令牌。
   * 算法：当前 Unix 秒 + Windows 纪元，向下取整到 300 秒窗口，
   * 再乘以 1e7 得到 100ns 刻度，拼上固定令牌后做 SHA256。
   */
  private generateSecMsGec(): string {
    let ticks = Date.now() / 1000 + this.WIN_EPOCH;
    ticks -= ticks % 300; // 对齐到 300 秒窗口
    ticks *= this.S_TO_NS / 100; // 转成 100ns 刻度（×1e7）
    const strToHash = `${ticks.toFixed(0)}${this.EDGE_TOKEN}`;
    return createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
  }

  /**
   * 生成随机 MUID Cookie，微软 handshake 现在似乎需要它。
   */
  private generateMuid(): string {
    return randomBytes(16).toString('hex').toUpperCase();
  }

  /**
   * 生成 edge-tts 风格的 X-Timestamp（UTC，JS Date 字符串）。
   */
  private makeTimestamp(): string {
    const d = new Date();
    const w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    const pad = (n: number) => String(n).padStart(2, '0');
    // 例：Sat Aug 01 2026 14:52:00 GMT+0000 (Coordinated Universal Time)
    return `${w} ${m} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
  }

  /**
   * 调用微软 Edge TTS，返回合成后的 MP3 音频 Buffer。
   *
   * @param text 待合成文本
   * @param voice Edge voice 名称，默认 zh-CN-XiaoxiaoNeural（晓晓）
   * @returns MP3 Buffer
   */
  async edgeTTS(text: string, voice = 'zh-CN-XiaoxiaoNeural'): Promise<Buffer> {
    if (!text || !text.trim()) {
      throw new Error('合成文本不能为空');
    }

    // 熔断检查：近期连续失败则快速失败，倒逼前端走本地语音兜底
    const now = Date.now();
    if (now < this.circuitOpenUntil) {
      throw new Error(`Edge TTS 熔断中，${Math.ceil((this.circuitOpenUntil - now) / 1000)} 秒后恢复`);
    }

    let lastError: Error | null = null;
    for (const version of this.GEC_VERSIONS) {
      try {
        const result = await this.edgeTTSAttempt(text, voice, version);
        this.consecutiveFailures = 0; // 成功则重置计数
        return result;
      } catch (err) {
        lastError = err as Error;
        // 仅疑似鉴权失败时尝试下一个版本；超时/网络错误直接抛出并累加熔断
        if (err instanceof Error && (err.message.includes('超时') || err.message.includes('WebSocket 错误'))) {
          this.consecutiveFailures += 1;
          if (this.consecutiveFailures >= this.CIRCUIT_FAILURE_THRESHOLD) {
            this.circuitOpenUntil = Date.now() + this.CIRCUIT_OPEN_MS;
          }
          throw err;
        }
      }
    }
    this.consecutiveFailures += 1;
    throw lastError ?? new Error('Edge TTS 合成失败');
  }

  private edgeTTSAttempt(text: string, voice: string, gecVersion: string): Promise<Buffer> {
    const connId = randomUUID();
    const secMsGec = this.generateSecMsGec();
    const muid = this.generateMuid();
    const url =
      `${this.EDGE_WSS_URL}?TrustedClientToken=${this.EDGE_TOKEN}` +
      `&ConnectionId=${connId}` +
      `&Sec-MS-GEC=${secMsGec}` +
      `&Sec-MS-GEC-Version=${gecVersion}`;

    return new Promise<Buffer>((resolve, reject) => {
      let closed = false;
      const chunks: Buffer[] = [];
      let configAck = false;

      const ws = new WebSocket(url, {
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          Cookie: `muid=${muid};`,
        },
      });

      const cleanup = () => {
        if (!closed) {
          closed = true;
          try { ws.close(); } catch { /* ignore */ }
        }
      };

      const finish = () => {
        cleanup();
        if (chunks.length === 0) {
          reject(new Error('未收到音频数据，可能音色不可用或被微软限制'));
          return;
        }
        resolve(Buffer.concat(chunks));
      };

      const now = this.makeTimestamp();
      const configMsg =
        `X-Timestamp:${now}\r\n` +
        'Content-Type:application/json; charset=utf-8\r\n' +
        'Path:speech.config\r\n\r\n' +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                outputFormat: this.OUTPUT_FORMAT,
              },
            },
          },
        });
      const ssml =
        `X-RequestId:${connId}\r\n` +
        'Content-Type:application/ssml+xml\r\n' +
        `X-Timestamp:${now}Z\r\n` + // 注意：edge-tts 源码此处故意在 timestamp 后加 Z
        'Path:ssml\r\n\r\n' +
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='" +
        voice +
        "'><prosody rate='+0%' pitch='+0%'>" +
        this.escapeXml(text) +
        '</prosody></voice></speak>';

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Edge TTS 合成超时（configAck=${configAck}, chunks=${chunks.length}）`));
      }, this.WS_TIMEOUT_MS);

      ws.on('open', () => {
        ws.send(configMsg);
        ws.send(ssml);
      });

      ws.on('message', (data: Buffer, isBinary: boolean) => {
        if (!isBinary) {
          const msg = data.toString();
          if (msg.indexOf('Path:turn.end') >= 0) {
            clearTimeout(timeout);
            finish();
          } else if (msg.indexOf('Path:response') >= 0 || msg.indexOf('Path:turn.start') >= 0) {
            configAck = true;
          }
          return;
        }
        // 二进制音频帧：2-byte header length（大端 BE）+ header text + audio bytes
        if (data.length < 2) return;
        const headerLen = data.readUInt16BE(0);
        if (headerLen + 2 <= data.length) {
          chunks.push(data.subarray(headerLen + 2));
        }
      });

      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Edge TTS WebSocket 错误：' + err.message));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!closed) {
          finish();
        }
      });
    });
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
