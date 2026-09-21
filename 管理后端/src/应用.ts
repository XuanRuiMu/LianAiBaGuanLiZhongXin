import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { 当前配置 } from './配置';
import { 取文案 } from './文案';
import { 成功响应, 失败响应 } from './响应';
import { 错误码 } from './错误码';
import { 日志, 取请求编号 } from './日志';
import { 归一化错误中间件 } from './错误归一化';
import type { 查询池 } from './数据库';
import type { 缓存客户端 } from './缓存';
import { 认证中间件 } from './中间件/认证';
import { 管理员门禁 } from './中间件/管理员';
import { 创建读限流, 创建写限流, type 限流选项 } from './中间件/限流';
import { 取真实IP } from './真实IP';
import { 创建账号路由 } from './路由/账号';
import { 创建聊天路由 } from './路由/聊天';
import { 创建思考路由 } from './路由/思考';
import { 创建封禁路由 } from './路由/封禁';
import { 创建审计路由 } from './路由/审计';
import { 创建统计路由 } from './路由/统计';
import { 创建审核路由 } from './路由/审核';
import { 创建登录路由, 创建身份路由 } from './路由/登录';
import { 创建管理写路由 } from './路由/管理写';

export interface 应用选项 {
  池?: 查询池;
  缓存?: 缓存客户端;
  读限流?: 限流选项;
  写限流?: 限流选项;
}

export function 是否允许来源(来源: string): boolean {
  const 允许来源 = 当前配置().允许来源;
  if (允许来源.includes(来源)) {
    return true;
  }
  try {
    const 解析 = new URL(来源);
    if (解析.protocol !== 'http:' && 解析.protocol !== 'https:') {
      return false;
    }
    const 主机 = 解析.hostname;
    if (主机 !== 'localhost' && 主机 !== '127.0.0.1') {
      return false;
    }
    const 端口 = 解析.port === '' ? (解析.protocol === 'http:' ? '80' : '443') : 解析.port;
    return 端口 === '5175';
  } catch {
    return false;
  }
}

function 是否内网地址(地址: string): boolean {
  const 清理 = 地址.trim();
  if (/^127\./.test(清理) || 清理 === '::1' || 清理 === '::ffff:127.0.0.1') {
    return true;
  }
  if (/^10\./.test(清理) || /^192\.168\./.test(清理)) {
    return true;
  }
  const 私有段 = /^172\.(1[6-9]|2\d|3[01])\./.exec(清理);
  if (私有段) {
    return true;
  }
  return false;
}

export function 是否允许源地址(地址: string | undefined): boolean {
  const 白名单 = 当前配置().内网白名单;
  if (白名单.length > 0) {
    return typeof 地址 === 'string' && 白名单.includes(地址);
  }
  return typeof 地址 === 'string' && 是否内网地址(地址);
}

