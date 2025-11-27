'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, Upload, Plus, Folder } from 'lucide-react';
import FileTree, { FileNode } from './FileTree';
import RichTextEditor from './RichTextEditor';
import WorkspaceChat from './WorkspaceChat';
import Button from '@/components/common/Button';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

interface WorkspacePageProps {
  // i18n labels
  fileTreeTitle: string;
  uploadLabel: string;
  newFileLabel: string;
  newFolderLabel: string;
  emptyFilesLabel: string;
  deleteConfirmLabel: string;
  saveLabel: string;
  editLabel: string;
  previewLabel: string;
  noFileLabel: string;
  selectFileHint: string;
  unsupportedFileLabel: string;
  supportedFormatsLabel: string;
  editorPlaceholder: string;
  chatTitle: string;
  chatInputPlaceholder: string;
  sendLabel: string;
  newChatLabel: string;
  welcomeLabel: string;
  thinkingLabel: string;
  sendFailedLabel: string;
  llmNotConfiguredLabel: string;
  llmConfigHintLabel: string;
  collapseSidebarLabel: string;
  expandSidebarLabel: string;
  collapseChatLabel: string;
  expandChatLabel: string;
  wordCountLabel: string;
  lastUpdatedLabel: string;
  quickActions: {
    summarize: string;
    summarizeDesc: string;
    improve: string;
    improveDesc: string;
    explain: string;
    explainDesc: string;
  };
  aiEditLabels?: {
    processing: string;
    confirm: string;
    cancel: string;
  };
  aiMenuLabels?: {
    beautify: string;
    expand: string;
    condense: string;
    correct: string;
    translate: string;
    chat: string;
    chatPlaceholder: string;
    send: string;
    back: string;
  };
}

