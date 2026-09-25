import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { 错误注册表, type 错误码键, type 错误码值 } from '../src/错误码';
import { 文案 } from '../src/文案';

const 后端根 = path.resolve(__dirname, '..');
const 源码根 = path.join(后端根, 'src');

export const 错误码文档路径 = path.resolve(后端根, '..', 'docs', '错误码大全.md');

type 分组名 = '鉴权与访问控制' | '业务与请求' | '限频' | '服务端与依赖';

const 分组顺序: readonly 分组名[] = ['鉴权与访问控制', '业务与请求', '限频', '服务端与依赖'];

const 状态分组: Readonly<Record<number, 分组名>> = {
  200: '服务端与依赖',
  400: '业务与请求',
  401: '鉴权与访问控制',
  403: '鉴权与访问控制',
  404: '业务与请求',
  409: '业务与请求',
  426: '鉴权与访问控制',
  429: '限频',
  500: '服务端与依赖',
  503: '服务端与依赖',
};

export interface 错误码行 {
  键: 错误码键;
  码: 错误码值;
  状态: number;
  可重试: boolean;
  文案列表: string[];
  运行时动态: boolean;
  分组: 分组名;
}

export interface 源码出口 {
  文件: string;
  键: 错误码键;
  文案列表: string[];
  运行时动态: boolean;
}

function 收源码文件(目录: string): string[] {
  const 文件列表: string[] = [];
  for (const 条目 of readdirSync(目录, { withFileTypes: true })) {
    const 整路径 = path.join(目录, 条目.name);
    if (条目.isDirectory()) {
      文件列表.push(...收源码文件(整路径));
    } else if (条目.name.endsWith('.ts')) {
      文件列表.push(整路径);
    }
  }
  return 文件列表.sort();
}

/** 从 起 读到第一个顶层逗号、闭括号或换行为止，尊重括号与引号 */
function 取表达式(源: string, 起: number): string {
  let 深度 = 0;
  let 引号 = '';
  for (let 位 = 起; 位 < 源.length; 位 += 1) {
    const 字符 = 源[位];
    if (引号 !== '') {
      if (字符 === 引号) {
        引号 = '';
      }
      continue;
    }
    if (字符 === "'" || 字符 === '"' || 字符 === '`') {
      引号 = 字符;
      continue;
    }
    if (字符 === '(' || 字符 === '[' || 字符 === '{') {
      深度 += 1;
      continue;
    }
    if (字符 === ')' || 字符 === ']' || 字符 === '}') {
      if (深度 === 0) {
        return 源.slice(起, 位).trim();
      }
      深度 -= 1;
      continue;
    }
    if (字符 === ',' || 字符 === '\n') {
      if (深度 === 0) {
        return 源.slice(起, 位).trim();
      }
      continue;
    }
  }
  return 源.slice(起).trim();
}

/** 从 起 读到配对的右括号为止，返回实参列表 */
function 取实参(源: string, 起: number, 文件: string): string[] {
  let 深度 = 1;
  let 引号 = '';
  let 当前 = '';
  const 实参: string[] = [];
  for (let 位 = 起; 位 < 源.length; 位 += 1) {
    const 字符 = 源[位];
    当前 += 字符;
    if (引号 !== '') {
      if (字符 === 引号) {
        引号 = '';
      }
      continue;
    }
    if (字符 === "'" || 字符 === '"' || 字符 === '`') {
      引号 = 字符;
      continue;
    }
    if (字符 === '(') {
      深度 += 1;
      continue;
    }
    if (字符 === ')') {
      深度 -= 1;
      if (深度 === 0) {
        if (当前.slice(0, -1).trim() !== '') {
          实参.push(当前.slice(0, -1).trim());
        }
        return 实参;
      }
      continue;
    }
    if (字符 === ',' && 深度 === 1) {
      实参.push(当前.slice(0, -1).trim());
      当前 = '';
    }
  }
  throw new Error(`${文件} 的调用实参不闭合，护栏拒绝静默通过`);
}

