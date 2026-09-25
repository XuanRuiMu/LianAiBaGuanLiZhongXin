import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { 文案, 字段显示名, 取文案, 取字段显示名 } from '../../src/文案';
import { 错误码, 全部错误码 } from '../../src/错误码';
import { 创建应用 } from '../../src/应用';
import { 创建模拟池, 创建模拟缓存, 签发管理令牌, 授权头, 创建测试应用 } from './测试辅助';

const 后端根 = path.resolve(__dirname, '..', '..');
const 管理中心根 = path.resolve(后端根, '..');
const 前端术语源 = path.join(管理中心根, '管理前端', 'src', '术语.ts');
const 契约文档 = path.join(管理中心根, 'docs', '契约.md');

interface 术语词典 {
  规范名: string[];
  禁用别名: string[];
  禁用叙述: string[];
  填充词: string[];
  长度预算: Record<string, number>;
  后缀预算: Record<string, string>;
}

function 取块(源: string, 声明: string): string {
  const 命中 = new RegExp(String.raw`${声明}[^{]*\{([\s\S]*?)\n\s*\}`).exec(源);
  if (!命中) {
    throw new Error(`术语.ts 里解析不到 ${声明}，护栏拒绝静默通过`);
  }
  return 命中[1];
}

function 取数组项(块: string, 声明: string): string[] {
  const 项 = [...块.matchAll(/'([^']*)'/g)].map((匹配) => 匹配[1]);
  if (项.length === 0) {
    throw new Error(`术语.ts 的 ${声明} 解析为空，护栏拒绝静默通过`);
  }
  return 项;
}

function 取规范名(术语目录: string): string[] {
  if (!fs.existsSync(术语目录)) {
    throw new Error(`管理前端术语域文件目录缺失，跨端护栏无法执行: ${术语目录}`);
  }
  const 规范名: string[] = [];
  for (const 条目 of fs.readdirSync(术语目录).sort()) {
    if (!条目.endsWith('.ts')) {
      continue;
    }
    const 域源 = fs.readFileSync(path.join(术语目录, 条目), 'utf8');
    规范名.push(...[...域源.matchAll(/^export const [^\s=]+ = '([^']*)';/gm)].map((匹配) => 匹配[1]));
  }
  if (规范名.length < 190) {
    throw new Error(`术语域文件只解析出 ${规范名.length} 条显示名，不足 190 条，护栏拒绝静默通过`);
  }
  return 规范名;
}

function 读术语词典(): 术语词典 {
  if (!fs.existsSync(前端术语源)) {
    throw new Error(`管理前端术语源缺失，跨端护栏无法执行: ${前端术语源}`);
  }
  const 源 = fs.readFileSync(前端术语源, 'utf8');
  const 规范名 = 取规范名(path.join(path.dirname(前端术语源), '术语'));
  const 长度预算: Record<string, number> = {};
  for (const 匹配 of 取块(源, '长度预算').matchAll(/([^\s:,]+):\s*(\d+)/g)) {
    长度预算[匹配[1]] = Number(匹配[2]);
  }
  const 后缀预算: Record<string, string> = {};
  for (const 匹配 of 取块(源, '键名后缀预算').matchAll(/([^\s:,]+):\s*'([^']+)'/g)) {
    后缀预算[匹配[1]] = 匹配[2];
  }
  if (Object.keys(长度预算).length === 0 || Object.keys(后缀预算).length === 0) {
    throw new Error('术语.ts 长度预算解析为空，护栏拒绝静默通过');
  }
  return {
    规范名,
    禁用别名: 取数组项(取块(源, 'export const 禁用别名'), '禁用别名'),
    禁用叙述: 取数组项(/禁用叙述:\s*\[([\s\S]*?)\]/.exec(源)?.[1] ?? '', '禁用叙述'),
    填充词: 取数组项(/填充词:\s*\[([\s\S]*?)\]/.exec(源)?.[1] ?? '', '填充词'),
    长度预算,
    后缀预算,
  };
}

const 词典 = 读术语词典();
const 允许拉丁词元 = new Set(['IP', 'AI']);

