<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  记忆列表,
  对话摘要列表,
  关键事件列表,
  夺舍日志列表,
  评估列表,
  思考记录列表,
  思考记录详情,
  思考说明,
  type 表格行,
  type 思考说明 as 思考说明类型,
} from '../api/管理';
import type { 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 取文案 } from '../文案';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import TuBiao from '../components/TuBiao.vue';

type 标签页 = 'si-kao-ji-lu' | 'ji-yi' | 'dui-hua-zhai-yao' | 'guan-jian-shi-jian' | 'duo-she-ri-zhi' | 'ping-gu';

type 标签键 = '思考记录标签' | '记忆标签' | '对话摘要标签' | '关键事件标签' | '夺舍日志标签' | '评估标签';

const 标签列: Array<{ 值: 标签页; 键: 标签键 }> = [
  { 值: 'si-kao-ji-lu', 键: '思考记录标签' },
  { 值: 'ji-yi', 键: '记忆标签' },
  { 值: 'dui-hua-zhai-yao', 键: '对话摘要标签' },
  { 值: 'guan-jian-shi-jian', 键: '关键事件标签' },
  { 值: 'duo-she-ri-zhi', 键: '夺舍日志标签' },
  { 值: 'ping-gu', 键: '评估标签' },
];

const 当前标签 = ref<标签页>('si-kao-ji-lu');
const 用户编号 = ref('');
const 角色编号 = ref('');
const 管理员编号 = ref('');
const 事件筛选 = ref('');
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 说明 = ref<思考说明类型 | null>(null);
const 加载中 = ref(false);
const 错误提示 = ref('');

