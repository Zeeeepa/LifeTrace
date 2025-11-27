'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import MarkdownPreview from '@/components/common/MarkdownPreview';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Image,
  Eye,
  Edit3,
  Save,
  FileText,
  FileWarning,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Sparkles,
  Expand,
  Shrink,
  Check,
  MessageCircle,
  Languages,
  Send,
  Undo2,
  Loader2,
  X,
} from 'lucide-react';
import Button from '@/components/common/Button';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  fileName?: string;
  saveLabel: string;
  editLabel: string;
  previewLabel: string;
  noFileLabel: string;
  selectFileHint: string;
  // 不支持的文件类型信息
  unsupportedFileInfo?: {
    fileName: string;
    message: string;
    supportedFormats: string;
  };
  // 文件树折叠控制
  isFileTreeCollapsed?: boolean;
  onToggleFileTree?: () => void;
  collapseSidebarLabel?: string;
  expandSidebarLabel?: string;
  // 对话面板折叠控制
  isChatCollapsed?: boolean;
  onToggleChat?: () => void;
  collapseChatLabel?: string;
  expandChatLabel?: string;
  // 状态栏
  wordCountLabel?: string;
  lineCountLabel?: string;
  lastUpdatedLabel?: string;
  lastUpdatedTime?: Date | null;
  maxLines?: number;
  // AI 编辑菜单
  onAIEdit?: (action: string, selectedText: string, customPrompt?: string) => void;
  aiMenuLabels?: {
    beautify: string;
    expand: string;
    condense: string;
    translate: string;
    chat: string;
    chatPlaceholder: string;
    send: string;
    back: string;
  };
  // AI 编辑状态
  aiEditState?: {
    isProcessing: boolean;
    previewText: string;
    originalText: string;
    selectionStart: number;
    selectionEnd: number;
  };
  onAIEditConfirm?: () => void;
  onAIEditCancel?: () => void;
  aiEditLabels?: {
    processing: string;
    confirm: string;
    cancel: string;
  };
}

