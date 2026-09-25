const assert = require('node:assert/strict');
const { test } = require('node:test');

const { 调开放接口, 通用参数 } = require('../dist/nodes/公共');
const { 发起问答 } = require('../dist/nodes/发起问答.node');
const { 触发流程 } = require('../dist/nodes/触发流程.node');
const { 查询统计 } = require('../dist/nodes/查询统计.node');
const { 语音合成 } = require('../dist/nodes/语音合成.node');

const 有效密钥 = 'test-api-key-1234567890';

function 建上下文(参数) {
  const 值 = new Map(Object.entries(参数));
  return {
    getNodeParameter(名称) {
      assert.equal(值.has(名称), true, `缺少参数：${名称}`);
      return 值.get(名称);
    },
  };
}

function 通用参数值(额外 = {}) {
  return {
    服务地址: 'http://management-backend:3100/base',
    接口密钥: 有效密钥,
    ...额外,
  };
}

function 安装响应(t, 状态, 数据, 捕获) {
  t.mock.method(globalThis, 'fetch', async (地址, 选项) => {
    捕获.地址 = 地址;
    捕获.选项 = 选项;
    return new Response(JSON.stringify(数据), {
      status: 状态,
      headers: { 'content-type': 'application/json' },
    });
  });
}

test('短令牌在发起网络请求前被拒绝', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('不应发起请求'));
  const 上下文 = 建上下文({ 服务地址: 'http://localhost:3100', 接口密钥: 'short' });
  await assert.rejects(() => 调开放接口(上下文, '公开概览'), /令牌缺失或长度不足/);
});

test('GET 请求携带精确路径、请求头和查询参数', async (t) => {
  const 捕获 = {};
  安装响应(t, 200, { 数值: 7 }, 捕获);
  const 上下文 = 建上下文(通用参数值());
  const 结果 = await 调开放接口(上下文, '公开概览', 'GET', { 范围: '全部' });
  assert.deepEqual(结果, { 数值: 7 });
  assert.equal(捕获.地址.origin, 'http://management-backend:3100');
  assert.equal(decodeURIComponent(捕获.地址.pathname), '/api/v1/公开概览');
  assert.equal(捕获.地址.searchParams.get('范围'), '全部');
  assert.equal(捕获.选项.method, 'GET');
  assert.equal(捕获.选项.headers['X-API-Key'], 有效密钥);
  assert.equal(捕获.选项.body, undefined);
});

test('POST 请求发送 JSON 请求体', async (t) => {
  const 捕获 = {};
  安装响应(t, 200, { 编号: 'A1' }, 捕获);
  const 上下文 = 建上下文(通用参数值());
  await 调开放接口(上下文, '问答', 'POST', {}, { 问题: '状态如何' });
  assert.equal(捕获.选项.method, 'POST');
  assert.deepEqual(JSON.parse(捕获.选项.body), { 问题: '状态如何' });
});

test('非成功响应抛出状态码', async (t) => {
  const 捕获 = {};
  安装响应(t, 503, { 错误: '不可用' }, 捕获);
  const 上下文 = 建上下文(通用参数值());
  await assert.rejects(() => 调开放接口(上下文, '公开概览'), /开放接口 503/);
});

test('通用参数使用容器内管理后端地址和密码字段', () => {
  const 参数 = 通用参数();
  assert.equal(参数[0].default, 'http://management-backend:3100');
  assert.equal(参数[1].typeOptions.password, true);
});

test('触发流程拒绝非法 JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('不应发起请求'));
  const 上下文 = 建上下文(通用参数值({ 流程名称: '演示', 输入: '{' }));
  await assert.rejects(() => new 触发流程().execute.call(上下文), /输入不是合法 JSON/);
});

test('触发流程转发流程名称和解析后的输入', async (t) => {
  const 捕获 = {};
  安装响应(t, 200, { 状态: '已触发' }, 捕获);
  const 上下文 = 建上下文(通用参数值({ 流程名称: '每日运营', 输入: '{"日期":"2026-09-24"}' }));
  const 结果 = await new 触发流程().execute.call(上下文);
  assert.deepEqual(结果, [[{ json: { 状态: '已触发' } }]]);
  assert.deepEqual(JSON.parse(捕获.选项.body), {
    流程名称: '每日运营',
    输入: { 日期: '2026-09-24' },
  });
});

test('查询统计按选项调用公开趋势', async (t) => {
  const 捕获 = {};
  安装响应(t, 200, { 趋势: [] }, 捕获);
  const 上下文 = 建上下文(通用参数值({ 查询: '用户趋势' }));
  const 结果 = await new 查询统计().execute.call(上下文);
  assert.deepEqual(结果, [[{ json: { 趋势: [] } }]]);
  assert.equal(decodeURIComponent(捕获.地址.pathname), '/api/v1/公开趋势');
});

test('发起问答转发中文问题', async (t) => {
  const 捕获 = {};
  安装响应(t, 200, { 回答: '正常' }, 捕获);
  const 上下文 = 建上下文(通用参数值({ 问题: '今天运营如何' }));
  await new 发起问答().execute.call(上下文);
  assert.deepEqual(JSON.parse(捕获.选项.body), { 问题: '今天运营如何' });
});

test('语音合成转发待合成文本', async (t) => {
  const 捕获 = {};
  安装响应(t, 200, { audio_hex: 'ff' }, 捕获);
  const 上下文 = 建上下文(通用参数值({ 文本: '你好' }));
  const 结果 = await new 语音合成().execute.call(上下文);
  assert.deepEqual(结果, [[{ json: { audio_hex: 'ff' } }]]);
  assert.deepEqual(JSON.parse(捕获.选项.body), { 文本: '你好' });
});
