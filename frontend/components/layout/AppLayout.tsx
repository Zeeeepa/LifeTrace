'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, BarChart2, FileText } from 'lucide-react';
import { marked } from 'marked';
import { Send, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage, Conversation } from '@/lib/types';
import { api } from '@/lib/api';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Loading from '@/components/common/Loading';
import dynamic from 'next/dynamic';
import { SelectedEventsProvider, useSelectedEvents } from '@/lib/context/SelectedEventsContext';
import { X } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarNav } from '@/components/ui/sidebar-nav';
import type { SidebarNavItem } from '@/components/ui/sidebar-nav';

// 动态导入页面组件以避免 SSR 问题
const EventsPage = dynamic(() => import('@/app/events/page'), { ssr: false });
const AnalyticsPage = dynamic(() => import('@/app/analytics/page'), { ssr: false });
const PlanPage = dynamic(() => import('@/app/plan/page'), { ssr: false });

type MenuType = 'events' | 'analytics' | 'plan';

const menuItems: SidebarNavItem[] = [
  { id: 'events', label: '事件管理', icon: Calendar },
  { id: 'analytics', label: '行为分析', icon: BarChart2 },
  { id: 'plan', label: '工作计划', icon: FileText },
];

function AppLayoutInner() {
  const [activeMenu, setActiveMenu] = useState<MenuType>('events');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRAG, setUseRAG] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { selectedEventsData, setSelectedEvents, setSelectedEventsData, selectedEvents } = useSelectedEvents();

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

      if (response.data.conversation_id) {
        setCurrentConversationId(response.data.conversation_id);
      }

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

  // 渲染中间内容
  const renderContent = () => {
    switch (activeMenu) {
      case 'events':
        return <EventsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'plan':
        return <PlanPage />;
      default:
        return <EventsPage />;
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* 左侧菜单 - 使用 shadcn 风格组件 */}
      <Sidebar className="w-56 flex-shrink-0 h-full">
        <SidebarContent>
          <SidebarNav
            items={menuItems}
            activeItem={activeMenu}
            onItemClick={(id) => setActiveMenu(id as MenuType)}
          />
        </SidebarContent>
      </Sidebar>

      {/* 中间内容区 */}
      <div className="flex-1 overflow-y-auto h-full">
        {renderContent()}
      </div>

      {/* 右侧对话窗口 - 占1/3，固定高度，不随中间内容滚动 */}
      <div className="w-1/3 border-l bg-card flex flex-col flex-shrink-0 h-full overflow-hidden">
        <div className="flex flex-1 flex-col h-full overflow-hidden">
          {/* 顶部工具栏 - 无标题，简洁设计 */}
          {conversations.length > 0 && (
            <div className="flex items-center justify-end px-4 py-3 border-b border-border flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={createNewConversation}
                className="h-7 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                新建
              </Button>
            </div>
          )}

          {/* 会话列表（可选，可以折叠） */}
          {conversations.length > 0 && (
            <div className="px-4 py-2 border-b border-border max-h-28 overflow-y-auto flex-shrink-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <div className="space-y-1">
                {conversations.slice(0, 3).map((conv) => (
                  <div
                    key={conv.id}
                    className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 text-sm transition-colors"
                  >
                    <button
                      className="flex-1 truncate text-left text-xs font-medium text-foreground"
                      onClick={() => loadConversation(conv)}
                    >
                      {conv.title || '新会话'}
                    </button>
                    <button
                      className="opacity-0 transition-opacity group-hover:opacity-100 p-1 hover:bg-muted rounded"
                      onClick={() => deleteConversation(conv.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 消息列表 - 滚动条靠边 */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <div className="px-4 py-4 space-y-3 pr-2">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm font-semibold">欢迎使用助手</p>
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
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div
                          className="prose prose-sm max-w-none text-sm prose-p:my-1.5 prose-p:leading-relaxed prose-ul:my-1.5 prose-ol:my-1.5"
                          dangerouslySetInnerHTML={{
                            __html: marked(message.content),
                          }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      )}

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 border-t border-border/50 pt-2">
                          <p className="font-medium text-xs text-muted-foreground mb-1.5">相关截图:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {message.sources.slice(0, 2).map((source, i: number) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground border border-border/50"
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
          </div>

          {/* 选中的事件上下文 */}
          {selectedEventsData.length > 0 && (
            <div className="border-t border-border px-4 py-3 flex-shrink-0 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  已选择 {selectedEventsData.length} 个事件
                </span>
                <button
                  onClick={() => {
                    setSelectedEvents(new Set());
                    setSelectedEventsData([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  清除
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {selectedEventsData.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-md bg-background/50 px-2 py-1.5 text-xs border border-border/50"
                  >
                    <span className="truncate flex-1 text-foreground">
                      {event.window_title || '未知窗口'} - {event.app_name}
                    </span>
                    <button
                      onClick={() => {
                        const newSet = new Set(selectedEvents);
                        newSet.delete(event.id);
                        setSelectedEvents(newSet);
                        setSelectedEventsData(selectedEventsData.filter(e => e.id !== event.id));
                      }}
                      className="ml-2 text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              placeholder="输入消息..."
              className="flex-1"
              disabled={loading}
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !inputMessage.trim()}
              size="sm"
              className="h-9 px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  return (
    <SelectedEventsProvider>
      <AppLayoutInner />
    </SelectedEventsProvider>
  );
}
