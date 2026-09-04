# TTS Service（免费版 v2.0）

免费 Edge-TTS 语音合成微服务，为「和我恋爱吧」提供 AI 角色语音回复能力。零 Key 可启动，无计费。

## 架构

```
┌─────────────┐     HTTP/JSON      ┌─────────────┐
│  恋爱吧后端  │ ─────────────────► │  tts-service │
│  (Node.js)  │ ◄───────────────── │  (FastAPI)   │
└─────────────┘  音频hex + 元信息  └──────┬──────┘
                                          │ 免费、无Key
                                          ▼
                                   ┌─────────────┐
                                   │ Edge TTS    │
                                   │ + 离线兜底   │
                                   └─────────────┘
```

Provider 抽象（`app/provider.py`）+ 音色目录（`app/voices.py`）+ 有界 LRU 缓存与单飞去重（`app/cache.py`）。

- 主路：Edge-TTS（14 音色全覆盖男女声，语速/音调/音量/8 种风格预设矩阵）
- 兜底：离线正弦 WAV（断网仍可用，测试确定性离线通过）
- 兼容：旧 `voice_id` 别名（female-shaonv 等）自动映射到新音色，旧调用方零改动

## 快速开始

```bash
cp .env.example .env   # 无需填任何 Key
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Docker Compose（已在 `infra/docker-compose.yml` 内置为 `tts-service`）：

```bash
cd ../infra
docker compose up -d tts-service
```

## API 接口

### POST /api/tts/synthesize

```json
{
  "text": "你好呀，今天过得怎么样？",
  "voice": "zh-CN-XiaoxiaoNeural",
  "rate": 1.0,
  "pitch": 0.0,
  "volume": 1.0,
  "style": "gentle"
}
```

兼容旧字段：`voice_id`（旧别名自动映射）、`speed`（等价于 `rate`）。

响应：

```json
{
  "audio_hex": "fffb9064...",
  "duration_ms": 2500,
  "format": "mp3",
  "voice": "zh-CN-XiaoxiaoNeural",
  "cached": false,
  "provider": "edge-tts+offline-sine(auto)"
}
```

`format` 为 `mp3`（Edge 成功）或 `wav`（离线兜底）。

### GET /api/tts/voices

返回 14 音色目录（性别/人设/场景）与 8 种风格预设。

### GET /api/tts/health

健康检查，含提供者名与缓存命中统计。

## 配置说明（全部可选，零 Key 启动）

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| TTS_PROVIDER | auto | auto/edge/offline |
| EDGE_TTS_DEFAULT_VOICE | zh-CN-XiaoxiaoNeural | 默认音色 |
| EDGE_TTS_TIMEOUT | 15 | 单次合成超时（秒） |
| EDGE_TTS_MAX_RETRIES | 2 | 失败重试次数 |
| TTS_CACHE_SIZE | 200 | LRU 缓存上限 |
| TTS_MAX_CHARS | 5000 | 单次文本上限 |
| HOST | 0.0.0.0 | 监听地址 |
| PORT | 8000 | 监听端口 |
| LOG_LEVEL | info | 日志级别 |

## 支持的音色（14 个，免费）

女声：Xiaoxiao（少女甜美·主力）、Xiaoyi（萝莉活泼）、Xiaomeng（少女可爱）、Xiaochen（御姐成熟）、Xiaomo（御姐冷艳）、Xiaohan（温柔知性）、Xiaorui（活泼运动）、Xiaoshuang（爽朗）、Xiaoyan（知性）。
男声：Yunjian（少年阳光）、Yunxi（少年活泼）、Yunxia（青年磁性）、Yunyang（深情低沉）、Yunye（沉稳大叔）。
风格预设：normal/cheerful/gentle/sad/angry/whisper/excited/calm（映射为语速音调组合）。

## 错误码

| 状态 | 含义 | 处理 |
|---|---|---|
| 400 | 文本空或超长、参数越界 | 检查请求体 |
| 422 | 字段校验失败 | 检查 voice/rate/pitch/volume 范围 |
| 502 | Edge 不可用且兜底失败 | 稍后重试（指数退避已内置） |

## 性能

- SHA256 缓存键 + 有界 LRU（O(1) 命中）+ 同文本并发单飞去重
- 相同文本二次请求 < 5ms（内存命中）
- 缓存上限可配，内存有界不泄漏

## 测试

```bash
# 单元测试（离线可过，17 个用例）
python -m pytest tests/ -q

# 手动测试合成
curl -X POST http://localhost:8000/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界", "voice": "zh-CN-XiaoxiaoNeural", "style": "gentle"}'
```

## 故障排查

1. **合成返回 wav 而非 mp3**：Edge 网络不可达，已自动降级离线兜底，检查出口网络
2. **响应 502**：Edge 与兜底同时失败，看日志 `Edge TTS失败` 行
3. **旧调用方 voice_id 失效**：确认别名在 `app/voices.py` 旧别名映射中
