/**
 * 输出安全真源：管理端读出口的玩家/AI 生成文本清洗。
 *
 * 与我方恋爱吧后端 src/utils/控制字符.ts 同一口径（两个项目共用同一套数据库：
 * 玩家/AI 文本在写入口清洗后仍可能有历史存量，管理端直读展示前必须再过一层）。
 *
 * 边界（只洗玩家/AI 内容字段）：
 *  - 洗：消息正文、举报原因、工单/公告标题与内容、封禁原因、思考/记忆/摘要/事件/评估正文、
 *    审核留痕备注——一切由玩家提交或模型生成、最终显示到管理端界面上的自由文本；
 *  - 不洗：管理端筛选条件（UUID、白名单枚举、时间范围、分页参数）——这些在写入侧已经
 *    校验.ts 白名单校验过，动它们只会模糊「已校验」与「未校验」的边界。
 *
 * 截断长度按该字段在管理端的展示合理值定，逐处写在调用点注释里；
 * 统一按码点截断，emoji/代理对不会被劈成半截。
 */

const 控制字符模式 = new RegExp(
  '[' +
    String.fromCharCode(0x0000) + '-' + String.fromCharCode(0x0008) +
    String.fromCharCode(0x000b) + '-' + String.fromCharCode(0x001f) +
    String.fromCharCode(0x007f) +
    String.fromCharCode(0xfffe) + String.fromCharCode(0xffff) +
    ']',
  'g',
);

/** 剥控制字符（保留 \n 与 \t）；非字符串入参返回空串，绝不由清洗层抛错中断批量处理 */
export function 剥离控制字符(文本: string): string {
  if (typeof 文本 !== 'string') {
    return '';
  }
  return 文本.replace(控制字符模式, '');
}

/** 剥控制字符 + 按码点截断到展示上限（正文类长文本的读出口统一入口） */
export function 清洗展示文本(文本: string, 上限: number): string {
  const 剥离后 = 剥离控制字符(文本);
  if (剥离后.length <= 上限) {
    return 剥离后;
  }
  return Array.from(剥离后).slice(0, 上限).join('');
}

export interface 字段清洗项 {
  字段: string;
  上限: number;
}

/** 单行清洗：克隆后按清单清洗指定字符串字段，非字符串原样保留（不清洗筛选列/枚举列） */
export function 清洗行(行: Record<string, unknown>, 字段清单: readonly 字段清洗项[]): Record<string, unknown> {
  const 结果: Record<string, unknown> = { ...行 };
  for (const { 字段, 上限 } of 字段清单) {
    const 值 = 结果[字段];
    if (typeof 值 === 'string') {
      结果[字段] = 清洗展示文本(值, 上限);
    }
  }
  return 结果;
}

/** 列表清洗：逐行过 清洗行，行序与行数不变 */
export function 清洗行列表(行列表: Record<string, unknown>[], 字段清单: readonly 字段清洗项[]): Record<string, unknown>[] {
  return 行列表.map((行) => 清洗行(行, 字段清单));
}