function 按后缀预算(键名: string): { 名: string; 上限: number } {
  for (const [后缀, 预算名] of Object.entries(词典.后缀预算)) {
    if (键名.endsWith(后缀)) {
      return { 名: 预算名, 上限: 词典.长度预算[预算名] ?? 词典.长度预算['默认'] };
    }
  }
  return { 名: '默认', 上限: 词典.长度预算['默认'] };
}

export function 扫描可见文字(键名: string, 文本: string): string[] {
  const 违规: string[] = [];
  let 掩码后 = 文本;
  for (const 名 of [...词典.规范名].sort((甲, 乙) => 乙.length - 甲.length)) {
    掩码后 = 掩码后.split(名).join('§'.repeat(名.length));
  }
  const 去空白 = 掩码后.replace(/\s+/g, '');
  for (const 别名 of 词典.禁用别名) {
    if (掩码后.includes(别名) || 去空白.includes(别名.replace(/\s+/g, ''))) {
      违规.push(`旧称「${别名}」`);
    }
  }
  for (const 叙述 of 词典.禁用叙述) {
    if (掩码后.toLowerCase().includes(叙述.toLowerCase())) {
      违规.push(`内部实现名词「${叙述}」`);
    }
  }
  for (const 填充 of 词典.填充词) {
    if (掩码后.includes(填充)) {
      违规.push(`填充括号「${填充}」`);
    }
  }
  for (const 匹配 of 文本.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)) {
    if (!允许拉丁词元.has(匹配[0])) {
      违规.push(`裸标识或内部名词「${匹配[0]}」`);
    }
  }
  if (/[\u4e00-\u9fa5](?=[A-Za-z0-9])/.test(文本) || /[A-Za-z0-9](?=[\u4e00-\u9fa5])/.test(文本)) {
    违规.push('中文与英文或数字之间缺半角空格');
  }
  const 预算 = 按后缀预算(键名);
  const 字数 = [...文本].length;
  if (字数 > 预算.上限) {
    违规.push(`超出${预算.名}预算 ${预算.上限} 字（实际 ${字数} 字）`);
  }
  return 违规;
}

function 遍历文案值(节点: unknown, 路径: string): Array<[string, string]> {
  if (typeof 节点 === 'string') {
    return [[路径, 节点]];
  }
  if (Array.isArray(节点)) {
    return 节点.flatMap((项, 序) => 遍历文案值(项, `${路径}${路径 === '' ? '' : '.'}${序 + 1}`));
  }
  if (节点 && typeof 节点 === 'object') {
    return Object.entries(节点 as Record<string, unknown>).flatMap(([键, 值]) =>
      遍历文案值(值, 路径 === '' ? 键 : `${路径}.${键}`),
    );
  }
  return [];
}

function 列出后端源码(目录: string): string[] {
  const 结果: string[] = [];
  for (const 条目 of fs.readdirSync(目录)) {
    const 全 = path.join(目录, 条目);
    if (fs.statSync(全).isDirectory()) {
      结果.push(...列出后端源码(全));
    } else if (条目.endsWith('.ts')) {
      结果.push(全);
    }
  }
  return 结果;
}

const 后端源码 = 列出后端源码(path.join(后端根, 'src'));

