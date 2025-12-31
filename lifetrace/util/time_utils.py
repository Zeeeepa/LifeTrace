"""时间工具函数模块

提供 UTC 时间处理相关的工具函数，确保项目中所有时间都使用 UTC 存储和处理。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone


def get_utc_now() -> datetime:
    """获取当前 UTC 时间（timezone-aware）

    Returns:
        datetime: 当前 UTC 时间，带时区信息
    """
    return datetime.now(UTC)


def to_utc(dt: datetime) -> datetime:
    """将 datetime 转换为 UTC 时间

    Args:
        dt: 要转换的 datetime 对象（可以是 naive 或 timezone-aware）

    Returns:
        datetime: UTC 时间（timezone-aware）

    注意：
        - 如果 dt 是 naive datetime（无时区信息），假设为本地时间并转换为 UTC
        - 如果 dt 已经是 timezone-aware，则转换为 UTC
    """
    if dt.tzinfo is None:
        # naive datetime 假设为本地时间，转换为 UTC
        # 使用 local timezone 转换
        import time

        local_tz = timezone(
            timedelta(seconds=-time.timezone if time.daylight == 0 else -time.altzone)
        )
        dt_with_tz = dt.replace(tzinfo=local_tz)
        return dt_with_tz.astimezone(UTC)
    return dt.astimezone(UTC)


def ensure_utc(dt: datetime | None) -> datetime | None:
    """确保 datetime 是 UTC，如果是 None 则返回 None

    Args:
        dt: 要处理的 datetime 对象或 None

    Returns:
        datetime | None: UTC 时间（timezone-aware）或 None
    """
    return to_utc(dt) if dt is not None else None
