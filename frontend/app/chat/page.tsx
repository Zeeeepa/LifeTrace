'use client';

import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Send, Trash2, Plus } from 'lucide-react';
import { ChatMessage, Conversation } from '@/lib/types';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRAG, setUseRAG] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 加载会话列表
  const loadConversations = async () => {
    try {
      const response = await api.getConversations();
      setConversations(response.data);
    } catch (error) {
      console.error('加载会话列表失败:', error);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await api.sendChatMessage({
        message: inputMessage,
        conversation_id: currentConversationId || undefined,
        use_rag: useRAG,
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.response || response.data.message,
        timestamp: new Date().toISOString(),
        sources: response.data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 更新当前会话ID
      if (response.data.conversation_id) {
        setCurrentConversationId(response.data.conversation_id);
      }

      // 重新加载会话列表
      loadConversations();
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '抱歉，发送消息失败，请重试。',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // 新建会话
  const createNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  // 删除会话
  const deleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      if (currentConversationId === id) {
        createNewConversation();
      }
      loadConversations();
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  };

  // 加载会话消息
  const loadConversation = (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    setMessages(conversation.messages || []);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="container mx-auto h-[calc(100vh-4rem)] px-4 py-4">
      <div className="flex h-full gap-4">
        {/* 左侧区域 - 占2/3 */}
        <div className="flex w-2/3 gap-4">
          {/* 会话列表 */}
          <Card className="w-64 flex-shrink-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">会话历史</CardTitle>
                <Button variant="ghost" size="sm" onClick={createNewConversation}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between rounded-lg p-2 hover:bg-muted/50 ${
                      currentConversationId === conv.id ? 'bg-muted' : ''
                    }`}
                  >
                    <button
                      className="flex-1 truncate text-left text-sm font-medium text-foreground"
                      onClick={() => loadConversation(conv)}
                    >
                      {conv.title || '新会话'}
                    </button>
                    <button
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => deleteConversation(conv.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 中间内容区域 */}
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <CardTitle>内容展示区</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-semibold">截图和内容展示</p>
                  <p className="mt-2 text-sm font-medium">
                    这里可以显示相关的截图和内容
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧聊天区域 - 占1/3 */}
        <Card className="flex w-1/3 flex-col">
          <CardContent className="flex flex-1 flex-col pt-6">
            {/* 消息列表 */}
            <div className="flex-1 space-y-3 overflow-y-auto pb-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm font-semibold">欢迎使用助手</p>
                    <p className="mt-2 text-xs font-medium">
                      询问关于截图的问题
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div
                          className="prose prose-sm max-w-none text-xs"
                          dangerouslySetInnerHTML={{
                            __html: marked(message.content),
                          }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-xs">{message.content}</p>
                      )}

                      {/* 来源信息 */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 border-t border-border pt-2 text-xs">
                          <p className="font-medium text-xs">相关截图:</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {message.sources.slice(0, 2).map((source, i: number) => (
                              <span
                                key={i}
                                className="rounded bg-background px-1.5 py-0.5 text-[10px] text-foreground dark:bg-card"
                              >
                                {(source as { app_name?: string }).app_name || '未知应用'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loading && <Loading text="正在思考..." size="sm" />}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入框 */}
            <div className="flex gap-2 border-t border-border pt-4">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="输入消息..."
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                disabled={loading}
              />
              <Button onClick={sendMessage} disabled={loading || !inputMessage.trim()} size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
