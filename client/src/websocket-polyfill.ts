/**
 * WebSocket polyfill for Taro mini-programs
 *
 * Wraps Taro.connectSocket() to provide the standard WebSocket API
 * expected by engine.io-client / socket.io-client.
 *
 * Standard WebSocket API:
 *   new WebSocket(url, protocols?)
 *   ws.onopen / onclose / onmessage / onerror (property-based)
 *   ws.send(data) / ws.close()
 *   ws.readyState / ws.CONNECTING / ws.OPEN / ws.CLOSING / ws.CLOSED
 */

// @ts-ignore
import Taro from '@tarojs/taro';

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

class MiniProgramWebSocket {
  private _url: string;
  private _protocols: string | string[] | undefined;
  private _readyState: number = CLOSED;
  private _task: any = null;
  private _binaryType: string = 'blob';

  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  static readonly CONNECTING = CONNECTING;
  static readonly OPEN = OPEN;
  static readonly CLOSING = CLOSING;
  static readonly CLOSED = CLOSED;

  get readyState(): number { return this._readyState; }
  get binaryType(): string { return this._binaryType; }
  set binaryType(val: string) { this._binaryType = val; }
  get url(): string { return this._url; }

  constructor(url: string, protocols?: string | string[]) {
    this._url = url;
    this._protocols = protocols;

    this._readyState = CONNECTING;

    const opts: any = { url };

    // 如果传了 protocols，作为 header 传给服务器
    if (protocols) {
      opts.header = opts.header || {};
      opts.header['Sec-WebSocket-Protocol'] = Array.isArray(protocols)
        ? protocols.join(', ')
        : protocols;
    }

    try {
      this._task = Taro.connectSocket(opts);
    } catch (err) {
      // 同步构造时 connectSocket 失败
      this._readyState = CLOSED;
      setTimeout(() => {
        if (this.onerror) this.onerror(err || new Error('connectSocket failed'));
        if (this.onclose) this.onclose({ code: 1006, reason: 'Connection failed', wasClean: false });
      }, 0);
      return;
    }

    this._task.onOpen(() => {
      this._readyState = OPEN;
      if (this.onopen) this.onopen({ type: 'open' });
    });

    this._task.onClose((res: any) => {
      this._readyState = CLOSED;
      if (this.onclose) {
        this.onclose({
          code: res.code || 1005,
          reason: res.reason || '',
          wasClean: res.code !== undefined,
        });
      }
    });

    this._task.onMessage((res: any) => {
      if (this.onmessage) {
        this.onmessage({ data: res.data });
      }
    });

    this._task.onError((err: any) => {
      if (this.onerror) this.onerror(err);
    });
  }

  send(data: any): void {
    if (this._readyState !== OPEN) {
      console.warn('[MiniProgramWebSocket] send() called when not OPEN, state:', this._readyState);
      return;
    }
    // socket.io 可能发送 string 或 ArrayBuffer，Taro.send 需要 string | ArrayBuffer
    const sendData = typeof data === 'string' ? data : JSON.stringify(data);
    this._task.send({ data: sendData });
  }

  close(code?: number, reason?: string): void {
    if (this._readyState === CLOSED || this._readyState === CLOSING) return;
    this._readyState = CLOSING;
    if (this._task) {
      this._task.close({ code, reason });
    }
    this._readyState = CLOSED;
  }
}

export default MiniProgramWebSocket;
