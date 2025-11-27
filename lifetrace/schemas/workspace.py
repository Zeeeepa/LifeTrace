"""工作区相关的数据模型"""

from enum import Enum

from pydantic import BaseModel


class FileNode(BaseModel):
    """文件/文件夹节点"""

    id: str
    name: str
    type: str  # 'file' | 'folder'
    children: list["FileNode"] | None = None
    content: str | None = None
    parent_id: str | None = None


class WorkspaceFilesResponse(BaseModel):
    """工作区文件列表响应"""

    files: list[FileNode]
    total: int


class FileContentResponse(BaseModel):
    """文件内容响应"""

    id: str
    name: str
    content: str
    type: str


class DocumentAction(str, Enum):
    """文档 AI 操作类型"""

    SUMMARIZE = "summarize"
    IMPROVE = "improve"
    EXPLAIN = "explain"
    CUSTOM = "custom"
    # 文本编辑操作
    BEAUTIFY = "beautify"
    EXPAND = "expand"
    CONDENSE = "condense"
    CORRECT = "correct"
    TRANSLATE = "translate"


class DocumentAIRequest(BaseModel):
    """文档 AI 操作请求"""

    action: DocumentAction
    document_content: str
    document_name: str | None = None
    custom_prompt: str | None = None  # 自定义对话时使用
    conversation_id: str | None = None  # 会话 ID（用于多轮对话）


class DocumentAIResponse(BaseModel):
    """文档 AI 操作响应"""

    success: bool
    response: str
    action: str
    document_name: str | None = None
    error: str | None = None


class RenameFileRequest(BaseModel):
    """重命名文件请求"""

    file_id: str  # 文件 ID（相对路径）
    new_name: str  # 新文件名


class RenameFileResponse(BaseModel):
    """重命名文件响应"""

    success: bool
    old_id: str
    new_id: str
    new_name: str
    error: str | None = None


class SaveFileRequest(BaseModel):
    """保存文件请求"""

    file_id: str  # 文件 ID（相对路径）
    content: str  # 文件内容


class SaveFileResponse(BaseModel):
    """保存文件响应"""

    success: bool
    file_id: str
    updated_at: str | None = None
    error: str | None = None


class UploadFileResponse(BaseModel):
    """上传文件响应"""

    success: bool
    file_id: str | None = None
    file_name: str | None = None
    content: str | None = None
    error: str | None = None


class CreateFileRequest(BaseModel):
    """创建文件请求"""

    file_name: str  # 文件名
    folder: str = ""  # 目标文件夹路径（相对于 workspace）
    content: str = ""  # 初始内容


class CreateFileResponse(BaseModel):
    """创建文件响应"""

    success: bool
    file_id: str | None = None
    file_name: str | None = None
    error: str | None = None


class CreateFolderRequest(BaseModel):
    """创建文件夹请求"""

    folder_name: str  # 文件夹名
    parent_folder: str = ""  # 父文件夹路径（相对于 workspace）


class CreateFolderResponse(BaseModel):
    """创建文件夹响应"""

    success: bool
    folder_id: str | None = None
    folder_name: str | None = None
    error: str | None = None


class DeleteFileRequest(BaseModel):
    """删除文件/文件夹请求"""

    file_id: str  # 文件/文件夹 ID（相对路径）


class DeleteFileResponse(BaseModel):
    """删除文件/文件夹响应"""

    success: bool
    file_id: str
    error: str | None = None
