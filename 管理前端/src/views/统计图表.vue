<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { 注册统计, 消息统计, 好感度统计, 留存统计, 用量统计, type 表格行 } from '../api/管理';
import { 统计默认天数 } from '../配置';
import { 取文案 } from '../文案';
import YeMei from '../components/YeMei.vue';
import TuBiao from '../components/TuBiao.vue';

const 图宽 = 640;
const 图高 = 220;
const 图左 = 46;
const 图下 = 32;
const 图上 = 16;
const 图底 = 图高 - 图下;

const 天数 = ref(统计默认天数);
const 注册行 = ref<表格行[]>([]);
const 消息行 = ref<表格行[]>([]);
const 好感度 = ref<表格行 | null>(null);
const 留存行 = ref<表格行[]>([]);
const 用量行 = ref<表格行[]>([]);
const 注册总数 = ref<number | null>(null);
const 加载中 = ref(false);
const 错误提示 = ref('');

function 取数值(行: 表格行, 键: string): number {
  const 值 = Number(行[键] ?? 0);
  return Number.isFinite(值) ? 值 : 0;
}

function 取文本(行: 表格行, 键: string): string {
  const 值 = 行[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  return String(值);
}

function 取分数(行: 表格行, 键: string): string {
  const 值 = 行[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  const 数 = Number(值);
  if (!Number.isFinite(数)) {
    return String(值);
  }
  return Number.isInteger(数) ? String(数) : String(Math.round(数 * 100) / 100);
}

function 标签步长(总数: number): number {
  return Math.max(1, Math.ceil(总数 / 6));
}

function 日期短标(行: 表格行, 序号: number, 总数: number): string {
  if (序号 % 标签步长(总数) !== 0) {
    return '';
  }
  const 原 = 取文本(行, '日期');
  if (原 === 取文案('通用', '暂无数据')) {
    return `#${序号 + 1}`;
  }
  return 原.length > 10 ? 原.slice(5, 10) : 原;
}

function 横坐标(序号: number, 总: number): number {
  if (总 <= 1) {
    return 图左 + (图宽 - 图左 - 14) / 2;
  }
  return 图左 + ((图宽 - 图左 - 14) * 序号) / (总 - 1);
}

function 纵坐标(值: number, 最大: number): number {
  const 有效 = 最大 > 0 ? 最大 : 1;
  return 图上 + ((图底 - 图上) * (1 - 值 / 有效));
}

function 折线(值列: number[]): string {
  return 值列
    .map((值, 序号) => `${横坐标(序号, 值列.length).toFixed(1)},${纵坐标(值, Math.max(...值列, 1)).toFixed(1)}`)
    .join(' ');
}

function 面积(值列: number[]): string {
  const 最大 = Math.max(...值列, 1);
  const 线 = 值列
    .map((值, 序号) => `L${横坐标(序号, 值列.length).toFixed(1)} ${纵坐标(值, 最大).toFixed(1)}`)
    .join(' ');
  const 首横 = 横坐标(0, 值列.length).toFixed(1);
  const 尾横 = 横坐标(值列.length - 1, 值列.length).toFixed(1);
  return `M${首横} ${图底} ${线} L${尾横} ${图底} Z`;
}

const 注册值列 = computed(() => 注册行.value.map((行) => 取数值(行, '数量')));

const 消息按日 = computed(() => {
  const 表 = new Map<string, number>();
  for (const 行 of 消息行.value) {
    const 键 = 取文本(行, '日期');
    表.set(键, (表.get(键) ?? 0) + 取数值(行, '数量'));
  }
  return [...表.entries()];
});

const 消息值列 = computed(() => 消息按日.value.map(([, 值]) => 值));

const 注册峰值 = computed(() => Math.max(...注册值列.value, 1));

const 好感分阶段 = computed(() => {
  const 原始 = 好感度.value?.['an_jie_duan'];
  return Array.isArray(原始) ? (原始 as 表格行[]) : [];
});

const 好感总览 = computed(() => {
  const 原始 = 好感度.value?.['zong_lan'];
  if (typeof 原始 === 'object' && 原始 !== null) {
    return 原始 as 表格行;
  }
  return null;
});

const 阶段峰值 = computed(() => {
  let 最大 = 1;
  for (const 行 of 好感分阶段.value) {
    const 数值 = 取数值(行, '数量');
    if (数值 > 最大) {
      最大 = 数值;
    }
  }
  return 最大;
});

function 阶段条宽(行: 表格行): number {
  return Math.round((取数值(行, '数量') / 阶段峰值.value) * 100);
}

async function 查询(): Promise<void> {
  const 天 = Number(天数.value);
  if (!Number.isInteger(天) || 天 <= 0 || 天 > 90) {
    错误提示.value = 取文案('通用', '请求失败');
    return;
  }
  加载中.value = true;
  错误提示.value = '';
  try {
    const [注册包, 消息包, 好感, 留存包, 用量包] = await Promise.all([
      注册统计(天),
      消息统计(天),
      好感度统计(),
      留存统计(天),
      用量统计(),
    ]);
    注册行.value = Array.isArray(注册包['lie_biao']) ? (注册包['lie_biao'] as 表格行[]) : [];
    注册总数.value = typeof 注册包['zong_shu'] === 'number' ? (注册包['zong_shu'] as number) : null;
    消息行.value = Array.isArray(消息包['lie_biao']) ? (消息包['lie_biao'] as 表格行[]) : [];
    好感度.value = 好感;
    留存行.value = Array.isArray(留存包['lie_biao']) ? (留存包['lie_biao'] as 表格行[]) : [];
    用量行.value = Array.isArray(用量包['lie_biao']) ? (用量包['lie_biao'] as 表格行[]) : [];
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  } finally {
    加载中.value = false;
  }
}

onMounted(() => {
  void 查询();
});
</script>

<template>
  <section>
    <YeMei
      xu-hao="陆 · 观象"
      :biao-ti="取文案('统计', '标题')"
    />
    <div class="账簿">
      <label class="字段">
        {{ 取文案('统计', '天数标签') }}
        <input
          v-model.number="天数"
          class="输入"
          type="number"
          min="1"
          max="90"
        >
      </label>
      <button
        type="button"
        class="按钮主"
        @click="查询"
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
    <h3 class="图题">
      {{ 取文案('统计', '注册趋势') }}
    </h3>
    <p
      v-if="注册行.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <div
      v-else
      class="图框"
    >
      <svg
        :viewBox="`0 0 ${图宽} ${图高}`"
        role="img"
        :aria-label="取文案('统计', '注册趋势')"
      >
        <line
          :x1="图左"
          :y1="图底"
          :x2="图宽 - 10"
          :y2="图底"
          stroke="var(--线)"
          stroke-width="1.5"
        />
        <text
          :x="图左 - 6"
          :y="图上 + 4"
          text-anchor="end"
          font-size="11"
          fill="var(--淡墨)"
        >
          {{ 注册峰值 }}
        </text>
        <path
          :d="面积(注册值列)"
          fill="var(--印)"
          opacity="0.14"
        />
        <polyline
          :points="折线(注册值列)"
          fill="none"
          stroke="var(--印)"
          stroke-width="2.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          pathLength="1"
          class="描线"
        />
        <g
          v-for="(行, 序号) in 注册行"
          :key="序号"
        >
          <circle
            :cx="横坐标(序号, 注册行.length)"
            :cy="纵坐标(取数值(行, '数量'), 注册峰值)"
            r="4"
            fill="var(--面)"
            stroke="var(--印)"
            stroke-width="2.5"
            class="图点"
            :style="{ '--位': Math.min(序号, 7) }"
          />
          <text
            :x="横坐标(序号, 注册行.length)"
            :y="图底 + 18"
            text-anchor="middle"
            font-size="11"
            fill="var(--淡墨)"
          >
            {{ 日期短标(行, 序号, 注册行.length) }}
          </text>
        </g>
      </svg>
    </div>
    <h3 class="图题">
      {{ 取文案('统计', '消息趋势') }}
    </h3>
    <p
      v-if="消息行.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <div v-else>
      <div class="图框">
        <svg
          :viewBox="`0 0 ${图宽} ${图高}`"
          role="img"
          :aria-label="取文案('统计', '消息趋势')"
        >
          <line
            :x1="图左"
            :y1="图底"
            :x2="图宽 - 10"
            :y2="图底"
            stroke="var(--线)"
            stroke-width="1.5"
          />
          <path
            :d="面积(消息值列)"
            fill="var(--黛)"
            opacity="0.16"
          />
          <polyline
            :points="折线(消息值列)"
            fill="none"
            stroke="var(--黛)"
            stroke-width="2.5"
            stroke-linejoin="round"
            stroke-linecap="round"
            pathLength="1"
            class="描线"
          />
          <g
            v-for="([日期, 值], 序号) in 消息按日"
            :key="日期"
          >
            <circle
              :cx="横坐标(序号, 消息按日.length)"
              :cy="纵坐标(值, Math.max(...消息值列, 1))"
              r="4"
              fill="var(--面)"
              stroke="var(--黛)"
              stroke-width="2.5"
              class="图点"
              :style="{ '--位': Math.min(序号, 7) }"
            >
              <title>{{ 日期 }}：{{ 值 }}</title>
            </circle>
            <text
              :x="横坐标(序号, 消息按日.length)"
              :y="图底 + 18"
              text-anchor="middle"
              font-size="11"
              fill="var(--淡墨)"
            >
              {{ 序号 % 标签步长(消息按日.length) === 0 ? (日期.length > 10 ? 日期.slice(5, 10) : 日期) : '' }}
            </text>
          </g>
        </svg>
        <p class="图注">
          <span><i style="background: var(--黛)" />{{ 取文案('统计', '消息趋势') }}</span>
        </p>
      </div>
      <table class="账簿表">
        <thead>
          <tr>
            <th>{{ 取文案('统计', '日期列') }}</th>
            <th>{{ 取文案('统计', '发送方列') }}</th>
            <th>{{ 取文案('统计', '数量列') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(行, 序号) in 消息行"
            :key="序号"
            :style="{ '--位': Math.min(序号, 7) }"
          >
            <td>{{ 取文本(行, '日期') }}</td>
            <td>
              <span class="徽标 墨">{{ 取文本(行, '发送方') }}</span>
            </td>
            <td class="数字">
              {{ 取文本(行, '数量') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <h3 class="图题">
      {{ 取文案('统计', '好感度总览') }}
    </h3>
    <p
      v-if="好感总览 === null"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <div
      v-else
      class="统计卡组"
    >
      <div class="统计卡">
        <p class="卡名">
          {{ 取文案('统计', '总数列') }}
        </p>
        <p class="卡值">
          {{ 好感总览 === null ? 取文案('通用', '暂无数据') : 取分数(好感总览, '总数') }}
        </p>
      </div>
      <div class="统计卡 黛">
        <p class="卡名">
          {{ 取文案('统计', '平均分列') }}
        </p>
        <p class="卡值">
          {{ 好感总览 === null ? 取文案('通用', '暂无数据') : 取分数(好感总览, '平均分') }}
        </p>
      </div>
      <div class="统计卡 安">
        <p class="卡名">
          {{ 取文案('统计', '最高分列') }}
        </p>
        <p class="卡值">
          {{ 好感总览 === null ? 取文案('通用', '暂无数据') : 取分数(好感总览, '最高分') }}
        </p>
      </div>
      <div class="统计卡">
        <p class="卡名">
          {{ 取文案('统计', '最低分列') }}
        </p>
        <p class="卡值">
          {{ 好感总览 === null ? 取文案('通用', '暂无数据') : 取分数(好感总览, '最低分') }}
        </p>
      </div>
    </div>
    <h3 class="图题">
      {{ 取文案('统计', '好感度分阶段') }}
    </h3>
    <p
      v-if="好感分阶段.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <div
      v-else
      class="卡片 条组"
    >
      <div
        v-for="(行, 序号) in 好感分阶段"
        :key="序号"
        class="条行"
      >
        <span>{{ 取文本(行, '阶段') }}</span>
        <span class="条轨"><span
          class="条充"
          :style="{ width: `${阶段条宽(行)}%` }"
        /></span>
        <span class="条值">{{ 取文本(行, '数量') }} · {{ 取分数(行, '平均分') }}</span>
      </div>
    </div>
    <h3 class="图题">
      {{ 取文案('统计', '注册总数') }}
    </h3>
    <p class="空态">
      {{ 注册总数 === null ? 取文案('通用', '暂无数据') : 注册总数 }}
    </p>
    <h3 class="图题">
      {{ 取文案('统计', '留存趋势') }}
    </h3>
    <p
      v-if="留存行.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <table
      v-else
      class="账簿表"
    >
      <thead>
        <tr>
          <th>{{ 取文案('统计', '日期列') }}</th>
          <th>{{ 取文案('统计', '数量列') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(行, 序号) in 留存行"
          :key="序号"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <td>{{ 取文本(行, '日期') }}</td>
          <td class="数字">
            {{ 取文本(行, '数量') }}
          </td>
        </tr>
      </tbody>
    </table>
    <h3 class="图题">
      {{ 取文案('统计', '用量趋势') }}
    </h3>
    <p
      v-if="用量行.length === 0"
      class="空态"
    >
      {{ 取文案('通用', '暂无数据') }}
    </p>
    <table
      v-else
      class="账簿表"
    >
      <thead>
        <tr>
          <th>{{ 取文案('统计', '日期列') }}</th>
          <th>{{ 取文案('统计', '模型列') }}</th>
          <th>{{ 取文案('统计', '数量列') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(行, 序号) in 用量行"
          :key="序号"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <td>{{ 取文本(行, '日期') }}</td>
          <td>{{ 取文本(行, '模型类型') }}</td>
          <td class="数字">
            {{ 取文本(行, '总数') }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.图题 {
  margin: 26px 0 12px;
  font-size: 20px;
  letter-spacing: 3px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.图题::before {
  content: '';
  width: 8px;
  height: 22px;
  background: var(--印);
  border-radius: 2px;
  flex: none;
}

.条组 {
  margin-bottom: 8px;
}
</style>
