import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest_asyncio
pytest_asyncio.fixture(scope="session")
def event_loop():
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()