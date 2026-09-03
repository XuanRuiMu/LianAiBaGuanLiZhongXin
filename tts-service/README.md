# TTS Service

MiniMax TTS 语音合成微服务，为「和我恋爱吧」提供 AI 角色语音回复能力。

## 架构

```
┌─────────────┐     HTTP/JSON      ┌─────────────┐
│  恋爱吧后端  │ ─────────────────► │  tts-service │
│  (Node.js)  │ ◄───────────────── │  (FastAPI)   │
└─────────────┘   MP3 hex + meta   └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  MiniMax API │
                                    │ (speech-2.8-turbo)│
                                    └─────────────┘
```

## 快速开始

### 1. 环境配置

```bash
cp .env.example .env
# 编辑 .env 填入 MINIMAX_API_KEY
```

### 2. 本地开发

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Docker 部署

```bash
docker build -t tts-service .
docker run -d --name tts-service -p 8001:8000 --env-file .env tts-service
```

### 4. Docker Compose（推荐）

在 `恋爱吧数据中心/infra/docker-compose.yml` 中添加：

```yaml
services:
  tts-service:
    build: ../tts-service
    ports: ["8001:8000"]
    env_file: ../tts-service/.env
    restart: unless-stopped
    depends_on: []
```

## API 接口

### POST /api/tts/synthesize

语音合成

**请求体：**
```json
{
  "text": "你好呀，今天过得怎么样？",
  "voice_id": "female-shaonv",
  "speed": 1.0
}
```

**响应：**
```json
{
  "audio_hex": "fffb9064...",  // MP3 二进制的十六进制字符串
  "duration_ms": 2500,         // 预估时长（毫秒）
  "format": "mp3"
}
```

### GET /api/tts/health

健康检查

## 配置说明

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| MINIMAX_API_KEY | - | MiniMax API Key（必填） |
| MINIMAX_TTS_BASE_URL | https://api.minimaxi.com/v1/t2a_v2 | API 基础地址 |
| MINIMAX_TTS_MODEL | speech-2.8-turbo | 模型名称 |
| MINIMAX_TTS_DEFAULT_VOICE | female-shaonv | 默认音色 |
| MINIMAX_TTS_TIMEOUT | 30 | 请求超时（秒） |
| MINIMAX_TTS_MAX_RETRIES | 3 | 最大重试次数 |
| HOST | 0.0.0.0 | 监听地址 |
| PORT | 8000 | 监听端口 |
| LOG_LEVEL | info | 日志级别 |

## 支持的音色

访问 MiniMax 调试台选定音色后记下 `voice_id`：
https://platform.minimaxi.com/examination-center/voice-experience-center/t2a_v2

常用音色示例：
- `female-shaonv` - 少女音（甜美、细腻）
- `female-chengshu` - 御姐音（成熟、磁性）
- `female-loli` - 萝莉音（高音、可爱）
- `male-qn-qingse` - 少年音（阳光、清爽）
- `male-qn-chenqing` - 深情男声（低沉、深情）

## 错误码

| 码 | 含义 | 处理 |
|---|------|------|
| 1002 | 限流 | 重试（指数退避） |
| 1004 | 鉴权失败 | 检查 API Key |
| 1039 | 额度耗尽 | 降级为文字 |
| 429 | 请求过多 | 重试 |
| 500/502/503/504 | 服务端错误 | 重试 |

## 监控指标

- 合成成功率（目标 > 99%）
- 平均延迟（目标 P99 < 3s）
- 错误率分布（按错误码）
- 并发请求数

## 成本控制

- 单次合成约 50 字符
- 日活 1000，日均 20 轮，语音率 10% → 日合成 100 万字符
- 月成本约 ¥200-500（新用户有免费额度）

## 测试

```bash
# 单元测试
pytest tests/

# 手动测试合成
curl -X POST http://localhost:8000/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界", "voice_id": "female-shaonv"}'
```

## 故障排查

1. **连接超时**：检查网络、防火墙、MiniMax API 状态
2. **鉴权失败**：确认 `.env` 中 `MINIMAX_API_KEY` 正确
3. **音色不存在**：在调试台确认 `voice_id` 拼写
4. **返回 429**：触发限流，服务会自动指数退避重试