function 取调用实参(源: string, 函数名: string): string[][] {
  const 结果: string[][] = [];
  let 游标 = 0;
  for (;;) {
    const 位置 = 源.indexOf(`${函数名}(`, 游标);
    if (位置 < 0) {
      break;
    }
    游标 = 位置 + 函数名.length + 1;
    if (/function\s*$/.test(源.slice(Math.max(0, 位置 - 12), 位置))) {
      continue;
    }
    let 深度 = 0;
    let 结尾 = -1;
    for (let i = 位置 + 函数名.length; i < 源.length; i += 1) {
      const 字符 = 源[i];
      if (字符 === "'" || 字符 === '"' || 字符 === '`') {
        const 结束 = 源.indexOf(字符, i + 1);
        if (结束 < 0) break;
        i = 结束;
        continue;
      }
      if (字符 === '(') 深度 += 1;
      else if (字符 === ')') {
        深度 -= 1;
        if (深度 === 0) {
          结尾 = i;
          break;
        }
      }
    }
    if (结尾 < 0) {
      throw new Error(`${函数名} 调用括号不闭合，解析失败`);
    }
    const 内部 = 源.slice(位置 + 函数名.length + 1, 结尾);
    const 实参: string[] = [];
    let 缓冲 = '';
    let 层 = 0;
    for (let i = 0; i < 内部.length; i += 1) {
      const 字符 = 内部[i];
      if (字符 === "'" || 字符 === '"' || 字符 === '`') {
        const 结束 = 内部.indexOf(字符, i + 1);
        缓冲 += 内部.slice(i, 结束 + 1);
        i = 结束;
        continue;
      }
      if (字符 === '(' || 字符 === '[') 层 += 1;
      if (字符 === ')' || 字符 === ']') 层 -= 1;
      if (字符 === ',' && 层 === 0) {
        实参.push(缓冲.trim());
        缓冲 = '';
        continue;
      }
      缓冲 += 字符;
    }
    实参.push(缓冲.trim());
    结果.push(实参);
  }
  return 结果;
}

