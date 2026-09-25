const 敏感键词 = [
  'password',
  'passwd',
  'pwd',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  '密码',
  '密钥',
  '令牌',
  '凭据',
  '凭证',
];

const 追踪编号格式 = /^[A-Za-z0-9._:-]{1,64}$/;

function 是敏感键(键: string): boolean {
  const 规范键 = 键.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  return 敏感键词.some((词) => 规范键.includes(词));
}

function 脱敏字符串(值: string): string {
  let 结果 = 值;
  if (/^1[3-9]\d{9}$/.test(结果)) {
    结果 = `${结果.slice(0, 3)}****${结果.slice(7)}`;
  }
  结果 = 结果.replace(/([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+@/giu, '$1[已脱敏]@');
  结果 = 结果.replace(/\bauthorization\s*[:=]\s*(?:bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, '[已脱敏]');
  结果 = 结果.replace(/\b(?:password|passwd|pwd|token|secret|api[_ -]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, '[已脱敏]');
  结果 = 结果.replace(/\bcookie\s*[:=]\s*[^;\r\n]*/giu, '[已脱敏]');
  结果 = 结果.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[已脱敏]');
  return 结果;
}

function 脱敏日志值(值: unknown, 已见: WeakSet<object>): unknown {
  if (typeof 值 === 'string') {
    return 脱敏字符串(值);
  }
  if (typeof 值 === 'bigint') {
    return 值.toString();
  }
  if (typeof 值 === 'number' && !Number.isFinite(值)) {
    return String(值);
  }
  if (typeof 值 !== 'object' || 值 === null) {
    return 值;
  }
  if (已见.has(值)) {
    return '[已脱敏]';
  }
  已见.add(值);
  if (Array.isArray(值)) {
    return 值.map((项) => 脱敏日志值(项, 已见));
  }
  const 清洗: Record<string, unknown> = {};
  for (const [键, 项] of Object.entries(值 as Record<string, unknown>)) {
    if (!是敏感键(键)) {
      清洗[键] = 脱敏日志值(项, 已见);
    }
  }
  return 清洗;
}

export function 脱敏日志详情(详情: Record<string, unknown>): Record<string, unknown> {
  return 脱敏日志值(详情, new WeakSet<object>()) as Record<string, unknown>;
}

function 取请求编号(请求头: Record<string, unknown>): string {
  const 候选 = [请求头['x-request-id'], 请求头['x-trace-id'], 请求头['traceparent']];
  for (const 项 of 候选) {
    if (typeof 项 === 'string' && 追踪编号格式.test(项.trim())) {
      return 项.trim();
    }
    if (Array.isArray(项) && typeof 项[0] === 'string' && 追踪编号格式.test(项[0].trim())) {
      return 项[0].trim();
    }
  }
  return `nei-sheng-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

function 输出(级别: string, 模块: string, 消息: string, 详情?: Record<string, unknown>): void {
  const 清洗 = 详情 === undefined ? {} : 脱敏日志详情(详情);
  const 行 = JSON.stringify({
    时间: new Date().toISOString(),
    级别: 脱敏字符串(级别),
    模块: 脱敏字符串(模块),
    消息: 脱敏字符串(消息),
    详情: 清洗,
  });
  if (级别 === '错误') {
    console.error(行);
  } else {
    console.log(行);
  }
}

export const 日志 = {
  信息: (模块: string, 消息: string, 详情?: Record<string, unknown>): void => {
    输出('信息', 模块, 消息, 详情);
  },
  警告: (模块: string, 消息: string, 详情?: Record<string, unknown>): void => {
    输出('警告', 模块, 消息, 详情);
  },
  错误: (模块: string, 消息: string, 详情?: Record<string, unknown>): void => {
    输出('错误', 模块, 消息, 详情);
  },
};

export { 取请求编号 };
