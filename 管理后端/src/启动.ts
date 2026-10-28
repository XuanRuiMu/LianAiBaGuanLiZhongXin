import { 当前配置, 校验启动配置, 启动前补齐主配置 } from './配置';
import { 创建池, type 查询池 } from './数据库';
import { 创建缓存 } from './缓存';
import { 创建应用 } from './应用';
import { 订阅失效广播 } from './中间件/管理员';
import { 日志 } from './日志';

/**
 * 启动提权（BOOTSTRAP_ADMIN=1 时把 ADMIN_PHONES 里的号码置为超管）。
 *
 * 安全边界（三条，缺一不可）：
 *  1. 环境闸门：仅非生产环境允许执行。生产环境即使误带 BOOTSTRAP_ADMIN=1 也直接拒绝——
 *     该开关一旦在生产生效，等于把 ADMIN_PHONES 里任意号码静默提为超管，且无任何回滚提示。
 *  2. 手机号掩码：日志只写掩码，绝不写完整号码（规则14/15：日志不留可定位的自然人标识）。
 *  3. 审计留痕：与 路由/管理写.ts 的授/回收同口径写 "审计日志"，记录操作者=启动提权、
 *     目标手机号掩码与影响行数；否则事后无法从审计面追溯「谁在什么时候把哪个号提成了超管」。
 * 仍不建议在生产前留下该开关：正式提权请走 路由/管理写.ts 的 /shou-quan 链路（带二次确认与审计）。
 */
function 掩码手机号(手机号: string): string {
  if (!/^1[3-9]\d{9}$/.test(手机号)) {
    return '非手机号';
  }
  return `${手机号.slice(0, 3)}****${手机号.slice(7)}`;
}

async function 执行启动提权(池: 查询池, 手机号列表: string[], 运行环境: string): Promise<void> {
  if (手机号列表.length === 0) {
    return;
  }
  if (运行环境 === 'prod') {
    日志.警告('启动提权', '生产环境拒绝执行启动提权，请改用管理接口 /shou-quan 完成授权', { 数量: 手机号列表.length });
    return;
  }
  const 结果 = await 池.query('UPDATE "用户" SET "管理员" = TRUE WHERE "手机号" = ANY($1)', [手机号列表]);
  const 影响行数 = 结果.rowCount ?? null;
  const 掩码列表 = 手机号列表.map(掩码手机号);
  await 池.query(
    'INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)',
    [
      null,
      '启动提权',
      'guan_li_qi_dong_ti_quan',
      JSON.stringify({ 来源: 'BOOTSTRAP_ADMIN', 运行环境, 目标手机号掩码: 掩码列表, 影响行数 }),
      'guan_li',
    ],
  );
  日志.信息('启动提权', '初始化管理员提权完成', { 数量: 手机号列表.length, 影响行数, 目标: 掩码列表 });
}

async function 启动(): Promise<void> {
  启动前补齐主配置();
  const 配置 = 当前配置();
  const 缺失 = 校验启动配置(配置);
  if (缺失.length > 0) {
    console.error(`启动失败：缺少必要环境变量 ${缺失.join('、')}，请从和我恋爱吧/.env 同名补齐后重试`);
    process.exit(1);
  }
  const 池 = 创建池();
  const 缓存 = 创建缓存();
  if (配置.启动提权) {
    await 执行启动提权(池, 配置.管理员手机号, 配置.运行环境);
  }
  try {
    const 权限位 = await import('node:fs').then((模) => 模.statSync('.env').mode & 0o777);
    if ((权限位 & 0o077) !== 0) {
      日志.警告('启动', '环境文件权限过宽，仅所有者可读写更安全', { 权限位: 权限位.toString(8) });
    }
  } catch (错误) {
    if ((错误 as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw 错误;
    }
  }
  const 应用 = 创建应用({ 池, 缓存 });
  try {
    await 订阅失效广播(缓存);
  } catch (错误) {
    日志.警告('启动', '失效广播订阅失败，降级为本实例缓存', { 错误: 错误 instanceof Error ? 错误.message : String(错误) });
  }
  应用.listen(配置.端口, () => {
    日志.信息('启动', '管理后端已启动', { 端口: 配置.端口, 环境: 配置.运行环境 });
  });
}

启动().catch((错误: unknown) => {
  console.error(`启动失败：${错误 instanceof Error ? 错误.message : String(错误)}`);
  process.exit(1);
});
