<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { 审计日志, 审计保留, type 表格行 } from '../api/管理';
import type { 分页信息 } from '../api/请求';
import { 默认每页条数, 默认页码 } from '../配置';
import { 取文案 } from '../文案';
import YeMei from '../components/YeMei.vue';
import FenYeTiao from '../components/FenYeTiao.vue';
import TuBiao from '../components/TuBiao.vue';

const 事件类型 = ref('');
const 用户编号 = ref('');
const 类型名 = ref('');
const 开始时间 = ref('');
const 结束时间 = ref('');
const 行列表 = ref<表格行[]>([]);
const 分页 = ref<分页信息 | undefined>(undefined);
const 保留信息 = ref<表格行 | null>(null);
const 加载中 = ref(false);
const 错误提示 = ref('');

function 显示值(行: 表格行, 键: string): string {
  const 值 = 行[键];
  if (值 === null || 值 === undefined || 值 === '') {
    return 取文案('通用', '暂无数据');
  }
  if (typeof 值 === 'object') {
    try {
      return JSON.stringify(值);
    } catch {
      return 取文案('通用', '暂无数据');
    }
  }
  return String(值);
}

async function 查询(页码: number = 默认页码): Promise<void> {
  加载中.value = true;
  错误提示.value = '';
  try {
    const 结果 = await 审计日志({
      ye_ma: 页码,
      mei_ye_tiao_shu: 默认每页条数,
      shi_jian_lei_xing: 事件类型.value.trim() === '' ? undefined : 事件类型.value.trim(),
      yong_hu_id: 用户编号.value.trim() === '' ? undefined : 用户编号.value.trim(),
      lei_xing: 类型名.value.trim() === '' ? undefined : 类型名.value.trim(),
      kai_shi_shi_jian: 开始时间.value.trim() === '' ? undefined : 开始时间.value.trim(),
      jie_shu_shi_jian: 结束时间.value.trim() === '' ? undefined : 结束时间.value.trim(),
    });
    行列表.value = 结果.行;
    分页.value = 结果.分页;
  } catch (错误) {
    错误提示.value = 错误 instanceof Error ? 错误.message : 取文案('通用', '请求失败');
  } finally {
    加载中.value = false;
  }
}

async function 查询保留(): Promise<void> {
  try {
    保留信息.value = await 审计保留();
  } catch {
    保留信息.value = null;
  }
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
  void 查询保留();
  void 查询();
});
</script>

<template>
  <section>
    <YeMei
      xu-hao="伍 · 起居"
      :biao-ti="取文案('审计', '标题')"
    />
    <div class="账簿">
      <label class="字段">
        {{ 取文案('审计', '事件类型占位') }}
        <input
          v-model="事件类型"
          class="输入"
          :placeholder="取文案('审计', '事件类型占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审计', '用户占位') }}
        <input
          v-model="用户编号"
          class="输入"
          :placeholder="取文案('审计', '用户占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审计', '类型占位') }}
        <input
          v-model="类型名"
          class="输入"
          :placeholder="取文案('审计', '类型占位')"
        >
      </label>
      <label class="字段">
        {{ 取文案('审计', '开始占位') }}
        <input
          v-model="开始时间"
          class="输入"
          type="datetime-local"
        >
      </label>
      <label class="字段">
        {{ 取文案('审计', '结束占位') }}
        <input
          v-model="结束时间"
          class="输入"
          type="datetime-local"
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
      v-if="保留信息"
      class="加载条"
    >
      {{ 取文案('审计', '保留标题') }}：{{ String(保留信息['zong_shu'] ?? '') }}
    </p>
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
    <table
      v-if="行列表.length > 0"
      class="账簿表"
    >
      <thead>
        <tr>
          <th>{{ 取文案('审计', '事件类型列') }}</th>
          <th>{{ 取文案('审计', '用户列') }}</th>
          <th>{{ 取文案('审计', '地址列') }}</th>
          <th>{{ 取文案('审计', '详情列') }}</th>
          <th>{{ 取文案('审计', '类型列') }}</th>
          <th>{{ 取文案('审计', '时间列') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(行, 序号) in 行列表"
          :key="String(行['ID'] ?? '')"
          :style="{ '--位': Math.min(序号, 7) }"
        >
          <td>
            <span class="徽标 墨">{{ 显示值(行, '事件类型') }}</span>
          </td>
          <td>{{ 显示值(行, '用户ID') }}</td>
          <td class="数字">
            {{ 显示值(行, 'IP') }}
          </td>
          <td>{{ 显示值(行, '详情') }}</td>
          <td>{{ 显示值(行, '类型') }}</td>
          <td>{{ 显示值(行, '创建时间') }}</td>
        </tr>
      </tbody>
    </table>
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
