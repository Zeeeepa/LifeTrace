/**
 * WebSocket 语音识别服务 - 使用后端 Faster-Whisper 进行实时识别
 * 支持麦克风和系统音频
 * 发送原始 PCM 数据（Int16），避免 WebM 解析问题
 */

export class WebSocketRecognitionService {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // 1 second

  private onResult?: (text: string, isFinal: boolean) => void;
  private onError?: (error: Error) => void;
  private onStatusChange?: (status: 'idle' | 'running' | 'error') => void;

  setCallbacks(callbacks: {
    onResult?: (text: string, isFinal: boolean) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: 'idle' | 'running' | 'error') => void;
  }) {
    this.onResult = callbacks.onResult;
    this.onError = callbacks.onError;
    this.onStatusChange = callbacks.onStatusChange;
  }

  /**
   * 开始识别
   */
  async start(stream: MediaStream): Promise<void> {
    if (this.isRunning) {
      console.warn('WebSocket recognition already running');
      return;
    }

    this.stream = stream;
    this.isRunning = true;
    this.reconnectAttempts = 0;

    await this.connect();
  }

  /**
   * 连接 WebSocket
   */
  private async connect(): Promise<void> {
    try {
      // 构建 WebSocket URL
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = process.env.NEXT_PUBLIC_WS_URL ||
                     (typeof window !== 'undefined'
                       ? `${wsProtocol}//${window.location.hostname}:8000`
                       : 'ws://localhost:8000');
      const wsUrl = `${wsHost}/api/voice/stream`;

      console.log('Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        if (this.onStatusChange) {
          this.onStatusChange('running');
        }
        this.startRecording();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            const error = new Error(data.error);
            console.error('WebSocket error:', error);
            if (this.onError) {
              this.onError(error);
            }
            return;
          }

          if (data.text && this.onResult) {
            this.onResult(data.text, data.isFinal || false);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.onError) {
          this.onError(new Error('WebSocket 连接错误'));
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);

        if (this.isRunning && this.reconnectAttempts < this.maxReconnectAttempts) {
          // 尝试重连
          this.reconnectAttempts++;
          console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => {
            if (this.isRunning) {
              this.connect();
            }
          }, this.reconnectDelay * this.reconnectAttempts);
        } else {
          this.isRunning = false;
          if (this.onStatusChange) {
            this.onStatusChange('idle');
          }
        }
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      const err = error instanceof Error ? error : new Error('无法连接 WebSocket');
      if (this.onError) {
        this.onError(err);
      }
      if (this.onStatusChange) {
        this.onStatusChange('error');
      }
      this.isRunning = false;
    }
  }

  /**
   * 开始录音并发送原始 PCM 数据到 WebSocket
   */
  private startRecording(): void {
    if (!this.stream || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // 创建 AudioContext，采样率设为 16kHz（与后端一致）
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({
        sampleRate: 16000, // 16kHz，与 Faster-Whisper 一致
      });

      // 创建音频源
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // 使用 ScriptProcessor 获取原始音频数据（兼容性更好）
      // bufferSize: 4096 samples = 256ms @ 16kHz
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }

        try {
          // 获取输入数据（Float32Array，范围 [-1, 1]）
          const inputData = e.inputBuffer.getChannelData(0);

          // 转换为 Int16（PCM 格式）
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // 限制范围到 [-1, 1]
            const sample = Math.max(-1, Math.min(1, inputData[i]));
            // 转换为 Int16：-1 -> -32768, 1 -> 32767
            int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          }

          // 发送原始 PCM 数据（Int16）
          if (int16.length > 0) {
            this.ws.send(int16.buffer);
          }
        } catch (e) {
          console.error('Failed to process audio data:', e);
        }
      };

      // 连接音频处理链
      this.source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      console.log('Audio processing started, sending PCM data to WebSocket');

    } catch (error) {
      console.error('Failed to start recording:', error);
      const err = error instanceof Error ? error : new Error('无法启动录音');
      if (this.onError) {
        this.onError(err);
      }
    }
  }

  /**
   * 停止识别
   */
  stop(): void {
    this.isRunning = false;

    // 断开音频处理链
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (e) {
        console.log('ScriptProcessor already disconnected');
      }
      this.scriptProcessor = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {
        console.log('Source already disconnected');
      }
      this.source = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.log('AudioContext already closed');
      }
      this.audioContext = null;
    }

    if (this.ws) {
      try {
        // 发送结束信号
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('EOS');
        }
        this.ws.close();
      } catch (e) {
        console.log('WebSocket already closed');
      }
      this.ws = null;
    }

    if (this.stream) {
      // 注意：不要停止 stream，因为 RecordingService 可能还在使用
      this.stream = null;
    }

    if (this.onStatusChange) {
      this.onStatusChange('idle');
    }

    console.log('WebSocket recognition stopped');
  }

  /**
   * 获取状态
   */
  getStatus(): 'idle' | 'running' | 'error' {
    if (!this.ws) return 'idle';
    if (this.isRunning && this.ws.readyState === WebSocket.OPEN) return 'running';
    return 'error';
  }
}