function 显示值(行: 表格行, 键: string): string {
  const 值 = 行[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  return String(值);
}

function 行快照(行: 表格行): string {
  try {
    return JSON.stringify(行, null, 2);
  } catch {
    return 取文案('通用', '暂无数据');
  }
}

function 可选文本(原始: string): string | undefined {
  const 修剪 = 原始.trim();
  return 修剪 === '' ? undefined : 修剪;
}

function 当前查询参数(): { yong_hu_id?: string; jiao_se_id?: string; guan_li_yuan_id?: string; shi_jian?: string } {
  return {
    yong_hu_id: 可选文本(用户编号.value),
    jiao_se_id: 可选文本(角色编号.value),
    guan_li_yuan_id: 可选文本(管理员编号.value),
    shi_jian: 可选文本(事件筛选.value),
  };
}

async function 展开思考记录(记录编号: unknown): Promise<void> {
  if (typeof 记录编号 !== 'string' || 记录编号.length === 0) {
    return;
  }
  try {
    const 详情 = await 思考记录详情(记录编号);
    const 目标 = 行列表.value.find((行) => String(行['ID'] ?? '') === 记录编号);
    if (目标) {
      目标['内容'] = 详情['内容'];
    }
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  }
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
  try {
    const 基础 = {
      ye_ma: 页码,
      mei_ye_tiao_shu: 默认每页条数,
      ...当前查询参数(),
    };
    if (当前标签.value === 'si-kao-ji-lu') {
      const 结果 = await 思考记录列表({ ye_ma: 基础.ye_ma, mei_ye_tiao_shu: 基础.mei_ye_tiao_shu, yong_hu_id: 基础.yong_hu_id, jiao_se_id: 基础.jiao_se_id, shi_jian: 基础.shi_jian });
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    } else if (当前标签.value === 'ji-yi') {
      const 结果 = await 记忆列表(基础);
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    } else if (当前标签.value === 'dui-hua-zhai-yao') {
      const 结果 = await 对话摘要列表(基础);
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    } else if (当前标签.value === 'guan-jian-shi-jian') {
      const 结果 = await 关键事件列表(基础);
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    } else if (当前标签.value === 'duo-she-ri-zhi') {
      const 结果 = await 夺舍日志列表(基础);
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    } else {
      const 结果 = await 评估列表(基础);
      行列表.value = 结果.行;
      分页.value = 结果.分页;
    }
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  } finally {
    加载中.value = false;
  }
}

async function 查询说明(): Promise<void> {
  try {
    说明.value = await 思考说明();
  } catch {
    说明.value = null;
  }
}

function 切换标签(目标: 标签页): void {
  当前标签.value = 目标;
  行列表.value = [];
  分页.value = undefined;
  void 查询();
}

function 上一页(): void {
  const 当前 = 分页.value?.ye_ma ?? 默认页码;
  if (当前 > 1) {
    void 查询(当前 - 1);
  }
}

function 下一页(): void {
  const 当前 = 分页.value?.ye_ma ?? 默认页码;
  void 查询(当前 + 1);
}

onMounted(() => {
  void 查询说明();
  void 查询();
});
</script>

<template>
  <section>
    <YeMei
      xu-hao="叁 · 心迹"
      :biao-ti="取文案('思考', '标题')"
      :shuo-ming="取文案('思考', '实时推送提示')"
    />
    <div
      class="卡片 说明卡"
      data-testid="shi-shi-shuo-ming"
    >
      <h3>{{ 取文案('思考', '实时说明标签') }}</h3>
      <p>{{ 取文案('思考', '实时推送提示') }}</p>
      <p v-if="说明">
        {{ 说明.sheng_ming }}
      </p>
      <p v-if="说明">
        {{ 说明.shi_shi_shuo_ming }}
      </p>
      <div v-if="说明 && 说明.dai_bu_chong.length > 0">
        <span class="待补题">{{ 取文案('思考', '待补充项标签') }}</span>
        <ul class="待补列">
          <li
            v-for="项 in 说明.dai_bu_chong"
            :key="项"
            data-testid="dai-bu-chong"
          >
            <span class="徽标 警">{{ 取文案('通用', '待补充') }}</span>
            {{ 项 }}（{{ 取文案('通用', '待补充') }}）
          </li>
        </ul>
      </div>
      <p
        v-else
        class="空态"
        data-testid="kong-tai-dai-bu-chong"
      >
        {{ 取文案('通用', '待补充') }}
      </p>
    </div>
    <div class="标签页">
      <button
        v-for="项 in 标签列"
        :key="项.值"
        type="button"
        :class="当前标签 === 项.值 ? '激活' : ''"
        @click="切换标签(项.值)"
      >
        {{ 取文案('思考', 项.键) }}
      </button>
    </div>
    <div class="账簿">
      <label class="字段">
        {{ 取文案('思考', '用户编号占位') }}
        <input
          v-model="用户编号"
          class="输入"
          :placeholder="取文案('思考', '用户编号占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('思考', '角色编号占位') }}
        <input
          v-model="角色编号"
          class="输入"
          :placeholder="取文案('思考', '角色编号占位')"
        >
      </label>
      <label
        v-if="当前标签 === 'duo-she-ri-zhi'"
        class="字段"
      >
        {{ 取文案('思考', '管理员编号占位') }}
        <input
          v-model="管理员编号"
          class="输入"
          :placeholder="取文案('思考', '管理员编号占位')"
        >
      </label>
      <label
        v-if="当前标签 === 'si-kao-ji-lu'"
        class="字段"
      >
        {{ 取文案('思考', '事件筛选占位') }}
        <input
          v-model="事件筛选"
          class="输入"
          :placeholder="取文案('思考', '事件筛选占位')"
        >
      </label>
      <button
        type="button"
        class="按钮主"
        @click="查询()"
      >
        <TuBiao ming-cheng="查询" />
        {{ 取文案('通用', '查询') }}
      </button>
    </div>
    <p
      v-if="加载中"
      class="加载条"
    >
      {{ 取文案('通用', '加载中') }}
    </p>
    <p
      v-if="错误提示.length > 0"
      class="错误条"
    >
      {{ 错误提示 }}
    </p>
    <p
      v-if="!加载中 && 行列表.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <ol
      v-if="行列表.length > 0"
      class="时间线"
    >
      <li
        v-for="(行, 序号) in 行列表"
        :key="序号"
        :style="{ '--位': Math.min(序号, 7) }"
      >
        <div class="节点卡">
          <div class="节点元">
            <span class="徽标 墨">{{ 取文案('思考', '序号列') }}{{ 序号 + 1 }}</span>
            <time>{{ 显示值(行, '创建时间') }}</time>
            <span
              v-if="当前标签 === 'si-kao-ji-lu'"
              class="徽标 墨"
            >{{ 显示值(行, '事件') }}</span>
          </div>
          <p v-if="当前标签 === 'si-kao-ji-lu'">
            {{ 显示值(行, '摘要') }}
          </p>
          <button
            v-if="当前标签 === 'si-kao-ji-lu'"
            type="button"
            class="按钮次"
            @click="展开思考记录(行['ID'])"
          >
            {{ 取文案('通用', '详情') }}
          </button>
          <pre class="快照码">{{ 行快照(行) }}</pre>
        </div>
      </li>
    </ol>
    <FenYeTiao
      v-if="分页"
      :zong-shu="分页.zong_shu"
      :dang-qian-ye="分页.ye_ma"
      :shi-fou-shou-ye="(分页.ye_ma ?? 默认页码) <= 1"
      @shang-ye="上一页"
      @xia-ye="下一页"
    />
  </section>
</template>

<style scoped>
.说明卡 {
  border-left: 5px solid var(--印);
  margin-bottom: 18px;
}

.说明卡 h3 {
  margin: 0 0 8px;
  font-size: 17px;
  letter-spacing: 2px;
}

.说明卡 p {
  margin: 6px 0;
  font-size: 14px;
}

.待补题 {
  font-weight: 700;
  color: var(--警);
}

.待补列 {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.待补列 li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: 14px;
}

.空态 {
  margin-bottom: 0;
}
</style>
