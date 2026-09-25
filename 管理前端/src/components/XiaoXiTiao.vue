<script setup lang="ts">
import { computed } from 'vue';
import { 消息条类名 } from '../配置';
import { 通用文案 } from '../文案/通用';
import { 拼错误摘要, 拼错误详情, type 错误展示 as 错误展示类型, type 请求错误状态 } from '../api/错误展示';

const props = withDefaults(
  defineProps<{
    xingTai: 'jia-zai' | 'cuo-wu' | 'cheng-gong' | 'kong';
    wenBen?: string;
    cuoWuMa?: string;
    xianShi?: boolean;
    ceShiBiaoShi?: string | null;
    错误展示?: 错误展示类型 | null;
    错误状态?: 请求错误状态 | null;
  }>(),
  { wenBen: '', cuoWuMa: '', xianShi: true, ceShiBiaoShi: null, 错误展示: null, 错误状态: null },
);

const emit = defineEmits<{ 重试: [] }>();
const 错误 = computed(() => props.xingTai === 'cuo-wu'
  ? props.错误状态?.当前错误.value ?? props.错误展示
  : null);
const 字段 = computed(() => Object.values(错误.value?.字段错误 ?? {}).join('；'));
const 错误摘要 = computed(() => 错误.value === null ? '' : 拼错误摘要(错误.value));
const 错误详情 = computed(() => 错误.value === null ? '' : 拼错误详情(错误.value));
const 字段文本 = computed(() => 字段.value.length === 0 ? '' : `${通用文案.字段问题}：${字段.value}`);
const 可重试 = computed(() => 错误.value?.可重试 === true);
const 等待毫秒 = computed(() => props.错误状态?.等待剩余毫秒.value ?? 0);
const 重试中 = computed(() => props.错误状态?.重试中.value === true);
const 等待秒 = computed(() => Math.ceil(等待毫秒.value / 1000));
const 重试文本 = computed(() => {
  if (!可重试.value) {
    return '';
  }
  if (等待毫秒.value > 0) {
    return 通用文案.等待后重试.replace(/\{[^}]+\}/, String(等待秒.value));
  }
  return 通用文案.重试当前操作;
});
const 文本 = computed(() => {
  if (props.wenBen.length > 0) {
    return props.wenBen;
  }
  return props.xingTai === 'jia-zai' ? 通用文案.加载中 : 通用文案.暂无数据;
});
const 出现 = computed(() => props.xianShi && (
  错误.value !== null
    || props.xingTai === 'jia-zai'
    || props.xingTai === 'kong'
    || props.wenBen.length > 0
));
const 重试事件 = 通用文案.重试当前操作.slice(0, 2) as '重试';

function 触发重试(): void {
  if (props.错误状态 !== null) {
    props.错误状态.重试();
    return;
  }
  emit(重试事件);
}
</script>

<template>
  <Transition name="条">
    <div
      v-if="出现"
      :class="[消息条类名[xingTai]]"
      :data-testid="ceShiBiaoShi"
      :role="xingTai === 'cuo-wu' ? 'alert' : 'status'"
      aria-live="polite"
    >
      <span data-testid="cuo-wu-zhan-yao">{{ 错误摘要 }}</span>
      <details
        :class="错误 === null ? '' : '错误详情'"
        data-testid="cuo-wu-zhen-dui"
        :hidden="错误 === null"
        :aria-hidden="错误 === null"
      >
        <summary>{{ 错误 === null ? '' : 通用文案.详情 }}</summary>
        <span>{{ 错误详情 }}</span>
      </details>
      <span>{{ 字段文本 }}</span>
      <button
        type="button"
        :class="可重试 ? 'error-retry 按钮次' : 'error-retry'"
        data-testid="cuo-wu-chong-shi"
        :hidden="!可重试"
        :aria-hidden="!可重试"
        :disabled="!可重试 || 等待毫秒 > 0 || 重试中"
        @click="触发重试"
      >
        {{ 重试文本 }}
      </button>
      <span>{{ 文本 }}</span>
    </div>
  </Transition>
</template>
