import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const 工程根 = path.dirname(url.fileURLToPath(import.meta.url));

function 读源(相对路径) {
  return fs.readFileSync(path.join(工程根, 相对路径), 'utf8');
}

const 词典目录 = 'src/文案';
const 词典文件 = fs
  .readdirSync(path.join(工程根, 词典目录))
  .filter((名) => 名.endsWith('.ts'))
  .sort();
const 聚合文件 = `${词典目录}/聚合.ts`;
if (!词典文件.includes('聚合.ts')) {
  throw new Error('src/文案 缺 聚合.ts，词典坐标白名单无从实读，护栏拒绝静默通过');
}

const 词典坐标 = new Set([
  ...[...读源(聚合文件).matchAll(/^ {2}([^\s:'"]+): /gm)].map((匹配) => 匹配[1]),
  ...词典文件
    .filter((名) => 名 !== '聚合.ts')
    .flatMap((名) => [...读源(`${词典目录}/${名}`).matchAll(/^ {2}([^\s:'"]+):/gm)].map((匹配) => 匹配[1])),
  ...[...读源('src/列定义.ts').matchAll(/^ {2}([^\s:'"]+): \[/gm)].map((匹配) => 匹配[1]),
]);

const 数据键 = new Set([
  ...[...读源('src/列定义.ts').matchAll(/^ {4,}[^\s:(]+\(\s*'([^']+)'/gm)].map((匹配) => 匹配[1]),
  ...[...读源('src/列定义.ts').matchAll(/^ {4}[^\s:'"]+: '[^']+',/gm)].map((匹配) => 匹配[1]),
]);

const 族名单源 = /export type 徽标族 =([\s\S]*?);/.exec(读源('src/枚举映射.ts'))?.[1] ?? '';
for (const 匹配 of 族名单源.matchAll(/'([^']+)'/g)) {
  词典坐标.add(匹配[1]);
}

const 汉字 = /[一-鿿]/;

const 全局样式 = (() => {
  try {
    return new Set([...读源('src/主题.css').matchAll(/\.([A-Za-z0-9_\u4e00-\u9fa5-]+)/g)].map((匹配) => 匹配[1]));
  } catch {
    return new Set();
  }
})();

function 局部样式钩子(源文本) {
  const 块 = /<style[\s\S]*?<\/style>/.exec(源文本)?.[0] ?? '';
  return new Set([...块.matchAll(/\.([A-Za-z0-9_\u4e00-\u9fa5-]+)/g)].map((匹配) => 匹配[1]));
}

const 钩子属性名 = new Set(['class', 'className', 'id']);

function 钩子未声明(值, 局部) {
  return 值
    .trim()
    .split(/\s+/)
    .filter((词) => 词.length > 0 && 汉字.test(词))
    .some((词) => !全局样式.has(词) && !局部.has(词));
}

const 文案属性 = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'summary', 'content', 'value']);

const 内部码属性 = new Set(['class', 'className', '图标名', '需能力', '测试标识', '插槽', '路径']);

const 模板码位属性 = new Set([...内部码属性, 'ming-cheng', 'mingCheng', 'data-testid', 'style']);

const 键位属性名 = new Set(['键', '文案键', '表', '表名', '数据键', '页签']);

const 键位实参下标 = new Map([
  ['取文案', [0, 1]],
  ['取列', [0, 1]],
  ['取列映射', [0]],
  ['建列', [0, 1]],
  ['文本列', [0, 1]],
  ['编号列', [0, 1]],
  ['时间列', [0, 1]],
  ['地址列', [0, 1]],
  ['数字列', [0, 1]],
  ['枚举列', [0, 1]],
  ['徽标列', [0, 1]],
  ['链接列', [0, 1]],
  ['插槽列', [0]],
]);

const 取列助手 = new Set(['取分数', '取数值', '单元格文本', '单元格原值', '单元格色调', '命名值文本', '行快照文本', '取列']);

function 祖先链(节点) {
  const 链 = [];
  let 当前 = 节点.parent;
  while (当前 !== undefined && 当前 !== null) {
    链.push(当前);
    当前 = 当前.parent;
  }
  return 链;
}

function 是否模块路径(节点) {
  const 父 = 节点.parent;
  if (父 === undefined || 父 === null) {
    return false;
  }
  if (父.type === 'ImportDeclaration' || 父.type === 'ExportNamedDeclaration' || 父.type === 'ExportAllDeclaration') {
    return 父.source === 节点;
  }
  if (父.type === 'ImportExpression') {
    return true;
  }
  if (父.type === 'CallExpression' && 父.callee.type === 'Identifier') {
    return (父.callee.name === 'require' || 父.callee.name === 'import') && 父.arguments.includes(节点);
  }
  return false;
}

function 模板属性实名(节点) {
  const 键 = 节点.key;
  if (键 === undefined || 键 === null) {
    return '';
  }
  if (键.type === 'VDirectiveKey') {
    const 指令 = typeof 键.name?.name === 'string' ? 键.name.name : '';
    const 实参 = typeof 键.argument?.name === 'string' ? 键.argument.name : '';
    if ((指令 === ':' || 指令 === 'bind' || 指令 === 'v-bind') && 实参.length > 0) {
      return 实参;
    }
    return 指令;
  }
  return typeof 键.name === 'string' ? 键.name : '';
}

function 是否在非可见位(节点) {
  if (是否模块路径(节点)) {
    return true;
  }
  for (const 祖先 of 祖先链(节点)) {
    if (祖先.type === 'TSLiteralType') {
      return true;
    }
    if (祖先.type === 'VAttribute') {
      const 名 = 模板属性实名(祖先);
      if (模板码位属性.has(名) || 名.startsWith('data-')) {
        return true;
      }
      continue;
    }
    if (祖先.type === 'Property' && 祖先.key.type === 'Identifier' && 内部码属性.has(祖先.key.name)) {
      return true;
    }
    if (祖先.type === 'CallExpression' && 祖先.callee?.name === '记原始错误') {
      return true;
    }
  }
  return false;
}

function 键位属性名of(节点) {
  const 键 = 节点.key;
  if (键 === undefined || 键 === null) {
    return '';
  }
  if (键.type === 'Identifier') {
    return 键.name;
  }
  if (键.type === 'Literal' && typeof 键.value === 'string') {
    return 键.value;
  }
  return '';
}

function 助手键位(调用, 节点) {
  const 允许 = 键位实参下标.get(调用.callee.name);
  return 允许 !== undefined && 允许.includes(调用.arguments.indexOf(节点));
}

function 是否在键位(节点) {
  const 父 = 节点.parent;
  if (父 === undefined || 父 === null) {
    return false;
  }
  if (父.type === 'Property') {
    if (父.key === 节点) {
      return true;
    }
    return 父.value === 节点 && 键位属性名.has(键位属性名of(父));
  }
  if (父.type === 'MemberExpression') {
    return 父.computed === true && 父.property === 节点;
  }
  if (父.type === 'CallExpression' && 父.callee !== undefined && 父.callee.type === 'Identifier') {
    return 助手键位(父, 节点);
  }
  if (父.type === 'ArrayExpression') {
    const 爷 = 父.parent;
    if (爷 === undefined || 爷 === null) {
      return false;
    }
    if (爷.type === 'CallExpression' && 爷.callee !== undefined && 爷.callee.type === 'Identifier') {
      return 助手键位(爷, 父);
    }
    return 爷.type === 'Property' && 键位属性名.has(键位属性名of(爷));
  }
  return false;
}

function 遍历子树(根, 访问) {
  const 栈 = [根];
  while (栈.length > 0) {
    const 当前 = 栈.pop();
    if (当前 === null || 当前 === undefined || typeof 当前 !== 'object') {
      continue;
    }
    if (Array.isArray(当前)) {
      栈.push(...当前);
      continue;
    }
    if (typeof 当前.type === 'string') {
      访问(当前);
    }
    for (const 键 of Object.keys(当前)) {
      if (键 === 'parent' || 键 === 'range' || 键 === 'loc' || 键 === 'start' || 键 === 'end') {
        continue;
      }
      const 子 = 当前[键];
      if (子 && typeof 子 === 'object') {
        栈.push(子);
      }
    }
  }
}

function 模板根(上下文) {
  const 根 = 上下文.sourceCode.ast.templateBody ?? 上下文.sourceCode.ast.template;
  return 根 === undefined || 根 === null ? [] : [根];
}

export const 单源守卫插件 = {
  rules: {
    'no-visible-cn-literal': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          可见中文:
            '用户可见中文字面量「{{值}}」不得写在视图/组件/入口里，必须进 src/文案/<域>.ts 并以 域文案.键 成员访问引用。豁免判据只有两条：它处在键位（分类文案.<键> 的成员名、列构造/登记调用的键位实参、取文案(分类,键) 的两个字面参数、对象键位）且字面量等于已登记的词典坐标，或它处在模块路径、类型标注、CSS 类名等非可见文本位',
        },
      },
      create(上下文) {
        const 局部 = 局部样式钩子(上下文.sourceCode.getText());
        function 查字面量(节点) {
          if (typeof 节点.value !== 'string' || !汉字.test(节点.value)) {
            return;
          }
          if (是否在非可见位(节点) || (是否在键位(节点) && 词典坐标.has(节点.value))) {
            return;
          }
          上下文.report({ node: 节点, messageId: '可见中文', data: { 值: 节点.value.trim() } });
        }
        for (const 模板 of 模板根(上下文)) {
          遍历子树(模板, (节点) => {
            if (节点.type === 'VText' && typeof 节点.value === 'string' && 汉字.test(节点.value)) {
              上下文.report({ node: 节点, messageId: '可见中文', data: { 值: 节点.value.trim() } });
            }
            if (节点.type === 'VAttribute' && 节点.value !== null && 节点.value !== undefined && 节点.value.type === 'VLiteral') {
              const 静态值 = 节点.value.value;
              const 实名 = 模板属性实名(节点);
              if (!汉字.test(静态值) || 实名.startsWith('data-') || 模板码位属性.has(实名) && !钩子属性名.has(实名)) {
                return;
              }
              if (文案属性.has(实名) || 词典坐标.has(静态值.trim()) || (钩子属性名.has(实名) && 钩子未声明(静态值, 局部))) {
                上下文.report({ node: 节点.value, messageId: '可见中文', data: { 值: 静态值.trim() } });
              }
            }
            if (节点.type === 'Literal') {
              查字面量(节点);
            }
          });
        }
        return {
          Literal: 查字面量,
        };
      },
    },
    'no-data-key-literal': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          数据键:
            '后端数据键字面量「{{值}}」不得自写在视图/组件里，必须经 src/列定义.ts 导出取值（取列映射(表).键、单元格原值(列, 行) 或 响应键表）',
        },
      },
      create(上下文) {
        function 查键(节点) {
          if (节点 === null || 节点 === undefined || 节点.type !== 'Literal') {
            return;
          }
          if (typeof 节点.value !== 'string' || !数据键.has(节点.value)) {
            return;
          }
          if (祖先链(节点).some((祖先) => 祖先.type === 'TSLiteralType')) {
            return;
          }
          上下文.report({ node: 节点, messageId: '数据键', data: { 值: 节点.value } });
        }
        function 查表达式(根) {
          遍历子树(根, (节点) => {
            if (节点.type === 'MemberExpression' && 节点.computed) {
              查键(节点.property);
            } else if (节点.type === 'CallExpression' && 节点.callee.type === 'Identifier' && 取列助手.has(节点.callee.name)) {
              查键(节点.arguments[节点.arguments.length - 1]);
            }
          });
        }
        for (const 模板 of 模板根(上下文)) {
          遍历子树(模板, (节点) => {
            if (节点.type === 'VExpressionContainer' && 节点.expression && typeof 节点.expression.type === 'string') {
              查表达式(节点.expression);
            }
          });
        }
        return {
          MemberExpression(节点) {
            if (节点.computed) {
              查键(节点.property);
            }
          },
          CallExpression(节点) {
            if (节点.callee.type === 'Identifier' && 取列助手.has(节点.callee.name)) {
              查键(节点.arguments[节点.arguments.length - 1]);
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: [
      'src/App.vue',
      'src/main.ts',
      'src/router/**/*.ts',
      'src/stores/**/*.ts',
      'src/api/**/*.ts',
      'src/views/**/*.vue',
      'src/components/**/*.vue',
    ],
    plugins: { local: 单源守卫插件 },
    rules: {
      'local/no-visible-cn-literal': 'error',
      'local/no-data-key-literal': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
);

export { 词典坐标, 数据键 };
