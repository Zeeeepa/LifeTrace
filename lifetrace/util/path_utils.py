"""
统一的路径工具模块
提供兼容开发环境和 PyInstaller 打包环境的路径获取函数
"""

from __future__ import annotations

import os
from pathlib import Path

from lifetrace.util.base_paths import (
    get_user_data_dir,
    get_user_logs_dir,
)
from lifetrace.util.settings import settings

# ============================================================
# 基于配置的路径计算函数
# ============================================================


def get_database_path() -> Path:
    """获取数据库路径（基于配置和数据目录）

    Returns:
        Path: 数据库文件的绝对路径
    """
    db_path = settings.database_path
    if not os.path.isabs(db_path):
        return get_user_data_dir() / db_path
    return Path(db_path)


def get_screenshots_dir() -> Path:
    """获取截图目录

    Returns:
        Path: 截图目录的绝对路径
    """
    screenshots_dir = settings.screenshots_dir
    if not os.path.isabs(screenshots_dir):
        return get_user_data_dir() / screenshots_dir
    return Path(screenshots_dir)


def get_scheduler_database_path() -> Path:
    """获取调度器数据库路径

    Returns:
        Path: 调度器数据库文件的绝对路径
    """
    db_path = settings.scheduler.database_path
    if not os.path.isabs(db_path):
        return get_user_data_dir() / db_path
    return Path(db_path)


def get_vector_db_dir() -> Path:
    """获取向量数据库目录

    Returns:
        Path: 向量数据库目录的绝对路径
    """
    persist_dir = settings.vector_db.persist_directory
    if not os.path.isabs(persist_dir):
        return get_user_data_dir() / persist_dir
    return Path(persist_dir)


def get_log_dir() -> Path:
    """获取日志目录（替代原有 log_path 属性）

    Returns:
        Path: 日志目录的绝对路径
    """
    return get_user_logs_dir()
