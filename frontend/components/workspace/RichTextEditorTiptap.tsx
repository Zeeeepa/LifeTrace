'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorContent, EditorContext, useEditor } from '@tiptap/react';
import {
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Save,
  Eye,
  Edit3,
  FileText,
  FileWarning,
  Sparkles,
} from 'lucide-react';
import TurndownService from 'turndown';
import Button from '@/components/common/Button';
import MarkdownPreview from '@/components/common/MarkdownPreview';

// --- Tiptap Core Extensions ---
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { Typography } from '@tiptap/extension-typography';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Selection } from '@tiptap/extensions';

// --- Tiptap UI Primitives ---
import { Spacer } from '@/components/workspace/tiptap/tiptap-ui-primitive/spacer';
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from '@/components/workspace/tiptap/tiptap-ui-primitive/toolbar';

// --- Tiptap Node ---
import { ImageUploadNode } from '@/components/workspace/tiptap/tiptap-node/image-upload-node/image-upload-node-extension';
import { HorizontalRule } from '@/components/workspace/tiptap/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';

// --- Tiptap Node Styles ---
import '@/components/workspace/tiptap/tiptap-scss/blockquote-node.scss';
import '@/components/workspace/tiptap/tiptap-scss/code-block-node.scss';
import '@/components/workspace/tiptap/tiptap-scss/horizontal-rule-node.scss';
import '@/components/workspace/tiptap/tiptap-scss/list-node.scss';
import '@/components/workspace/tiptap/tiptap-scss/image-node.scss';
import '@/components/workspace/tiptap/tiptap-scss/heading-node.scss';
import '@/components/workspace/tiptap/tiptap-scss/paragraph-node.scss';
import '@/components/workspace/tiptap/tiptap-scss/simple-editor.scss';

// --- Tiptap UI ---
import { HeadingDropdownMenu } from '@/components/workspace/tiptap/tiptap-ui/heading-dropdown-menu';
import { ImageUploadButton } from '@/components/workspace/tiptap/tiptap-ui/image-upload-button';
import { ListDropdownMenu } from '@/components/workspace/tiptap/tiptap-ui/list-dropdown-menu';
import { BlockquoteButton } from '@/components/workspace/tiptap/tiptap-ui/blockquote-button';
import { CodeBlockButton } from '@/components/workspace/tiptap/tiptap-ui/code-block-button';
import { ColorHighlightPopover } from '@/components/workspace/tiptap/tiptap-ui/color-highlight-popover';
import { LinkPopover } from '@/components/workspace/tiptap/tiptap-ui/link-popover';
import { MarkButton } from '@/components/workspace/tiptap/tiptap-ui/mark-button';
import { TextAlignButton } from '@/components/workspace/tiptap/tiptap-ui/text-align-button';
import { UndoRedoButton } from '@/components/workspace/tiptap/tiptap-ui/undo-redo-button';

// --- Components ---

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils';
import { marked } from 'marked';

// --- Markdown Converter (Turndown) ---
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// 保持行内代码与块代码的简单处理
turndownService.addRule('inlineCode', {
  filter: 'code',
  replacement: (content) => '`' + content + '`',
});

// --- Tiptap Toolbar Content ---
const MainToolbarContent = () => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} />
        <ListDropdownMenu types={['bulletList', 'orderedList', 'taskList']} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        <ColorHighlightPopover />
        <LinkPopover />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <Spacer />
    </>
  );
};

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

export default function RichTextEditorTiptap({
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
  const contentRef = useRef<string>(content);

  // 将 markdown 转换为 HTML（用于 Tiptap）
  const markdownToHtml = useCallback((md: string): string => {
    if (!md) return '';
    try {
      return marked.parse(md) as string;
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      return md;
    }
  }, []);

  // 将 HTML 转换为 markdown：使用 Turndown 提升兼容性
  const htmlToMarkdown = useCallback((html: string): string => {
    if (!html || html === '<p></p>') return '';

    try {
      const markdown = turndownService.turndown(html);
      return markdown;
    } catch (error) {
      console.error('Error converting HTML to Markdown:', error);
      return contentRef.current || '';
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        'aria-label': 'Main content area, start typing to enter text.',
        class: 'simple-editor',
        placeholder: placeholder || '开始输入...',
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: 'image/*',
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error('Upload failed:', error),
      }),
    ],
    content: markdownToHtml(content),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // 将 HTML 转换回 markdown
      const markdown = htmlToMarkdown(html);
      contentRef.current = markdown;
      onChange(markdown);
    },
  });

  // 同步外部 content 变化到编辑器
  useEffect(() => {
    if (editor && content !== contentRef.current) {
      const html = markdownToHtml(content);
      editor.commands.setContent(html);
      contentRef.current = content;
    }
  }, [content, editor, markdownToHtml]);

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave?.();
    }
  };

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

  // 计算字数和行数
  const wordCount = content ? content.length : 0;
  const lineCount = content ? content.split('\n').length : 1;

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

          {/* AI 编辑入口（预留） */}
          {onAIEdit && !readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // TODO: 实现 AI 编辑功能
                console.log('AI Edit clicked - feature to be implemented');
              }}
              className="h-8 w-8 p-0"
              title="AI 编辑"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
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
            <div className="h-full" onKeyDown={handleKeyDown}>
              {editor && (
                <EditorContext.Provider value={{ editor }}>
                  <div className="simple-editor-wrapper">
                    <Toolbar>
                      <MainToolbarContent />
                    </Toolbar>
                    <EditorContent
                      editor={editor}
                      role="presentation"
                      className="simple-editor-content w-full h-full"
                    />
                  </div>
                </EditorContext.Provider>
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