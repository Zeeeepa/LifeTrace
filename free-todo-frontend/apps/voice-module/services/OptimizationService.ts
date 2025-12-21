import OpenAI from 'openai';
import { TranscriptSegment } from '../types';

const SYSTEM_PROMPT_OPTIMIZER = `
你是一个实时语音转录优化助手。
任务：修正输入文本的语法和标点，使其更通顺。
重要原则：
1. 严禁删减内容！必须保留所有原始信息，仅进行润色。
2. 如果输入是不完整的句子，尝试补全标点，不要强行造句。
3. 【关键】主动服务：如果文本中包含任何【时间点、日程安排、会议、时间提醒】（例如"早上7点"、"7:40"、"11:30"、"明天下午三点开会"、"后天去上海"），请务必用 [SCHEDULE: 完整日程内容] 格式将该部分包裹起来。
4. 特别注意：
   - 任何包含时间信息（如"早上7点"、"7:40"、"11:30"、"8点至10"、"明天"、"后天"等）的文本，都应该被标记为日程
   - 即使时间信息不完整（如只有"7点"），只要后面有活动描述，也要标记
   - 标记时要包含完整的时间+活动描述，例如："[SCHEDULE: 早上7点准时起床]" 而不是只标记时间
示例输入1："早上7点准时起床,洗术完毕后"
示例输出1："[SCHEDULE: 早上7点准时起床],洗术完毕后"
示例输入2："充足能量 7.40分前往突出"
示例输出2："充足能量 [SCHEDULE: 7:40 前往突出]"
示例输入3："分前往图书馆自习区8点至10"
示例输出3："分前往图书馆自习区[SCHEDULE: 8点至10 前往图书馆自习区]"
示例输入4："我明天下午那个三点钟有个会"
示例输出4："我[SCHEDULE: 明天下午 3:00 有个会]。"
只输出优化后的文本，不要任何解释。必须严格遵循 [SCHEDULE: ...] 格式标记。
`;

/**
 * 文本优化服务 - 负责异步优化转录文本
 */
export class OptimizationService {
  private queue: TranscriptSegment[] = [];
  private isProcessing: boolean = false;
  private batchSize: number = 3; // 批量处理大小
  private processingDelay: number = 500; // 处理延迟（ms）
  private maxQueueSize: number = 100; // 最大队列长度

  private aiClient: OpenAI | null = null;
  
  // 回调函数
  private onOptimized?: (segmentId: string, optimizedText: string, containsSchedule: boolean) => void;
  private onError?: (segmentId: string, error: Error) => void;
  private onStatusChange?: (status: 'idle' | 'processing' | 'error') => void;

  constructor() {
    this.initializeAIClient();
  }

  /**
   * 初始化 AI 客户端
   */
  private initializeAIClient(): void {
    // 在 Next.js 环境中，使用 process.env 而不是 import.meta.env
    let apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    if (!apiKey || apiKey.includes('your_deepseek_api_key')) {
      apiKey = "sk-26d76c61cf2842fcb729e019d587a026";
    }

    if (apiKey) {
      // 使用 Next.js 代理路径（会自动代理到后端 localhost:8000）
      // API Key 由后端管理，前端不需要传递真实 Key
      // OpenAI SDK 需要完整的 URL，在浏览器环境中使用 window.location.origin
      let baseURL: string;
      if (typeof window !== 'undefined' && window.location) {
        // 浏览器环境：使用当前页面的 origin + 代理路径
        const origin = window.location.origin;
        if (!origin || origin === 'null' || origin === 'undefined') {
          // 如果 origin 无效，使用默认值
          baseURL = 'http://localhost:3000/api/deepseek';
        } else {
          baseURL = `${origin}/api/deepseek`;
        }
      } else {
        // 服务端环境：直接使用后端地址
        baseURL = 'http://localhost:8000/api/deepseek';
      }
      
      // 验证 baseURL 是否有效
      try {
        new URL(baseURL);
      } catch (urlError) {
        console.error('Invalid baseURL:', baseURL, urlError);
        baseURL = 'http://localhost:3000/api/deepseek'; // 使用默认值
      }
      
      this.aiClient = new OpenAI({
        baseURL: baseURL,
        apiKey: 'dummy-key', // 后端会使用配置的 API Key，这里只是占位符
        dangerouslyAllowBrowser: true,
      });
    } else {
      console.warn('Missing NEXT_PUBLIC_DEEPSEEK_API_KEY');
    }
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: {
    onOptimized?: (segmentId: string, optimizedText: string, containsSchedule: boolean) => void;
    onError?: (segmentId: string, error: Error) => void;
    onStatusChange?: (status: 'idle' | 'processing' | 'error') => void;
  }) {
    this.onOptimized = callbacks.onOptimized;
    this.onError = callbacks.onError;
    this.onStatusChange = callbacks.onStatusChange;
  }

  /**
   * 添加文本到优化队列
   */
  enqueue(segment: TranscriptSegment): void {
    // 检查队列大小
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Optimization queue is full, dropping oldest item');
      this.queue.shift();
    }

    // 避免重复添加
    const exists = this.queue.find(s => s.id === segment.id);
    if (exists) {
      // 更新现有项
      const index = this.queue.indexOf(exists);
      this.queue[index] = segment;
    } else {
      this.queue.push(segment);
    }

    // 触发处理
    this.processQueue();
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    if (this.onStatusChange) {
      this.onStatusChange('processing');
    }

    try {
      // 批量处理
      const batch = this.queue.splice(0, this.batchSize);
      
      // 并行处理批次
      const promises = batch.map(segment => this.optimizeSegment(segment));
      await Promise.allSettled(promises);

      // 延迟后继续处理
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));

      // 继续处理队列
      if (this.queue.length > 0) {
        this.processQueue();
      } else {
        this.isProcessing = false;
        if (this.onStatusChange) {
          this.onStatusChange('idle');
        }
      }
    } catch (error) {
      console.error('Error processing optimization queue:', error);
      this.isProcessing = false;
      if (this.onStatusChange) {
        this.onStatusChange('error');
      }
    }
  }

  /**
   * 优化单个片段
   */
  private async optimizeSegment(segment: TranscriptSegment): Promise<void> {
    if (!this.aiClient) {
      console.warn('AI client not initialized, skipping optimization');
      if (this.onOptimized) {
        this.onOptimized(segment.id, segment.rawText, false);
      }
      return;
    }

    try {
      // 添加超时保护
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API timeout')), 15000)
      );

      const apiPromise = this.aiClient.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_OPTIMIZER },
          { role: 'user', content: segment.rawText }
        ],
        temperature: 0.3,
      });

      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      const optimizedText = response.choices?.[0]?.message?.content || segment.rawText;
      const containsSchedule = optimizedText.includes('[SCHEDULE:');

      if (this.onOptimized) {
        this.onOptimized(segment.id, optimizedText, containsSchedule);
      }
    } catch (error) {
      console.error(`Optimization failed for segment ${segment.id}:`, error);
      
      // 即使失败也返回原始文本
      if (this.onOptimized) {
        this.onOptimized(segment.id, segment.rawText, false);
      }
      
      if (this.onError) {
        const err = error instanceof Error ? error : new Error('Optimization failed');
        this.onError(segment.id, err);
      }
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
    this.isProcessing = false;
    if (this.onStatusChange) {
      this.onStatusChange('idle');
    }
  }
}
