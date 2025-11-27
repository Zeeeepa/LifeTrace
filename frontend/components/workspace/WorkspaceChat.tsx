'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Plus } from 'lucide-react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import MessageContent from '@/components/common/MessageContent';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface WorkspaceChatProps {
  documentContent?: string;
  documentName?: string;
  // i18n labels
  titleLabel: string;
  inputPlaceholder: string;
  sendLabel: string;
  newChatLabel: string;
  welcomeLabel: string;
  thinkingLabel: string;
  sendFailedLabel: string;
  llmNotConfiguredLabel: string;
  llmConfigHintLabel: string;
  quickActions: {
    summarize: string;
    summarizeDesc: string;
    improve: string;
    improveDesc: string;
    explain: string;
    explainDesc: string;
  };
}

export default function WorkspaceChat({
  documentContent,
  documentName,
  titleLabel,
  inputPlaceholder,
  sendLabel,
  newChatLabel,
  welcomeLabel,
  thinkingLabel,
  sendFailedLabel,
  llmNotConfiguredLabel,
  llmConfigHintLabel,
  quickActions,
}: WorkspaceChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [llmHealthy, setLlmHealthy] = useState(true);
  const [llmHealthChecked, setLlmHealthChecked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 检查 LLM 健康状态
  const checkLlmHealth = async () => {
    try {
      const response = await api.llmHealthCheck();
      const status = response.data.status;
      setLlmHealthy(status === 'healthy');
      setLlmHealthChecked(true);
      return status === 'healthy';
    } catch (error) {
      console.error('LLM健康检查失败:', error);
      setLlmHealthy(false);
      setLlmHealthChecked(true);
      return false;
    }
  };

  useEffect(() => {
    checkLlmHealth();
  }, []);

  // 快捷操作 - 直接调用后端 AI API
  const handleQuickAction = async (action: 'summarize' | 'improve' | 'explain') => {
    if (!documentContent) return;

    if (!llmHealthChecked) {
      await checkLlmHealth();
    }

    if (!llmHealthy) {
      toast.error(llmConfigHintLabel);
      return;
    }

    // 创建用户消息
    const actionLabels: Record<string, string> = {
      summarize: quickActions.summarize,
      improve: quickActions.improve,
      explain: quickActions.explain,
    };

    const userMessage: ChatMessage = {
      role: 'user',
      content: actionLabels[action],
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setChatLoading(true);
    setIsStreaming(true);

    // 创建助手消息占位
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: thinkingLabel,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      let assistantContent = '';
      let isFirstChunk = true;

      await api.processDocumentAIStream(
        {
          action: action,
          document_content: documentContent,
          document_name: documentName,
        },
        (chunk: string) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: assistantContent,
            };
            return newMessages;
          });

          if (isFirstChunk) {
            setChatLoading(false);
            isFirstChunk = false;
          }
        }
      );
    } catch (error) {
      console.error('快捷操作失败:', error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          content: sendFailedLabel,
        };
        return newMessages;
      });
    } finally {
      setChatLoading(false);
      setIsStreaming(false);
    }
  };

  // 发送消息 - 使用后端 AI API 的 custom 模式
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!llmHealthChecked) {
      await checkLlmHealth();
    }

    if (!llmHealthy) {
      toast.error(llmConfigHintLabel);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setChatLoading(true);
    setIsStreaming(true);

    // 创建助手消息占位
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: thinkingLabel,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      let assistantContent = '';
      let isFirstChunk = true;

      // 如果有文档内容，使用工作区 AI API；否则使用通用聊天 API
      if (documentContent) {
        await api.processDocumentAIStream(
          {
            action: 'custom',
            document_content: documentContent,
            document_name: documentName,
            custom_prompt: currentInput,
            conversation_id: currentConversationId || undefined,
          },
          (chunk: string) => {
            assistantContent += chunk;
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content: assistantContent,
              };
              return newMessages;
            });

            if (isFirstChunk) {
              setChatLoading(false);
              isFirstChunk = false;
            }
          }
        );
      } else {
        await api.sendChatMessageStream(
          {
            message: currentInput,
            conversation_id: currentConversationId || undefined,
            use_rag: false,
          },
          (chunk: string) => {
            assistantContent += chunk;
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content: assistantContent,
              };
              return newMessages;
            });

            if (isFirstChunk) {
              setChatLoading(false);
              isFirstChunk = false;
            }
          },
          (sessionId: string) => {
            if (!currentConversationId) {
              setCurrentConversationId(sessionId);
            }
          }
        );
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          content: sendFailedLabel,
        };
        return newMessages;
      });
    } finally {
      setChatLoading(false);
      setIsStreaming(false);
    }
  };

  // 新建会话
  const createNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full bg-card border-border">
      {/* 顶部工具栏 - 统一高度 h-12 */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">{titleLabel}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewConversation}
            className="h-8 w-8 p-0"
            title={newChatLabel}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center px-4">
            <div className="text-center space-y-6 max-w-md w-full">
              {/* LLM 健康状态提醒 */}
              {llmHealthChecked && !llmHealthy && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">
                        {llmNotConfiguredLabel}
                      </h3>
                      <p className="text-xs text-orange-700 dark:text-orange-400">
                        {llmConfigHintLabel}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 欢迎标题 */}
              <h1 className="text-xl font-bold text-foreground my-6">
                {welcomeLabel}
              </h1>

              {/* 快捷选项 */}
              {documentContent && (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleQuickAction('summarize')}
                    disabled={chatLoading}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-sm font-medium text-foreground">{quickActions.summarize}</div>
                  </button>
                  <button
                    onClick={() => handleQuickAction('improve')}
                    disabled={chatLoading}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-sm font-medium text-foreground">{quickActions.improve}</div>
                  </button>
                  <button
                    onClick={() => handleQuickAction('explain')}
                    disabled={chatLoading}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-sm font-medium text-foreground">{quickActions.explain}</div>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    message.content === thinkingLabel ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="animate-pulse">{thinkingLabel}</span>
                      </span>
                    ) : (
                      <MessageContent
                        content={message.content}
                        isMarkdown={true}
                        isStreaming={index === messages.length - 1 && isStreaming}
                      />
                    )
                  ) : (
                    <MessageContent content={message.content} isMarkdown={false} />
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="flex gap-2 border-t border-border px-4 py-3 flex-shrink-0 bg-background">
        <Input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={inputPlaceholder}
          className="flex-1"
          disabled={chatLoading}
        />
        <Button
          onClick={sendMessage}
          disabled={chatLoading || !inputMessage.trim()}
          size="sm"
          className="h-9 px-3"
          aria-label={sendLabel}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
