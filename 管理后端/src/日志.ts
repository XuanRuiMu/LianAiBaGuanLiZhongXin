function 脱敏值(值: unknown): unknown {
  if (typeof 值 !== 'string') {
    return 值;
  }
  // YH-021 两仓统一手机号正则掩码
  if (/^1[3-9]\d{9}$/.test(值)) {
    return `${值.slice(0, 3)}****${值.slice(7)}`;
  }
  return 值;
}

const 敏感键 = ['令牌', '密码', '密钥', 'token', 'password', 'secret', 'authorization'];

function 取请求编号(请求头: Record<string, unknown>): string {
  const 候选 = [请求头['x-request-id'], 请求头['x-trace-id'], 请求头['traceparent']];
  for (const 项 of 候选) {
    if (typeof 项 === 'string' && 项.trim().length > 0) {
      return 项.trim().slice(0, 64);
    }
    if (Array.isArray(项) && typeof 项[0] === 'string' && 项[0].trim().length > 0) {
      return 项[0].trim().slice(0, 64);
    }
  }
  return `nei-sheng-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

function 输出(级别: string, 模块: string, 消息: string, 详情?: Record<string, unknown>): void {
  const 清洗: Record<string, unknown> = {};
  if (详情) {
    for (const [键, 值] of Object.entries(详情)) {
      if (敏感键.includes(键.toLowerCase())) {
        continue;
      }
      清洗[键] = 脱敏值(值);
    }
  }
  const 行 = JSON.stringify({ 时间: new Date().toISOString(), 级别, 模块, 消息, 详情: 清洗 });
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