export default function RichTextEditor({
  content,
  onChange,
  onSave,
  placeholder = '',
  readOnly = false,
  fileName,
  saveLabel,
  editLabel,
  previewLabel,
  noFileLabel,
  selectFileHint,
  unsupportedFileInfo,
  isFileTreeCollapsed,
  onToggleFileTree,
  collapseSidebarLabel,
  expandSidebarLabel,
  isChatCollapsed,
  onToggleChat,
  collapseChatLabel,
  expandChatLabel,
  wordCountLabel,
  lineCountLabel = '{count}/{max} 行',
  lastUpdatedLabel,
  lastUpdatedTime,
  maxLines = 1000,
  onAIEdit,
  aiMenuLabels = {
    beautify: '美化',
    expand: '扩写',
    condense: '缩写',
    translate: '翻译',
    chat: '对话',
    chatPlaceholder: '输入指令...',
    send: '发送',
    back: '返回',
  },
  aiEditState,
  onAIEditConfirm,
  onAIEditCancel,
  aiEditLabels = {
    processing: 'AI 处理中...',
    confirm: '确认',
    cancel: '取消',
  },
}: RichTextEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // AI 编辑菜单状态
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [aiMenuPosition, setAIMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [scrollTop, setScrollTop] = useState(0);

  // 每行的实际高度（用于行号对齐）
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  // Chat 输入模式状态
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);

  // 计算字数和行数
  const wordCount = content ? content.length : 0;
  const lineCount = content ? content.split('\n').length : 1;

  // 计算每行的实际高度
  const calculateLineHeights = useCallback(() => {
    if (!measureRef.current || !textareaRef.current || isPreview || readOnly) return;

    const lines = (content || '').split('\n');
    const measureDiv = measureRef.current;
    const textarea = textareaRef.current;

    // 获取 textarea 的实际宽度（减去 padding）
    const computedStyle = window.getComputedStyle(textarea);
    const paddingLeft = parseFloat(computedStyle.paddingLeft);
    const paddingRight = parseFloat(computedStyle.paddingRight);
    const contentWidth = textarea.clientWidth - paddingLeft - paddingRight;

    // 设置测量 div 的宽度与 textarea 内容区域一致
    measureDiv.style.width = `${contentWidth}px`;

    // 测量每行的高度
    const heights: number[] = [];
    for (const line of lines) {
      // 空行也要有最小高度
      measureDiv.textContent = line || ' ';
      heights.push(measureDiv.offsetHeight);
    }

    setLineHeights(heights);
  }, [content, isPreview, readOnly]);

  // 内容变化时重新计算行高
  useEffect(() => {
    calculateLineHeights();
  }, [calculateLineHeights]);

  // 窗口大小变化时重新计算行高
  useEffect(() => {
    const handleResize = () => {
      calculateLineHeights();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateLineHeights]);

  // 处理内容变化（限制行数）
  const handleContentChange = useCallback((newContent: string) => {
    const lines = newContent.split('\n');
    if (lines.length > maxLines) {
      // 截断超出的行
      const truncatedContent = lines.slice(0, maxLines).join('\n');
      onChange(truncatedContent);
    } else {
      onChange(newContent);
    }
  }, [maxLines, onChange]);

  // 格式化时间
  const formatTime = (date: Date | null | undefined) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;

    return date.toLocaleString();
  };

  // 插入文本
  const insertText = useCallback(
    (before: string, after: string = '', placeholder: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end) || placeholder;
      const newText =
        content.substring(0, start) +
        before +
        selectedText +
        after +
        content.substring(end);

      onChange(newText);

      // 恢复光标位置
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + before.length + selectedText.length;
        textarea.setSelectionRange(
          start + before.length,
          newCursorPos
        );
      }, 0);
    },
    [content, onChange]
  );

  // 工具栏按钮配置
  const toolbarConfig = [
    { icon: Bold, before: '**', after: '**', placeholder: '粗体', title: 'Bold' },
    { icon: Italic, before: '*', after: '*', placeholder: '斜体', title: 'Italic' },
    { icon: Heading1, before: '# ', after: '', placeholder: '标题', title: 'Heading 1' },
    { icon: Heading2, before: '## ', after: '', placeholder: '标题', title: 'Heading 2' },
    { icon: Heading3, before: '### ', after: '', placeholder: '标题', title: 'Heading 3' },
    { icon: List, before: '- ', after: '', placeholder: '列表项', title: 'Bullet List' },
    { icon: ListOrdered, before: '1. ', after: '', placeholder: '列表项', title: 'Numbered List' },
    { icon: Quote, before: '> ', after: '', placeholder: '引用', title: 'Quote' },
    { icon: Code, before: '`', after: '`', placeholder: 'code', title: 'Code' },
    { icon: Link, before: '[', after: '](url)', placeholder: '链接文字', title: 'Link' },
    { icon: Image, before: '![', after: '](url)', placeholder: 'alt', title: 'Image' },
  ];

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave?.();
    }
    // ESC 关闭菜单
    if (e.key === 'Escape') {
      setShowAIMenu(false);
      setIsChatMode(false);
      setChatInput('');
    }
  };

  // 处理文本选择
  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current;
    const measureDiv = measureRef.current;
    if (!textarea || !measureDiv) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    if (selected.length > 0) {
      setSelectedText(selected);

      // 计算菜单位置
      const container = editorContainerRef.current;
      if (container) {
        const textareaRect = textarea.getBoundingClientRect();

        const paddingTop = 16; // p-4 = 1rem
        const menuHeight = 36; // 菜单高度
        const gap = 8; // 菜单与文本的间距

        // 获取 textarea 的实际内容宽度
        const computedStyle = window.getComputedStyle(textarea);
        const paddingLeft = parseFloat(computedStyle.paddingLeft);
        const paddingRight = parseFloat(computedStyle.paddingRight);
        const contentWidth = textarea.clientWidth - paddingLeft - paddingRight;
        measureDiv.style.width = `${contentWidth}px`;

        // 使用测量元素计算选中文本开始位置的实际高度
        // 需要测量从开始到选中起点之前的所有文本
        const textBeforeStart = content.substring(0, start);
        // 在最后添加一个字符以确保能测量到最后一行的高度
        measureDiv.textContent = textBeforeStart + '|';
        const textTop = paddingTop + measureDiv.offsetHeight - 26 - textarea.scrollTop; // 减去一行高度因为添加了 '|'

        // 测量选中文本结束位置的高度
        const textBeforeEnd = content.substring(0, end);
        measureDiv.textContent = textBeforeEnd + '|';
        const textBottom = paddingTop + measureDiv.offsetHeight - textarea.scrollTop;

        // 判断上方是否有足够空间，如果没有则放在下方
        let top: number;
        if (textTop - menuHeight - gap >= 0) {
          // 上方有空间，放在上方
          top = textTop - menuHeight - gap;
        } else {
          // 上方空间不足，放在下方
          top = textBottom + gap;
        }

        // 计算水平位置 - 基于选中起点在当前行内的位置
        const lastNewlineBeforeStart = textBeforeStart.lastIndexOf('\n');

        // 测量当前行开始到选中起点的宽度
        const lineStart = lastNewlineBeforeStart === -1 ? 0 : lastNewlineBeforeStart + 1;
        const lineTextBeforeSelection = content.substring(lineStart, start);
        const tempSpan = document.createElement('span');
        tempSpan.style.cssText = 'font-family: monospace; font-size: 0.875rem; visibility: hidden; position: absolute;';
        tempSpan.textContent = lineTextBeforeSelection;
        document.body.appendChild(tempSpan);
        const charWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);

        // 计算左侧位置：如果字符宽度超过容器宽度，取模得到换行后的位置
        const left = Math.min(
          Math.max((charWidth % contentWidth) + 16, 16),
          textareaRect.width - 380
        );

        setAIMenuPosition({ top, left });
        setShowAIMenu(true);
      }
    } else {
      setShowAIMenu(false);
      setSelectedText('');
    }
  }, [content]);

  // 处理 AI 编辑操作
  const handleAIAction = useCallback((action: string) => {
    if (action === 'chat') {
      // 切换到 chat 输入模式
      setIsChatMode(true);
      setChatInput('');
      // 聚焦输入框
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 0);
      return;
    }
    if (selectedText && onAIEdit) {
      onAIEdit(action, selectedText);
    }
    setShowAIMenu(false);
  }, [selectedText, onAIEdit]);

  // 处理 chat 发送
  const handleChatSend = useCallback(() => {
    if (chatInput.trim() && selectedText && onAIEdit) {
      onAIEdit('custom', selectedText, chatInput.trim());
      setShowAIMenu(false);
      setIsChatMode(false);
      setChatInput('');
    }
  }, [chatInput, selectedText, onAIEdit]);

  // 返回功能按钮界面
  const handleChatBack = useCallback(() => {
    setIsChatMode(false);
    setChatInput('');
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showAIMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest('.ai-edit-menu')) {
          setShowAIMenu(false);
          setIsChatMode(false);
          setChatInput('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAIMenu]);

  // AI 菜单选项
  const aiMenuItems = [
    { icon: Sparkles, action: 'beautify', label: aiMenuLabels.beautify },
    { icon: Expand, action: 'expand', label: aiMenuLabels.expand },
    { icon: Shrink, action: 'condense', label: aiMenuLabels.condense },
    { icon: Languages, action: 'translate', label: aiMenuLabels.translate },
    { icon: MessageCircle, action: 'chat', label: aiMenuLabels.chat },
  ];

  // 如果选中的是不支持的文件类型
  if (unsupportedFileInfo) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* 工具栏 - 保持高度一致 */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-muted/30 flex-shrink-0">
          {/* 左侧：折叠/展开按钮和文件名 */}
          <div className="flex items-center">
            {onToggleFileTree && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFileTree}
                className="h-7 w-7 p-0 mr-3"
                title={isFileTreeCollapsed ? expandSidebarLabel : collapseSidebarLabel}
              >
                {isFileTreeCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            )}
            <span className="text-sm text-muted-foreground">{unsupportedFileInfo.fileName}</span>
          </div>
          {/* 右侧：折叠/展开对话面板按钮 */}
          {onToggleChat && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleChat}
              className="h-7 w-7 p-0"
              title={isChatCollapsed ? expandChatLabel : collapseChatLabel}
            >
              {isChatCollapsed ? (
                <PanelRight className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {/* 不支持的文件类型提示 */}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <FileWarning className="h-16 w-16 mb-4 opacity-30 text-amber-500" />
          <h3 className="text-lg font-medium mb-2">{unsupportedFileInfo.message}</h3>
          <p className="text-sm">{unsupportedFileInfo.supportedFormats}</p>
        </div>
      </div>
    );
  }

  // 如果没有文件被选中
  if (!fileName) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* 空的工具栏 - 保持高度一致 */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-muted/30 flex-shrink-0">
          {/* 左侧：折叠/展开按钮 */}
          <div className="flex items-center">
            {onToggleFileTree && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFileTree}
                className="h-7 w-7 p-0 mr-3"
                title={isFileTreeCollapsed ? expandSidebarLabel : collapseSidebarLabel}
              >
                {isFileTreeCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            )}
            <span className="text-sm text-muted-foreground">{noFileLabel}</span>
          </div>
          {/* 右侧：折叠/展开对话面板按钮 */}
          {onToggleChat && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleChat}
              className="h-7 w-7 p-0"
              title={isChatCollapsed ? expandChatLabel : collapseChatLabel}
            >
              {isChatCollapsed ? (
                <PanelRight className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {/* 空状态提示 */}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">{noFileLabel}</h3>
          <p className="text-sm">{selectFileHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 工具栏 - 统一高度 h-12 */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* 左侧：折叠/展开按钮 */}
          {onToggleFileTree && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFileTree}
              className="h-7 w-7 p-0 mr-2"
              title={isFileTreeCollapsed ? expandSidebarLabel : collapseSidebarLabel}
            >
              {isFileTreeCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* 文件名 */}
          <span className="text-sm font-medium text-foreground mr-4 truncate max-w-[200px]">
            {fileName}
          </span>

          {/* 编辑工具 */}
          {!isPreview && !readOnly && (
            <div className="flex items-center gap-0.5 border-l border-border pl-3">
              {toolbarConfig.map((btn, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => insertText(btn.before, btn.after, btn.placeholder)}
                  className="h-8 w-8 p-0"
                  title={btn.title}
                >
                  <btn.icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 预览/编辑切换 */}
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
              className="h-8 gap-1.5"
            >
              {isPreview ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  <span>{editLabel}</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span>{previewLabel}</span>
                </>
              )}
            </Button>
          )}

          {/* 保存按钮 */}
          {onSave && !readOnly && (
            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              className="h-8 gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{saveLabel}</span>
            </Button>
          )}

          {/* 折叠/展开对话面板按钮 */}
          {onToggleChat && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleChat}
              className="h-7 w-7 p-0 ml-2"
              title={isChatCollapsed ? expandChatLabel : collapseChatLabel}
            >
              {isChatCollapsed ? (
                <PanelRight className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 编辑器/预览区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          {isPreview || readOnly ? (
            <div className="h-full overflow-y-auto p-6 max-w-none scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <MarkdownPreview content={content || ''} />
            </div>
          ) : (
            <div ref={editorContainerRef} className="relative flex h-full">
              {/* 行号区域 */}
              <div
                className="flex-shrink-0 select-none bg-muted/20 border-r border-border overflow-hidden"
                style={{ width: '2.5rem' }}
              >
                <div
                  className="pt-4 pr-2 text-right font-mono text-sm text-muted-foreground/60"
                  style={{
                    marginTop: -scrollTop,
                  }}
                >
                  {(content || '\n').split('\n').map((_, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-end"
                      style={{
                        height: lineHeights[index] || 26,
                        lineHeight: '1.625rem',
                      }}
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>
              </div>
              {/* 编辑区域 - 正常模式 */}
              {!aiEditState?.previewText && !aiEditState?.isProcessing && (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onSelect={handleSelect}
                  onScroll={(e) => {
                    // 更新滚动位置状态
                    setScrollTop(e.currentTarget.scrollTop);
                    // 滚动时隐藏菜单
                    setShowAIMenu(false);
                    setIsChatMode(false);
                    setChatInput('');
                  }}
                  placeholder={placeholder}
                  className="flex-1 h-full resize-none p-4 bg-transparent text-foreground font-mono text-sm focus:outline-none scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                  style={{ lineHeight: '1.625rem' }}
                  spellCheck={false}
                />
              )}

              {/* 隐藏的测量元素 - 用于计算每行实际高度 */}
              <div
                ref={measureRef}
                className="absolute invisible whitespace-pre-wrap break-words font-mono text-sm"
                style={{ lineHeight: '1.625rem', padding: 0 }}
                aria-hidden="true"
              />

              {/* AI 编辑预览模式 - 直接在原文中显示对比 */}
              {(aiEditState?.isProcessing || aiEditState?.previewText) && (
                <div className="flex-1 h-full flex flex-col overflow-hidden">
                  {/* 内容区域 - 内联对比显示 */}
                  <div
                    className="flex-1 overflow-y-auto p-4 font-mono text-sm text-foreground whitespace-pre-wrap"
                    style={{ lineHeight: '1.625rem' }}
                  >
                    {/* 选中位置之前的内容 */}
                    <span>{content.substring(0, aiEditState.selectionStart)}</span>

                    {/* 对比区域 */}
                    {aiEditState.isProcessing ? (
                      // 处理中：显示原文（红色删除线）+ 流式生成的内容（绿色）+ 加载提示
                      <>
                        <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 line-through px-0.5">
                          {aiEditState.originalText}
                        </span>
                        {aiEditState.previewText && (
                          <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-0.5">
                            {aiEditState.previewText}
                          </span>
                        )}
                        {aiEditState.previewText ? (
                          // 已有数据：只显示加载图标
                          <Loader2 className="inline-block h-3.5 w-3.5 animate-spin text-primary ml-1 align-middle" />
                        ) : (
                          // 未产生数据：显示完整提示
                          <span className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs align-middle">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{aiEditLabels.processing}</span>
                          </span>
                        )}
                      </>
                    ) : (
                      // 完成：显示删除的原文 + 新增的文本 + 悬浮确认按钮
                      <>
                        <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 line-through px-0.5">
                          {aiEditState.originalText}
                        </span>
                        <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-0.5">
                          {aiEditState.previewText}
                        </span>
                        {/* 悬浮确认弹框 - 浮在上层，与最后一行垂直居中 */}
                        <span className="relative inline-block w-0 h-0 align-baseline">
                          <span className="absolute left-2 top-1 flex items-center gap-1 z-50 whitespace-nowrap">
                            <button
                              onClick={onAIEditCancel}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 rounded shadow-md hover:shadow-lg transition-all"
                            >
                              <X className="h-3 w-3" />
                              <span>{aiEditLabels.cancel}</span>
                            </button>
                            <button
                              onClick={onAIEditConfirm}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 rounded shadow-md hover:shadow-lg transition-all"
                            >
                              <Check className="h-3 w-3" />
                              <span>{aiEditLabels.confirm}</span>
                            </button>
                          </span>
                        </span>
                      </>
                    )}

                    {/* 选中位置之后的内容 */}
                    <span>{content.substring(aiEditState.selectionEnd)}</span>
                  </div>
                </div>
              )}

              {/* AI 编辑浮动菜单 */}
              {showAIMenu && !aiEditState?.isProcessing && !aiEditState?.previewText && (
                <div
                  className="ai-edit-menu absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-1"
                  style={{
                    top: aiMenuPosition.top,
                    left: `calc(2.5rem + ${aiMenuPosition.left}px)`,
                  }}
                >
                  {isChatMode ? (
                    // Chat 输入模式
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleChatBack}
                        className="flex items-center justify-center p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        title={aiMenuLabels.back}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="relative flex items-center">
                        <input
                          ref={chatInputRef}
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleChatSend();
                            } else if (e.key === 'Escape') {
                              handleChatBack();
                            }
                          }}
                          placeholder={aiMenuLabels.chatPlaceholder}
                          className="w-48 pl-2.5 pr-8 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none"
                        />
                        <button
                          onClick={handleChatSend}
                          disabled={!chatInput.trim()}
                          className="absolute right-1 flex items-center justify-center p-1 text-xs text-primary hover:text-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={aiMenuLabels.send}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 功能按钮模式
                    <div className="flex gap-0.5">
                      {aiMenuItems.map((item) => (
                        <button
                          key={item.action}
                          onClick={() => handleAIAction(item.action)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground hover:bg-accent rounded-md transition-colors whitespace-nowrap"
                          title={item.label}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="flex items-center justify-between h-6 px-4 border-t border-border bg-muted/30 flex-shrink-0 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className={lineCount >= maxLines ? 'text-amber-500 font-medium' : ''}>
              {lineCountLabel.replace('{count}', String(lineCount)).replace('{max}', String(maxLines))}
            </span>
            <span>{wordCountLabel?.replace('{count}', String(wordCount))}</span>
          </div>
          <span>
            {lastUpdatedTime && lastUpdatedLabel?.replace('{time}', formatTime(lastUpdatedTime))}
          </span>
        </div>
      </div>
    </div>
  );
}