function 解析文案表达式(表达式: string): { 文案列表: string[]; 运行时动态: boolean } {
  const 文案列表: string[] = [];
  let 命中数 = 0;
  for (const 命中 of 表达式.matchAll(/取文案\(/g)) {
    命中数 += 1;
    const 实参 = 取实参(表达式, 命中.index + 命中[0].length, `文案表达式 ${表达式}`);
    if (实参.length !== 2) {
      throw new Error(`取文案实参不是两个：${表达式}`);
    }
    const 键 = 实参[1].replace(/^'|'$/g, '');
    const 分组实参 = 实参[0];
    if (分组实参.startsWith("'") && 分组实参.endsWith("'")) {
      const 分组 = 分组实参.slice(1, -1) as keyof typeof 文案;
      const 文案分组 = 文案[分组] as Record<string, unknown> | undefined;
      const 值 = 文案分组?.[键];
      if (typeof 值 !== 'string' || 值 === '') {
        throw new Error(`文案真源里取不到 ${分组}.${键} 的中文文案`);
      }
      文案列表.push(值);
      continue;
    }
    const 全部分组值 = new Set<string>();
    for (const 分组 of Object.keys(文案) as Array<keyof typeof 文案>) {
      const 值 = (文案[分组] as Record<string, unknown>)[键];
      if (typeof 值 === 'string' && 值 !== '') {
        全部分组值.add(值);
      }
    }
    if (全部分组值.size !== 1) {
      throw new Error(`文案键 ${键} 的分组实参不是字面量且各分组取值不一致，拒绝猜测`);
    }
    文案列表.push([...全部分组值][0]);
  }
  return { 文案列表, 运行时动态: 命中数 === 0 };
}

function 记出口(出口: 源码出口[], 文件: string, 键: 错误码键, 表达式: string): void {
  if (!Object.hasOwn(错误注册表, 键)) {
    throw new Error(`${文件} 用了未注册错误码 ${键}`);
  }
  const { 文案列表, 运行时动态 } = 解析文案表达式(表达式);
  出口.push({ 文件, 键, 文案列表, 运行时动态 });
}

export function 扫源码出口(): 源码出口[] {
  const 出口: 源码出口[] = [];
  for (const 文件路径 of 收源码文件(源码根)) {
    const 文件 = path.relative(后端根, 文件路径).split(path.sep).join('/');
    const 源 = readFileSync(文件路径, 'utf8');
    for (const 命中 of 源.matchAll(/失败响应\(/g)) {
      const 实参 = 取实参(源, 命中.index + 命中[0].length, 文件);
      if (!/^\d{3}$/.test(实参[1] ?? '')) {
        continue;
      }
      if (实参.length < 4) {
        throw new Error(`${文件} 的失败响应实参不足四个，护栏拒绝静默通过`);
      }
      if (/['"]/.test(实参[3])) {
        throw new Error(`${文件} 的失败响应手写了错误码字符串：${实参[3]}`);
      }
      const 状态 = Number(实参[1]);
      const 码参 = /^错误码\.(.+)$/.exec(实参[3]);
      if (码参 === null) {
        throw new Error(`${文件} 的失败响应第 4 个实参不是注册码别名：${实参[3]}`);
      }
      const 键 = 码参[1] as 错误码键;
      if (!Object.hasOwn(错误注册表, 键)) {
        throw new Error(`${文件} 用了未注册错误码 ${键}`);
      }
      if (状态 !== 错误注册表[键].状态码) {
        throw new Error(`${文件} 里 ${键} 的调用状态码与注册表不一致`);
      }
      记出口(出口, 文件, 键, 实参[2]);
    }
    const 行 = 源.split('\n');
    for (let 位 = 0; 位 < 行.length; 位 += 1) {
      if (!/错误码:\s*错误码\./.test(行[位])) {
        continue;
      }
      const 键集 = [...行[位].matchAll(/错误码\.([^\s,}]+)/g)].map((取值) => 取值[1]);
      let 表达式 = /提示:\s*/.test(行[位]) ? 取表达式(行[位], 行[位].indexOf('提示:') + 3) : '';
      for (let 跨 = 位 + 1; 跨 < Math.min(位 + 4, 行.length) && 表达式 === ''; 跨 += 1) {
        if (/^\s*\}/.test(行[跨])) {
          break;
        }
        if (/提示:\s*/.test(行[跨])) {
          表达式 = 取表达式(行[跨], 行[跨].indexOf('提示:') + 3);
        }
      }
      if (表达式 === '') {
        continue;
      }
      for (const 键 of 键集) {
        记出口(出口, 文件, 键 as 错误码键, 表达式);
      }
    }
  }
  return 出口;
}

export function duiQu全部错误码(): 错误码行[] {
  const 出口 = 扫源码出口();
  return (Object.keys(错误注册表) as 错误码键[]).map((键) => {
    const 定义 = 错误注册表[键];
    const 命中 = 出口.filter((项) => 项.键 === 键);
    if (命中.length === 0) {
      throw new Error(`注册码 ${键} 在后端源码里找不到任何失败出口，文案无出处`);
    }
    const 文案列表: string[] = [];
    for (const 项 of 命中) {
      for (const 文案值 of 项.文案列表) {
        if (!文案列表.includes(文案值)) {
          文案列表.push(文案值);
        }
      }
    }
    const 分组 = 状态分组[定义.状态码];
    if (分组 === undefined) {
      throw new Error(`注册码 ${键} 的状态码 ${定义.状态码} 没有归组，拒绝猜测`);
    }
    return {
      键,
      码: 定义.code,
      状态: 定义.状态码,
      可重试: 定义.可重试,
      文案列表,
      运行时动态: 命中.some((项) => 项.运行时动态),
      分组,
    };
  });
}

function 码表(行: 错误码行[]): string[] {
  return [
    '|码|语义（HTTP）|管理员可见文案|可重试|提示形态|',
    '|---|---|---|---|---|',
    ...行.map(
      (项) =>
        `|${项.码}|${项.键}（${项.状态}）|${项.文案列表.join('／')}|${
          项.可重试 ? '是' : '否'
        }|${项.运行时动态 ? '文案真源＋运行时动态' : '文案真源'}|`,
    ),
  ];
}

export function 生成错误码文档(): string {
  const 全部 = duiQu全部错误码();
  const 行: string[] = [
    '# 恋爱吧管理中心 错误码大全',
    '',
    '## 用途与唯一真源',
    '',
    '本文面向管理员与运维，用于按 `code` 判定管理接口的失败语义、HTTP 状态与可重试口径。',
    '',
    '- 码与 HTTP 状态、可重试的唯一真源是 `管理后端/src/错误码.ts::错误注册表`；管理员可见文案的真源是 `管理后端/src/文案.ts`，由后端各失败出口按码取用，本文按出口机械解析后登记。',
    '- 本文件由 `管理后端/scripts/错误码文档.ts` 生成，禁止手改：改注册表或文案后重新生成，`管理后端/tests/单元/错误码文档.test.ts` 会断言与真源逐条一致。',
    '- 码一经发布不得改名，文案措辞可改写；前端、告警与工单一律以 `code` 为锚点，禁止解析 `message`。',
    '- 注册表未声明旧码兼容映射，管理端没有旧码转换入口；`docs/契约.md` 十五节是同一注册表的摘要视图，与本文件同源。',
    '- 接口与请求参数口径见 `docs/API文档.md` 与 `docs/契约.md`，本文不复制接口清单。',
    '',
    '## 响应包络',
    '',
    '失败响应统一由 `管理后端/src/响应.ts::失败响应` 产出，与成功响应同一 `cheng_gong` 口径。',
    '',
    '|字段|类型|说明|',
    '|---|---|---|',
    '|`cheng_gong`|boolean|失败时恒为 `false`|',
    '|`shu_ju`|null|失败时恒为 `null`|',
    '|`ti_shi`|string|兼容字段，与 `message` 同值|',
    '|`cuo_wu_ma`|string|兼容字段，与 `code` 同值|',
    '|`code`|string|稳定错误码，取自注册表|',
    '|`message`|string|管理员可见文案，取自文案真源|',
    '|`traceId`|string|追踪号，与响应头 `X-Trace-Id` 同值|',
    '|`retryable`|boolean|是否可原样重试，取自注册表|',
    '|`retryAfterMs`|number|可选，仅限频出口携带|',
    '|`fieldErrors`|object|可选，机器字段到中文提示的映射|',
    '',
    '失败响应带未注册码、状态码与注册表不一致或提示为空时，服务端直接抛错而不是产出包络；因此本文件与注册表必须同批修改。',
    '',
    '## traceId 与重试规则',
    '',
    '追踪号由 `管理后端/src/应用.ts` 与 `管理后端/src/日志.ts` 统一产出：',
    '',
    '- 请求头 `X-Request-Id`、`X-Trace-Id`、`traceparent` 依次尝试，合法时沿用；合法性为 1 至 64 个字符且全落在 `[A-Za-z0-9._:-]`。',
    '- 三个头都缺失或非法时生成 `nei-sheng-` 前缀的编号；同一值写入响应头 `X-Request-Id`、`X-Trace-Id` 与失败包络 `traceId`。',
    '- 管理员报障只需给出 `traceId`；运维凭此在脱敏日志中定位同一次请求，日志已递归移除密码、Cookie、令牌与 API key。',
    '',
    '重试口径：',
    '',
    '- `retryable=false` 不得原样重试：先修正入参、重新登录或补齐审批单编号。',
    '- `retryable=true` 可原样重试；限频码必须按 `retryAfterMs` 等待后再发，退避以服务端返回值为准。',
    '- 409 冲突码可重试，但必须先刷新对象状态再由管理员决定是否重新提交，禁止盲目连点。',
    '- 服务端不代管理员重试；写操作重试前须确认上一次是否已落库与是否已写审计。',
    '',
    '## 分类码表',
    '',
    '分类只用于检索与分派，按注册表的状态码归组，不改变任何运行时行为。',
    '',
  ];
  for (const 分组 of 分组顺序) {
    行.push(`### ${分组}`, '', ...码表(全部.filter((项) => 项.分组 === 分组)), '');
  }
  行.push(
    '标记为运行时动态的码，其 `message` 由 `管理后端/src/校验.ts` 的校验异常按字段显示名拼装后透传；字段显示名单源为 `管理后端/src/文案.ts::字段显示名`，本文只登记文案基句。',
    '',
    '## 运维处置原则',
    '',
    '- 先看 `code` 再看 `message`：`message` 是管理员可见文案，随时可能改写，不能作为归类依据。',
    '- 排查入口是 `traceId`：凭它取同一请求的脱敏日志，日志里的内部原因不外发、不写入本文。',
    '- 401 与 403 分工不同：401 是凭证缺失或失效，重新登录即可；403 是无管理身份或来源被拒，重登无用，须改授权或改入口。',
    '- 503 段（数据表未就绪／依赖未就绪／缓存服务不可用）不是成功：关系尚未迁移或依赖未存活时必须返回失败包络，前端按可重试提示原样重试，不得当成空列表让管理员误判为没有数据。',
    '- 500 段的模式缺陷与查询失败对外只给同一句通用文案，真实原因只在脱敏日志；先按日志定位迁移或连接，再决定是否放行。',
    '- 限频码必须按 `retryAfterMs` 等待，管理端禁止绕过限频批量重试。',
    '- 冲突码重试前必须刷新对象状态；写操作重试前确认上一次是否已落库与已写审计。',
    '',
    '## 生成与校验',
    '',
    '```bash',
    'npx ts-node scripts/错误码文档.ts',
    '```',
    '',
    '校验随 `npm test` 执行：重新生成结果须与本文件逐字一致；每个注册码恰好一行且状态与可重试标志与注册表一致；无重复、遗漏与未注册码；与 `docs/契约.md` 十五节码表的码集合、状态与可重试逐条一致；文件为 UTF-8 无 BOM 且不含敏感样例。',
    '',
  );
  return 行.join('\n');
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  mkdirSync(path.dirname(错误码文档路径), { recursive: true });
  writeFileSync(错误码文档路径, 生成错误码文档(), 'utf8');
  process.stdout.write(`已生成 ${错误码文档路径}\n`);
}
