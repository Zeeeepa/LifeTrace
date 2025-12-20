"""
LifeTrace 配置管理模块 - Dynaconf 兼容层

保持与现有代码的 API 兼容性，同时使用 Dynaconf 提供热加载能力。
"""

import os
import re
import threading

import yaml

from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import get_settings, reload_settings

logger = get_logger()


def backend_to_frontend_key(backend_key: str) -> str:
    """将后端配置键转换为前端格式（驼峰命名）

    将点和下划线都视为分隔符，转换为驼峰命名。
    例如：
    - jobs.recorder.params.auto_exclude_self -> jobsRecorderParamsAutoExcludeSelf
    - llm.api_key -> llmApiKey
    - ui.theme -> uiTheme

    Args:
        backend_key: 后端配置键（如 jobs.recorder.params.auto_exclude_self）

    Returns:
        前端配置键（驼峰形式，如 jobsRecorderParamsAutoExcludeSelf）
    """
    # 将点和下划线都替换为空格，然后分割
    parts = re.split(r"[._]", backend_key)
    # 第一个部分保持小写，其余部分首字母大写
    if not parts:
        return backend_key
    return parts[0].lower() + "".join(word.capitalize() for word in parts[1:])


def _process_nested_path_parts(parts: list[str], i: int, result: list[str]) -> int:
    """处理嵌套的配置路径部分"""
    # 如果是 clean_data，特殊处理
    if i < len(parts) and i > 0 and parts[i - 1] == "clean" and parts[i] == "data":
        result[-1] = result[-1] + "_data"
        i += 1

    # 第三级路径（如 params）
    if i < len(parts) and parts[i] in ["params"]:
        result.append("." + parts[i])
        i += 1

        # 第四级路径（如 blacklist）
        if i < len(parts) and parts[i] in ["blacklist", "auto"]:
            result.append("." + parts[i])
            i += 1
            # 剩余部分用下划线连接
            if i < len(parts):
                result[-1] = result[-1] + "_" + "_".join(parts[i:])
        # 剩余部分用下划线连接
        elif i < len(parts):
            result.append("." + "_".join(parts[i:]))
    # 剩余部分用下划线连接
    elif i < len(parts):
        result.append("." + "_".join(parts[i:]))

    return i


def frontend_to_backend_key(frontend_key: str) -> str:
    """将前端配置键转换为后端格式（下划线命名）

    将驼峰命名转换回下划线命名，同时识别原本是点分隔的路径部分。
    例如：
    - jobsRecorderParamsAutoExcludeSelf -> jobs.recorder.params.auto_exclude_self
    - llmApiKey -> llm.api_key
    - uiTheme -> ui.theme
    """
    # 在大写字母前插入下划线，然后转小写
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", frontend_key)
    snake_case = re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()

    # 常见的顶级路径段
    path_segments = ["jobs", "llm", "ui", "server", "chat", "vector", "logging", "scheduler"]
    # 常见的二级路径
    second_level_segments = ["recorder", "clean", "ocr", "task"]

    for segment in path_segments:
        if not snake_case.startswith(segment + "_"):
            continue

        parts = snake_case.split("_")
        result = [parts[0]]  # 第一部分（如 jobs）

        i = 1
        if i >= len(parts):
            return "".join(result)

        # 特殊处理 auto_todo_detection（复合二级路径）
        if (
            i + 2 < len(parts)
            and parts[i] == "auto"
            and parts[i + 1] == "todo"
            and parts[i + 2] == "detection"
        ):
            result.append(".auto_todo_detection")
            i += 3
            # 剩余部分用下划线连接作为配置项
            if i < len(parts):
                result.append("." + "_".join(parts[i:]))
        # 第二级路径（如 recorder）
        elif parts[i] in second_level_segments:
            result.append("." + parts[i])
            i += 1
            i = _process_nested_path_parts(parts, i, result)
        else:
            # 第二级直接是配置项
            result.append("." + "_".join(parts[i:]))

        return "".join(result)

    return snake_case


