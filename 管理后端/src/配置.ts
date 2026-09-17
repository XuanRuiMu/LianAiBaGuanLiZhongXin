import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

export interface 管理后端配置 {
  端口: number;
  数据库连接串: string;
  缓存连接串: string;
  令牌密钥: string;
  令牌有效期: string;
  刷新有效秒: number;
  管理员手机号: string[];
  允许来源: string[];
  每页上限: number;
  读限流次数: number;
  读限流窗口毫秒: number;
  写限流次数: number;
  写限流窗口毫秒: number;
  启动提权: boolean;
  运行环境: string;
  // YH-016 照抄主仓可信代理白名单：受信代理仅 loopback/指定CIDR，不再信任任意XFF
  受信代理: string;
  可信代理网段: string[];
  内网白名单: string[];
  强制安全传输: boolean;
  代理目标: string;
  备份保留天: number;
  恢复演练间隔天: number;
  恢复目标时长分: number;
  恢复目标丢失分: number;
}

function 取环境整数(键: string, 默认值: number): number {
  const 原始 = process.env[键];
  if (原始 === undefined || 原始.trim() === '') {
    return 默认值;
  }
  const 解析 = Number(原始);
  if (!Number.isInteger(解析) || 解析 <= 0) {
    return 默认值;
  }
  return 解析;
}

function 取环境列表(键: string): string[] {
  const 原始 = process.env[键] ?? '';
  return 原始
    .split(',')
    .map((项) => 项.trim())
    .filter((项) => 项.length > 0);
}

export function 当前配置(): 管理后端配置 {
  return {
    端口: 取环境整数('MANAGEMENT_BACKEND_PORT', 3100),
    数据库连接串: process.env.DATABASE_URL ?? '',
    缓存连接串: process.env.REDIS_URL ?? '',
    令牌密钥: process.env.JWT_SECRET ?? '',
    令牌有效期: process.env.JWT_EXPIRES_IN ?? '15m',
    刷新有效秒: 取环境整数('GUAN_LI_SHUA_XIN_YOU_XIAO_MIAO', 7 * 24 * 60 * 60),
    管理员手机号: 取环境列表('ADMIN_PHONES'),
    允许来源: 取环境列表('ALLOWED_ORIGINS'),
    每页上限: 取环境整数('FENYE_SHANG_XIAN', 100),
    读限流次数: 取环境整数('CHANG_GUI_XIAN_PIN_CI_SHU', 100),
    读限流窗口毫秒: 取环境整数('CHANG_GUI_XIAN_PIN_CHUANG_KOU_MIAO', 60000),
    写限流次数: 取环境整数('GUAN_LI_XIE_XIAN_PIN_CI_SHU', 10),
    写限流窗口毫秒: 取环境整数('GUAN_LI_XIE_XIAN_PIN_CHUANG_KOU_MIAO', 60000),
    启动提权: (process.env.BOOTSTRAP_ADMIN ?? '0') === '1',
    运行环境: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'dev',
    // YH-016 与主仓对齐：默认仅回环；生产经 KE_XIN_DAI_LI_WANG_DUAN 覆盖
    受信代理: (process.env.TRUST_PROXY ?? 'loopback').trim() || 'loopback',
    可信代理网段: 取环境列表('KE_XIN_DAI_LI_WANG_DUAN').length > 0 ? 取环境列表('KE_XIN_DAI_LI_WANG_DUAN') : ['127.0.0.1', '::1'],
    内网白名单: 取环境列表('NEI_WANG_BAI_MING_DAN'),
    强制安全传输: (process.env.FORCE_HTTPS ?? '0') === '1',
    代理目标: (process.env.VITE_API_PROXY_TARGET ?? process.env.DAI_LI_MU_BIAO ?? '').trim(),
    备份保留天: 取环境整数('BEI_FEN_BAO_LIU_TIAN', 30),
    恢复演练间隔天: 取环境整数('HUI_FU_YAN_LIAN_JIAN_GE_TIAN', 90),
    恢复目标时长分: 取环境整数('HUI_FU_MU_BIAO_SHI_CHANG_FEN', 60),
    恢复目标丢失分: 取环境整数('HUI_FU_MU_BIAO_DIU_SHI_FEN', 15),
  };
}

const 热重载键 = [
  'FENYE_SHANG_XIAN',
  'CHANG_GUI_XIAN_PIN_CI_SHU',
  'CHANG_GUI_XIAN_PIN_CHUANG_KOU_MIAO',
  'GUAN_LI_XIE_XIAN_PIN_CI_SHU',
  'GUAN_LI_XIE_XIAN_PIN_CHUANG_KOU_MIAO',
  'GUAN_LI_SHUA_XIN_YOU_XIAO_MIAO',
  'ALLOWED_ORIGINS',
  'NEI_WANG_BAI_MING_DAN',
];

