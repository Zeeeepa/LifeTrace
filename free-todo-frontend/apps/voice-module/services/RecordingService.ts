/**
 * 录音服务 - 负责持续录音和音频分段
 */
export type AudioSource = 'microphone' | 'system';

export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private pendingRestart: boolean = false;
  
  /**
   * 获取当前音频流（用于 WebSocket 识别）
   */
  getStream(): MediaStream | null {
    return this.stream;
  }
  
  private segmentDuration = 10 * 60 * 1000; // 10分钟
  private currentSegmentStart: number = 0;
  private currentSegmentChunks: Blob[] = [];
  private segmentId: string | null = null;
  
  private isRecording: boolean = false;
  private recordingStartTime: Date | null = null;
  private audioSource: AudioSource = 'microphone'; // 默认麦克风
  
  // 回调函数
  private onSegmentReady?: (blob: Blob, startTime: Date, endTime: Date, segmentId: string, audioSource: AudioSource) => void;
  private onError?: (error: Error) => void;
  private onAudioData?: (analyser: AnalyserNode) => void;
  
  constructor(audioSource: AudioSource = 'microphone') {
    this.audioSource = audioSource;
  }
  
  /**
   * 设置音频源
   */
  setAudioSource(source: AudioSource): void {
    if (this.isRecording) {
      console.warn('Cannot change audio source while recording');
      return;
    }
    this.audioSource = source;
  }
  
  /**
   * 获取当前音频源
   */
  getAudioSource(): AudioSource {
    return this.audioSource;
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: {
    onSegmentReady?: (blob: Blob, startTime: Date, endTime: Date, segmentId: string, audioSource: AudioSource) => void;
    onError?: (error: Error) => void;
    onAudioData?: (analyser: AnalyserNode) => void;
  }) {
    this.onSegmentReady = callbacks.onSegmentReady;
    this.onError = callbacks.onError;
    this.onAudioData = callbacks.onAudioData;
  }

  /**
   * 开始录音
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.warn('Recording already started');
      return;
    }

    try {
      // 根据音频源选择不同的 API
      if (this.audioSource === 'system') {
        // 系统音频：使用 getDisplayMedia（需要用户选择屏幕/窗口）
        // 注意：大多数浏览器要求同时请求视频和音频，然后我们可以移除视频轨道
        try {
          this.stream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
              echoCancellation: false, // 系统音频不需要回声消除
              noiseSuppression: false,
              autoGainControl: false,
            } as MediaTrackConstraints,
            video: {
              // 请求视频（浏览器要求），但我们会立即停止它
              displaySurface: 'browser' as any, // 只捕获浏览器标签页
            },
          });
          
          // 检查是否有音频轨道
          if (this.stream.getAudioTracks().length === 0) {
            throw new Error('无法获取系统音频，请确保选择了包含音频的标签页');
          }
          
          // 移除视频轨道（我们只需要音频）
          this.stream.getVideoTracks().forEach(track => {
            track.stop(); // 停止视频轨道
            this.stream!.removeTrack(track); // 从流中移除
          });
          
          // 监听音频轨道结束事件（用户可能停止共享）
          this.stream.getAudioTracks().forEach(track => {
            track.onended = () => {
              console.log('音频轨道已结束（用户可能停止了共享）');
              if (this.isRecording) {
                this.stop();
              }
            };
          });
        } catch (error: any) {
          // 提供更友好的错误信息
          if (error.name === 'NotAllowedError') {
            throw new Error('系统音频权限被拒绝，请允许屏幕共享权限');
          } else if (error.name === 'NotSupportedError') {
            throw new Error('您的浏览器不支持系统音频捕获，请使用 Chrome 或 Edge 浏览器');
          } else if (error.name === 'NotFoundError') {
            throw new Error('未找到可用的音频源，请确保选择了包含音频的标签页');
          }
          throw error;
        }
      } else {
        // 麦克风：使用 getUserMedia
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
      }

      // 创建 AudioContext 用于波形分析
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      
      if (this.onAudioData) {
        this.onAudioData(this.analyser);
      }

      // 创建 MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: this.getSupportedMimeType(),
      };
      
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      // 设置事件监听
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.currentSegmentChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        const error = new Error('MediaRecorder error');
        console.error('MediaRecorder error:', event);
        if (this.onError) {
          this.onError(error);
        }
      };

      this.mediaRecorder.onstop = () => {
        // 先完成当前片段
        this.finalizeSegment();

        // 如需继续录音，启动新片段
        if (this.isRecording && this.pendingRestart) {
          this.pendingRestart = false;
          this.startNewSegment();
        }
      };

      // 开始录音
      this.recordingStartTime = new Date();
      this.currentSegmentStart = Date.now();
      this.segmentId = this.generateSegmentId();
      this.currentSegmentChunks = [];
      
      // 每1秒收集一次数据
      this.mediaRecorder.start(1000);
      this.isRecording = true;

      // 设置定时器，每10分钟自动分段
      this.scheduleNextSegment();

      console.log('Recording started at', this.recordingStartTime);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start recording');
      console.error('Failed to start recording:', err);
      if (this.onError) {
        this.onError(err);
      }
      throw err;
    }
  }

  /**
   * 停止录音
   */
  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;

    // 停止 MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // 停止音频流
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // 关闭 AudioContext
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }

    // 最终化当前片段
    this.finalizeSegment();

    console.log('Recording stopped');
  }

  /**
   * 获取录音状态
   */
  getStatus(): { isRecording: boolean; startTime: Date | null } {
    return {
      isRecording: this.isRecording,
      startTime: this.recordingStartTime,
    };
  }

  /**
   * 获取 AnalyserNode（用于波形显示）
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * 安排下一个分段
   */
  private scheduleNextSegment(): void {
    if (!this.isRecording) return;

    const remainingTime = this.segmentDuration - (Date.now() - this.currentSegmentStart);
    
    setTimeout(() => {
      if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        // 标记需要在 onstop 后重启新的片段
        this.pendingRestart = true;
        this.mediaRecorder.stop();
      }
    }, remainingTime);
  }

  /**
   * 启动一个新片段录音（在 onstop 之后调用）
   */
  private startNewSegment() {
    if (!this.mediaRecorder || !this.stream) return;

    this.currentSegmentStart = Date.now();
    this.segmentId = this.generateSegmentId();
    this.currentSegmentChunks = [];

    try {
      this.mediaRecorder.start(1000);
      // 继续安排下一次分段
      this.scheduleNextSegment();
    } catch (e) {
      console.error('Failed to start new segment:', e);
      if (this.onError) {
        const err = e instanceof Error ? e : new Error('Failed to start new segment');
        this.onError(err);
      }
    }
  }

  /**
   * 最终化当前片段
   */
  private finalizeSegment(): void {
    if (this.currentSegmentChunks.length === 0 || !this.segmentId || !this.recordingStartTime) {
      return;
    }

    const blob = new Blob(this.currentSegmentChunks, { type: this.getSupportedMimeType() || 'audio/webm' });
    const startTime = new Date(this.currentSegmentStart);
    const endTime = new Date();

    if (this.onSegmentReady) {
      this.onSegmentReady(blob, startTime, endTime, this.segmentId, this.audioSource);
    }

    // 重置
    this.currentSegmentChunks = [];
  }

  /**
   * 生成片段ID
   */
  private generateSegmentId(): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // 使用浏览器默认
  }
}

