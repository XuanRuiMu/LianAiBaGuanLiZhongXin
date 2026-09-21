<script setup lang="ts">
import { computed } from 'vue';
import { 消息条类名 } from '../配置';
import { 通用文案 } from '../文案/通用';

const props = withDefaults(
  defineProps<{
    xingTai: 'jia-zai' | 'cuo-wu' | 'cheng-gong' | 'kong';
    wenBen?: string;
    cuoWuMa?: string;
    xianShi?: boolean;
    ceShiBiaoShi?: string | null;
  }>(),
  { wenBen: '', cuoWuMa: '', xianShi: true, ceShiBiaoShi: null },
);

const 类名 = computed(() => 消息条类名[props.xingTai]);

const 文本 = computed(() => {
  const 码 = props.xingTai === 'cuo-wu' && props.cuoWuMa.length > 0 ? `（${props.cuoWuMa}）` : '';
  if (props.wenBen.length > 0) {
    return `${props.wenBen}${码}`;
  }
  return props.xingTai === 'jia-zai' ? 通用文案.加载中 : 通用文案.暂无数据;
});

const 出现 = computed(() => {
  if (!props.xianShi) {
    return false;
  }
  return props.xingTai === 'jia-zai' || props.xingTai === 'kong' || props.wenBen.length > 0;
});
</script>

<template>
  <p
    v-if="出现"
    :class="类名"
    :data-testid="ceShiBiaoShi"
    :role="xingTai === 'cuo-wu' ? 'alert' : 'status'"
    aria-live="polite"
  >
    {{ 文本 }}
  </p>
</template>
