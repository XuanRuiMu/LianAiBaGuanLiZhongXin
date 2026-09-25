import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


def pytest_configure(config):
    if not config.pluginmanager.hasplugin("asyncio"):
        raise pytest.UsageError("pytest-asyncio 未加载")
    if config.getini("asyncio_mode") != "auto":
        raise pytest.UsageError("pytest-asyncio 必须使用 auto 模式")