export function 启动环境监听(工作目录: string = process.cwd()): () => void {
  const 文件 = path.join(工作目录, '.env');
  let 观察器: fs.FSWatcher | null = null;
  try {
    观察器 = fs.watch(文件, () => {
      let 解析: Record<string, string>;
      try {
        解析 = dotenv.parse(fs.readFileSync(文件, 'utf8'));
      } catch {
        return;
      }
      for (const 键 of 热重载键) {
        if (解析[键] !== undefined) {
          process.env[键] = 解析[键];
        }
      }
    });
  } catch {
    观察器 = null;
  }
  return () => {
    观察器?.close();
  };
}

const 主配置同源键 = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'GUAN_LI_SHUA_XIN_YOU_XIAO_MIAO', 'ADMIN_PHONES', 'ALLOWED_ORIGINS', 'NEI_WANG_BAI_MING_DAN', 'TRUST_PROXY', 'KE_XIN_DAI_LI_WANG_DUAN', 'FORCE_HTTPS', 'VITE_API_PROXY_TARGET', 'INTERNAL_TOKEN', 'TTS_SERVICE_URL'];

function 解析环境文件(文件: string): Record<string, string> {
  try {
    return dotenv.parse(fs.readFileSync(文件, 'utf8'));
  } catch {
    return {};
  }
}

export function 启动前补齐主配置(工作目录: string = process.cwd()): string[] {
  const 已补: string[] = [];
  if ((process.env.APP_ENV ?? process.env.NODE_ENV ?? 'dev') === 'prod') {
    return 已补;
  }
  const 候选主路径 = [
    path.join(工作目录, '..', '和我恋爱吧', '.env'),
    path.join(工作目录, '..', '..', '和我恋爱吧', '.env'),
  ];
  let 主表: Record<string, string> | null = null;
  const 取主表 = (): Record<string, string> => {
    if (主表) {
      return 主表;
    }
    主表 = {};
    for (const 主路径 of 候选主路径) {
      const 解析 = 解析环境文件(主路径);
      if (Object.keys(解析).length > 0) {
        主表 = 解析;
        break;
      }
    }
    return 主表;
  };
  for (const 键 of 主配置同源键) {
    const 现 = process.env[键];
    if (现 !== undefined && 现.trim() !== '') {
      continue;
    }
    const 主值 = 取主表()[键];
    if (主值 !== undefined && 主值.trim() !== '') {
      process.env[键] = 主值;
      已补.push(键);
      continue;
    }
    if (键 === 'DATABASE_URL' || 键 === 'REDIS_URL') {
      const 派生 = 派生连接串(键, 取主表());
      if (派生) {
        process.env[键] = 派生;
        已补.push(键);
      }
    }
  }
  return 已补;
}

function 派生连接串(键: string, 主表: Record<string, string>): string | null {
  const 取值 = (名: string): string => (process.env[名] ?? 主表[名] ?? '').trim();
  if (键 === 'DATABASE_URL') {
    const 用户 = 取值('POSTGRES_USER');
    const 密码 = 取值('POSTGRES_PASSWORD');
    const 库 = 取值('POSTGRES_DB');
    if (!用户 || !密码 || !库) {
      return null;
    }
    return `postgresql://${encodeURIComponent(用户)}:${encodeURIComponent(密码)}@localhost:5432/${encodeURIComponent(库)}`;
  }
  const 密码 = 取值('REDIS_PASSWORD');
  if (!密码) {
    return null;
  }
  return `redis://:${encodeURIComponent(密码)}@localhost:6379`;
}

export function 校验启动配置(配置: 管理后端配置): string[] {
  const 缺失: string[] = [];
  if (!配置.数据库连接串) {
    缺失.push('DATABASE_URL');
  }
  if (!配置.缓存连接串) {
    缺失.push('REDIS_URL');
  }
  if (!配置.令牌密钥) {
    缺失.push('JWT_SECRET');
  } else if (配置.令牌密钥.length < 32) {
    缺失.push('JWT_SECRET(长度不足32字节)');
  }
  // YH-031 管理端密码学收敛：令牌密钥熵检查由长度扩展为字符集熵，弱密钥拒绝启动
  if (配置.令牌密钥 && 配置.令牌密钥.length >= 32) {
    const 密钥 = 配置.令牌密钥;
    const 字符集 = new Set(密钥).size;
    if (字符集 < 16 || /^(.)\1+$/.test(密钥)) {
      缺失.push('JWT_SECRET(熵不足)');
    }
  }
  if (!配置.代理目标) {
    缺失.push('VITE_API_PROXY_TARGET(代理目标须显式配置)');
  }
  return 缺失;
}