export function 创建应用(选项: 应用选项 = {}) {
  const 应用 = express();
  // YH-016 照抄主仓：Express层不信代理头，真实IP由可信链路X-Real-IP推导
  应用.set('trust proxy', false);
  应用.use(helmet({ hsts: 当前配置().强制安全传输 ? { maxAge: 31536000, includeSubDomains: true } : false }));
  应用.use((请求: Request, 响应: Response, 下一步: NextFunction): void => {
    const 请求编号 = 取请求编号(请求.headers as Record<string, unknown>);
    (请求 as Request & { 请求编号?: string }).请求编号 = 请求编号;
    响应.setHeader('X-Request-Id', 请求编号);
    响应.setHeader('X-Trace-Id', 请求编号);
    下一步();
  });
  应用.use((请求: Request, 响应: Response, 下一步: NextFunction): void => {
    if (当前配置().强制安全传输 && 请求.secure !== true && 请求.headers['x-forwarded-proto'] !== 'https') {
      失败响应(响应, 426, 取文案('通用', '需经加密通道访问'), 错误码.需加密访问);
      return;
    }
    下一步();
  });
  应用.use((请求: Request, 响应: Response, 下一步: NextFunction): void => {
    if (请求.path === '/api/jian-kang' || 请求.path === '/api/ready' || 请求.path === '/api/zhi-biao') {
      下一步();
      return;
    }
    // YH-016 真实IP推导：不再信任客户端可控XFF派生的req.ip
    if (!是否允许源地址(取真实IP(请求))) {
      失败响应(响应, 403, 取文案('通用', '源地址不在白名单'), 错误码.源地址被拒);
      return;
    }
    下一步();
  });
  应用.use(
    cors({
      credentials: true,
      origin: (来源: string | undefined, 回调: (错误: Error | null, 允许?: boolean) => void) => {
        if (来源 === undefined) {
          回调(null, false);
          return;
        }
        if (是否允许来源(来源)) {
          回调(null, true);
          return;
        }
        回调(null, false);
      },
    }),
  );
  应用.use(express.json({ limit: '100kb' }));
  应用.use(cookieParser());
  if (选项.池) {
    应用.locals.池 = 选项.池;
  }
  if (选项.缓存) {
    应用.locals.缓存 = 选项.缓存;
  }

  应用.get('/api/jian-kang', (_请求: Request, 响应: Response): void => {
    成功响应(响应, { zhuang_tai: '正常', shi_jian: new Date().toISOString() });
  });

  应用.get('/api/ready', async (_请求: Request, 响应: Response): Promise<void> => {
    const 池 = (_请求.app.locals as { 池?: 查询池 }).池;
    const 缓存 = (_请求.app.locals as { 缓存?: 缓存客户端 }).缓存;
    if (!池) {
      成功响应(响应, { zhuang_tai: 'bu_ke_yong', jiu_xu: false, kui: ['shu_ju_ku_wei_zhu_ru'] });
      return;
    }
    const 故障: string[] = [];
    try {
      await 池.query('SELECT 1', []);
    } catch {
      故障.push('shu_ju_ku_bu_ke_da');
    }
    if (缓存) {
      try {
        await 缓存.set('jian_kang_tan_zhen', '1', 10);
      } catch {
        故障.push('huan_cun_bu_ke_da');
      }
    }
    if (故障.length === 0) {
      成功响应(响应, { zhuang_tai: 'jiu_xu', jiu_xu: true, kui: [] });
      return;
    }
    成功响应(响应, { zhuang_tai: 'jiang_ji', jiu_xu: false, kui: 故障 });
  });

  应用.get('/api/zhi-biao', async (_请求: Request, 响应: Response): Promise<void> => {
    const 池 = (_请求.app.locals as { 池?: 查询池 }).池;
    const 指标: Record<string, unknown> = {
      shi_jian: new Date().toISOString(),
      lu_you_shu: 9,
    };
    if (池) {
      try {
        const 审计数 = await 池.query('SELECT COUNT(*) AS "总数" FROM "审计日志"', []);
        指标['shen_ji_zong_shu'] = Number(审计数.rows[0]?.['总数'] ?? 0);
      } catch {
        指标['shen_ji_zong_shu'] = 'bu_ke_yong';
      }
    }
    成功响应(响应, 指标);
  });

  const 写限流器 = 创建写限流(选项.写限流 ?? {}, undefined);
  应用.use('/api/guan-li', 创建登录路由(写限流器));

  const 管理路由 = express.Router();
  管理路由.use(认证中间件);
  管理路由.use(创建读限流(选项.读限流 ?? {}, undefined));
  管理路由.use(管理员门禁);
  // YH-108 身份回传走认证+门禁之后，角色与能力一律服务端查库结果，不接受客户端申报
  管理路由.use(创建身份路由());
  管理路由.use(创建账号路由());
  管理路由.use(创建聊天路由());
  管理路由.use(创建思考路由());
  // FP-17 封禁写挂 feng_jin、申诉审核挂 feng_jin_shen_he、统计族挂 tong_ji_xie（矩阵内角色按位可达），授回收/夺舍/审核发布仍 gao_we
  管理路由.use(创建封禁路由(创建写限流(选项.写限流 ?? {}, 选项.缓存)));
  管理路由.use(创建审计路由());
  管理路由.use(创建统计路由());
  管理路由.use(创建审核路由(创建写限流(选项.写限流 ?? {}, 选项.缓存)));
  管理路由.use(创建管理写路由(创建写限流(选项.写限流 ?? {}, 选项.缓存)));
  应用.use('/api/guan-li', 管理路由);

  应用.use((请求: Request, 响应: Response): void => {
    日志.信息('路由', '未知路径', { 路径: 请求.path });
    失败响应(响应, 404, 取文案('通用', '未找到'), 错误码.记录未找到);
  });

  应用.use(归一化错误中间件());

  return 应用;
}
