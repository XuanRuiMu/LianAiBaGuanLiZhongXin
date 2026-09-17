import { 当前配置, 校验启动配置, 启动前补齐主配置 } from './配置';
import { 创建池, type 查询池 } from './数据库';
import { 创建缓存 } from './缓存';
import { 创建应用 } from './应用';
import { 订阅失效广播 } from './中间件/管理员';
import { 日志 } from './日志';

async function 执行启动提权(池: 查询池, 手机号列表: string[]): Promise<void> {
  if (手机号列表.length === 0) {
    return;
  }
  await 池.query('UPDATE "用户" SET "管理员" = TRUE WHERE "手机号" = ANY($1)', [手机号列表]);
  日志.信息('启动提权', '初始化管理员提权完成', { 数量: 手机号列表.length });
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
    await 执行启动提权(池, 配置.管理员手机号);
  }
  try {
    const 权限位 = await import('node:fs').then((模) => 模.statSync('.env').mode & 0o777);
    if ((权限位 & 0o077) !== 0) {
      日志.警告('启动', '环境文件权限过宽，仅所有者可读写更安全', { 权限位: 权限位.toString(8) });
    }
  } catch {
    return;
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