def _resolve_model_price(
    model: str,
    price_config: dict,
    config_path: str,
    input_tokens: int | None = None,
) -> tuple[float, float]:
    """根据价格配置解析模型的单价（元/千token）

    支持分层定价（tiers）和旧版的 input_price/output_price 直配。
    """

    # 支持分层定价：tiers 为列表，按 max_input_tokens 升序匹配
    if "tiers" in price_config:
        tiers = price_config.get("tiers") or []
        if not isinstance(tiers, list) or not tiers:
            raise ValueError(f"模型 '{model}' 的 tiers 配置无效，请检查配置文件 {config_path}")

        sorted_tiers = sorted(
            tiers,
            key=lambda tier: tier.get("max_input_tokens", float("inf")),
        )
        tokens = input_tokens if input_tokens is not None else 0
        selected_tier = None
        for tier in sorted_tiers:
            max_tokens = tier.get("max_input_tokens")
            # 如果未设置上限或在上限内，则匹配到该档
            if max_tokens is None or tokens <= max_tokens:
                selected_tier = tier
                break
        if selected_tier is None:
            selected_tier = sorted_tiers[-1]

        if "input_price" not in selected_tier or "output_price" not in selected_tier:
            raise KeyError(f"模型 '{model}' 的 tiers 配置缺少 input_price 或 output_price。")
        return float(selected_tier["input_price"]), float(selected_tier["output_price"])

    # 兼容旧配置：直接使用 input_price/output_price
    if "input_price" not in price_config or "output_price" not in price_config:
        raise KeyError(
            f"模型 '{model}' 的价格配置不完整。请确保配置了 input_price 和 output_price。"
        )
    return float(price_config["input_price"]), float(price_config["output_price"])


