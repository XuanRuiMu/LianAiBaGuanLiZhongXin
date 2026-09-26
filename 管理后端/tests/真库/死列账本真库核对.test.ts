import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { 创建隔离数据库池 } from '../测试数据库';

/**
 * FP-28a 真库核对：账号列清单的每一列都必须真实存在于隔离库，且清单里不得有 `性别`。
 *
 * 与 tests/单元/死列账本.test.ts 的分工：那边只做源码静态扫描（零读零写 + 禁读形态自证），
 * 任何机器都能跑；这边必须连真库，故归入 tests/真库/，只由隔离门禁注入 TEST_DATABASE_URL 后执行。
 * 两侧合起来才是「删 用户.性别 之前必须先证明没人读它」的全部证据。
 */
const 后端根 = path.resolve(__dirname, '..', '..');

function 取常量列(源: string, 声明: string): string[] {
  const 命中 = new RegExp(String.raw`const ${声明} =\s*'([^']+)'`).exec(源);
  if (命中 === null) {
    throw new Error(`账号.ts 里取不到常量 ${声明} 的列清单，死列账本拒绝空跑`);
  }
  return 命中[1].split(',').map((段) => 段.trim()).filter((段) => 段.length > 0);
}

const 账号列清单 = 取常量列(
  fs.readFileSync(path.join(后端根, 'src', '路由', '账号.ts'), 'utf8'),
  '列表列',
);

async function 取表列(表: string): Promise<Set<string>> {
  const 池 = await 创建隔离数据库池();
  try {
    const 结果 = await 池.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1',
      [表],
    );
    return new Set(结果.rows.map((行) => String(行['column_name'])));
  } finally {
    await 池.end().catch(() => undefined);
  }
}

describe('FP-28a 用户.性别 死列真库核对（管理中心删列前置条件）', () => {
  it('账号列清单的每一列都在真实库存在，且清单里没有 `性别`', async () => {
    const 用户列 = await 取表列('用户');
    const 封禁列 = await 取表列('账号封禁');
    const 缺列: string[] = [];
    for (const 段 of 账号列清单) {
      const 命中 = /^(?:u|f)\."([^"]+)"(?:\s+AS\s+"([^"]+)")?$/.exec(段);
      if (命中 === null) {
        throw new Error(`账号列清单解析不出片段：${段}`);
      }
      const 表列 = 段.startsWith('u.') ? 用户列 : 封禁列;
      if (!表列.has(命中[1])) {
        缺列.push(`${段.startsWith('u.') ? '用户' : '账号封禁'}.${命中[1]}`);
      }
    }
    expect(缺列, '账号列清单里有真实库不存在的列，删列或改列后账本未同步').toEqual([]);
    expect(用户列.has('默认性别'), '`默认性别` 需由 037 迁移补齐，未补齐的库上此读点即 42703').toBe(true);
    expect(账号列清单.some((段) => 段 === 'u."性别"')).toBe(false);
  });
});