function 手打中文(表达式: string): string[] {
  const 剥净 = 表达式
    .replace(/取文案\(\s*'[^']*'\s*,\s*'[^']*'\s*\)/g, '')
    .replace(/取文案\(\s*文案分组\s*,\s*'[^']*'\s*\)/g, '')
    .replace(/参数错误提示\(\s*'[^']*'\s*\)/g, '');
  return [...剥净.matchAll(/['"`]([^'"`]*)['"`]/g)].map((匹配) => 匹配[1]).filter((段) => /[\u4e00-\u9fa5]/.test(段));
}

const 提示表达式白名单 = ['归一.提示', '错误.message'];
const 码表达式白名单 = ['归一.错误码'];

function 码合法(表达式: string): boolean {
  return /^错误码\.[^\s().]+$/.test(表达式) || 码表达式白名单.includes(表达式);
}

describe('FP-07 后端可见提示跨端术语护栏', () => {
  it('文案.ts 每条值无旧称、无内部实现名词、无裸标识，且守排版与长度预算', () => {
    const 违例: string[] = [];
    for (const [键名, 值] of 遍历文案值(文案, '')) {
      const 命中 = 扫描可见文字(键名.split('.').pop() ?? 键名, 值);
      if (命中.length > 0) {
        违例.push(`${键名}「${值}」：${命中.join('、')}`);
      }
    }
    expect(违例).toEqual([]);
  });

  it('字段显示名同样过术语扫描，且不超过字段标签预算', () => {
    const 违例: string[] = [];
    for (const [标识, 显示名] of Object.entries(字段显示名)) {
      const 命中 = 扫描可见文字('标签', 显示名);
      if (命中.length > 0) {
        违例.push(`${标识} → 「${显示名}」：${命中.join('、')}`);
      }
    }
    expect(违例).toEqual([]);
    expect(Object.keys(字段显示名).length).toBeGreaterThanOrEqual(35);
  });

  it('失败响应出口一律带稳定码，禁止手打码字符串与手打文案', () => {
    const 违例: string[] = [];
    let 出口数 = 0;
    for (const 文件 of 后端源码) {
      const 源 = fs.readFileSync(文件, 'utf8');
      for (const 实参 of 取调用实参(源, '失败响应')) {
        出口数 += 1;
        const 码表达式 = 实参[3] ?? '';
        const 提示表达式 = 实参[2] ?? '';
        if (实参.length < 4 || !码合法(码表达式)) {
          违例.push(`${path.basename(文件)}: 失败响应码未走 错误码.ts（${码表达式 || '缺参'}）`);
        }
        const 来自词典 = /^取文案\(/.test(提示表达式) || /^参数错误提示\(/.test(提示表达式) || 提示表达式白名单.includes(提示表达式);
        if (!来自词典 || 手打中文(提示表达式).length > 0) {
          违例.push(`${path.basename(文件)}: 失败响应提示非词典来源（${提示表达式}）`);
        }
      }
    }
    expect(出口数).toBeGreaterThanOrEqual(25);
    expect(违例).toEqual([]);
  });

  it('校验异常提示只能出自词典，不得在调用点拼中文', () => {
    const 违例: string[] = [];
    for (const 文件 of 后端源码) {
      const 源 = fs.readFileSync(文件, 'utf8');
      for (const 函数名 of ['校验失败', '记录缺失']) {
        for (const 实参 of 取调用实参(源, 函数名)) {
          const 手打 = 手打中文(实参[0] ?? '');
          if (手打.length > 0) {
            违例.push(`${path.basename(文件)}: ${函数名} 手打中文 ${手打.join('/')}`);
          }
        }
      }
    }
    expect(违例).toEqual([]);
  });

  it('每个 取文案 与 参数错误提示 调用点都解析得出非空可见文字', () => {
    const 违例: string[] = [];
    for (const 文件 of 后端源码) {
      const 源 = fs.readFileSync(文件, 'utf8');
      for (const 实参 of 取调用实参(源, '取文案')) {
        const 分组文本 = 实参[0] ?? '';
        const 键 = /'([^']+)'/.exec(实参[1] ?? '')?.[1];
        if (键 === undefined) {
          违例.push(`${path.basename(文件)}: 取文案 键非字面量（${实参[1] ?? ''}）`);
          continue;
        }
        if (分组文本 === '文案分组') {
          for (const 分组 of ['封禁', '审核', '审计', '统计', '思考']) {
            if (取文案(分组 as never, 键 as never) === '') {
              违例.push(`${path.basename(文件)}: ${分组}.${键} 无值`);
            }
          }
          continue;
        }
        const 分组 = /'([^']+)'/.exec(分组文本)?.[1];
        if (分组 === undefined || 取文案(分组 as never, 键 as never) === '') {
          违例.push(`${path.basename(文件)}: 取文案(${分组文本}, ${键}) 取不到值`);
        }
      }
      for (const 实参 of 取调用实参(源, '参数错误提示')) {
        if (path.basename(文件) === '校验.ts') {
          continue;
        }
        const 标识 = /'([^']+)'/.exec(实参[0] ?? '')?.[1];
        if (!标识 || 取字段显示名(标识) === '') {
          违例.push(`${path.basename(文件)}: 参数错误提示('${标识 ?? '非字面量'}') 未登记显示名`);
        }
      }
    }
    expect(违例).toEqual([]);
  });

  it('校验器一律以接口字段标识调用，每个标识都在 字段显示名 登记', () => {
    const 违例: string[] = [];
    const 位置实参: Record<string, number> = {
      校验UUID: 0,
      校验可选UUID: 0,
      校验手机号: 0,
      校验IP: 0,
      校验白名单: 0,
      取必填字符串: 1,
    };
    let 调用数 = 0;
    for (const 文件 of 后端源码) {
      const 源 = fs.readFileSync(文件, 'utf8');
      for (const [函数名, 下标] of Object.entries(位置实参)) {
        for (const 实参 of 取调用实参(源, 函数名)) {
          const 表达式 = 实参[下标] ?? '';
          const 命中 = /^'([^']+)'$/.exec(表达式);
          if (!命中) {
            const 内部转派 = path.basename(文件) === '校验.ts' || 表达式 === '过滤.键';
            if (!内部转派) {
              违例.push(`${path.basename(文件)}: ${函数名} 字段标识非字面量（${表达式}）`);
            }
            continue;
          }
          调用数 += 1;
          if (取字段显示名(命中[1]) === '') {
            违例.push(`${path.basename(文件)}: ${函数名} 字段标识「${命中[1]}」未登记显示名`);
          }
        }
      }
      for (const 匹配 of 源.matchAll(/键: '([a-z_]+)'/g)) {
        if (取字段显示名(匹配[1]) === '') {
          违例.push(`${path.basename(文件)}: 过滤列键「${匹配[1]}」未登记显示名`);
        }
      }
    }
    expect(调用数).toBeGreaterThanOrEqual(30);
    expect(违例).toEqual([]);
  });

  it('错误码.ts 与 docs/契约.md 十五节码表逐条同源', () => {
    const 源 = fs.readFileSync(契约文档, 'utf8');
    const 起 = 源.indexOf('## 十五、');
    if (起 < 0) {
      throw new Error('docs/契约.md 缺「十五、管理端错误码表」，码无出处');
    }
    const 前端起点 = 源.indexOf('\n### 前端', 起);
    const 表段 = 源.slice(起, 前端起点 < 0 ? undefined : 前端起点);
    const 表码 = [...表段.matchAll(/^\|\s*([A-Z][A-Z0-9_]{3,})\s*\|/gm)].map((匹配) => 匹配[1]);
    expect([...表码].sort()).toEqual([...全部错误码].sort());
    for (const 码 of 全部错误码) {
      expect(表段, `${码} 无码表行`).toContain(`| ${码} |`);
    }
  });

  it('反证：已知违规样张必须判红', () => {
    const 样张 = '缓存服务不可用，请确认共享 Redis 与 REDIS_URL 同源后执行018迁移；夺舍与归还未留痕，批量处理封禁 IP，封禁写入成功';
    const 命中 = 扫描可见文字('提示', 样张).join('、');
    expect(命中).toContain('内部实现名词「Redis」');
    expect(命中).toContain('内部实现名词「REDIS_URL」');
    expect(命中).toContain('内部实现名词「留痕」');
    expect(命中).toContain('旧称「夺舍」');
    expect(命中).toContain('旧称「归还」');
    expect(命中).toContain('旧称「批量」');
    expect(命中).toContain('旧称「封禁 IP」');
    expect(命中).toContain('旧称「封禁写入成功」');
    expect(命中).toContain('超出');
    expect(扫描可见文字('提示', '请求参数有误：mu_biao_id').join('、')).toContain('裸标识或内部名词「mu_biao_id」');
    expect(扫描可见文字('提示', '请填写IP地址').join('、')).toContain('中文与英文或数字之间缺半角空格');
    expect(扫描可见文字('列', '账号编号').join('、')).toContain('旧称「账号编号」');
    expect(扫描可见文字('提示', '请填写用户编号或 IP 地址')).toEqual([]);
  });

  it('反证：术语源或码表解析失败必须抛错，不得静默通过', () => {
    expect(() => 取块('export const 术语 = {\n  应用标题: x,\n};\n', 'export const 禁用别名')).toThrow(/解析不到/);
    expect(() => 取数组项('', '禁用叙述')).toThrow(/解析为空/);
    expect(() => 取调用实参('失败响应(响应, 400, 提示', '失败响应')).toThrow(/不闭合/);
  });
});

describe('FP-07 改写后的可见提示与稳定码成对锁死', () => {
  const 授权 = () => 授权头(签发管理令牌());
  const 编号 = '11111111-1111-4111-8111-111111111111';

  function 缺表池(表名: string) {
    return 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) {
        return [{ 管理员: true, 运营: true, 审核员: false }];
      }
      throw new Error(`relation "${表名}" does not exist`);
    }).池;
  }

  it('每条改写提示都锁定文本与所属稳定码，且文本无违规', () => {
    const 对照: Array<[string, string, string]> = [
      ['通用', '缓存不可用', '缓存服务不可用'],
      ['通用', '依赖未就绪', '依赖未就绪'],
      ['通用', '数据服务异常', '数据服务失败'],
      ['通用', '服务器内部错误', '内部错误'],
      ['通用', '源地址不在白名单', '源地址被拒'],
      ['通用', '需经加密通道访问', '需加密访问'],
      ['通用', '未授权', '未授权'],
      ['通用', '令牌无效', '登录失效'],
      ['通用', '无管理员权限', '无管理身份'],
      ['通用', '请求过于频繁', '请求过频'],
      ['通用', '参数错误', '参数有误'],
      ['通用', '时间范围有误', '参数有误'],
      ['通用', '未找到', '记录未找到'],
      ['封禁', '表缺失降级', '数据表未就绪'],
      ['审核', '表缺失降级', '数据表未就绪'],
      ['审计', '表缺失降级', '数据表未就绪'],
      ['统计', '表缺失降级', '数据表未就绪'],
      ['思考', '表缺失降级', '数据表未就绪'],
      ['封禁', '缺少目标', '参数有误'],
      ['封禁', '缺少原因', '参数有误'],
      ['封禁', '申诉结论必选', '参数有误'],
      ['封禁', '无封禁可解除', '记录未找到'],
      ['封禁', '无封禁记录', '记录未找到'],
      ['封禁', '无待审申诉', '无待审申诉'],
      ['审核', '缺少举报目标', '参数有误'],
      ['审核', '评审结论必选', '参数有误'],
      ['审核', '评审轮次有误', '参数有误'],
      ['审核', '多项目标超限', '参数有误'],
      ['审核', '多项状态已变', '参数有误'],
      ['审核', '超时筛选有误', '参数有误'],
      ['审核', '对象已变化', '审核对象已变'],
      ['审计', '需审批单', '需审批单'],
      ['审计', '保留策略', '记录未找到'],
      ['统计', '用量口径', '记录未找到'],
      ['思考', '无持久化声明', '记录未找到'],
      ['思考', '回放准则', '记录未找到'],
      ['思考', '实时事件说明', '记录未找到'],
      ['思考', '待补充说明', '记录未找到'],
      ['管理写', '需再次确认', '需再次确认'],
      ['管理写', '不能变更自己', '参数有误'],
      ['账号', '账号不存在', '记录未找到'],
      ['账号', '角色不存在', '记录未找到'],
      ['登录', '账号或密码错误', '参数有误'],
      ['登录', '刷新令牌无效', '登录失效'],
    ];
    expect(对照.length).toBeGreaterThanOrEqual(40);
    const 覆盖码 = new Set<string>();
    for (const [分组, 键, 码名] of 对照) {
      const 值 = 取文案(分组 as never, 键 as never);
      expect(值, `${分组}.${键} 无值`).not.toBe('');
      const 码 = (错误码 as Record<string, string>)[码名];
      expect(码, `码 ${码名} 未定义`).toBeTruthy();
      expect(全部错误码).toContain(码 as never);
      覆盖码.add(码名);
      const 命中 = 扫描可见文字(键, 值);
      if (命中.length > 0) {
        throw new Error(`${分组}.${键}「${值}」违规：${命中.join('、')}`);
      }
    }
    expect(覆盖码.size).toBeGreaterThanOrEqual(12);
  });

  it('思考待补充项逐条受术语扫描约束', () => {
    for (const 项 of 文案.思考.待补充项) {
      expect(扫描可见文字('选项', 项)).toEqual([]);
    }
  });

  it('未授权出口提示与码成对', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao');
    expect(响应.status).toBe(401);
    expect(响应.body.ti_shi).toBe(取文案('通用', '未授权'));
    expect(响应.body.message).toBe(响应.body.ti_shi);
    expect(响应.body.cuo_wu_ma).toBe(错误码.未授权);
    expect(响应.body.code).toBe(错误码.未授权);
    expect(响应.body.traceId).toBe(响应.headers['x-trace-id']);
    expect(响应.body.retryable).toBe(false);
  });

  it('依赖未就绪与缓存不可用各带自己的码，提示无内部名词', async () => {
    const 有缓存 = 创建模拟缓存();
    const 缺库 = await request(创建应用({ 缓存: 有缓存.缓存 as never }))
      .get('/api/guan-li/zhang-hao-lie-biao')
      .set(授权());
    expect(缺库.status).toBe(503);
    expect(缺库.body.ti_shi).toBe(取文案('通用', '依赖未就绪'));
    expect(缺库.body.cuo_wu_ma).toBe(错误码.依赖未就绪);
    expect(JSON.stringify(缺库.body)).not.toMatch(/数据库|注入/);

    const 有池 = 创建模拟池();
    const 缺缓存 = await request(创建应用({ 池: 有池.池 }))
      .get('/api/guan-li/zhang-hao-lie-biao')
      .set(授权());
    expect(缺缓存.status).toBe(503);
    expect(缺缓存.body.ti_shi).toBe(取文案('通用', '缓存不可用'));
    expect(缺缓存.body.cuo_wu_ma).toBe(错误码.缓存服务不可用);
    expect(JSON.stringify(缺缓存.body)).not.toMatch(/Redis|REDIS_URL/);
  });

  it('五族表缺失返回503失败包络，迁移编号不上屏', async () => {
    const 用例: Array<[string, string, string]> = [
      ['思考', '/api/guan-li/si-kao-ji-lu', '思考记录'],
      ['封禁', '/api/guan-li/zhang-hao-feng-jin', '账号封禁'],
      ['审核', '/api/guan-li/ju-bao-lie-biao', '举报'],
      ['审计', '/api/guan-li/shen-ji-bao-liu', '审计日志'],
      ['统计', '/api/guan-li/tong-ji/liu-cun', '消息'],
    ];
    for (const [分组, 路径, 表名] of 用例) {
      const { 应用 } = 创建测试应用({ 池: 缺表池(表名) });
      const 响应 = await request(应用).get(路径).set(授权());
      expect(响应.status, `${分组} 表缺失必须是503失败包络`).toBe(503);
      expect(响应.body.ti_shi).toBe(取文案(分组 as never, '表缺失降级' as never));
      expect(响应.body.cuo_wu_ma).toBe(错误码.数据表未就绪);
      expect(JSON.stringify(响应.body)).not.toMatch(/018|021|迁移|relation|MySQL|Postgres/);
    }
  });

  it('参数错误消息只出显示名，fieldErrors 保留机器字段', async () => {
    const { 应用 } = 创建测试应用();
    const 用户编号 = await request(应用).get('/api/guan-li/si-kao-ji-lu?yong_hu_id=bu-shi-uuid').set(授权());
    expect(用户编号.status).toBe(400);
    expect(用户编号.body.ti_shi).toBe(`${取文案('通用', '参数错误')}：用户编号`);
    expect(用户编号.body.cuo_wu_ma).toBe(错误码.参数有误);
    expect(用户编号.body.fieldErrors).toEqual({ yong_hu_id: '用户编号格式不正确' });

    const 页码 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao?ye_ma=0').set(授权());
    expect(页码.body.ti_shi).toBe(`${取文案('通用', '参数错误')}：页码`);
    expect(页码.body.fieldErrors).toEqual({ ye_ma: '页码格式不正确' });

    const 记录 = await request(应用).get('/api/guan-li/si-kao-ji-lu/bu-cun-zai').set(授权());
    expect(记录.body.ti_shi).toBe(`${取文案('通用', '参数错误')}：思考记录编号`);

    const 地址 = await request(应用).get('/api/guan-li/feng-jin-ji-lu?ip=bucun').set(授权());
    expect(地址.body.ti_shi).toBe(`${取文案('通用', '参数错误')}：IP 地址`);
    expect(地址.body.fieldErrors).toEqual({ ip: 'IP 地址格式不正确' });
  });

  it('再次确认与审批单两个专用码带改写后的提示', async () => {
    const { 应用 } = 创建测试应用();
    const 未确认 = await request(应用).post('/api/guan-li/shou-quan').set(授权()).send({ yong_hu_id: 编号 });
    expect(未确认.status).toBe(400);
    expect(未确认.body.ti_shi).toBe(取文案('管理写', '需再次确认'));
    expect(未确认.body.cuo_wu_ma).toBe(错误码.需再次确认);
    expect(JSON.stringify(未确认.body)).not.toMatch(/高危|二次确认/);

    const 缺单 = await request(应用).get('/api/guan-li/shen-ji-dao-chu').set(授权());
    expect(缺单.status).toBe(400);
    expect(缺单.body.ti_shi).toBe(取文案('审计', '需审批单'));
    expect(缺单.body.cuo_wu_ma).toBe(错误码.需审批单);
  });

  it('不存在与状态冲突分码：404 与 409 不再混用', async () => {
    const 空更新 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      return [];
    }).池;
    const { 应用 } = 创建测试应用({ 池: 空更新 });
    const 解封 = await request(应用)
      .post('/api/guan-li/zhang-hao-feng-jin/jie-feng')
      .set(授权())
      .send({ yong_hu_id: 编号 });
    expect(解封.status).toBe(404);
    expect(解封.body.ti_shi).toBe(取文案('封禁', '无封禁可解除'));
    expect(解封.body.cuo_wu_ma).toBe(错误码.记录未找到);

    const 驳回 = await request(应用)
      .post('/api/guan-li/shen-su/shen-he')
      .set(授权())
      .send({ yong_hu_id: 编号, tong_guo: false });
    expect(驳回.status).toBe(409);
    expect(驳回.body.ti_shi).toBe(取文案('封禁', '无待审申诉'));
    expect(驳回.body.cuo_wu_ma).toBe(错误码.无待审申诉);

    const 评审 = await request(应用)
      .post('/api/guan-li/ju-bao-yi-shen')
      .set(授权())
      .send({ mu_biao_id: 编号, tong_guo: true });
    expect(评审.status).toBe(409);
    expect(评审.body.ti_shi).toBe(取文案('审核', '对象已变化'));
    expect(评审.body.cuo_wu_ma).toBe(错误码.审核对象已变);
  });

  it('越权与模式缺陷与未知异常：提示不叙述实现，码不回退', async () => {
    const 非管理员 = 创建测试应用({ 管理员: false });
    const 越权 = await request(非管理员.应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权());
    expect(越权.status).toBe(403);
    expect(越权.body.ti_shi).toBe(取文案('通用', '无管理员权限'));
    expect(越权.body.cuo_wu_ma).toBe(错误码.无管理身份);

    const 缺列 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      throw Object.assign(new Error('column "原文长度" does not exist'), { code: '42703' });
    }).池;
    const 模式 = await request(创建测试应用({ 池: 缺列 }).应用).get('/api/guan-li/si-kao-ji-lu').set(授权());
    expect(模式.status).toBe(500);
    expect(模式.body.ti_shi).toBe(取文案('通用', '数据服务异常'));
    expect(模式.body.cuo_wu_ma).toBe(错误码.表结构不完整);
    expect(JSON.stringify(模式.body)).not.toMatch(/42703|does not exist|SQLSTATE|column/);

    const 未知 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      throw new Error('boom');
    }).池;
    const 内部 = await request(创建测试应用({ 池: 未知 }).应用).get('/api/guan-li/si-kao-ji-lu').set(授权());
    expect(内部.body.cuo_wu_ma).toBe(错误码.内部错误);
    expect(内部.body.ti_shi).toBe(取文案('通用', '服务器内部错误'));
  });

  it('思考链与审计统计说明区块只剩一句结论', async () => {
    const { 应用 } = 创建测试应用();
    const 说明 = await request(应用).get('/api/guan-li/si-kao-shuo-ming').set(授权());
    expect(说明.status).toBe(200);
    const 数据 = 说明.body.shu_ju as Record<string, unknown>;
    expect(数据['hui_fang_zhun_ze']).toBe(取文案('思考', '回放准则'));
    expect(数据['sheng_ming']).toBe(取文案('思考', '无持久化声明'));
    expect(数据['shi_shi_shuo_ming']).toBe(取文案('思考', '实时事件说明'));
    expect(数据['dai_bu_chong_shuo_ming']).toBe(取文案('思考', '待补充说明'));
    expect(数据['dai_bu_chong']).toEqual(文案.思考.待补充项);
    expect(JSON.stringify(数据['shi_shi_shuo_ming'])).not.toMatch(/Socket|落库|订阅|018/);

    const 保留 = await request(应用).get('/api/guan-li/shen-ji-bao-liu').set(授权());
    expect((保留.body.shu_ju as Record<string, unknown>)['bao_liu_ce_lue']).toBe(取文案('审计', '保留策略'));
    const 用量 = await request(应用).get('/api/guan-li/tong-ji/ai-yong-liang').set(授权());
    expect((用量.body.shu_ju as Record<string, unknown>)['kou_jing']).toBe(取文案('统计', '用量口径'));
  });
});