class LifeTraceConfig:
    """LifeTrace 配置管理类 - Dynaconf 兼容层

    保持与现有代码的 API 兼容性，内部使用 Dynaconf 提供热加载能力。
    """

    def __init__(self, config_path: str | None = None):
        """初始化配置管理器

        Args:
            config_path: 配置文件路径（可选，主要用于兼容性）
        """
        self._settings = get_settings()
        self._config_lock = threading.RLock()

        # 配置文件路径（用于保存配置和兼容旧代码）
        if config_path:
            self._config_path = config_path
        else:
            self._config_path = self._get_default_config_path()

    def _get_application_path(self) -> str:
        """获取应用程序路径，兼容 PyInstaller 打包"""
        from lifetrace.util.path_utils import get_app_root

        return str(get_app_root())

    def _get_data_directory(self) -> str | None:
        """获取数据目录路径（从环境变量或命令行参数）"""
        # 优先使用环境变量
        data_dir = os.environ.get("LIFETRACE_DATA_DIR")
        if data_dir:
            return os.path.abspath(data_dir)
        return None

    def _get_default_config_path(self) -> str:
        """获取默认配置文件路径"""
        from lifetrace.util.path_utils import get_user_config_dir

        return str(get_user_config_dir() / "config.yaml")

    @property
    def config_path(self) -> str:
        """配置文件路径"""
        return self._config_path

    def get(self, key: str):
        """获取配置值

        Args:
            key: 配置键（支持点号分隔的嵌套键）

        Returns:
            配置值

        Raises:
            KeyError: 如果配置键不存在
        """
        try:
            # Dynaconf 使用点号访问嵌套值
            value = self._settings.get(key, default=None)
            if value is None:
                # 尝试使用属性访问方式
                parts = key.split(".")
                value = self._settings
                for part in parts:
                    if hasattr(value, part):
                        value = getattr(value, part)
                    elif isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        raise KeyError(f"配置键 '{key}' 不存在。请检查配置文件 {self._config_path}")
            return value
        except Exception as e:
            if isinstance(e, KeyError):
                raise
            raise KeyError(f"配置键 '{key}' 不存在: {e}") from e

    def set(self, key: str, value, persist: bool = True):
        """设置配置值

        Args:
            key: 配置键（支持点号分隔的嵌套键）
            value: 配置值
            persist: 是否持久化到配置文件，默认为 True
        """
        with self._config_lock:
            # 使用 Dynaconf 的 set 方法
            self._settings.set(key, value)

            # 如果需要持久化，保存到配置文件
            if persist:
                self._persist_to_file(key, value)

    def _persist_to_file(self, key: str, value):
        """持久化配置到文件"""
        try:
            # 读取当前配置文件
            with open(self._config_path, encoding="utf-8") as f:
                config_data = yaml.safe_load(f) or {}

            # 设置嵌套值
            keys = key.split(".")
            current = config_data
            for k in keys[:-1]:
                if k not in current:
                    current[k] = {}
                current = current[k]
            current[keys[-1]] = value

            # 写回配置文件
            with open(self._config_path, "w", encoding="utf-8") as f:
                yaml.dump(config_data, f, allow_unicode=True, sort_keys=False)

            logger.debug(f"配置已保存到文件: {key} = {value}")
        except Exception as e:
            logger.error(f"保存配置到文件失败: {e}")
            raise

    def reload(self) -> bool:
        """重新加载配置文件（热加载）

        Returns:
            bool: 是否成功重载
        """
        with self._config_lock:
            try:
                result = reload_settings()
                if result:
                    logger.info("配置文件已重新加载（热加载）")
                return result
            except Exception as e:
                logger.error(f"配置重载失败: {e}")
                return False

    @property
    def base_dir(self) -> str:
        """基础数据目录"""
        # 如果指定了数据目录，使用数据目录下的 data 子目录
        data_dir = self._get_data_directory()
        if data_dir:
            base_dir = os.path.join(data_dir, "data")
            os.makedirs(base_dir, exist_ok=True)
            return base_dir.rstrip(os.sep)

        # 否则使用配置中的 base_dir
        base_dir = self.get("base_dir")
        # 如果是相对路径，转换为绝对路径
        if not os.path.isabs(base_dir):
            base_dir = os.path.join(self._get_application_path(), base_dir)
        # 确保路径末尾没有多余的斜杠
        return base_dir.rstrip(os.sep)

    @property
    def database_path(self) -> str:
        """数据库路径"""
        db_path = self.get("database_path")
        # 如果是相对路径，基于 base_dir 拼接
        if not os.path.isabs(db_path):
            db_path = os.path.join(self.base_dir, db_path)
        return db_path

    @property
    def screenshots_dir(self) -> str:
        """截图目录路径"""
        screenshots_dir = self.get("screenshots_dir")
        if not os.path.isabs(screenshots_dir):
            screenshots_dir = os.path.join(self.base_dir, screenshots_dir)
        return screenshots_dir

    @property
    def log_path(self) -> str:
        """日志目录路径"""
        # 如果指定了数据目录，使用数据目录下的 logs 子目录
        data_dir = self._get_data_directory()
        if data_dir:
            log_path = os.path.join(data_dir, "logs")
            os.makedirs(log_path, exist_ok=True)
            return log_path + os.sep if not log_path.endswith(os.sep) else log_path

        # 否则使用配置中的 log_path
        log_path = self.get("logging.log_path")
        if not os.path.isabs(log_path):
            log_path = os.path.join(self.base_dir, log_path)
        return log_path + os.sep if not log_path.endswith(os.sep) else log_path

    @property
    def vector_db_persist_directory(self) -> str:
        """向量数据库持久化目录"""
        persist_dir = self.get("vector_db.persist_directory")
        if not os.path.isabs(persist_dir):
            return os.path.join(self.base_dir, persist_dir)
        return persist_dir

    @property
    def llm_input_token_price(self) -> float:
        """LLM 输入 token 价格（元/千 token）"""
        input_price, _ = self.get_model_price(self.get("llm.model"), input_tokens=0)
        return input_price

    @property
    def llm_output_token_price(self) -> float:
        """LLM 输出 token 价格（元/千 token）"""
        _, output_price = self.get_model_price(self.get("llm.model"), input_tokens=0)
        return output_price

    def get_model_price(self, model: str, input_tokens: int | None = None) -> tuple[float, float]:
        """获取指定模型的单价（元/千 token），支持按输入 token 区间分层计价"""
        model_prices = self.get("llm.model_prices")

        # 将 Dynaconf Box 对象转换为普通字典
        if hasattr(model_prices, "to_dict"):
            model_prices = model_prices.to_dict()

        # 先尝试获取指定模型的价格
        if model in model_prices:
            price_config = model_prices[model]
            if hasattr(price_config, "to_dict"):
                price_config = price_config.to_dict()
            return _resolve_model_price(
                model, price_config, self._config_path, input_tokens=input_tokens
            )

        # 如果没有找到，使用默认价格
        if "default" not in model_prices:
            raise KeyError(
                f"找不到模型 '{model}' 的价格配置，也没有配置默认价格。"
                f"请在配置文件中添加该模型的价格或配置 default 价格。"
            )

        default_config = model_prices["default"]
        if hasattr(default_config, "to_dict"):
            default_config = default_config.to_dict()
        return _resolve_model_price(
            model, default_config, self._config_path, input_tokens=input_tokens
        )

    @property
    def scheduler_database_path(self) -> str:
        """调度器数据库路径"""
        db_path = self.get("scheduler.database_path")
        if not os.path.isabs(db_path):
            db_path = os.path.join(self.base_dir, db_path)
        return db_path

    def is_configured(self) -> bool:
        """检查 LLM 配置是否已完成

        Returns:
            bool: 如果 llm_key 和 base_url 都已配置（不是占位符或空），返回 True
        """
        llm_key = self.get("llm.api_key")
        base_url = self.get("llm.base_url")
        # 检查是否为空或占位符
        invalid_values = [
            "",
            "xxx",
            "YOUR_API_KEY_HERE",
            "YOUR_BASE_URL_HERE",
            "YOUR_LLM_KEY_HERE",
        ]
        return llm_key not in invalid_values and base_url not in invalid_values

    def save_config(self):
        """保存配置文件（兼容方法）

        从 default_config.yaml 复制并初始化配置。
        """
        from lifetrace.util.path_utils import get_config_dir

        default_config_path = str(get_config_dir() / "default_config.yaml")

        if not os.path.exists(default_config_path):
            raise FileNotFoundError(
                f"默认配置文件不存在: {default_config_path}\n"
                "请确保 default_config.yaml 文件存在于 config 目录中"
            )

        os.makedirs(os.path.dirname(self._config_path), exist_ok=True)

        try:
            import shutil

            shutil.copy2(default_config_path, self._config_path)

            with open(self._config_path, encoding="utf-8") as f:
                config_data = yaml.safe_load(f)

            # 修改路径设置
            config_data["base_dir"] = "lifetrace/data"
            config_data["database_path"] = "lifetrace.db"
            config_data["screenshots_dir"] = "screenshots/"
            if "logging" not in config_data:
                config_data["logging"] = {}
            config_data["logging"]["log_path"] = "logs/"
            if "scheduler" in config_data:
                config_data["scheduler"]["database_path"] = "scheduler.db"

            with open(self._config_path, "w", encoding="utf-8") as f:
                yaml.dump(config_data, f, allow_unicode=True, sort_keys=False)

            # 重新加载配置
            self.reload()
        except Exception as e:
            raise RuntimeError(f"保存配置文件失败: {e}") from e


# 全局配置实例
config = LifeTraceConfig()