export default function WorkspacePage({
  fileTreeTitle,
  uploadLabel,
  newFileLabel,
  newFolderLabel,
  emptyFilesLabel,
  deleteConfirmLabel,
  saveLabel,
  editLabel,
  previewLabel,
  noFileLabel,
  selectFileHint,
  unsupportedFileLabel,
  supportedFormatsLabel,
  editorPlaceholder,
  chatTitle,
  chatInputPlaceholder,
  sendLabel,
  newChatLabel,
  welcomeLabel,
  thinkingLabel,
  sendFailedLabel,
  llmNotConfiguredLabel,
  llmConfigHintLabel,
  collapseSidebarLabel,
  expandSidebarLabel,
  collapseChatLabel,
  expandChatLabel,
  wordCountLabel,
  lastUpdatedLabel,
  quickActions,
  aiEditLabels,
  aiMenuLabels,
}: WorkspacePageProps) {
  // 文件树状态
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date | null>(null);

  // 自动保存相关
  const lastSavedContentRef = useRef<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // 面板状态
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);

  // 新建文件编辑状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // 从后端加载文件列表
  useEffect(() => {
    // 图片文件扩展名
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff', '.tif'];

    // 判断是否为文本文件（非图片）
    const isTextFile = (fileName: string): boolean => {
      const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      return !imageExtensions.includes(ext);
    };

    // 递归查找第一个文本文件节点（跳过图片）
    const findFirstTextFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.type === 'file' && isTextFile(node.name)) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = findFirstTextFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const loadWorkspaceFiles = async () => {
      try {
        const response = await api.getWorkspaceFiles();
        if (response.data?.files) {
          // 后端文件节点类型
          interface BackendNode {
            id: string;
            name: string;
            type: 'file' | 'folder';
            content?: string;
            parent_id?: string;
            children?: BackendNode[];
          }
          // 转换后端返回的 parent_id 为前端的 parentId
          const convertNodes = (nodes: BackendNode[]): FileNode[] => {
            return nodes.map((node) => ({
              id: node.id,
              name: node.name,
              type: node.type,
              content: node.content,
              parentId: node.parent_id,
              children: node.children ? convertNodes(node.children) : undefined,
            }));
          };
          const convertedFiles = convertNodes(response.data.files);
          setFiles(convertedFiles);

          // 默认选中第一个文本文件（跳过图片）
          const firstFile = findFirstTextFile(convertedFiles);
          if (firstFile) {
            // 加载文件内容
            try {
              const fileResponse = await api.getWorkspaceFile(firstFile.id);
              if (fileResponse.data?.content) {
                setSelectedFile(firstFile);
                setFileContent(fileResponse.data.content);
                lastSavedContentRef.current = fileResponse.data.content;
              }
            } catch (error) {
              console.error('加载默认文件内容失败:', error);
            }
          }
        }
      } catch (error) {
        console.error('加载工作区文件失败:', error);
      }
    };

    loadWorkspaceFiles();
  }, []);

  // 保存面板状态到 localStorage
  useEffect(() => {
    localStorage.setItem('workspace_fileTreeCollapsed', String(isFileTreeCollapsed));
  }, [isFileTreeCollapsed]);

  useEffect(() => {
    localStorage.setItem('workspace_chatCollapsed', String(isChatCollapsed));
  }, [isChatCollapsed]);

  useEffect(() => {
    localStorage.setItem('workspace_chatWidth', String(chatWidth));
  }, [chatWidth]);

  // 处理文件/文件夹选择
  const handleSelectFile = async (node: FileNode) => {
    setSelectedFile(node);

    // 如果是文件夹，只选中不加载内容
    if (node.type === 'folder') {
      return;
    }

    // 如果是文件，加载内容
    if (!node.content) {
      try {
        const response = await api.getWorkspaceFile(node.id);
        if (response.data?.content) {
          setFileContent(response.data.content);
          lastSavedContentRef.current = response.data.content;
          // 更新文件树中的内容
          updateFileContent(node.id, response.data.content);
        }
      } catch (error) {
        console.error('加载文件内容失败:', error);
        setFileContent('');
        lastSavedContentRef.current = '';
      }
    } else {
      setFileContent(node.content);
      lastSavedContentRef.current = node.content;
    }
  };

  // 处理文件内容变化
  const handleContentChange = (content: string) => {
    setFileContent(content);
    // 不在这里更新 lastUpdatedTime，只在保存时更新
    if (selectedFile) {
      // 更新文件内容
      updateFileContent(selectedFile.id, content);
    }
  };

  // 更新文件内容（递归查找并更新）
  const updateFileContent = useCallback((fileId: string, content: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.id === fileId) {
          return { ...node, content };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    setFiles((prev) => updateNode(prev));
  }, []);

  // 处理文件上传点击
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      // 调用后端 API 上传文件
      const response = await api.uploadWorkspaceFile(file);

      if (response.data?.success) {
        const { file_id, file_name, content } = response.data;

        // 创建新的文件节点
        const newFile: FileNode = {
          id: file_id,
          name: file_name,
          type: 'file',
          content: content || '',
        };

        // 添加到文件树
        setFiles((prev) => [...prev, newFile]);

        // 自动选中新上传的文件
        setSelectedFile(newFile);
        setFileContent(content || '');
        lastSavedContentRef.current = content || '';

        toast.success(`文件上传成功: ${file_name}`);
      } else {
        toast.error(response.data?.error || '文件上传失败');
      }
    } catch (error) {
      console.error('上传文件失败:', error);
      toast.error('上传文件失败，请重试');
    }

    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 将新节点添加到文件树中（根据选中的文件夹位置）
  const addNodeToTree = useCallback((nodes: FileNode[], newNode: FileNode, targetFolderId?: string): FileNode[] => {
    if (!targetFolderId) {
      // 添加到根目录
      return [...nodes, newNode];
    }

    return nodes.map((node) => {
      if (node.id === targetFolderId && node.type === 'folder') {
        // 找到目标文件夹，添加到其 children 中
        return {
          ...node,
          children: [...(node.children || []), newNode],
        };
      }
      if (node.children) {
        return { ...node, children: addNodeToTree(node.children, newNode, targetFolderId) };
      }
      return node;
    });
  }, []);

  // 创建新文件
  const handleCreateFile = async () => {
    try {
      // 获取当前选中的文件夹路径
      const targetFolder = selectedFile?.type === 'folder' ? selectedFile.id : '';

      // 调用后端 API 创建文件
      const response = await api.createWorkspaceFile('untitled.md', targetFolder);

      if (response.data?.success) {
        const { file_id, file_name } = response.data;

        const newFile: FileNode = {
          id: file_id,
          name: file_name,
          type: 'file',
          content: '',
          parentId: targetFolder || undefined,
        };

        // 添加到文件树对应位置
        setFiles((prev) => addNodeToTree(prev, newFile, targetFolder || undefined));
        setSelectedFile(newFile);
        setFileContent('');
        lastSavedContentRef.current = '';
        // 设置为编辑状态
        setEditingNodeId(file_id);
      } else {
        toast.error(response.data?.error || '创建文件失败');
      }
    } catch (error) {
      console.error('创建文件失败:', error);
      toast.error('创建文件失败，请重试');
    }
  };

  // 编辑完成回调
  const handleEditingComplete = () => {
    setEditingNodeId(null);
  };

  // 创建新文件夹
  const handleCreateFolder = async () => {
    try {
      // 获取当前选中的文件夹路径
      const targetFolder = selectedFile?.type === 'folder' ? selectedFile.id : '';

      // 调用后端 API 创建文件夹
      const response = await api.createWorkspaceFolder('untitled', targetFolder);

      if (response.data?.success) {
        const { folder_id, folder_name } = response.data;

        const newFolder: FileNode = {
          id: folder_id,
          name: folder_name,
          type: 'folder',
          children: [],
          parentId: targetFolder || undefined,
        };

        // 添加到文件树对应位置
        setFiles((prev) => addNodeToTree(prev, newFolder, targetFolder || undefined));
        // 选中新创建的文件夹
        setSelectedFile(newFolder);
        // 设置为编辑状态
        setEditingNodeId(folder_id);
      } else {
        toast.error(response.data?.error || '创建文件夹失败');
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      toast.error('创建文件夹失败，请重试');
    }
  };

  // 删除节点
  const handleDeleteNode = async (nodeId: string) => {
    try {
      // 调用后端 API 删除文件/文件夹
      const response = await api.deleteWorkspaceFile(nodeId);

      if (response.data?.success) {
        // 从文件树中移除节点
        const deleteFromTree = (nodes: FileNode[]): FileNode[] => {
          return nodes.filter((node) => {
            if (node.id === nodeId) {
              return false;
            }
            if (node.children) {
              node.children = deleteFromTree(node.children);
            }
            return true;
          });
        };
        setFiles((prev) => deleteFromTree(prev));

        // 如果删除的是当前选中的文件，清空编辑器
        if (selectedFile?.id === nodeId) {
          setSelectedFile(null);
          setFileContent('');
          lastSavedContentRef.current = '';
        }

        toast.success('删除成功');
      } else {
        toast.error(response.data?.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败，请重试');
    }
  };

  // 重命名节点
  const handleRenameNode = async (nodeId: string, newName: string) => {
    try {
      // 调用后端 API 重命名文件
      const response = await api.renameWorkspaceFile(nodeId, newName);

      if (response.data?.success) {
        const newId = response.data.new_id;

        // 更新文件树
        const renameInTree = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === nodeId) {
              return { ...node, id: newId, name: newName };
            }
            if (node.children) {
              return { ...node, children: renameInTree(node.children) };
            }
            return node;
          });
        };
        setFiles((prev) => renameInTree(prev));

        // 如果重命名的是当前选中的文件，更新 selectedFile
        if (selectedFile?.id === nodeId) {
          setSelectedFile((prev) => prev ? { ...prev, id: newId, name: newName } : null);
        }
      } else {
        console.error('重命名失败:', response.data?.error);
        alert(response.data?.error || '重命名失败');
      }
    } catch (error) {
      console.error('重命名文件失败:', error);
      alert('重命名文件失败，请重试');
    }
  };

  // 保存文件
  const handleSaveFile = useCallback(async (showNotification = false) => {
    if (!selectedFile || isSaving) return;

    // 如果内容没有变化，不需要保存
    if (fileContent === lastSavedContentRef.current) {
      if (showNotification) {
        toast.success('文件已是最新');
      }
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.saveWorkspaceFile(selectedFile.id, fileContent);
      if (response.data?.success) {
        lastSavedContentRef.current = fileContent;
        setLastUpdatedTime(new Date());
        // 更新文件树中的内容
        updateFileContent(selectedFile.id, fileContent);
        if (showNotification) {
          toast.success('保存成功');
        }
      } else {
        if (showNotification) {
          toast.error('保存失败');
        }
      }
    } catch (error) {
      console.error('保存文件失败:', error);
      if (showNotification) {
        toast.error('保存失败');
      }
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, fileContent, isSaving, updateFileContent]);

  // 自动保存（每10秒检查一次）
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (selectedFile && fileContent !== lastSavedContentRef.current && !isSaving) {
        handleSaveFile();
      }
    }, 10000); // 10 秒

    return () => clearInterval(autoSaveInterval);
  }, [selectedFile, fileContent, isSaving, handleSaveFile]);

  // AI 编辑状态
  const [aiEditState, setAiEditState] = useState<{
    isProcessing: boolean;
    previewText: string;
    originalText: string;
    selectionStart: number;
    selectionEnd: number;
  } | undefined>(undefined);

  // 处理 AI 编辑操作
  const handleAIEdit = async (action: string, selectedText: string, customPrompt?: string) => {
    if (!selectedText || aiEditState?.isProcessing) return;

    // 映射操作名称
    const actionMap: Record<string, 'beautify' | 'expand' | 'condense' | 'correct' | 'translate' | 'custom'> = {
      beautify: 'beautify',
      expand: 'expand',
      condense: 'condense',
      correct: 'correct',
      translate: 'translate',
      custom: 'custom',
    };

    const apiAction = actionMap[action];
    if (!apiAction) {
      return;
    }

    // 找到选中文本的位置
    const startIndex = fileContent.indexOf(selectedText);
    if (startIndex === -1) return;

    // 设置处理中状态
    setAiEditState({
      isProcessing: true,
      previewText: '',
      originalText: selectedText,
      selectionStart: startIndex,
      selectionEnd: startIndex + selectedText.length,
    });

    try {
      let result = '';

      await api.processDocumentAIStream(
        {
          action: apiAction,
          document_content: selectedText,
          document_name: selectedFile?.name,
          custom_prompt: customPrompt,
        },
        (chunk: string) => {
          result += chunk;
          // 实时更新预览文本
          setAiEditState(prev => prev ? {
            ...prev,
            previewText: result,
          } : undefined);
        }
      );

      // 生成完成，等待用户确认
      setAiEditState(prev => prev ? {
        ...prev,
        isProcessing: false,
        previewText: result,
      } : undefined);

    } catch (error) {
      console.error('AI 编辑失败:', error);
      alert('AI 编辑失败，请重试');
      setAiEditState(undefined);
    }
  };

  // 确认 AI 编辑
  const handleAIEditConfirm = async () => {
    if (!aiEditState?.previewText || !selectedFile) return;

    const { originalText, previewText, selectionStart } = aiEditState;

    // 替换选中的文本
    const newContent =
      fileContent.substring(0, selectionStart) +
      previewText +
      fileContent.substring(selectionStart + originalText.length);

    setFileContent(newContent);

    // 更新文件树中的内容
    updateFileContent(selectedFile.id, newContent);

    // 清除状态
    setAiEditState(undefined);

    // 静默保存（不显示通知）
    try {
      const response = await api.saveWorkspaceFile(selectedFile.id, newContent);
      if (response.data?.success) {
        lastSavedContentRef.current = newContent;
        setLastUpdatedTime(new Date());
      }
    } catch (error) {
      console.error('AI 编辑后保存失败:', error);
    }
  };

  // 取消 AI 编辑
  const handleAIEditCancel = () => {
    setAiEditState(undefined);
  };

  // 处理拖动调整宽度
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = chatWidth;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = dragStartX.current - e.clientX;
      const newWidth = Math.min(Math.max(dragStartWidth.current + deltaX, 280), 600);
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="flex h-full overflow-hidden bg-background"
      style={{ cursor: isDragging ? 'col-resize' : 'default' }}
    >
      {/* 隐藏的文件上传 input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept=".txt,.md,.doc,.docx"
      />

      {/* 左侧：文件树 */}
      <div
        className={`flex-shrink-0 h-full border-r border-border bg-card transition-all duration-300 ${
          isFileTreeCollapsed ? 'w-0 border-r-0 overflow-hidden' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* 文件树标题栏 - 统一高度 h-12 */}
          <div className="flex items-center justify-between h-12 px-3 border-b border-border flex-shrink-0">
            {/* 左侧：标题 */}
            <h3 className="text-sm font-semibold text-foreground">{fileTreeTitle}</h3>
            {/* 右侧：功能按钮 */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUploadClick}
                className="h-7 w-7 p-0"
                title={uploadLabel}
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateFile}
                className="h-7 w-7 p-0"
                title={newFileLabel}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateFolder}
                className="h-7 w-7 p-0"
                title={newFolderLabel}
              >
                <Folder className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 文件树内容 */}
          <FileTree
            files={files}
            selectedFileId={selectedFile?.id || null}
            onSelectFile={handleSelectFile}
            onDeleteNode={handleDeleteNode}
            onRenameNode={handleRenameNode}
            emptyLabel={emptyFilesLabel}
            deleteConfirmLabel={deleteConfirmLabel}
            editingNodeId={editingNodeId}
            onEditingComplete={handleEditingComplete}
          />
        </div>
      </div>

      {/* 中间：富文本编辑器 */}
      <div className="flex-1 h-full overflow-hidden">
        <RichTextEditor
          content={fileContent}
          onChange={handleContentChange}
          onSave={() => handleSaveFile(true)}
          placeholder={editorPlaceholder}
          fileName={selectedFile?.type === 'file' ? (() => {
            // 检查是否是支持的文件类型
            const supportedExtensions = ['.txt', '.md', '.doc', '.docx'];
            const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
            return supportedExtensions.includes(ext) ? selectedFile.name : undefined;
          })() : undefined}
          unsupportedFileInfo={selectedFile?.type === 'file' ? (() => {
            const supportedExtensions = ['.txt', '.md', '.doc', '.docx'];
            const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
            if (!supportedExtensions.includes(ext)) {
              return {
                fileName: selectedFile.name,
                message: unsupportedFileLabel,
                supportedFormats: supportedFormatsLabel,
              };
            }
            return undefined;
          })() : undefined}
          saveLabel={saveLabel}
          editLabel={editLabel}
          previewLabel={previewLabel}
          noFileLabel={noFileLabel}
          selectFileHint={selectFileHint}
          isFileTreeCollapsed={isFileTreeCollapsed}
          onToggleFileTree={() => setIsFileTreeCollapsed(!isFileTreeCollapsed)}
          collapseSidebarLabel={collapseSidebarLabel}
          expandSidebarLabel={expandSidebarLabel}
          isChatCollapsed={isChatCollapsed}
          onToggleChat={() => setIsChatCollapsed(!isChatCollapsed)}
          collapseChatLabel={collapseChatLabel}
          expandChatLabel={expandChatLabel}
          wordCountLabel={wordCountLabel}
          lastUpdatedLabel={lastUpdatedLabel}
          lastUpdatedTime={lastUpdatedTime}
          onAIEdit={handleAIEdit}
          aiEditState={aiEditState}
          onAIEditConfirm={handleAIEditConfirm}
          onAIEditCancel={handleAIEditCancel}
          aiEditLabels={aiEditLabels}
          aiMenuLabels={aiMenuLabels}
        />
      </div>

      {/* 拖动条 - 当对话面板折叠时隐藏 */}
      {!isChatCollapsed && (
        <div
          className="flex-shrink-0 w-px bg-border cursor-col-resize transition-all flex items-center justify-center relative"
          onMouseDown={handleDragStart}
        >
          <GripVertical className="absolute h-4 w-4 text-muted-foreground/40 z-10" />
        </div>
      )}

      {/* 右侧：AI 对话 */}
      <div
        className={`flex-shrink-0 h-full overflow-hidden transition-all duration-300 ${
          isChatCollapsed ? 'w-0' : ''
        }`}
        style={{ width: isChatCollapsed ? 0 : `${chatWidth}px` }}
      >
        <WorkspaceChat
          documentContent={fileContent}
          documentName={selectedFile?.name}
          titleLabel={chatTitle}
          inputPlaceholder={chatInputPlaceholder}
          sendLabel={sendLabel}
          newChatLabel={newChatLabel}
          welcomeLabel={welcomeLabel}
          thinkingLabel={thinkingLabel}
          sendFailedLabel={sendFailedLabel}
          llmNotConfiguredLabel={llmNotConfiguredLabel}
          llmConfigHintLabel={llmConfigHintLabel}
          quickActions={quickActions}
        />
      </div>
    </div>
  );
}
